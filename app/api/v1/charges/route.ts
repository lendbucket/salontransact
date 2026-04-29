import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { checkIdempotency, storeIdempotency } from "@/lib/api/v1/idempotency";
import { writeAuditLog } from "@/lib/audit/log";
import { fireWebhookEvent } from "@/lib/webhooks/fanout";
import { validateChargeInput } from "@/lib/api/v1/charges/validate";
import { processCharge } from "@/lib/api/v1/charges/process";
import { formatChargeResponse, formatTransactionAsCharge } from "@/lib/api/v1/charges/format";
import type { V1ChargeResponse } from "@/lib/api/v1/charges/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET /api/v1/charges — list with cursor pagination + filters ──

function encodeCursor(tMs: number, id: string): string {
  return Buffer.from(JSON.stringify({ t: tMs, id })).toString("base64url");
}
function decodeCursor(s: string): { t: number; id: string } | null {
  try {
    const d = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    return typeof d.t === "number" && typeof d.id === "string" ? d : null;
  } catch { return null; }
}

export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(Math.max(limitRaw || 50, 1), 200);
  const status = url.searchParams.get("status");
  const customerId = url.searchParams.get("customer_id");
  const stylistId = url.searchParams.get("stylist_id");
  const bookingId = url.searchParams.get("booking_id");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const cursorParam = url.searchParams.get("cursor");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { merchantId: auth.merchant.id };

  if (status) {
    const valid = ["succeeded", "failed", "requires_capture"];
    if (!valid.includes(status)) {
      return apiError("validation_error", `status must be one of: ${valid.join(", ")}`, { requestId: auth.requestId });
    }
    where.status = status;
  }
  if (customerId) where.customerId = customerId;
  if (stylistId) where.stylistId = stylistId;
  if (bookingId) where.bookingId = bookingId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];
  if (fromParam) { const d = new Date(fromParam); if (!isNaN(d.getTime())) conditions.push({ createdAt: { gte: d } }); }
  if (toParam) { const d = new Date(toParam); if (!isNaN(d.getTime())) conditions.push({ createdAt: { lte: d } }); }

  if (cursorParam) {
    const cursor = decodeCursor(cursorParam);
    if (!cursor) return apiError("validation_error", "Invalid cursor", { requestId: auth.requestId });
    conditions.push({
      OR: [
        { createdAt: { lt: new Date(cursor.t) } },
        { AND: [{ createdAt: new Date(cursor.t) }, { id: { lt: cursor.id } }] },
      ],
    });
  }

  if (conditions.length > 0) {
    where.AND = conditions;
  }

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const data: V1ChargeResponse[] = sliced.map(formatTransactionAsCharge);

  const nextCursor = hasMore && sliced.length > 0
    ? encodeCursor(sliced[sliced.length - 1].createdAt.getTime(), sliced[sliced.length - 1].id)
    : null;

  const response = NextResponse.json({ data, has_more: hasMore, next_cursor: nextCursor });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}

// ── POST /api/v1/charges — create a new charge ──

export async function POST(request: Request) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return apiError("validation_error", "Could not read request body", { requestId: auth.requestId });
  }

  // Idempotency check — BEFORE any Payroc call
  const idem = await checkIdempotency(request, auth.apiKey.id, bodyText, auth.requestId);
  if (idem.cached === true || idem.cached === "conflict") return idem.response;

  let parsedBody: unknown;
  try {
    parsedBody = bodyText.length > 0 ? JSON.parse(bodyText) : {};
  } catch {
    return apiError("validation_error", "Invalid JSON in request body", { requestId: auth.requestId });
  }

  const validation = validateChargeInput(parsedBody);
  if (!validation.ok) {
    return apiError(validation.error.code, validation.error.message, { requestId: auth.requestId, details: validation.error.details });
  }

  const createdAt = new Date();
  const result = await processCharge({
    apiKeyId: auth.apiKey.id,
    merchantId: auth.merchant.id,
    merchantBusinessName: auth.merchant.businessName,
    parsed: validation.parsed,
    requestId: auth.requestId,
  });

  // System-level error (not a card decline)
  if (!result.ok && !result.payrocPaymentId && result.errorMessage) {
    const errorBody = {
      error: {
        code: result.errorMessage.includes("not found") ? "not_found" : "validation_error",
        message: result.errorMessage,
      },
    };
    const response = NextResponse.json(errorBody, { status: 422 });
    response.headers.set("X-Request-ID", auth.requestId);

    await writeAuditLog({
      actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
      action: "charge.create.v1.failed",
      targetType: "Charge",
      targetId: "n/a",
      merchantId: auth.merchant.id,
      metadata: { apiKeyId: auth.apiKey.id, amountCents: validation.parsed.amountCents, errorMessage: result.errorMessage, requestId: auth.requestId },
    }).catch(() => {});

    return response;
  }

  const responseBody = formatChargeResponse({ result, parsed: validation.parsed, createdAt });
  const responseStatus = result.ok ? 201 : 422;

  const jsonBody = result.ok
    ? responseBody
    : {
        error: {
          code: "payment_failed" as const,
          message: result.declineReason ?? "Payment declined",
          details: { decline_reason: result.declineReason, response_code: result.responseCode, payroc_payment_id: result.payrocPaymentId },
        },
      };

  const response = NextResponse.json(jsonBody, { status: responseStatus });
  response.headers.set("X-Request-ID", auth.requestId);

  // Store idempotency for replay
  await storeIdempotency(auth.apiKey.id, request, bodyText, responseStatus, jsonBody);

  // Audit
  await writeAuditLog({
    actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
    action: result.ok ? "charge.create.v1" : "charge.create.v1.declined",
    targetType: "Charge",
    targetId: result.transactionId ?? "unknown",
    merchantId: auth.merchant.id,
    metadata: {
      apiKeyId: auth.apiKey.id, amountCents: validation.parsed.amountCents, currency: validation.parsed.currency,
      sourceType: validation.parsed.source.type, stylistId: validation.parsed.stylistId, bookingId: validation.parsed.bookingId,
      tipAmountCents: validation.parsed.tipAmountCents, payrocPaymentId: result.payrocPaymentId,
      responseCode: result.responseCode, declineReason: result.declineReason, requestId: auth.requestId,
    },
  }).catch(() => {});

  // Fire webhook (fire-and-forget)
  void fireWebhookEvent({
    merchantId: auth.merchant.id,
    eventType: result.ok ? "charge.succeeded" : "charge.failed",
    data: {
      charge: responseBody as unknown as Record<string, unknown>,
      ...(result.ok ? {} : { decline_reason: result.declineReason, response_code: result.responseCode }),
    },
  });

  return response;
}
