import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import {
  parseWindow,
  type ReportingWindow,
  type SummaryResponse,
} from "@/lib/reporting/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const days: ReportingWindow = parseWindow(url.searchParams.get("days"));

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const [aggResult, activeMerchants, txns] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        status: "succeeded",
        createdAt: { gte: startDate },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.merchant.count({
      where: { status: "active" },
    }),
    prisma.transaction.findMany({
      where: {
        status: "succeeded",
        createdAt: { gte: startDate },
      },
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const totalDollars = aggResult._sum.amount ?? 0;
  const count = aggResult._count;

  const totalVolumeCents = Math.round(totalDollars * 100);
  const averageTicketCents = count > 0 ? Math.round((totalDollars / count) * 100) : 0;

  const dailyMap = new Map<string, { volumeCents: number; count: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { volumeCents: 0, count: 0 });
  }

  for (const tx of txns) {
    const key = tx.createdAt.toISOString().slice(0, 10);
    const existing = dailyMap.get(key);
    if (existing) {
      existing.volumeCents += Math.round(tx.amount * 100);
      existing.count += 1;
    }
  }

  const dailyVolume: SummaryResponse["dailyVolume"] = Array.from(dailyMap.entries()).map(
    ([date, val]) => ({ date, volumeCents: val.volumeCents, count: val.count })
  );

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "reporting.view",
    targetType: "Reporting",
    targetId: "summary",
    merchantId: null,
    metadata: { window: days },
  });

  const response: SummaryResponse = {
    window: days,
    totalVolumeCents,
    transactionCount: count,
    activeMerchantCount: activeMerchants,
    averageTicketCents,
    dailyVolume,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
