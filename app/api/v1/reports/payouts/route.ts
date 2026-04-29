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
  const status = url.searchParams.get("status");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { merchantId: auth.merchant.id };
  if (from || to) {
    where.createdAt = {};
    if (from) { const d = new Date(from); if (!isNaN(d.getTime())) where.createdAt.gte = d; }
    if (to) { const d = new Date(to); if (!isNaN(d.getTime())) where.createdAt.lte = d; }
  }
  if (status) where.status = status;

  const payouts = await prisma.payout.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, amount: true, currency: true, status: true, arrivalDate: true, description: true, createdAt: true },
  });

  const data = payouts.map((p) => ({
    id: p.id,
    amount_cents: Math.round(p.amount * 100),
    currency: p.currency,
    status: p.status,
    arrival_date: p.arrivalDate?.toISOString() ?? null,
    description: p.description,
    created_at: p.createdAt.toISOString(),
  }));

  const totalCents = data.reduce((s, p) => s + p.amount_cents, 0);

  const response = NextResponse.json({ object: "report", type: "payouts", count: data.length, total_cents: totalCents, data });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
