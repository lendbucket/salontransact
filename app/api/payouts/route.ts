import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PayoutListResponse, PayoutPublic } from "@/lib/payouts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveMerchantId(
  user: { id: string; role?: string },
  merchantIdParam: string | null
): Promise<{ merchantId: string } | { error: string; status: number }> {
  if (user.role === "master portal") {
    if (!merchantIdParam || merchantIdParam.length === 0)
      return { error: "master portal must provide merchantId", status: 400 };
    const exists = await prisma.merchant.findUnique({ where: { id: merchantIdParam }, select: { id: true } });
    if (!exists) return { error: "merchant not found", status: 404 };
    return { merchantId: merchantIdParam };
  }
  if (user.role === "merchant") {
    const merchant = await prisma.merchant.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!merchant) return { error: "merchant profile not found", status: 404 };
    return { merchantId: merchant.id };
  }
  return { error: "Forbidden", status: 403 };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user || !user.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.role !== "master portal" && user.role !== "merchant")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const resolved = await resolveMerchantId({ id: user.id, role: user.role }, url.searchParams.get("merchantId"));
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const statusParam = url.searchParams.get("status") ?? "all";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { merchantId: resolved.merchantId };
  if (statusParam !== "all" && statusParam.length > 0) where.status = statusParam;

  const rows = await prisma.payout.findMany({ where, orderBy: [{ arrivalDate: "desc" }, { createdAt: "desc" }], take: 200 });
  const data: PayoutPublic[] = rows.map((r) => ({
    id: r.id, merchantId: r.merchantId, amount: r.amount, currency: r.currency,
    status: r.status, arrivalDate: r.arrivalDate?.toISOString() ?? null,
    description: r.description, batchId: r.batchId, createdAt: r.createdAt.toISOString(),
  }));
  const totalAmount = data.reduce((s, p) => s + p.amount, 0);
  return NextResponse.json({ data, count: data.length, totalAmount } satisfies PayoutListResponse);
}
