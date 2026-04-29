import { prisma } from "@/lib/prisma";
import { getPayrocToken } from "@/lib/payroc/client";
import crypto from "crypto";

export interface ProcessRefundOptions {
  apiKeyId: string;
  merchantId: string;
  transactionId: string;
  amountCents: number;
  reason?: string | null;
  requestId: string;
}

export interface ProcessRefundResult {
  ok: boolean;
  refundId: string | null;
  refundedAmountCents: number;
  totalRefundedCents: number;
  originalAmountCents: number;
  errorMessage: string | null;
  payrocRefundId: string | null;
}

export async function processRefund(options: ProcessRefundOptions): Promise<ProcessRefundResult> {
  const fail = (msg: string, totalRefunded = 0, original = 0): ProcessRefundResult => ({
    ok: false, refundId: null, refundedAmountCents: 0, totalRefundedCents: totalRefunded,
    originalAmountCents: original, errorMessage: msg, payrocRefundId: null,
  });

  const txn = await prisma.transaction.findUnique({ where: { id: options.transactionId } });
  if (!txn || txn.merchantId !== options.merchantId) return fail("Charge not found");
  if (txn.status !== "succeeded") return fail(`Cannot refund charge with status '${txn.status}'`);

  const originalCents = Math.round(txn.amount * 100);
  const alreadyRefundedCents = Math.round(txn.refundAmount * 100);
  const remainingCents = originalCents - alreadyRefundedCents;

  if (options.amountCents > remainingCents) {
    return fail(`Refund amount ${options.amountCents}c exceeds remaining ${remainingCents}c`, alreadyRefundedCents, originalCents);
  }

  const meta = (txn.metadata as Record<string, unknown> | null) ?? {};
  const payrocPaymentId = typeof meta.payrocPaymentId === "string" ? meta.payrocPaymentId : null;
  if (!payrocPaymentId) return fail("Charge missing Payroc payment ID", alreadyRefundedCents, originalCents);

  const apiUrl = process.env.PAYROC_API_URL;
  if (!apiUrl) return fail("Payroc not configured", alreadyRefundedCents, originalCents);

  let bearerToken: string;
  try { bearerToken = await getPayrocToken(); }
  catch (e) { return fail(`Auth failed: ${e instanceof Error ? e.message : "unknown"}`, alreadyRefundedCents, originalCents); }

  const idempotencyKey = crypto.randomUUID();
  console.log(`[PAYROC-IDEMPOTENCY] key=${idempotencyKey} path=/payments/${payrocPaymentId}/refunds method=POST amount=${options.amountCents} requestId=${options.requestId}`);

  let payrocResponse: Record<string, unknown> = {};
  try {
    const res = await fetch(`${apiUrl}/payments/${payrocPaymentId}/refunds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
        "Idempotency-Key": idempotencyKey,
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: options.amountCents,
        currency: txn.currency.toUpperCase(),
        ...(options.reason ? { reason: options.reason.slice(0, 200) } : {}),
      }),
    });
    payrocResponse = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (payrocResponse.response as Record<string, unknown>)?.message ?? `Payroc ${res.status}`;
      return { ok: false, refundId: null, refundedAmountCents: 0, totalRefundedCents: alreadyRefundedCents,
        originalAmountCents: originalCents, errorMessage: `Refund failed: ${msg}`, payrocRefundId: (payrocResponse.id as string) ?? null };
    }
  } catch (e) {
    return fail(`Network error: ${e instanceof Error ? e.message : "unknown"}`, alreadyRefundedCents, originalCents);
  }

  const newTotalRefundedCents = alreadyRefundedCents + options.amountCents;
  const fullyRefunded = newTotalRefundedCents >= originalCents;

  try {
    await prisma.transaction.update({
      where: { id: txn.id },
      data: {
        refunded: fullyRefunded,
        refundAmount: newTotalRefundedCents / 100,
        metadata: {
          ...(meta as object),
          lastRefundAt: new Date().toISOString(),
          lastRefundAmountCents: options.amountCents,
          lastRefundPayrocId: (payrocResponse.id as string) ?? null,
          lastRefundReason: options.reason,
        },
      },
    });
  } catch (e) { console.error("[REFUND] Transaction update failed:", e); }

  // Decrement Customer totalSpentCents if linked
  if (txn.customerId) {
    await prisma.customer.update({
      where: { id: txn.customerId },
      data: { totalSpentCents: { decrement: options.amountCents } },
    }).catch((e) => console.error("[REFUND] Customer decrement failed:", e));
  }

  return {
    ok: true,
    refundId: `re_${txn.id}_${Date.now()}`,
    refundedAmountCents: options.amountCents,
    totalRefundedCents: newTotalRefundedCents,
    originalAmountCents: originalCents,
    errorMessage: null,
    payrocRefundId: (payrocResponse.id as string) ?? null,
  };
}
