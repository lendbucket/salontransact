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
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 7), 365);

  const startDate = new Date(Date.now() - days * 86400000);

  const [txnAgg, payoutAgg, pendingPayouts] = await Promise.all([
    prisma.transaction.aggregate({
      where: { merchantId: auth.merchant.id, status: "succeeded", createdAt: { gte: startDate } },
      _sum: { amount: true, fee: true, net: true, tipAmount: true, refundAmount: true },
      _count: true,
    }),
    prisma.payout.aggregate({
      where: { merchantId: auth.merchant.id, status: "paid", createdAt: { gte: startDate } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payout.aggregate({
      where: { merchantId: auth.merchant.id, status: { in: ["pending", "in_transit"] } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const inflow = {
    volume_cents: Math.round((txnAgg._sum.amount ?? 0) * 100),
    transaction_count: txnAgg._count,
    fees_cents: Math.round((txnAgg._sum.fee ?? 0) * 100),
    net_cents: Math.round((txnAgg._sum.net ?? 0) * 100),
    tips_cents: Math.round((txnAgg._sum.tipAmount ?? 0) * 100),
    refunds_cents: Math.round((txnAgg._sum.refundAmount ?? 0) * 100),
  };

  const outflow = {
    paid_cents: Math.round((payoutAgg._sum.amount ?? 0) * 100),
    paid_count: payoutAgg._count,
    pending_cents: Math.round((pendingPayouts._sum.amount ?? 0) * 100),
    pending_count: pendingPayouts._count,
  };

  const response = NextResponse.json({
    object: "report",
    type: "cash_flow",
    days,
    inflow,
    outflow,
    net_position_cents: inflow.net_cents - outflow.paid_cents,
  });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
