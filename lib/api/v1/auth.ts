import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "./errors";
import { generateRequestId } from "./request-id";
import type { V1AuthContext } from "./types";

function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const xApiKey = request.headers.get("x-api-key");
  if (xApiKey) return xApiKey.trim();
  return null;
}

export async function requireApiKey(
  request: Request
): Promise<V1AuthContext | NextResponse> {
  const requestId = generateRequestId();

  const rawKey = extractApiKey(request);
  if (!rawKey) {
    return apiError(
      "unauthorized",
      "API key required. Provide via Authorization: Bearer <key> or X-API-Key header.",
      { requestId }
    );
  }

  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: { key: rawKey, active: true },
    include: {
      merchant: {
        select: { id: true, businessName: true, email: true },
      },
    },
  });

  if (!apiKeyRecord) {
    return apiError("unauthorized", "Invalid API key", { requestId });
  }

  // Update lastUsed (fire and forget)
  prisma.apiKey
    .update({ where: { id: apiKeyRecord.id }, data: { lastUsed: new Date() } })
    .catch((e) => console.error("[V1-AUTH] lastUsed update failed:", e));

  return {
    apiKey: {
      id: apiKeyRecord.id,
      merchantId: apiKeyRecord.merchantId,
      name: apiKeyRecord.name,
      keyPrefix: apiKeyRecord.keyPrefix,
    },
    merchant: apiKeyRecord.merchant,
    requestId,
  };
}
