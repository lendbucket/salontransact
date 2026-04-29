import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!from || !to) {
    return apiError("validation_error", "from and to required", { requestId: auth.requestId });
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return apiError("validation_error", "Invalid date format", { requestId: auth.requestId });
  }

  // Group succeeded transactions by stylistId
  const grouped = await prisma.transaction.groupBy({
    by: ["stylistId"],
    where: {
      merchantId: auth.merchant.id,
      status: "succeeded",
      createdAt: { gte: fromDate, lte: toDate },
    },
    _sum: { amount: true, tipAmount: true },
    _count: true,
  });

  // Fetch stylist names
  const stylistIds = grouped.map((g) => g.stylistId).filter((id): id is string => !!id);
  const stylists = stylistIds.length > 0
    ? await prisma.stylist.findMany({ where: { id: { in: stylistIds } }, select: { id: true, name: true, commissionRate: true } })
    : [];
  const stylistMap = new Map(stylists.map((s) => [s.id, s]));

  const data = grouped.map((g) => {
    const stylist = g.stylistId ? stylistMap.get(g.stylistId) : null;
    const volumeCents = Math.round((g._sum.amount ?? 0) * 100);
    const tipsCents = Math.round((g._sum.tipAmount ?? 0) * 100);
    const commissionRate = stylist?.commissionRate ?? null;
    const commissionCents = commissionRate != null ? Math.round(volumeCents * commissionRate) : null;

    return {
      stylist_id: g.stylistId,
      stylist_name: stylist?.name ?? (g.stylistId ? "Unknown" : "Unassigned"),
      transaction_count: g._count,
      volume_cents: volumeCents,
      tips_cents: tipsCents,
      commission_rate: commissionRate,
      commission_cents: commissionCents,
      average_ticket_cents: g._count > 0 ? Math.round(volumeCents / g._count) : 0,
    };
  }).sort((a, b) => b.volume_cents - a.volume_cents);

  const response = NextResponse.json({ object: "report", type: "stylist_attribution", from, to, data });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
