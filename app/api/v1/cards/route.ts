import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { savedPaymentMethodToCard } from "@/lib/api/v1/cards/format";
import type { V1CardListResponse } from "@/lib/api/v1/cards/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const customerId = url.searchParams.get("customer_id");
  const customerEmail = url.searchParams.get("customer_email");
  const status = url.searchParams.get("status");
  const cursorParam = url.searchParams.get("cursor");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { merchantId: auth.merchant.id };

  if (customerId) where.customerId = customerId;
  if (customerEmail) where.customerEmail = { contains: customerEmail.toLowerCase(), mode: "insensitive" };
  if (status) {
    const valid = ["active", "revoked", "expired"];
    if (!valid.includes(status)) {
      return apiError("validation_error", `status must be one of: ${valid.join(", ")}`, { requestId: auth.requestId });
    }
    where.status = status;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];
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
  if (conditions.length > 0) where.AND = conditions;

  const rows = await prisma.savedPaymentMethod.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const data = sliced.map(savedPaymentMethodToCard);

  const nextCursor = hasMore && sliced.length > 0
    ? encodeCursor(sliced[sliced.length - 1].createdAt.getTime(), sliced[sliced.length - 1].id)
    : null;

  const body: V1CardListResponse = { data, has_more: hasMore, next_cursor: nextCursor };
  const response = NextResponse.json(body);
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
