import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TransactionDetailClient } from "./transaction-detail-client";
import type { TransactionDetail } from "@/app/master/transactions/_lib/transaction-types";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;
  if (!user || !user.id) redirect("/login");

  const { id } = await params;

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
  if (!t) notFound();

  if (user.role === "merchant") {
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!merchant || merchant.id !== t.merchantId) notFound();
  } else if (user.role !== "master portal") {
    notFound();
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

  const isMaster = user.role === "master portal";
  const backHref = isMaster ? "/master/transactions" : "/transactions";

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <Link
        href={backHref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "#878787",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        Back to transactions
      </Link>
      <TransactionDetailClient transaction={detail} isMaster={isMaster} />
    </div>
  );
}
