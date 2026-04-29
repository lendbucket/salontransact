import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { classifyTier, daysSince } from "@/lib/api/v1/customers/compute";
import type { V1Customer, V1CustomerListResponse, V1CustomerTier } from "@/lib/api/v1/customers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TIERS: V1CustomerTier[] = ["new", "regular", "occasional", "lapsed"];

function encodeCursor(ls: number, id: string): string {
  return Buffer.from(JSON.stringify({ ls, id })).toString("base64url");
}

function decodeCursor(s: string): { ls: number; id: string } | null {
  try {
    const d = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    return typeof d.ls === "number" && typeof d.id === "string" ? d : null;
  } catch { return null; }
}

export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(Math.max(limitRaw || 50, 1), 200);
  const search = (url.searchParams.get("search") ?? "").trim();
  const tierFilter = url.searchParams.get("tier");
  const cursorParam = url.searchParams.get("cursor");

  if (tierFilter && !VALID_TIERS.includes(tierFilter as V1CustomerTier)) {
    return apiError("validation_error", `tier must be one of: ${VALID_TIERS.join(", ")}`, { requestId: auth.requestId });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { merchantId: auth.merchant.id };

  if (search.length > 0) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
  }

  if (cursorParam) {
    const cursor = decodeCursor(cursorParam);
    if (!cursor) return apiError("validation_error", "Invalid cursor", { requestId: auth.requestId });
    // For cursor + search we need to combine both conditions
    const cursorCondition = [
      { lastSeenAt: { lt: new Date(cursor.ls) } },
      { AND: [{ lastSeenAt: new Date(cursor.ls) }, { id: { lt: cursor.id } }] },
    ];
    if (where.OR) {
      // search + cursor: both must match
      const searchConditions = where.OR;
      where.AND = [{ OR: searchConditions }, { OR: cursorCondition }];
      delete where.OR;
    } else {
      where.OR = cursorCondition;
    }
  }

  const rows = await prisma.customer.findMany({
    where,
    orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { _count: { select: { savedPaymentMethods: true } } },
  });

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;

  const customerIds = sliced.map((r) => r.id);
  const yearAgo = new Date(Date.now() - 365 * 86400000);
  const visitCounts = customerIds.length === 0
    ? new Map<string, number>()
    : await prisma.transaction.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds }, status: "succeeded", createdAt: { gte: yearAgo } },
        _count: true,
      }).then((groups) => {
        const map = new Map<string, number>();
        for (const g of groups) { if (g.customerId) map.set(g.customerId, g._count); }
        return map;
      });

  const now = new Date();
  let data: V1Customer[] = sliced.map((r) => {
    const visits365 = visitCounts.get(r.id) ?? 0;
    const tier = classifyTier({ totalTransactions: r.totalTransactions, visitsLast365Days: visits365, firstSeenAt: r.firstSeenAt, lastSeenAt: r.lastSeenAt, now });
    return {
      id: r.id, object: "customer", email: r.email, name: r.name, phone: r.phone, tier,
      total_transactions: r.totalTransactions, total_spent_cents: r.totalSpentCents,
      saved_card_count: r._count.savedPaymentMethods, days_since_last_visit: daysSince(r.lastSeenAt, now),
      first_seen_at: r.firstSeenAt.toISOString(), last_seen_at: r.lastSeenAt.toISOString(), created_at: r.firstSeenAt.toISOString(),
    };
  });

  if (tierFilter) data = data.filter((c) => c.tier === tierFilter);

  const nextCursor = hasMore && sliced.length > 0
    ? encodeCursor(sliced[sliced.length - 1].lastSeenAt.getTime(), sliced[sliced.length - 1].id)
    : null;

  const body: V1CustomerListResponse = { data, has_more: hasMore, next_cursor: nextCursor };
  const response = NextResponse.json(body);
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
