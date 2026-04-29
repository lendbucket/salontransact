import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { checkIdempotency, storeIdempotency } from "@/lib/api/v1/idempotency";
import { writeAuditLog } from "@/lib/audit/log";
import { fireWebhookEvent } from "@/lib/webhooks/fanout";
import { processVoid } from "@/lib/api/v1/charges/void";

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

  let reason: string | null = null;
  if (bodyText.length > 0) {
    try {
      const body = JSON.parse(bodyText) as { reason?: unknown };
      if (typeof body.reason === "string" && body.reason.trim().length > 0) {
        reason = body.reason.trim().slice(0, 200);
      }
    } catch {
      return apiError("validation_error", "Invalid JSON", { requestId: auth.requestId });
    }
  }

  const result = await processVoid({
    apiKeyId: auth.apiKey.id,
    merchantId: auth.merchant.id,
    transactionId,
    reason,
    requestId: auth.requestId,
  });

  if (!result.ok) {
    const isNotFound = result.errorMessage?.toLowerCase().includes("not found");
    const status = isNotFound ? 404 : 422;
    const errorBody = { error: { code: isNotFound ? "not_found" as const : "payment_failed" as const, message: result.errorMessage ?? "Void failed" } };
    const response = NextResponse.json(errorBody, { status });
    response.headers.set("X-Request-ID", auth.requestId);
    await storeIdempotency(auth.apiKey.id, request, bodyText, status, errorBody);
    await writeAuditLog({
      actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
      action: "void.create.v1.failed",
      targetType: "Charge",
      targetId: transactionId,
      merchantId: auth.merchant.id,
      metadata: { errorMessage: result.errorMessage, requestId: auth.requestId },
    }).catch(() => {});
    return response;
  }

  const responseBody = {
    id: `vd_${transactionId}_${Date.now()}`,
    object: "void",
    charge_id: `ch_${transactionId}`,
    reason,
    voided_at: new Date().toISOString(),
    payroc: { void_id: result.payrocVoidId },
  };

  const response = NextResponse.json(responseBody, { status: 200 });
  response.headers.set("X-Request-ID", auth.requestId);

  await storeIdempotency(auth.apiKey.id, request, bodyText, 200, responseBody);

  await writeAuditLog({
    actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
    action: "void.create.v1",
    targetType: "Charge",
    targetId: transactionId,
    merchantId: auth.merchant.id,
    metadata: { payrocVoidId: result.payrocVoidId, reason, requestId: auth.requestId },
  }).catch(() => {});

  void fireWebhookEvent({
    merchantId: auth.merchant.id,
    eventType: "charge.failed",
    data: { void: responseBody, reason: reason ?? "voided" },
  });

  return response;
}
