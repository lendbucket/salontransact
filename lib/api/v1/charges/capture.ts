import { prisma } from "@/lib/prisma";
import { getPayrocToken } from "@/lib/payroc/client";
import crypto from "crypto";

export interface ProcessCaptureOptions {
  apiKeyId: string;
  merchantId: string;
  transactionId: string;
  amountCents: number | null;
  requestId: string;
}

export interface ProcessCaptureResult {
  ok: boolean;
  capturedAmountCents: number;
  errorMessage: string | null;
  payrocCaptureId: string | null;
}

export async function processCapture(options: ProcessCaptureOptions): Promise<ProcessCaptureResult> {
  const fail = (msg: string): ProcessCaptureResult => ({ ok: false, capturedAmountCents: 0, errorMessage: msg, payrocCaptureId: null });

  const txn = await prisma.transaction.findUnique({ where: { id: options.transactionId } });
  if (!txn || txn.merchantId !== options.merchantId) return fail("Charge not found");
  if (txn.status !== "requires_capture") return fail(`Charge is '${txn.status}', must be 'requires_capture'`);

  const originalCents = Math.round(txn.amount * 100);
  const captureAmount = options.amountCents ?? originalCents;
  if (captureAmount > originalCents) return fail(`Capture ${captureAmount}c exceeds authorized ${originalCents}c`);

  const meta = (txn.metadata as Record<string, unknown> | null) ?? {};
  const payrocPaymentId = typeof meta.payrocPaymentId === "string" ? meta.payrocPaymentId : null;
  if (!payrocPaymentId) return fail("Charge missing Payroc payment ID");

  const apiUrl = process.env.PAYROC_API_URL;
  if (!apiUrl) return fail("Payroc not configured");

  let bearerToken: string;
  try { bearerToken = await getPayrocToken(); }
  catch (e) { return fail(`Auth failed: ${e instanceof Error ? e.message : "unknown"}`); }

  const idempotencyKey = crypto.randomUUID();
  console.log(`[PAYROC-IDEMPOTENCY] key=${idempotencyKey} path=/payments/${payrocPaymentId}/capture method=POST amount=${captureAmount} requestId=${options.requestId}`);

  let payrocResponse: Record<string, unknown> = {};
  try {
    const res = await fetch(`${apiUrl}/payments/${payrocPaymentId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
        "Idempotency-Key": idempotencyKey,
        Accept: "application/json",
      },
      body: JSON.stringify({ amount: captureAmount, currency: txn.currency.toUpperCase() }),
    });
    payrocResponse = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (payrocResponse.response as Record<string, unknown>)?.message ?? `Payroc ${res.status}`;
      return fail(`Capture failed: ${msg}`);
    }
  } catch (e) {
    return fail(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
  }

  await prisma.transaction.update({
    where: { id: txn.id },
    data: {
      status: "succeeded",
      ...(captureAmount !== originalCents ? { amount: captureAmount / 100 } : {}),
      metadata: {
        ...(meta as object),
        capturedAt: new Date().toISOString(),
        capturedAmountCents: captureAmount,
        payrocCaptureId: (payrocResponse.id as string) ?? null,
        captureIdempotencyKey: idempotencyKey,
      },
    },
  }).catch((e) => console.error("[CAPTURE] Transaction update failed:", e));

  // Auth holds don't increment Customer stats; capture does
  if (txn.customerId) {
    await prisma.customer.update({
      where: { id: txn.customerId },
      data: { totalTransactions: { increment: 1 }, totalSpentCents: { increment: captureAmount } },
    }).catch((e) => console.error("[CAPTURE] Customer increment failed:", e));
  }

  return { ok: true, capturedAmountCents: captureAmount, errorMessage: null, payrocCaptureId: (payrocResponse.id as string) ?? null };
}
