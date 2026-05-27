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
    const isFirstCharge = subscription.firstPaymentId === null;
    const standingInstructions: RecurringPaymentRequest["order"]["standingInstructions"] = isFirstCharge
      ? {
          sequence: "first",
          processingModel: "recurring",
        }
      : {
          sequence: "subsequent",
          processingModel: "recurring",
          referenceDataOfFirstTxn: {
            paymentId: subscription.firstPaymentId!,
          },
        };

    const paymentPayload: RecurringPaymentRequest = {
      // Channel "pos" for all recurring subscription charges per Chris
      // Boutwell (Payroc) verbal confirmation 2026-05-27.
      channel: "pos",
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
    const responseCode = (txnResult?.responseCode ?? payrocResponse.responseCode ?? null) as string | null;
    const responseMessage = (txnResult?.responseMessage ?? payrocResponse.responseMessage ?? null) as string | null;
    const approvalCode = (txnResult?.approvalCode ?? payrocResponse.approvalCode ?? null) as string | null;
    const payrocPaymentId = (payrocResponse.paymentId ?? null) as string | null;

    console.log(
      `[BILLING] cid=${cid} invoice=${invoiceId} payroc status=${payrRes.status} ` +
      `paymentId=${payrocPaymentId ?? "none"} responseCode=${responseCode ?? "none"} ` +
      `approvalCode=${approvalCode ?? "none"}`
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

        // Reset failure counters on the subscription. Also persist
        // firstPaymentId if this is the first successful charge — the
        // ?? guard preserves the existing value if a prior charge has
        // already set it. Once set, firstPaymentId is immutable; all
        // subsequent MIT charges reference it via
        // standingInstructions.referenceDataOfFirstTxn.paymentId.
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            failedPaymentCount: 0,
            lastFailureAt: null,
            firstPaymentId: subscription.firstPaymentId ?? payrocPaymentId,
          },
        });

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
              isFirstCharge,
              sequence: isFirstCharge ? "first" : "subsequent",
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
