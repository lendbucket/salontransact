import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { formatTransactionAsCharge } from "@/lib/api/v1/charges/format";
import { getPayrocToken } from "@/lib/payroc/client";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id: rawId } = await params;
  const txnId = rawId.startsWith("ch_") ? rawId.slice(3) : rawId;

  const txn = await prisma.transaction.findUnique({ where: { id: txnId } });
  if (!txn || txn.merchantId !== auth.merchant.id) {
    return apiError("not_found", "Charge not found", { requestId: auth.requestId });
  }

  // Can void requires_capture (auth hold not yet captured) or succeeded (same-day void before settlement)
  if (txn.status !== "requires_capture" && txn.status !== "succeeded") {
    return apiError("validation_error", `Cannot void charge with status '${txn.status}'. Only requires_capture or succeeded charges can be voided.`, { requestId: auth.requestId });
  }

  const meta = (txn.metadata ?? {}) as Record<string, unknown>;
  const payrocPaymentId = meta.payrocPaymentId as string | undefined;

  let voidSuccess = false;
  let voidError: string | null = null;

  if (payrocPaymentId) {
    try {
      const apiUrl = process.env.PAYROC_API_URL;
      const bearerToken = await getPayrocToken();
      const idempotencyKey = crypto.randomUUID();
      console.log(`[PAYROC-IDEMPOTENCY] key=${idempotencyKey} path=/payments/${payrocPaymentId}/void method=POST requestId=${auth.requestId}`);

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

      if (res.ok || res.status === 200 || res.status === 201) {
        voidSuccess = true;
      } else {
        const resData = await res.json().catch(() => ({}));
        voidError = `Payroc ${res.status}: ${JSON.stringify(resData).slice(0, 200)}`;
      }
    } catch (e) {
      voidError = e instanceof Error ? e.message : "Void request failed";
    }
  } else {
    voidSuccess = true;
  }

  if (!voidSuccess) {
    const response = NextResponse.json({ error: { code: "payment_failed", message: voidError ?? "Void failed" } }, { status: 502 });
    response.headers.set("X-Request-ID", auth.requestId);
    return response;
  }

  await prisma.transaction.update({ where: { id: txnId }, data: { status: "voided" } });

  const updated = await prisma.transaction.findUnique({ where: { id: txnId } });
  const responseBody = updated ? formatTransactionAsCharge(updated) : null;

  await writeAuditLog({
    actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
    action: "charge.void.v1",
    targetType: "Charge",
    targetId: txnId,
    merchantId: auth.merchant.id,
    metadata: { amountCents: Math.round(txn.amount * 100), previousStatus: txn.status, payrocPaymentId, requestId: auth.requestId },
  }).catch(() => {});

  const response = NextResponse.json(responseBody);
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
