import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { signWebhookPayload } from "./sign";

const REQUEST_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BODY_BYTES = 4096;

export interface WebhookEventEnvelope {
  id: string;
  type: string;
  createdAt: string;
  data: Record<string, unknown>;
}

export async function fireWebhookEvent(args: {
  merchantId: string;
  eventType: string;
  data: Record<string, unknown>;
}): Promise<void> {
  try {
    const subscribers = await prisma.webhook.findMany({
      where: { merchantId: args.merchantId, active: true, events: { has: args.eventType } },
      select: { id: true, url: true, secret: true },
    });
    if (subscribers.length === 0) return;
    await Promise.allSettled(subscribers.map((sub) => deliverOneWebhook(sub, args)));
  } catch (e) {
    console.error("[WEBHOOK-FANOUT] Top-level failure:", e);
  }
}

async function deliverOneWebhook(
  subscriber: { id: string; url: string; secret: string },
  args: { merchantId: string; eventType: string; data: Record<string, unknown> }
): Promise<void> {
  const eventId = `evt_${crypto.randomUUID()}`;
  const envelope: WebhookEventEnvelope = {
    id: eventId,
    type: args.eventType,
    createdAt: new Date().toISOString(),
    data: args.data,
  };

  const rawBody = JSON.stringify(envelope);
  const { signatureHeader, timestamp } = signWebhookPayload(subscriber.secret, rawBody);

  let deliveryId: string;
  try {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: subscriber.id,
        merchantId: args.merchantId,
        eventType: args.eventType,
        eventId,
        payload: envelope as object,
        signature: signatureHeader,
        status: "pending",
        attemptCount: 0,
      },
    });
    deliveryId = delivery.id;
  } catch (e) {
    console.error(`[WEBHOOK-FANOUT] Failed to create delivery row for webhook ${subscriber.id}:`, e);
    return;
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let responseStatus: number | null = null;
  let responseBodySnippet: string | null = null;
  let errorMessage: string | null = null;
  let succeeded = false;

  try {
    const res = await fetch(subscriber.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signatureHeader,
        "X-Webhook-Event": args.eventType,
        "X-Webhook-Delivery-Id": eventId,
        "X-Webhook-Timestamp": String(timestamp),
        "User-Agent": "SalonTransact-Webhooks/1.0",
      },
      body: rawBody,
      signal: controller.signal,
    });

    responseStatus = res.status;
    succeeded = res.status >= 200 && res.status < 300;

    try {
      const text = await res.text();
      responseBodySnippet = text.slice(0, MAX_RESPONSE_BODY_BYTES);
    } catch {
      responseBodySnippet = null;
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
    if (controller.signal.aborted) {
      errorMessage = `Timed out after ${REQUEST_TIMEOUT_MS}ms`;
    }
  } finally {
    clearTimeout(timeoutHandle);
  }

  try {
    const now = new Date();
    const nextRetryAt = succeeded ? null : new Date(now.getTime() + 60_000);
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: succeeded ? "succeeded" : "failed",
        responseStatus,
        responseBody: responseBodySnippet,
        errorMessage,
        attemptCount: 1,
        lastAttemptAt: now,
        nextRetryAt,
      },
    });
    if (succeeded) {
      await prisma.webhook.update({ where: { id: subscriber.id }, data: { lastTriggeredAt: new Date() } });
    }
  } catch (e) {
    console.error(`[WEBHOOK-FANOUT] Failed to update delivery ${deliveryId}:`, e);
  }

  if (!succeeded) {
    console.warn(`[WEBHOOK-FANOUT] Delivery failed: webhook=${subscriber.id} event=${args.eventType} status=${responseStatus} error=${errorMessage}`);
  }
}
