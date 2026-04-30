import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { retryFailedDelivery } from "@/lib/webhooks/retry";
import { webhookDeliveryToV1 } from "@/lib/api/v1/webhooks/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; deliveryId: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id: rawWebhookId, deliveryId: rawDeliveryId } = await params;
  const webhookId = rawWebhookId.startsWith("whk_") ? rawWebhookId.slice(4) : rawWebhookId;
  const deliveryId = rawDeliveryId.startsWith("whd_") ? rawDeliveryId.slice(4) : rawDeliveryId;

  // Verify webhook ownership
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
    select: { id: true, merchantId: true },
  });
  if (!webhook || webhook.merchantId !== auth.merchant.id) {
    return apiError("not_found", "Webhook not found", { requestId: auth.requestId });
  }

  // Verify delivery belongs to this webhook
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, webhookId: true, status: true },
  });
  if (!delivery || delivery.webhookId !== webhookId) {
    return apiError("not_found", "Delivery not found", { requestId: auth.requestId });
  }

  if (delivery.status === "succeeded") {
    return apiError("validation_error", "Delivery already succeeded — nothing to replay", { requestId: auth.requestId });
  }
  if (delivery.status === "pending") {
    return apiError("validation_error", "Delivery is still pending — wait for initial attempt", { requestId: auth.requestId });
  }

  // Reset to allow retry regardless of attempt count (manual override)
  if (delivery.status === "exhausted") {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "failed", attemptCount: 4 }, // one more attempt allowed
    });
  }

  const result = await retryFailedDelivery(deliveryId);

  // Re-fetch for full response
  const updated = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });

  await writeAuditLog({
    actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
    action: "webhook_delivery.replay.v1",
    targetType: "WebhookDelivery",
    targetId: deliveryId,
    merchantId: auth.merchant.id,
    metadata: {
      webhookId,
      succeeded: result.succeeded,
      newAttemptCount: result.newAttemptCount,
      newStatus: result.newStatus,
      responseStatus: result.responseStatus,
      requestId: auth.requestId,
    },
  }).catch(() => {});

  const responseBody = {
    replay: {
      succeeded: result.succeeded,
      attempt_count: result.newAttemptCount,
      status: result.newStatus,
      response_status: result.responseStatus,
      error_message: result.errorMessage,
    },
    delivery: updated ? webhookDeliveryToV1(updated) : null,
  };

  const response = NextResponse.json(responseBody, { status: result.succeeded ? 200 : 422 });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
