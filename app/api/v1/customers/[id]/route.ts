import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { classifyTier, daysSince } from "@/lib/api/v1/customers/compute";
import type { V1CustomerDetail } from "@/lib/api/v1/customers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const row = await prisma.customer.findUnique({
    where: { id },
    include: {
      savedPaymentMethods: { orderBy: { createdAt: "desc" }, take: 50 },
      transactions: { orderBy: { createdAt: "desc" }, take: 25 },
      _count: { select: { savedPaymentMethods: true } },
    },
  });

  if (!row || row.merchantId !== auth.merchant.id) {
    return apiError("not_found", "Customer not found", { requestId: auth.requestId });
  }

  const yearAgo = new Date(Date.now() - 365 * 86400000);
  const visits365 = await prisma.transaction.count({
    where: { customerId: row.id, status: "succeeded", createdAt: { gte: yearAgo } },
  });

  const now = new Date();
  const tier = classifyTier({ totalTransactions: row.totalTransactions, visitsLast365Days: visits365, firstSeenAt: row.firstSeenAt, lastSeenAt: row.lastSeenAt, now });

  const detail: V1CustomerDetail = {
    id: row.id, object: "customer", email: row.email, name: row.name, phone: row.phone, tier,
    total_transactions: row.totalTransactions, total_spent_cents: row.totalSpentCents,
    saved_card_count: row._count.savedPaymentMethods, days_since_last_visit: daysSince(row.lastSeenAt, now),
    first_seen_at: row.firstSeenAt.toISOString(), last_seen_at: row.lastSeenAt.toISOString(), created_at: row.firstSeenAt.toISOString(),
    saved_cards: row.savedPaymentMethods.map((c) => ({
      id: c.id, last4: c.last4, brand: c.cardScheme, expiry_month: c.expiryMonth, expiry_year: c.expiryYear,
      cardholder_name: c.cardholderName, label: c.label, status: c.status,
      created_at: c.createdAt.toISOString(), last_used_at: c.lastUsedAt?.toISOString() ?? null,
    })),
    recent_transactions: row.transactions.map((t) => ({
      id: `ch_${t.id}`, amount_cents: Math.round(t.amount * 100), tip_amount_cents: Math.round(t.tipAmount * 100),
      status: t.status, description: t.description, stylist_id: t.stylistId, booking_id: t.bookingId,
      created_at: t.createdAt.toISOString(),
    })),
  };

  const response = NextResponse.json(detail);
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
