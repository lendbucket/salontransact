import { prisma } from "@/lib/prisma";

export interface RecordPaymentInput {
  payrocPaymentId: string;
  merchantId: string;
  amountCents: number;
  currency?: string;
  source: "checkout" | "backfill" | "manual";
}

export interface RecordPaymentResult {
  ok: boolean;
  recorded: boolean;
  reason?: string;
  recordId?: string;
}

/**
 * Record a Payroc payment for refund-scoping purposes.
 *
 * DESIGN GUARANTEES:
 * - This function NEVER throws. If anything goes wrong, it logs and returns
 *   { ok: false, recorded: false, reason: ... }.
 * - Callers in payment-success paths can call this without try/catch.
 * - Gated by env var REFUNDS_RECORD_PAYMENTS. If not "true", returns a
 *   no-op result without touching the database.
 * - Idempotent: if the same payrocPaymentId is recorded twice, the second
 *   call returns { ok: true, recorded: false, reason: 'already-exists' }
 *   without erroring.
 */
export async function recordPaymentForRefunds(
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  const flagEnabled = process.env.REFUNDS_RECORD_PAYMENTS === "true";

  if (!flagEnabled) {
    console.log(
      "[PAYMENT-RECORD] Skipped — REFUNDS_RECORD_PAYMENTS flag not enabled"
    );
    return { ok: true, recorded: false, reason: "flag-disabled" };
  }

  if (!input.payrocPaymentId || !input.merchantId) {
    console.log(
      "[PAYMENT-RECORD] Skipped — missing payrocPaymentId or merchantId",
      {
        payrocPaymentId: input.payrocPaymentId,
        merchantId: input.merchantId,
      }
    );
    return { ok: false, recorded: false, reason: "missing-required-fields" };
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    console.log("[PAYMENT-RECORD] Skipped — invalid amount", {
      amountCents: input.amountCents,
    });
    return { ok: false, recorded: false, reason: "invalid-amount" };
  }

  try {
    const existing = await prisma.payrocPaymentRecord.findUnique({
      where: { payrocPaymentId: input.payrocPaymentId },
      select: { id: true },
    });

    if (existing) {
      console.log("[PAYMENT-RECORD] Already exists, skipping insert", {
        payrocPaymentId: input.payrocPaymentId,
        recordId: existing.id,
      });
      return {
        ok: true,
        recorded: false,
        reason: "already-exists",
        recordId: existing.id,
      };
    }

    const created = await prisma.payrocPaymentRecord.create({
      data: {
        payrocPaymentId: input.payrocPaymentId,
        merchantId: input.merchantId,
        amountCents: input.amountCents,
        currency: input.currency ?? "USD",
        status: input.source === "backfill" ? "backfilled" : "recorded",
        source: input.source,
      },
      select: { id: true },
    });

    console.log("[PAYMENT-RECORD] Recorded successfully", {
      payrocPaymentId: input.payrocPaymentId,
      recordId: created.id,
      merchantId: input.merchantId,
    });

    return { ok: true, recorded: true, recordId: created.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error("[PAYMENT-RECORD] Insert failed", {
      payrocPaymentId: input.payrocPaymentId,
      merchantId: input.merchantId,
      error: message,
    });
    return { ok: false, recorded: false, reason: `db-error: ${message}` };
  }
}
