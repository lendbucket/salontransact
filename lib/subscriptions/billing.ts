/**
 * Billing engine — charges subscription invoices via Payroc MIT
 * (Merchant-Initiated Transaction) using saved secure tokens.
 *
 * This module owns the `chargeInvoice` function called by:
 *   - billing-engine-tick cron (automated recurring charges)
 *   - dunning-engine-tick cron (retry failed charges)
 *   - /api/subscriptions/[id]/charge-now admin manual trigger
 *
 * Every charge is idempotent: the Payroc Idempotency-Key is derived
 * from invoiceId + UTC date bucket so duplicate cron fires on the
 * same day cannot double-charge.
 *
 * See docs/subscriptions-platform-design.md Section 6 for architecture.
 */

import { prisma } from "@/lib/prisma";
import { getPayrocToken, getTerminalIdForMerchant } from "@/lib/payroc/client";
import { updateSecureToken } from "@/lib/payroc/tokens";
import type { RecurringPaymentRequest } from "@/lib/payroc/types";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Builds a deterministic UUID v4-FORMATTED string from an arbitrary
 * string input. Used to derive Payroc Idempotency-Keys so duplicate
 * cron fires produce the same key and Payroc deduplicates.
 *
 * NOTE: This is NOT a true RFC 4122 v4 UUID (which is randomly
 * generated). The output has the version nibble (4) and variant
 * bits (RFC 4122) set to satisfy the format constraint, but the
 * source bytes are SHA-256 of the input. Payroc validates the
 * format, not the entropy source.
 */
