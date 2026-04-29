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
  const groupBy = url.searchParams.get("group_by") ?? "day"; // day | week | month

  if (!from || !to) {
    return apiError("validation_error", "from and to query params required (ISO 8601)", { requestId: auth.requestId });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return apiError("validation_error", "Invalid date format", { requestId: auth.requestId });
  }

  if (!["day", "week", "month"].includes(groupBy)) {
    return apiError("validation_error", "group_by must be day, week, or month", { requestId: auth.requestId });
  }

  const txns = await prisma.transaction.findMany({
    where: {
      merchantId: auth.merchant.id,
      status: "succeeded",
      createdAt: { gte: fromDate, lte: toDate },
    },
    select: { amount: true, fee: true, net: true, tipAmount: true, refundAmount: true, refunded: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by period
  const buckets = new Map<string, { volume_cents: number; count: number; fees_cents: number; net_cents: number; tips_cents: number; refunds_cents: number; refund_count: number }>();

  for (const t of txns) {
    let key: string;
    if (groupBy === "month") {
      key = `${t.createdAt.getUTCFullYear()}-${String(t.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    } else if (groupBy === "week") {
      const d = new Date(t.createdAt);
      d.setUTCDate(d.getUTCDate() - d.getUTCDay());
      key = d.toISOString().slice(0, 10);
    } else {
      key = t.createdAt.toISOString().slice(0, 10);
    }

    const b = buckets.get(key) ?? { volume_cents: 0, count: 0, fees_cents: 0, net_cents: 0, tips_cents: 0, refunds_cents: 0, refund_count: 0 };
    b.volume_cents += Math.round(t.amount * 100);
    b.count += 1;
    b.fees_cents += Math.round(t.fee * 100);
    b.net_cents += Math.round(t.net * 100);
    b.tips_cents += Math.round(t.tipAmount * 100);
    if (t.refunded) { b.refunds_cents += Math.round(t.refundAmount * 100); b.refund_count += 1; }
    buckets.set(key, b);
  }

  const periods = Array.from(buckets.entries()).map(([period, d]) => ({ period, ...d }));

  const totals = {
    volume_cents: periods.reduce((s, p) => s + p.volume_cents, 0),
    count: periods.reduce((s, p) => s + p.count, 0),
    fees_cents: periods.reduce((s, p) => s + p.fees_cents, 0),
    net_cents: periods.reduce((s, p) => s + p.net_cents, 0),
    tips_cents: periods.reduce((s, p) => s + p.tips_cents, 0),
    refunds_cents: periods.reduce((s, p) => s + p.refunds_cents, 0),
    refund_count: periods.reduce((s, p) => s + p.refund_count, 0),
  };

  const response = NextResponse.json({ object: "report", type: "transactions", group_by: groupBy, from: from, to: to, totals, periods });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
