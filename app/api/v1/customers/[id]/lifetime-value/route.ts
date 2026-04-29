import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import type { V1Ltv } from "@/lib/api/v1/customers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, merchantId: true },
  });
  if (!customer || customer.merchantId !== auth.merchant.id) {
    return apiError("not_found", "Customer not found", { requestId: auth.requestId });
  }

  const transactions = await prisma.transaction.findMany({
    where: { customerId: id, status: "succeeded" },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  let totalSpentCents = 0;
  let highestTicketCents = 0;
  const byYearMap = new Map<number, { spent: number; count: number }>();

  for (const t of transactions) {
    const cents = Math.round(t.amount * 100);
    totalSpentCents += cents;
    if (cents > highestTicketCents) highestTicketCents = cents;
    const year = t.createdAt.getUTCFullYear();
    const existing = byYearMap.get(year) ?? { spent: 0, count: 0 };
    existing.spent += cents;
    existing.count += 1;
    byYearMap.set(year, existing);
  }

  const totalTransactions = transactions.length;
  const averageTicketCents = totalTransactions > 0 ? Math.round(totalSpentCents / totalTransactions) : 0;

  const body: V1Ltv = {
    customer_id: id,
    total_spent_cents: totalSpentCents,
    total_transactions: totalTransactions,
    average_ticket_cents: averageTicketCents,
    highest_ticket_cents: highestTicketCents,
    by_year: Array.from(byYearMap.entries()).sort((a, b) => a[0] - b[0]).map(([year, d]) => ({ year, spent_cents: d.spent, transaction_count: d.count })),
    computed_at: new Date().toISOString(),
  };

  const response = NextResponse.json(body);
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
