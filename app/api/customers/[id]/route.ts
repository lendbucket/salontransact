import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CustomerDetail } from "@/lib/customers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      savedPaymentMethods: { orderBy: { createdAt: "desc" }, take: 50 },
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!customer || customer.merchantId !== merchant.id) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const detail: CustomerDetail = {
    id: customer.id,
    merchantId: customer.merchantId,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    firstSeenAt: customer.firstSeenAt.toISOString(),
    lastSeenAt: customer.lastSeenAt.toISOString(),
    totalTransactions: customer.totalTransactions,
    totalSpentCents: customer.totalSpentCents,
    savedCards: customer.savedPaymentMethods.map((s) => ({
      id: s.id,
      payrocSecureTokenId: s.payrocSecureTokenId,
      cardScheme: s.cardScheme,
      last4: s.last4,
      expiryMonth: s.expiryMonth,
      expiryYear: s.expiryYear,
      cardholderName: s.cardholderName,
      label: s.label,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
    })),
    recentTransactions: customer.transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      status: t.status,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  };

  return NextResponse.json(detail);
}
