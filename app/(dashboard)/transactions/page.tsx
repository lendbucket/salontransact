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
      <h1 className="text-2xl font-semibold text-foreground mb-1">
        Transactions
      </h1>
      <p className="text-sm text-secondary mb-8">
        All payments processed for {merchant.businessName}
      </p>

      <TransactionsTable
        transactions={transactions.map(
          (t: {
            id: string;
            stripePaymentId: string | null;
            amount: number;
            status: string;
            description: string | null;
            customerEmail: string | null;
            customerName: string | null;
            fee: number;
            net: number;
            createdAt: Date;
          }) => ({
            id: t.id,
            stripePaymentId: t.stripePaymentId,
            createdAt: t.createdAt.toISOString(),
            customerEmail: t.customerEmail,
            customerName: t.customerName,
            amount: t.amount,
            fee: t.fee,
            net: t.net,
            status: t.status,
            description: t.description,
          })
        )}
      />
    </div>
  );
}
