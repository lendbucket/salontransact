import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MasterTransactionsClient } from "./master-transactions-client";
import type { TransactionSummary } from "./_lib/transaction-types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ merchantId?: string }>;
}

export default async function MasterTransactionsPage({
  searchParams,
}: PageProps) {
  await requireMaster();
  const params = await searchParams;
  const merchantIdScope = params.merchantId ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (merchantIdScope) where.merchantId = merchantIdScope;

  const [rows, scopeMerchant] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        merchant: { select: { id: true, businessName: true } },
      },
    }),
    merchantIdScope
      ? prisma.merchant.findUnique({
          where: { id: merchantIdScope },
          select: { id: true, businessName: true },
        })
      : Promise.resolve(null),
  ]);

  const initialTransactions: TransactionSummary[] = rows.map((t) => ({
    id: t.id,
    merchantId: t.merchant.id,
    merchantBusinessName: t.merchant.businessName,
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
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1
        className="text-2xl font-semibold text-[#1A1313] mb-1"
        style={{ letterSpacing: "-0.31px" }}
      >
        Transactions
      </h1>
      <p className="text-sm text-[#878787] mb-8">
        {scopeMerchant
          ? `Payments processed for ${scopeMerchant.businessName}`
          : "All payments processed across the platform"}
      </p>
      <MasterTransactionsClient
        initialTransactions={initialTransactions}
        scopedMerchantId={merchantIdScope}
        scopedMerchant={scopeMerchant}
      />
    </div>
  );
}
