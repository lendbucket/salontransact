import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { webhookDeliveryToV1 } from "@/lib/api/v1/webhooks/format";
import type { V1WebhookDeliveryListResponse } from "@/lib/api/v1/webhooks/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = ["pending", "succeeded", "failed", "exhausted"];

function encodeCursor(crMs: number, id: string): string {
  return Buffer.from(JSON.stringify({ cr: crMs, id })).toString("base64url");
}
function decodeCursor(s: string): { cr: number; id: string } | null {
  try {
    const d = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    return typeof d.cr === "number" && typeof d.id === "string" ? d : null;
  } catch { return null; }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id: rawId } = await params;
  const webhookId = rawId.startsWith("whk_") ? rawId.slice(4) : rawId;

  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
    select: { id: true, merchantId: true },
  });
  if (!webhook || webhook.merchantId !== auth.merchant.id) {
    return apiError("not_found", "Webhook not found", { requestId: auth.requestId });
  }

  const url = new URL(request.url);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(Math.max(limitRaw || 50, 1), 200);
  const cursorParam = url.searchParams.get("cursor");
  const statusFilter = url.searchParams.get("status");
  const eventTypeFilter = url.searchParams.get("event_type");

  if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
    return apiError("validation_error", `status must be one of: ${VALID_STATUSES.join(", ")}`, { requestId: auth.requestId });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { webhookId };
  if (statusFilter) where.status = statusFilter;
  if (eventTypeFilter) where.eventType = eventTypeFilter;

  if (cursorParam) {
    const cursor = decodeCursor(cursorParam);
    if (!cursor) return apiError("validation_error", "Invalid cursor", { requestId: auth.requestId });
    where.AND = [{
      OR: [
        { createdAt: { lt: new Date(cursor.cr) } },
        { AND: [{ createdAt: new Date(cursor.cr) }, { id: { lt: cursor.id } }] },
      ],
    }];
  }

  const rows = await prisma.webhookDelivery.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const data = sliced.map(webhookDeliveryToV1);

  const nextCursor = hasMore && sliced.length > 0
    ? encodeCursor(sliced[sliced.length - 1].createdAt.getTime(), sliced[sliced.length - 1].id)
    : null;

  const body: V1WebhookDeliveryListResponse = { data, has_more: hasMore, next_cursor: nextCursor };
  const response = NextResponse.json(body);
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
