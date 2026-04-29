import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { StylistSummary, StylistListResponse, StylistRole, StylistStatus } from "@/lib/stylists/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const merchantIdFilter = url.searchParams.get("merchantId");
  const status = url.searchParams.get("status");
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "100", 10) || 100,
    500
  );

  const whereClause: Record<string, unknown> = {};
  if (merchantIdFilter && merchantIdFilter.length > 0) {
    whereClause.merchantId = merchantIdFilter;
  }
  if (status === "active" || status === "inactive") {
    whereClause.status = status;
  }
  if (search.length > 0) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.stylist.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      merchant: { select: { businessName: true } },
    },
  });

  const data: StylistSummary[] = rows.map((r) => ({
    id: r.id,
    merchantId: r.merchantId,
    merchantName: r.merchant.businessName,
    name: r.name,
    email: r.email,
    phone: r.phone,
    role: r.role as StylistRole,
    commissionRate: r.commissionRate,
    hourlyRate: r.hourlyRate,
    payoutMethod: r.payoutMethod,
    status: r.status as StylistStatus,
    externalRef: r.externalRef,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({
    data,
    count: data.length,
  } satisfies StylistListResponse);
}
