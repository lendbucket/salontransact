import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { computeChargebackRisk } from "@/lib/risk/chargeback-monitor";
import type { MerchantRiskRow } from "@/lib/risk/types";

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
  const windowDays = Math.min(
    Math.max(parseInt(url.searchParams.get("windowDays") ?? "90", 10) || 90, 7),
    365
  );

  const merchants = await prisma.merchant.findMany({
    where: { status: "active" },
    select: { id: true, businessName: true, email: true },
  });

  const rows: MerchantRiskRow[] = await Promise.all(
    merchants.map(async (m) => {
      const metrics = await computeChargebackRisk({
        merchantId: m.id,
        windowDays,
      });

      const windowStart = new Date(Date.now() - windowDays * 86400000);
      const volumeAgg = await prisma.transaction.aggregate({
        where: {
          merchantId: m.id,
          status: "succeeded",
          createdAt: { gte: windowStart },
        },
        _sum: { amount: true },
      });
      const totalVolumeCents = Math.round((volumeAgg._sum.amount ?? 0) * 100);

      return {
        ...metrics,
        businessName: m.businessName,
        ownerEmail: m.email,
        totalVolumeCents,
      };
    })
  );

  rows.sort((a, b) => b.chargebackRatio - a.chargebackRatio);

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "risk.view",
    targetType: "Risk",
    targetId: "all-merchants",
    merchantId: null,
    metadata: {
      windowDays,
      merchantCount: rows.length,
      criticalCount: rows.filter((r) => r.status === "critical").length,
      warningCount: rows.filter((r) => r.status === "warning").length,
    },
  });

  return NextResponse.json({ data: rows, windowDays, count: rows.length });
}
