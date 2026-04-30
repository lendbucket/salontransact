import type { WebhookDelivery } from "@prisma/client";
import type { V1WebhookDelivery } from "./types";

export function webhookDeliveryToV1(d: WebhookDelivery): V1WebhookDelivery {
  return {
    id: `whd_${d.id}`,
    object: "webhook_delivery",
    webhook_id: `whk_${d.webhookId}`,
    event_id: d.eventId,
    event_type: d.eventType,
    status: d.status as V1WebhookDelivery["status"],
    attempt_count: d.attemptCount,
    response_status: d.responseStatus,
    response_body: d.responseBody,
    error_message: d.errorMessage,
    last_attempt_at: d.lastAttemptAt?.toISOString() ?? null,
    next_retry_at: d.nextRetryAt?.toISOString() ?? null,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  };
}
