import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { averageDaysBetweenVisits, classifyTier } from "@/lib/api/v1/customers/compute";
import type { V1VisitSummary } from "@/lib/api/v1/customers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const url = new URL(request.url);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(Math.max(limitRaw || 50, 1), 200);

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, merchantId: true, firstSeenAt: true, lastSeenAt: true, totalTransactions: true },
  });
  if (!customer || customer.merchantId !== auth.merchant.id) {
    return apiError("not_found", "Customer not found", { requestId: auth.requestId });
  }

  const [allTimestamps, recentVisits] = await Promise.all([
    prisma.transaction.findMany({
      where: { customerId: id, status: "succeeded" },
      select: { createdAt: true },
    }),
    prisma.transaction.findMany({
      where: { customerId: id, status: "succeeded" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { stylist: { select: { id: true, name: true } } },
    }),
  ]);

  const now = new Date();
  const day30 = new Date(now.getTime() - 30 * 86400000);
  const day90 = new Date(now.getTime() - 90 * 86400000);
  const day365 = new Date(now.getTime() - 365 * 86400000);

  const visitTimestamps = allTimestamps.map((t) => t.createdAt);
  const visitsLast30 = visitTimestamps.filter((t) => t >= day30).length;
  const visitsLast90 = visitTimestamps.filter((t) => t >= day90).length;
  const visitsLast365 = visitTimestamps.filter((t) => t >= day365).length;

  const tier = classifyTier({ totalTransactions: customer.totalTransactions, visitsLast365Days: visitsLast365, firstSeenAt: customer.firstSeenAt, lastSeenAt: customer.lastSeenAt, now });

  const sorted = [...visitTimestamps].sort((a, b) => a.getTime() - b.getTime());

  const body: V1VisitSummary = {
    customer_id: id,
    total_visits: visitTimestamps.length,
    visits_last_30_days: visitsLast30,
    visits_last_90_days: visitsLast90,
    visits_last_365_days: visitsLast365,
    average_days_between_visits: averageDaysBetweenVisits(visitTimestamps),
    tier,
    first_visit_at: sorted.length > 0 ? sorted[0].toISOString() : null,
    last_visit_at: sorted.length > 0 ? sorted[sorted.length - 1].toISOString() : null,
    visits: recentVisits.map((t) => ({
      transaction_id: `ch_${t.id}`,
      visited_at: t.createdAt.toISOString(),
      amount_cents: Math.round(t.amount * 100),
      tip_amount_cents: Math.round(t.tipAmount * 100),
      description: t.description,
      stylist_id: t.stylistId,
      stylist_name: t.stylist?.name ?? null,
    })),
  };

  const response = NextResponse.json(body);
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
