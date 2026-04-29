import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CustomerListResponse, CustomerSummary } from "@/lib/customers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "merchant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);

  const whereClause: Record<string, unknown> = { merchantId: merchant.id };

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
    },
  });

  const data: CustomerSummary[] = rows.map((r) => ({
    id: r.id,
    merchantId: r.merchantId,
    email: r.email,
    name: r.name,
    phone: r.phone,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
    totalTransactions: r.totalTransactions,
    totalSpentCents: r.totalSpentCents,
    savedCardCount: r._count.savedPaymentMethods,
  }));

  return NextResponse.json({ data, count: data.length } satisfies CustomerListResponse);
}
