import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { apiError } from "./errors";

const TTL_HOURS = 24;

function hashRequestBody(body: string): string {
  return crypto.createHash("sha256").update(body).digest("hex");
}

export async function checkIdempotency(
  request: Request,
  apiKeyId: string,
  bodyText: string,
  requestId: string
): Promise<
  | { cached: false }
  | { cached: true; response: NextResponse }
  | { cached: "conflict"; response: NextResponse }
> {
  const key = request.headers.get("idempotency-key");
  if (!key) return { cached: false };

  const trimmed = key.trim();
  if (trimmed.length === 0 || trimmed.length > 200) {
    return {
      cached: "conflict",
      response: apiError(
        "validation_error",
        "Idempotency-Key header must be 1-200 characters",
        { requestId }
      ),
    };
  }

  const requestHash = hashRequestBody(bodyText);

  const existing = await prisma.idempotencyKey.findUnique({
    where: { apiKeyId_key: { apiKeyId, key: trimmed } },
  });

  if (!existing) return { cached: false };

  if (existing.expiresAt.getTime() <= Date.now()) {
    await prisma.idempotencyKey.delete({ where: { id: existing.id } }).catch(() => {});
    return { cached: false };
  }

  if (existing.requestHash !== requestHash) {
    return {
      cached: "conflict",
      response: apiError(
        "idempotency_conflict",
        "Idempotency-Key was used with a different request body. Use a fresh key for a different request.",
        { requestId, details: { idempotencyKey: trimmed } }
      ),
    };
  }

  const cachedResponse = NextResponse.json(existing.responseBody, {
    status: existing.responseStatus,
  });
  cachedResponse.headers.set("X-Request-ID", requestId);
  cachedResponse.headers.set("X-Idempotency-Replay", "true");
  return { cached: true, response: cachedResponse };
}

export async function storeIdempotency(
  apiKeyId: string,
  request: Request,
  bodyText: string,
  responseStatus: number,
  responseBody: unknown
): Promise<void> {
  const key = request.headers.get("idempotency-key");
  if (!key) return;

  const trimmed = key.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return;

  const requestHash = hashRequestBody(bodyText);
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000);

  try {
    await prisma.idempotencyKey.upsert({
      where: { apiKeyId_key: { apiKeyId, key: trimmed } },
      update: {
        requestHash,
        responseStatus,
        responseBody: responseBody as object,
        expiresAt,
      },
      create: {
        apiKeyId,
        key: trimmed,
        requestHash,
        responseStatus,
        responseBody: responseBody as object,
        expiresAt,
      },
    });
  } catch (e) {
    console.error("[V1-IDEMPOTENCY] Store failed:", e);
  }
}
