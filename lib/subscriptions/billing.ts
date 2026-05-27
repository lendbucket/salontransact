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
 * from invoiceId + attemptCount so duplicate cron fires cannot
 * double-charge.
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
 * Builds a deterministic UUID v4 from an arbitrary string input.
 * Used to derive Payroc Idempotency-Keys from invoiceId + attemptCount
 * so duplicate cron fires produce the same key and Payroc deduplicates.
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
    // ── 1. Load invoice + subscription + relations ──────────────
    const invoice = await prisma.subscriptionInvoice.findUnique({
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
      console.error(`[BILLING] cid=${cid} invoice ${invoiceId} not found`);
      return { success: false, error: "Invoice not found" };
    }

    const { subscription } = invoice;

    // ── 2. Idempotency: already-paid invoices return success ────
    if (invoice.status === "paid") {
      console.log(
        `[BILLING] cid=${cid} invoice already paid, paymentId=${invoice.paymentId}`
      );
      return { success: true, payrocPaymentId: invoice.paymentId ?? undefined };
    }

    // ── 3. Guard: only charge pending or failed_retrying invoices ──
    if (invoice.status !== "pending" && invoice.status !== "failed_retrying") {
      console.log(
        `[BILLING] cid=${cid} invoice=${invoiceId} status=${invoice.status} — skipping (not chargeable)`
      );
      return { success: false, error: `Invoice status is ${invoice.status}, not chargeable` };
    }

    // ── 4. Guard: subscription must be in a billable state ──────
    if (
      subscription.status !== "active" &&
      subscription.status !== "trialing" &&
      subscription.status !== "past_due"
    ) {
      console.log(
        `[BILLING] cid=${cid} invoice=${invoiceId} subscription=${subscription.id} ` +
        `status=${subscription.status} — skipping (not billable)`
      );
      return {
        success: false,
        error: `Subscription status is ${subscription.status}, not billable`,
      };
    }

    // ── 5. Guard: saved card must be active with a payment token ──
    const { savedCard } = subscription;
    if (savedCard.status !== "active") {
      return { success: false, error: `Saved card ${savedCard.id} is ${savedCard.status}` };
    }
    if (!savedCard.payrocToken) {
      return {
        success: false,
        error: `Saved card ${savedCard.id} missing payment token`,
      };
    }

    // ── 6. Increment attempt + write billed_attempt event ───────
    // Both writes happen in one transaction so the attemptCount used
    // in the idempotency key is consistent with the audit trail.
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.subscriptionInvoice.update({
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
            attemptCount: inv.attemptCount,
            amountCents: invoice.totalCents,
          },
        },
      });

      return inv;
    });

    const attemptCount = updatedInvoice.attemptCount;

    // ── 7. Build deterministic idempotency key ──────────────────
    const idempotencyKey = deterministicUuid(
      `subscription_invoice_${invoiceId}_attempt_${attemptCount}`
    );

    // ── 8. Resolve terminal ID for this merchant ────────────────
    const terminalId = await getTerminalIdForMerchant(subscription.merchantId);

    // ── 9. Build Payroc payment payload ─────────────────────────
    // FIX 1: no `customer` field. For MIT recurring charges the customer
    // association is bound to the saved token — repeating customer info
    // is unnecessary, and the subscription include doesn't load customer.
    //
    // FIX 2: orderId uses the full invoiceId (no .slice()). Payroc
    // accepts up to 50 chars; truncation risks idempotency collisions.
    const paymentPayload: RecurringPaymentRequest = {
      // TODO: confirm "moto" is correct channel for MIT recurring with Matt/Payroc
      channel: "moto",
      processingTerminalId: terminalId,
      operator: (subscription.merchant.businessName || "SalonTransact").slice(0, 50),
      order: {
        orderId: invoiceId,
        orderDate: new Date().toISOString().split("T")[0],
        description: `Subscription: ${subscription.plan.name}`.slice(0, 100),
        amount: invoice.totalCents,
        currency: "USD",
      },
      paymentMethod: {
        type: "secureToken",
        token: savedCard.payrocToken,
      },
      credentialOnFile: {
        initiator: "merchant",
        type: "recurring",
      },
    };

    console.log(
      `[BILLING] cid=${cid} invoice=${invoiceId} attempt=${attemptCount} ` +
      `amount=${invoice.totalCents} terminal=${terminalId} idempotencyKey=${idempotencyKey}`
    );

    // ── 10. Send charge to Payroc ───────────────────────────────
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

    console.log(
      `[BILLING] cid=${cid} invoice=${invoiceId} payroc status=${payrRes.status} ` +
      `body=${responseText.substring(0, 500)}`
    );

    // ── 11. Parse Payroc response ───────────────────────────────
    const txnResult = payrocResponse.transactionResult as Record<string, unknown> | undefined;
    const responseCode = (txnResult?.responseCode ?? payrocResponse.responseCode ?? null) as string | null;
    const responseMessage = (txnResult?.responseMessage ?? payrocResponse.responseMessage ?? null) as string | null;
    const approvalCode = (txnResult?.approvalCode ?? payrocResponse.approvalCode ?? null) as string | null;
    const payrocPaymentId = (payrocResponse.paymentId ?? null) as string | null;

    // ── 12. Handle success ──────────────────────────────────────
    if (responseCode === "A") {
      console.log(
        `[BILLING] cid=${cid} invoice=${invoiceId} APPROVED paymentId=${payrocPaymentId} approvalCode=${approvalCode}`
      );

      await prisma.$transaction(async (tx) => {
        await tx.subscriptionInvoice.update({
          where: { id: invoiceId },
          data: {
            status: "paid",
            paymentId: payrocPaymentId,
            paidAt: new Date(),
            failureReason: null,
          },
        });

        // Reset failure counters on the subscription
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            failedPaymentCount: 0,
            lastFailureAt: null,
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

    // ── 13. Handle decline / failure ────────────────────────────
    console.warn(
      `[BILLING] cid=${cid} invoice=${invoiceId} DECLINED responseCode=${responseCode} ` +
      `message=${responseMessage}`
    );

    await prisma.$transaction(async (tx) => {
      await tx.subscriptionInvoice.update({
        where: { id: invoiceId },
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

  // ── 14. Unexpected error catch ──────────────────────────────
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
