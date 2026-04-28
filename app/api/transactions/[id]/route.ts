import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TransactionDetail } from "@/app/master/transactions/_lib/transaction-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal" && user.role !== "merchant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const t = await prisma.transaction.findUnique({
    where: { id },
    include: {
      merchant: {
        select: {
          id: true,
          businessName: true,
          city: true,
          state: true,
        },
      },
    },
  });
  if (!t) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  if (user.role === "merchant") {
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!merchant || merchant.id !== t.merchantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const detail: TransactionDetail = {
    id: t.id,
    merchantId: t.merchant.id,
    merchantBusinessName: t.merchant.businessName,
    merchantCity: t.merchant.city,
    merchantState: t.merchant.state,
    amount: t.amount,
    currency: t.currency,
    status: t.status,
    description: t.description,
    customerEmail: t.customerEmail,
    customerName: t.customerName,
    fee: t.fee,
    net: t.net,
    refunded: t.refunded,
    refundAmount: t.refundAmount,
    stripePaymentId: t.stripePaymentId,
    metadata: t.metadata as Record<string, unknown> | null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };

  return NextResponse.json(detail);
}
