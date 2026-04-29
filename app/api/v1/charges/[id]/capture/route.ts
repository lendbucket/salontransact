import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { checkIdempotency, storeIdempotency } from "@/lib/api/v1/idempotency";
import { writeAuditLog } from "@/lib/audit/log";
import { fireWebhookEvent } from "@/lib/webhooks/fanout";
import { processCapture } from "@/lib/api/v1/charges/capture";
import { transactionToCharge } from "@/lib/api/v1/charges/retrieve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let amountCents: number | null = null;
  if (bodyText.length > 0) {
    try {
      const body = JSON.parse(bodyText) as { amount_cents?: unknown };
      if (body.amount_cents !== undefined) {
        if (typeof body.amount_cents !== "number" || !Number.isInteger(body.amount_cents) || body.amount_cents < 1) {
          return apiError("validation_error", "amount_cents must be a positive integer", { requestId: auth.requestId });
        }
        amountCents = body.amount_cents;
      }
    } catch {
      return apiError("validation_error", "Invalid JSON", { requestId: auth.requestId });
    }
  }

  const result = await processCapture({
    apiKeyId: auth.apiKey.id,
    merchantId: auth.merchant.id,
    transactionId,
    amountCents,
    requestId: auth.requestId,
  });

  if (!result.ok) {
    const isNotFound = result.errorMessage?.toLowerCase().includes("not found");
    const status = isNotFound ? 404 : 422;
    const errorBody = { error: { code: isNotFound ? "not_found" as const : "payment_failed" as const, message: result.errorMessage ?? "Capture failed" } };
    const response = NextResponse.json(errorBody, { status });
    response.headers.set("X-Request-ID", auth.requestId);
    await storeIdempotency(auth.apiKey.id, request, bodyText, status, errorBody);
    await writeAuditLog({
      actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
      action: "capture.create.v1.failed",
      targetType: "Charge",
      targetId: transactionId,
      merchantId: auth.merchant.id,
      metadata: { errorMessage: result.errorMessage, requestId: auth.requestId },
    }).catch(() => {});
    return response;
  }

  const updatedTxn = await prisma.transaction.findUnique({ where: { id: transactionId } });
  const responseBody = updatedTxn ? transactionToCharge(updatedTxn) : null;

  const response = NextResponse.json(responseBody, { status: 200 });
  response.headers.set("X-Request-ID", auth.requestId);

  await storeIdempotency(auth.apiKey.id, request, bodyText, 200, responseBody);

  await writeAuditLog({
    actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
    action: "capture.create.v1",
    targetType: "Charge",
    targetId: transactionId,
    merchantId: auth.merchant.id,
    metadata: { capturedAmountCents: result.capturedAmountCents, payrocCaptureId: result.payrocCaptureId, requestId: auth.requestId },
  }).catch(() => {});

  void fireWebhookEvent({
    merchantId: auth.merchant.id,
    eventType: "charge.succeeded",
    data: { charge: responseBody as unknown as Record<string, unknown>, capture: true },
  });

  return response;
}
