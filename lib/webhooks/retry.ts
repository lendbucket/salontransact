import { prisma } from "@/lib/prisma";
import { signWebhookPayload } from "./sign";

const REQUEST_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BODY_BYTES = 4096;
const MAX_ATTEMPTS = 5;

const BACKOFF_MS: Record<number, number | null> = {
  1: 60_000,
  2: 300_000,
  3: 1_800_000,
  4: 7_200_000,
  5: null,
};

export interface RetryResult {
  deliveryId: string;
  succeeded: boolean;
  newAttemptCount: number;
  newStatus: string;
  responseStatus: number | null;
  errorMessage: string | null;
}

export function computeNextRetryAt(attemptCount: number, now: Date = new Date()): Date | null {
  const offset = BACKOFF_MS[attemptCount];
  if (offset === null || offset === undefined) return null;
  return new Date(now.getTime() + offset);
}

export async function retryFailedDelivery(deliveryId: string): Promise<RetryResult> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: { select: { id: true, url: true, secret: true, active: true } } },
  });

  if (!delivery) {
    return { deliveryId, succeeded: false, newAttemptCount: 0, newStatus: "failed", responseStatus: null, errorMessage: "Delivery not found" };
  }

  if (!delivery.webhook.active) {
    await prisma.webhookDelivery.update({ where: { id: deliveryId }, data: { status: "exhausted", nextRetryAt: null, errorMessage: "Webhook subscriber deactivated" } });
    return { deliveryId, succeeded: false, newAttemptCount: delivery.attemptCount, newStatus: "exhausted", responseStatus: null, errorMessage: "Webhook subscriber deactivated" };
  }

  if (delivery.attemptCount >= MAX_ATTEMPTS) {
    await prisma.webhookDelivery.update({ where: { id: deliveryId }, data: { status: "exhausted", nextRetryAt: null } });
    return { deliveryId, succeeded: false, newAttemptCount: delivery.attemptCount, newStatus: "exhausted", responseStatus: null, errorMessage: "Max attempts reached" };
  }

  const rawBody = JSON.stringify(delivery.payload);
  const { signatureHeader, timestamp } = signWebhookPayload(delivery.webhook.secret, rawBody);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let responseStatus: number | null = null;
  let responseBodySnippet: string | null = null;
  let errorMessage: string | null = null;
  let succeeded = false;

  try {
    const res = await fetch(delivery.webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signatureHeader,
        "X-Webhook-Event": delivery.eventType,
        "X-Webhook-Delivery-Id": delivery.eventId,
        "X-Webhook-Timestamp": String(timestamp),
        "User-Agent": "SalonTransact-Webhooks/1.0",
      },
      body: rawBody,
      signal: controller.signal,
    });
    responseStatus = res.status;
    succeeded = res.status >= 200 && res.status < 300;
    try { responseBodySnippet = (await res.text()).slice(0, MAX_RESPONSE_BODY_BYTES); } catch { responseBodySnippet = null; }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
    if (controller.signal.aborted) errorMessage = `Timed out after ${REQUEST_TIMEOUT_MS}ms`;
  } finally {
    clearTimeout(timeoutHandle);
  }

  const newAttemptCount = delivery.attemptCount + 1;
  const now = new Date();
  let newStatus: string;
  let nextRetryAt: Date | null = null;

  if (succeeded) {
    newStatus = "succeeded";
  } else if (newAttemptCount >= MAX_ATTEMPTS) {
    newStatus = "exhausted";
  } else {
    newStatus = "failed";
    nextRetryAt = computeNextRetryAt(newAttemptCount, now);
  }

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: { status: newStatus, responseStatus, responseBody: responseBodySnippet, errorMessage, attemptCount: newAttemptCount, lastAttemptAt: now, nextRetryAt },
  });

  if (succeeded) {
    await prisma.webhook.update({ where: { id: delivery.webhook.id }, data: { lastTriggeredAt: now } }).catch(() => {});
  }

  return { deliveryId, succeeded, newAttemptCount, newStatus, responseStatus, errorMessage };
}
