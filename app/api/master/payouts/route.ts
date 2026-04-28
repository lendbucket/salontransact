import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MasterPayoutListResponse, MasterPayoutRow } from "@/lib/payouts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user || !user.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.role !== "master portal") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const merchantIdParam = url.searchParams.get("merchantId");
  const statusParam = url.searchParams.get("status") ?? "all";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (merchantIdParam && merchantIdParam.length > 0) where.merchantId = merchantIdParam;
  if (statusParam !== "all" && statusParam.length > 0) where.status = statusParam;

  const rows = await prisma.payout.findMany({
    where, orderBy: [{ arrivalDate: "desc" }, { createdAt: "desc" }], take: 500,
    include: { merchant: { select: { id: true, businessName: true } } },
  });

  const data: MasterPayoutRow[] = rows.map((r) => ({
    id: r.id, merchantId: r.merchantId, merchantBusinessName: r.merchant.businessName,
    amount: r.amount, currency: r.currency, status: r.status,
    arrivalDate: r.arrivalDate?.toISOString() ?? null,
    description: r.description, batchId: r.batchId, createdAt: r.createdAt.toISOString(),
  }));

  const totalAmount = data.reduce((s, p) => s + p.amount, 0);
  const merchantsRepresented = new Set(data.map((p) => p.merchantId)).size;
  return NextResponse.json({ data, count: data.length, totalAmount, merchantsRepresented } satisfies MasterPayoutListResponse);
}
