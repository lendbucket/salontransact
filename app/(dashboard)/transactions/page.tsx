import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TransactionsTable } from "./transactions-table";

export default async function TransactionsPage() {
  const { merchant } = await requireMerchant();

  const transactions = await prisma.transaction.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-1">Transactions</h1>
      <p className="text-sm text-muted mb-8">
        All payments processed for {merchant.businessName}
      </p>

      <TransactionsTable
        transactions={transactions.map((t: { id: string; merchantId: string; stripePaymentId: string | null; amount: number; currency: string; status: string; description: string | null; customerEmail: string | null; customerName: string | null; fee: number; net: number; refunded: boolean; refundAmount: number; metadata: unknown; createdAt: Date; updatedAt: Date }) => ({
          id: t.id,
          createdAt: t.createdAt.toISOString(),
          customerEmail: t.customerEmail,
          customerName: t.customerName,
          amount: t.amount,
          fee: t.fee,
          net: t.net,
          status: t.status,
          description: t.description,
        }))}
      />
    </div>
  );
}
