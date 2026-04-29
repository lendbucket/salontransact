import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { classifyTier, daysSince } from "@/lib/api/v1/customers/compute";
import type { V1Customer } from "@/lib/api/v1/customers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const phone = (url.searchParams.get("phone") ?? "").trim();
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();

  if (!phone && !email) {
    return apiError("validation_error", "Either phone or email query parameter is required", { requestId: auth.requestId });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { merchantId: auth.merchant.id };
  if (phone) where.phone = phone;
  else where.email = email;

  const row = await prisma.customer.findFirst({
    where,
    include: { _count: { select: { savedPaymentMethods: true } } },
  });

  if (!row) return apiError("not_found", "Customer not found", { requestId: auth.requestId });

  const yearAgo = new Date(Date.now() - 365 * 86400000);
  const visits365 = await prisma.transaction.count({
    where: { customerId: row.id, status: "succeeded", createdAt: { gte: yearAgo } },
  });

  const now = new Date();
  const tier = classifyTier({ totalTransactions: row.totalTransactions, visitsLast365Days: visits365, firstSeenAt: row.firstSeenAt, lastSeenAt: row.lastSeenAt, now });

  const body: V1Customer = {
    id: row.id, object: "customer", email: row.email, name: row.name, phone: row.phone, tier,
    total_transactions: row.totalTransactions, total_spent_cents: row.totalSpentCents,
    saved_card_count: row._count.savedPaymentMethods, days_since_last_visit: daysSince(row.lastSeenAt, now),
    first_seen_at: row.firstSeenAt.toISOString(), last_seen_at: row.lastSeenAt.toISOString(), created_at: row.firstSeenAt.toISOString(),
  };

  const response = NextResponse.json(body);
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