export function deterministicUuid(input: string): string {
  const hash = crypto.createHash("sha256").update(input).digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

// ─────────────────────────────────────────────────────────────────
// Public interface
// ─────────────────────────────────────────────────────────────────

export interface ChargeInvoiceResult {
  success: boolean;
  payrocPaymentId?: string;
  approvalCode?: string;
  responseCode?: string;
  declineReason?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────
// chargeInvoice — the single entry point for all subscription charges
// ─────────────────────────────────────────────────────────────────

export async function chargeInvoice(invoiceId: string): Promise<ChargeInvoiceResult> {
  const cid = Math.random().toString(36).slice(2, 10);
  console.log(`[BILLING] cid=${cid} START chargeInvoice invoice=${invoiceId}`);

  try {
    // ── 1. Acquire row lock + validate state + increment attempt ──
    // All in one transaction so concurrent cron fires can't both
    // pass the guard checks and double-charge.
    const lockResult = await prisma.$transaction(async (tx) => {
      // Row lock prevents concurrent chargeInvoice calls for the
      // same invoiceId from both proceeding.
      await tx.$queryRaw`SELECT id FROM "SubscriptionInvoice" WHERE id = ${invoiceId} FOR UPDATE`;

      // Re-read invoice + relations under the lock.
      const invoice = await tx.subscriptionInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          subscription: {
            include: {
              plan: true,
              savedCard: true,
              merchant: true,
            },
          },
        },
      });

      if (!invoice) {
        return { kind: "not-found" as const };
      }

      const { subscription } = invoice;

      // Idempotency: already-paid → success
      if (invoice.status === "paid") {
        return {
          kind: "already-paid" as const,
          paymentId: invoice.paymentId ?? undefined,
        };
      }

      // Invoice status guard
      if (invoice.status !== "pending" && invoice.status !== "failed_retrying") {
        return {
          kind: "wrong-invoice-status" as const,
          status: invoice.status,
        };
      }

      // Subscription status guard
      if (
        subscription.status !== "active" &&
        subscription.status !== "trialing" &&
        subscription.status !== "past_due"
      ) {
        return {
          kind: "wrong-subscription-status" as const,
          status: subscription.status,
        };
      }

      // Saved card guard
      const { savedCard } = subscription;
      if (savedCard.status !== "active") {
        return {
          kind: "card-not-active" as const,
          savedCardId: savedCard.id,
          status: savedCard.status,
        };
      }
      if (!savedCard.payrocToken) {
        return {
          kind: "missing-token" as const,
          savedCardId: savedCard.id,
        };
      }

      // All guards passed. Increment attempt + write billed_attempt event
      // atomically under the lock.
      const updated = await tx.subscriptionInvoice.update({
        where: { id: invoiceId },
        data: {
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          eventType: "subscription.billed_attempt",
          actor: "system:billing-engine",
          payload: {
            invoiceId,
            attemptCount: updated.attemptCount,
            amountCents: invoice.totalCents,
          },
        },
      });

      return {
        kind: "proceed" as const,
        invoice,
        subscription,
        savedCard,
        attemptCount: updated.attemptCount,
      };
    });

    // ── 2. Handle non-proceed outcomes from the locked transaction ──
    if (lockResult.kind === "not-found") {
      console.error(`[BILLING] cid=${cid} invoice ${invoiceId} not found`);
      return { success: false, error: "Invoice not found" };
    }
    if (lockResult.kind === "already-paid") {
      console.log(`[BILLING] cid=${cid} invoice already paid, paymentId=${lockResult.paymentId}`);
      return { success: true, payrocPaymentId: lockResult.paymentId };
    }
    if (lockResult.kind === "wrong-invoice-status") {
      console.log(`[BILLING] cid=${cid} invoice=${invoiceId} status=${lockResult.status} — not chargeable`);
      return { success: false, error: `Invoice status is ${lockResult.status}, not chargeable` };
    }
    if (lockResult.kind === "wrong-subscription-status") {
      console.log(`[BILLING] cid=${cid} subscription status=${lockResult.status} — not billable`);
      return { success: false, error: `Subscription status is ${lockResult.status}, not billable` };
    }
    if (lockResult.kind === "card-not-active") {
      return { success: false, error: `Saved card ${lockResult.savedCardId} is ${lockResult.status}` };
    }
    if (lockResult.kind === "missing-token") {
      return { success: false, error: `Saved card ${lockResult.savedCardId} missing payment token` };
    }

    // From here on, we have invoice + subscription + savedCard from
    // the locked transaction result.
    const { invoice, subscription, savedCard, attemptCount } = lockResult;

    // ── 3. Build deterministic idempotency key (per-day) ────────
    // Key = invoiceId + UTC date. Same invoice on same UTC day → same
    // key → Payroc deduplicates. Next day → new key → legitimate
    // retry possible. attemptCount does NOT feed the key — it's only
    // an internal counter for dunning logic.
    //
    // This handles the crash-between-increment-and-Payroc-call scenario:
    // if we crash after incrementing but before charging, the retry on
    // the same day uses the same key and Payroc returns the cached
    // result (or processes once).
    const utcDate = new Date().toISOString().split("T")[0];  // "YYYY-MM-DD"
    const idempotencyKey = deterministicUuid(
      `subscription_invoice_${invoiceId}_date_${utcDate}`
    );

    // ── 4. Resolve terminal ID for this merchant ────────────────
    const terminalId = await getTerminalIdForMerchant(subscription.merchantId);

    // ── 5. Build Payroc payment payload ─────────────────────────
    // Determine sequence based on whether this subscription has ever
    // had a successful charge. First charge → sequence="first" with no
    // referenceDataOfFirstTxn. All subsequent charges → sequence="subsequent"
    // with referenceDataOfFirstTxn.paymentId pointing at the first paymentId.
    const isFirstCharge = subscription.firstPaymentId == null;
    const standingInstructions: RecurringPaymentRequest["order"]["standingInstructions"] = isFirstCharge
      ? {
          sequence: "first",
          processingModel: "recurring",
        }
      : {
          sequence: "subsequent",
          processingModel: "recurring",
          referenceDataOfFirstTxn: {
            // non-null: isFirstCharge === false implies firstPaymentId
            // was set on a prior successful charge and is immutable.
            paymentId: subscription.firstPaymentId!,
            // Include cardSchemeReferenceId when we captured it on
            // the first charge (Chris Boutwell spec 2026-05-27).
            // Omit the property entirely when null/undefined so we
            // don't send empty strings to Payroc.
            ...(subscription.firstCardSchemeReferenceId
              ? { cardSchemeReferenceId: subscription.firstCardSchemeReferenceId }
              : {}),
          },
        };

    // Determine channel from the subscription. Null defaults to "pos"
    // (in-person master-stub-merchant V1 use case). Per Chris Boutwell
    // (Payroc) 2026-05-27 PM Slack correction: channel MUST match
    // where the original auth happened. D2 will surface this as a
    // selector on subscription creation; V1 subscriptions all default
    // to pos until then.
    //
    // Runtime guard: column is freeform String? at the DB level. If a
    // bad value lands there (direct SQL, future migration, a bug in D2
    // form submission), default to "pos" rather than passing it to
    // Payroc and getting an opaque channel-error response. Tradeoff:
    // a wrong value silently becomes "pos" rather than surfacing a
    // descriptive error. Acceptable for V1 — the bad-value path
    // shouldn't exist once D2 ships proper validation, and "pos" is
    // the conservative fallback for the in-person master-stub use case.
    const rawChannel = subscription.originatingChannel;
    const channelForCharge: "pos" | "web" | "moto" =
      rawChannel === "pos" || rawChannel === "web" || rawChannel === "moto"
        ? rawChannel
        : "pos";

    const paymentPayload: RecurringPaymentRequest = {
      channel: channelForCharge,
      processingTerminalId: terminalId,
      operator: (subscription.merchant.businessName || "SalonTransact").slice(0, 50),
      order: {
        orderId: invoiceId,
        orderDate: utcDate,
        description: `Subscription: ${subscription.plan.name}`.slice(0, 100),
        amount: invoice.totalCents,
        currency: "USD",
        standingInstructions,
      },
      paymentMethod: {
        type: "secureToken",
        token: savedCard.payrocToken!,
      },
    };

    console.log(
      `[BILLING] cid=${cid} invoice=${invoiceId} attempt=${attemptCount} ` +
      `amount=${invoice.totalCents} terminal=${terminalId} idempotencyKey=${idempotencyKey} dateBucket=${utcDate}`
    );

    // ── 5.5 Promote token mitAgreement → "recurring" on first charge ──
    // Saved cards are tokenized with mitAgreement="unscheduled" by the
    // existing checkout flow (app/api/payroc/checkout/route.ts). For
    // subscription use, Payroc spec (Chris Boutwell 2026-05-27) requires
    // mitAgreement="recurring" on the underlying secureToken. We PATCH
    // the token immediately before the first charge to bring it into
    // compliance.
    //
    // Best-effort: a failure here logs but does NOT abort the charge.
    // The downstream charge will reveal whether Payroc actually rejects
    // unscheduled-token recurring MITs (their behavior on this is not
    // documented in our reference material). If it succeeds, we're fine.
    // If it fails for mitAgreement reasons, the error will be
    // informative for Friday debugging.
    //
    // Idempotent: PATCH-ing a token that's already "recurring" is a
    // no-op per docs. Safe to call on every first charge attempt.
    if (isFirstCharge && savedCard.payrocSecureTokenId) {
      try {
        await updateSecureToken(
          savedCard.payrocSecureTokenId,
          { mitAgreement: "recurring" },
          terminalId
        );
        console.log(
          `[BILLING] cid=${cid} token ${savedCard.payrocSecureTokenId.slice(0, 8)}... ` +
          `promoted to mitAgreement=recurring`
        );
      } catch (mitErr) {
        const msg = mitErr instanceof Error ? mitErr.message : String(mitErr);
        console.warn(
          `[BILLING] cid=${cid} mitAgreement promotion failed (non-fatal, proceeding ` +
          `with charge): ${msg}`
        );
      }
    }

    // ── 6. Send charge to Payroc ────────────────────────────────
    const bearerToken = await getPayrocToken();
    const apiUrl = process.env.PAYROC_API_URL;

    const payrRes = await fetch(`${apiUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
        "Idempotency-Key": idempotencyKey,
        Accept: "application/json",
      },
      body: JSON.stringify(paymentPayload),
    });

    const responseText = await payrRes.text();
    let payrocResponse: Record<string, unknown> = {};
    try {
      payrocResponse = JSON.parse(responseText);
    } catch {
      payrocResponse = { rawText: responseText };
    }

    // Parse response now to extract safe fields for logging.
    // Do NOT log responseText.substring(0, N) — that captures masked
    // card numbers and any other fields Payroc may include.
    const txnResult = payrocResponse.transactionResult as Record<string, unknown> | undefined;
    const card = payrocResponse.card as Record<string, unknown> | undefined;
    const responseCode = (txnResult?.responseCode ?? payrocResponse.responseCode ?? null) as string | null;
    const responseMessage = (txnResult?.responseMessage ?? payrocResponse.responseMessage ?? null) as string | null;
    const approvalCode = (txnResult?.approvalCode ?? payrocResponse.approvalCode ?? null) as string | null;
    const payrocPaymentId = (payrocResponse.paymentId ?? null) as string | null;
    // Probe three locations for cardSchemeReferenceId since exact
    // response shape isn't documented. Chris Boutwell's spec shows
    // it should be returned somewhere on first-charge responses;
    // first match wins. Null is fine — we only persist when non-null.
    // Each probe is typeof-guarded: if Payroc returns a non-string
    // (number, nested object, etc.) at any location, we treat it as
    // missing rather than silently casting and storing garbage in a
    // String? column.
    const pickString = (v: unknown): string | null =>
      typeof v === "string" && v.length > 0 ? v : null;
    // Track which probe location matched so Friday's empirical test
    // can lock in the canonical response shape and a future PR can
    // drop the other two probes. Logs "none" when no match — also
    // useful: tells us whether Payroc returned it at all on first
    // charges with mitAgreement=recurring tokens.
    const probeTop = pickString(payrocResponse.cardSchemeReferenceId);
    const probeCard = pickString(card?.cardSchemeReferenceId);
    const probeTxn = pickString(txnResult?.cardSchemeReferenceId);
    const cardSchemeReferenceId = probeTop ?? probeCard ?? probeTxn ?? null;
    const cardSchemeReferenceIdSource: "top" | "card" | "txnResult" | "none" =
      probeTop ? "top" : probeCard ? "card" : probeTxn ? "txnResult" : "none";

    console.log(
      `[BILLING] cid=${cid} invoice=${invoiceId} payroc status=${payrRes.status} ` +
      `paymentId=${payrocPaymentId ?? "none"} responseCode=${responseCode ?? "none"} ` +
      `approvalCode=${approvalCode ?? "none"} ` +
      `cardSchemeRefSource=${cardSchemeReferenceIdSource}`
    );

    // ── 7. Handle infrastructure errors (5xx, 401, 429) separately ──
    // These are NOT payment declines — they are transient infrastructure
    // failures and should NOT increment the failedPaymentCount counter
    // (which feeds dunning). Mark invoice failed_retrying without
    // touching the subscription's failure counter.
    if (!payrRes.ok) {
      const isTransient = payrRes.status >= 500 || payrRes.status === 401 || payrRes.status === 429;
      const failureReason = `Payroc HTTP ${payrRes.status}` +
        (responseCode ? ` code=${responseCode}` : ``) +
        (responseMessage ? ` message=${responseMessage.substring(0, 200)}` : ``);

      await prisma.$transaction(async (tx) => {
        await tx.subscriptionInvoice.updateMany({
          where: {
            id: invoiceId,
            status: { in: ["pending", "failed_retrying"] },
          },
          data: {
            status: "failed_retrying",
            failureReason,
          },
        });

        // Only increment failure counter for actual payment failures (4xx
        // that aren't 401/429), not for transient infrastructure errors.
        if (!isTransient) {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              failedPaymentCount: { increment: 1 },
              lastFailureAt: new Date(),
            },
          });
        }

        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            eventType: "subscription.billed_failed",
            actor: "system:billing-engine",
            payload: {
              invoiceId,
              attemptCount,
              httpStatus: payrRes.status,
              transient: isTransient,
              failureReason,
            },
          },
        });
      });

      console.error(`[BILLING] cid=${cid} Payroc HTTP ${payrRes.status} (transient=${isTransient}): ${failureReason}`);
      return { success: false, error: failureReason };
    }

    // ── 8. Handle success ───────────────────────────────────────
    if (responseCode === "A") {
      console.log(
        `[BILLING] cid=${cid} invoice=${invoiceId} APPROVED paymentId=${payrocPaymentId} approvalCode=${approvalCode}`
      );

      await prisma.$transaction(async (tx) => {
        await tx.subscriptionInvoice.updateMany({
          where: {
            id: invoiceId,
            status: { in: ["pending", "failed_retrying"] },
          },
          data: {
            status: "paid",
            paymentId: payrocPaymentId,
            paidAt: new Date(),
            failureReason: null,
          },
        });

        // Reset failure counters on the subscription.
        //
        // If this was the first charge (isFirstCharge === true),
        // attempt to atomically claim firstPaymentId via updateMany
        // with a `firstPaymentId: null` filter. If count === 0, a
        // concurrent first-charge already won the race and we just
        // log it.
        //
        // CONCURRENCY MODEL — these two protections are load-bearing
        // together and must NOT be removed independently:
        //   1. Payroc-level dedup: the deterministic per-day
        //      idempotency key in Step 3 (invoiceId + UTC date) means
        //      two concurrent workers building sequence:"first"
        //      payloads will produce the SAME Idempotency-Key, so
        //      Payroc executes only ONE actual charge. This prevents
        //      a double-charge on the customer's card.
        //   2. DB-level claim: the updateMany below with
        //      `firstPaymentId: null` filter ensures only ONE worker
        //      persists firstPaymentId, even if both successfully
        //      received responses from Payroc (e.g., one cached, one
        //      fresh). This prevents firstPaymentId from being
        //      overwritten with the wrong value.
        // Together they guarantee correctness under concurrent first-
        // charge races. Removing either breaks the invariant.
        if (isFirstCharge) {
          const claimResult = await tx.subscription.updateMany({
            where: { id: subscription.id, firstPaymentId: null },
            data: {
              failedPaymentCount: 0,
              lastFailureAt: null,
              firstPaymentId: payrocPaymentId,
              // Persist cardSchemeReferenceId atomically with
              // firstPaymentId — Payroc may have returned it. If null,
              // the column simply stays null and subsequent charges
              // omit cardSchemeReferenceId from referenceDataOfFirstTxn.
              firstCardSchemeReferenceId: cardSchemeReferenceId,
            },
          });

          if (claimResult.count === 0) {
            // Concurrent job already claimed firstPaymentId for this
            // subscription. Just reset failure counters without
            // touching firstPaymentId.
            console.warn(
              `[BILLING] cid=${cid} concurrent first-charge race detected ` +
              `for subscription=${subscription.id} — firstPaymentId already claimed`
            );
            await tx.subscription.update({
              where: { id: subscription.id },
              data: {
                failedPaymentCount: 0,
                lastFailureAt: null,
              },
            });
          }
        } else {
          // Subsequent charge — just reset failure counters.
          // firstPaymentId is already set and immutable.
          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              failedPaymentCount: 0,
              lastFailureAt: null,
            },
          });
        }

        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            eventType: "subscription.billed_success",
            actor: "system:billing-engine",
            payload: {
              invoiceId,
              payrocPaymentId,
              approvalCode,
              amountCents: invoice.totalCents,
              attemptCount,
              sequence: standingInstructions.sequence,
              // sequence is derived from the actual standingInstructions
              // object that was sent to Payroc — single source of truth.
            },
          },
        });
      });

      // Update lastUsedAt on the saved card (best-effort)
      await prisma.savedPaymentMethod
        .update({
          where: { id: savedCard.id },
          data: { lastUsedAt: new Date() },
        })
        .catch((e) =>
          console.error(`[BILLING] cid=${cid} lastUsedAt update failed (non-fatal):`, e)
        );

      return {
        success: true,
        payrocPaymentId: payrocPaymentId ?? undefined,
        approvalCode: approvalCode ?? undefined,
        responseCode: responseCode ?? undefined,
      };
    }

    // ── 9. Handle decline / failure ────────────────────────────
    console.warn(
      `[BILLING] cid=${cid} invoice=${invoiceId} DECLINED responseCode=${responseCode} ` +
      `message=${responseMessage}`
    );

    await prisma.$transaction(async (tx) => {
      await tx.subscriptionInvoice.updateMany({
        where: {
          id: invoiceId,
          status: { in: ["pending", "failed_retrying"] },
        },
        data: {
          status: "failed_retrying",
          failureReason: (responseMessage ?? "Payment declined").substring(0, 300),
        },
      });

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          failedPaymentCount: { increment: 1 },
          lastFailureAt: new Date(),
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          eventType: "subscription.billed_failed",
          actor: "system:billing-engine",
          payload: {
            invoiceId,
            payrocPaymentId,
            responseCode,
            responseMessage,
            attemptCount,
            amountCents: invoice.totalCents,
          },
        },
      });
    });

    return {
      success: false,
      payrocPaymentId: payrocPaymentId ?? undefined,
      responseCode: responseCode ?? undefined,
      declineReason: responseMessage ?? "Payment declined",
    };

  // ── 10. Unexpected error catch ──────────────────────────────
  // FIX 3: findUnique runs BEFORE the transaction so we have a known
  // subscriptionId. Guarded with `if (inv)` to avoid FK violations.
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[BILLING] cid=${cid} UNEXPECTED ERROR invoice=${invoiceId}: ${message}`
    );

    try {
      const inv = await prisma.subscriptionInvoice.findUnique({
        where: { id: invoiceId },
        select: { subscriptionId: true },
      });

      if (inv) {
        await prisma.$transaction(async (tx) => {
          await tx.subscriptionInvoice.update({
            where: { id: invoiceId },
            data: {
              status: "failed_retrying",
              failureReason: `Unexpected error: ${message.substring(0, 300)}`,
            },
          });
          await tx.subscriptionEvent.create({
            data: {
              subscriptionId: inv.subscriptionId,
              eventType: "subscription.billed_failed",
              actor: "system:billing-engine",
              payload: {
                invoiceId,
                error: message.substring(0, 500),
                unexpected: true,
              },
            },
          });
        });
      }
    } catch (innerErr) {
      console.error(
        `[BILLING] cid=${cid} failed to record failure: ` +
        `${innerErr instanceof Error ? innerErr.message : String(innerErr)}`
      );
    }

    return { success: false, error: `Unexpected error: ${message}` };
  }
}
