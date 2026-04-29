import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseWindow,
  type ReportingWindow,
  type VelocityRow,
  type VelocityResponse,
} from "@/lib/reporting/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const days: ReportingWindow = parseWindow(url.searchParams.get("days"));
  const limitParam = parseInt(url.searchParams.get("limit") ?? "5", 10);
  const limit = Math.min(Math.max(1, limitParam), 50);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const grouped = await prisma.transaction.groupBy({
    by: ["merchantId"],
    where: {
      status: "succeeded",
      createdAt: { gte: startDate },
    },
    _count: true,
  });

  const sorted = grouped
    .map((g) => ({
      merchantId: g.merchantId,
      transactionCount: g._count,
    }))
    .sort((a, b) => b.transactionCount - a.transactionCount)
    .slice(0, limit);

  const merchantIds = sorted.map((s) => s.merchantId);
  const merchants = await prisma.merchant.findMany({
    where: { id: { in: merchantIds } },
    select: { id: true, businessName: true },
  });
  const nameMap = new Map(merchants.map((m) => [m.id, m.businessName]));

  const data: VelocityRow[] = sorted.map((s, idx) => ({
    merchantId: s.merchantId,
    businessName: nameMap.get(s.merchantId) ?? "Unknown",
    transactionCount: s.transactionCount,
    avgPerDay: Math.round((s.transactionCount / days) * 100) / 100,
    rank: idx + 1,
  }));

  const response: VelocityResponse = { window: days, data };
  return NextResponse.json(response);
}
