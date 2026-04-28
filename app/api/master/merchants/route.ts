import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  MerchantListResponse,
  MerchantSummary,
} from "@/app/master/merchants/_lib/merchant-types";

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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim() ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (status && status !== "all") {
    where.status = status;
  }
  if (q.length > 0) {
    where.OR = [
      { businessName: { contains: q, mode: "insensitive" } },
      { dbaName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { ein: { contains: q } },
    ];
  }

  const rows = await prisma.merchant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      businessName: true,
      dbaName: true,
      email: true,
      phone: true,
      status: true,
      plan: true,
      totalVolume: true,
      totalTransactions: true,
      createdAt: true,
      city: true,
      state: true,
      applicationSubmittedAt: true,
    },
  });

  const merchants: MerchantSummary[] = rows.map((r) => ({
    id: r.id,
    businessName: r.businessName,
    dbaName: r.dbaName,
    email: r.email,
    phone: r.phone,
    status: r.status,
    plan: r.plan,
    totalVolume: r.totalVolume,
    totalTransactions: r.totalTransactions,
    createdAt: r.createdAt.toISOString(),
    city: r.city,
    state: r.state,
    applicationSubmittedAt: r.applicationSubmittedAt?.toISOString() ?? null,
  }));

  const response: MerchantListResponse = {
    merchants,
    total: merchants.length,
  };

  return NextResponse.json(response);
}
