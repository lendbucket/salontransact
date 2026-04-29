import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import type { CustomerListResponse, CustomerSummary } from "@/lib/customers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string | null; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const merchantIdFilter = url.searchParams.get("merchantId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 500);

  const whereClause: Record<string, unknown> = {};
  if (merchantIdFilter && merchantIdFilter.length > 0) {
    whereClause.merchantId = merchantIdFilter;
  }
  if (search.length > 0) {
    whereClause.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.customer.findMany({
    where: whereClause,
    orderBy: { lastSeenAt: "desc" },
    take: limit,
    include: {
      _count: { select: { savedPaymentMethods: true } },
      merchant: { select: { businessName: true } },
    },
  });

  const data: CustomerSummary[] = rows.map((r) => ({
    id: r.id,
    merchantId: r.merchantId,
    merchantName: r.merchant.businessName,
    email: r.email,
    name: r.name,
    phone: r.phone,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
    totalTransactions: r.totalTransactions,
    totalSpentCents: r.totalSpentCents,
    savedCardCount: r._count.savedPaymentMethods,
  }));

  if (search.length > 0) {
    await writeAuditLog({
      actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
      action: "customer.search",
      targetType: "Customer",
      targetId: "search",
      merchantId: merchantIdFilter ?? null,
      metadata: { search, results: data.length },
    });
  }

  return NextResponse.json({ data, count: data.length } satisfies CustomerListResponse);
}
