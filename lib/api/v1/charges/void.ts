import { prisma } from "@/lib/prisma";
import { getPayrocToken } from "@/lib/payroc/client";
import crypto from "crypto";

export interface ProcessVoidOptions {
  apiKeyId: string;
  merchantId: string;
  transactionId: string;
  reason?: string | null;
  requestId: string;
}

export interface ProcessVoidResult {
  ok: boolean;
  errorMessage: string | null;
  payrocVoidId: string | null;
}

export async function processVoid(options: ProcessVoidOptions): Promise<ProcessVoidResult> {
  const fail = (msg: string): ProcessVoidResult => ({ ok: false, errorMessage: msg, payrocVoidId: null });

  const txn = await prisma.transaction.findUnique({ where: { id: options.transactionId } });
  if (!txn || txn.merchantId !== options.merchantId) return fail("Charge not found");
  if (txn.status !== "requires_capture") return fail(`Charge is '${txn.status}', must be 'requires_capture'`);

  const meta = (txn.metadata as Record<string, unknown> | null) ?? {};
  const payrocPaymentId = typeof meta.payrocPaymentId === "string" ? meta.payrocPaymentId : null;
  if (!payrocPaymentId) return fail("Charge missing Payroc payment ID");

  const apiUrl = process.env.PAYROC_API_URL;
  if (!apiUrl) return fail("Payroc not configured");

  let bearerToken: string;
  try { bearerToken = await getPayrocToken(); }
  catch (e) { return fail(`Auth failed: ${e instanceof Error ? e.message : "unknown"}`); }

  const idempotencyKey = crypto.randomUUID();
  console.log(`[PAYROC-IDEMPOTENCY] key=${idempotencyKey} path=/payments/${payrocPaymentId}/void method=POST requestId=${options.requestId}`);

  let payrocResponse: Record<string, unknown> = {};
  try {
    const res = await fetch(`${apiUrl}/payments/${payrocPaymentId}/void`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
        "Idempotency-Key": idempotencyKey,
        Accept: "application/json",
      },
      body: "{}",
    });
    payrocResponse = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (payrocResponse.response as Record<string, unknown>)?.message ?? `Payroc ${res.status}`;
      return fail(`Void failed: ${msg}`);
    }
  } catch (e) {
    return fail(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
  }

  await prisma.transaction.update({
    where: { id: txn.id },
    data: {
      status: "voided",
      metadata: {
        ...(meta as object),
        voidedAt: new Date().toISOString(),
        voidReason: options.reason ?? null,
        payrocVoidId: (payrocResponse.id as string) ?? null,
        voidIdempotencyKey: idempotencyKey,
      },
    },
  }).catch((e) => console.error("[VOID] Transaction update failed:", e));

  return { ok: true, errorMessage: null, payrocVoidId: (payrocResponse.id as string) ?? null };
}
