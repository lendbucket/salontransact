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
  if (txn.status !== "requires_capture") {
    return apiError("validation_error", `Cannot capture charge with status '${txn.status}'. Only requires_capture charges can be captured.`, { requestId: auth.requestId });
  }

  const meta = (txn.metadata ?? {}) as Record<string, unknown>;
  const payrocPaymentId = meta.payrocPaymentId as string | undefined;

  let captureSuccess = false;
  let captureError: string | null = null;

  if (payrocPaymentId) {
    try {
      const apiUrl = process.env.PAYROC_API_URL;
      const bearerToken = await getPayrocToken();
      const idempotencyKey = crypto.randomUUID();
      console.log(`[PAYROC-IDEMPOTENCY] key=${idempotencyKey} path=/payments/${payrocPaymentId}/capture method=POST requestId=${auth.requestId}`);

      const res = await fetch(`${apiUrl}/payments/${payrocPaymentId}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
          "Idempotency-Key": idempotencyKey,
          Accept: "application/json",
        },
        body: JSON.stringify({ amount: Math.round(txn.amount * 100) }),
      });

      if (res.ok || res.status === 200 || res.status === 201) {
        captureSuccess = true;
      } else {
        const resData = await res.json().catch(() => ({}));
        captureError = `Payroc ${res.status}: ${JSON.stringify(resData).slice(0, 200)}`;
      }
    } catch (e) {
      captureError = e instanceof Error ? e.message : "Capture request failed";
    }
  } else {
    captureSuccess = true;
  }

  if (!captureSuccess) {
    const response = NextResponse.json({ error: { code: "payment_failed", message: captureError ?? "Capture failed" } }, { status: 502 });
    response.headers.set("X-Request-ID", auth.requestId);
    return response;
  }

  await prisma.transaction.update({ where: { id: txnId }, data: { status: "succeeded" } });

  const updated = await prisma.transaction.findUnique({ where: { id: txnId } });
  const responseBody = updated ? formatTransactionAsCharge(updated) : null;

  await writeAuditLog({
    actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
    action: "charge.capture.v1",
    targetType: "Charge",
    targetId: txnId,
    merchantId: auth.merchant.id,
    metadata: { amountCents: Math.round(txn.amount * 100), payrocPaymentId, requestId: auth.requestId },
  }).catch(() => {});

  const response = NextResponse.json(responseBody);
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
