import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import type { CustomerDetail } from "@/lib/customers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string | null; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      savedPaymentMethods: { orderBy: { createdAt: "desc" }, take: 50 },
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
      merchant: { select: { businessName: true } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "customer.view",
    targetType: "Customer",
    targetId: customer.id,
    merchantId: customer.merchantId,
    metadata: { email: customer.email, businessName: customer.merchant.businessName },
  });

  const detail: CustomerDetail = {
    id: customer.id,
    merchantId: customer.merchantId,
    merchantName: customer.merchant.businessName,
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
