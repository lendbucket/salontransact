import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { checkIdempotency, storeIdempotency } from "@/lib/api/v1/idempotency";
import { writeAuditLog } from "@/lib/audit/log";
import { fireWebhookEvent } from "@/lib/webhooks/fanout";
import { processRefund } from "@/lib/api/v1/charges/refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RefundRequestBody {
  amount_cents?: unknown;
  reason?: unknown;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id: rawId } = await params;
  const transactionId = rawId.startsWith("ch_") ? rawId.slice(3) : rawId;

  let bodyText: string;
  try { bodyText = await request.text(); } catch {
    return apiError("validation_error", "Could not read request body", { requestId: auth.requestId });
  }

  const idem = await checkIdempotency(request, auth.apiKey.id, bodyText, auth.requestId);
  if (idem.cached === true || idem.cached === "conflict") return idem.response;

  let body: RefundRequestBody = {};
  if (bodyText.length > 0) {
    try { body = JSON.parse(bodyText) as RefundRequestBody; } catch {
      return apiError("validation_error", "Invalid JSON", { requestId: auth.requestId });
    }
  }

  // Look up charge to determine default refund amount
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!txn || txn.merchantId !== auth.merchant.id) {
    return apiError("not_found", "Charge not found", { requestId: auth.requestId });
  }

  const originalCents = Math.round(txn.amount * 100);
  const alreadyRefundedCents = Math.round(txn.refundAmount * 100);
  const remainingCents = originalCents - alreadyRefundedCents;

  let amountCents: number;
  if (body.amount_cents === undefined) {
    amountCents = remainingCents;
  } else if (typeof body.amount_cents !== "number" || !Number.isInteger(body.amount_cents) || body.amount_cents < 1) {
    return apiError("validation_error", "amount_cents must be a positive integer", { requestId: auth.requestId, details: { field: "amount_cents" } });
  } else {
    amountCents = body.amount_cents;
  }

  const reason = typeof body.reason === "string" && body.reason.trim().length > 0
    ? body.reason.trim().slice(0, 200)
    : null;

  const result = await processRefund({
    apiKeyId: auth.apiKey.id,
    merchantId: auth.merchant.id,
    transactionId,
    amountCents,
    reason,
    requestId: auth.requestId,
  });

  if (!result.ok) {
    const isNotFound = result.errorMessage?.toLowerCase().includes("not found");
    const errorBody = { error: { code: isNotFound ? "not_found" as const : "payment_failed" as const, message: result.errorMessage ?? "Refund failed" } };
    const status = isNotFound ? 404 : 422;
    const response = NextResponse.json(errorBody, { status });
    response.headers.set("X-Request-ID", auth.requestId);
    await storeIdempotency(auth.apiKey.id, request, bodyText, status, errorBody);
    await writeAuditLog({
      actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
      action: "refund.create.v1.failed",
      targetType: "Charge",
      targetId: transactionId,
      merchantId: auth.merchant.id,
      metadata: { amountCents, errorMessage: result.errorMessage, requestId: auth.requestId },
    }).catch(() => {});
    return response;
  }

  const responseBody = {
    id: result.refundId,
    object: "refund",
    charge_id: `ch_${transactionId}`,
    amount_cents: result.refundedAmountCents,
    total_refunded_cents: result.totalRefundedCents,
    original_amount_cents: result.originalAmountCents,
    fully_refunded: result.totalRefundedCents >= result.originalAmountCents,
    reason,
    created_at: new Date().toISOString(),
    payroc: { refund_id: result.payrocRefundId },
  };

  const response = NextResponse.json(responseBody, { status: 201 });
  response.headers.set("X-Request-ID", auth.requestId);

  await storeIdempotency(auth.apiKey.id, request, bodyText, 201, responseBody);

  await writeAuditLog({
    actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
    action: "refund.create.v1",
    targetType: "Charge",
    targetId: transactionId,
    merchantId: auth.merchant.id,
    metadata: {
      refundedCents: result.refundedAmountCents,
      totalRefundedCents: result.totalRefundedCents,
      payrocRefundId: result.payrocRefundId,
      reason,
      requestId: auth.requestId,
    },
  }).catch(() => {});

  void fireWebhookEvent({
    merchantId: auth.merchant.id,
    eventType: "charge.refunded",
    data: { refund: responseBody },
  });

  return response;
}
