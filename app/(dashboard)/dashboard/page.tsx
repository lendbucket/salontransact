import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DollarSign, TrendingUp, CreditCard, Clock } from "lucide-react";
import { format } from "date-fns";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function statusColor(status: string) {
  if (status === "succeeded" || status === "paid") return "#22c55e";
  if (status === "pending" || status === "processing") return "#f59e0b";
  if (status === "failed" || status === "canceled") return "#ef4444";
  return "#8b949e";
}

export default async function DashboardPage() {
  const { merchant } = await requireMerchant();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [monthAgg, recent, pendingPayoutsAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        merchantId: merchant.id,
        status: "succeeded",
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.payout.aggregate({
      where: {
        merchantId: merchant.id,
        status: { in: ["pending", "in_transit"] },
      },
      _sum: { amount: true },
    }),
  ]);

  const stats = [
    {
      label: "Total Volume",
      value: formatMoney(merchant.totalVolume),
      icon: DollarSign,
    },
    {
      label: "This Month",
      value: formatMoney(monthAgg._sum.amount ?? 0),
      icon: TrendingUp,
    },
    {
      label: "Transactions",
      value: merchant.totalTransactions.toLocaleString(),
      icon: CreditCard,
    },
    {
      label: "Pending Payouts",
      value: formatMoney(pendingPayoutsAgg._sum.amount ?? 0),
      icon: Clock,
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-1">Dashboard</h1>
      <p className="text-sm text-muted mb-8">
        Welcome back, {merchant.businessName}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat: { label: string; value: string; icon: typeof DollarSign }) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-wider text-muted">
                  {stat.label}
                </span>
                <Icon className="w-4 h-4" style={{ color: "#606E74" }} />
              </div>
              <p className="text-2xl font-semibold text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Recent transactions
        </h2>

        {recent.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">
            No transactions yet. Connect your Stripe account to start accepting
            payments.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tx: { id: string; merchantId: string; stripePaymentId: string | null; amount: number; currency: string; status: string; description: string | null; customerEmail: string | null; customerName: string | null; fee: number; net: number; refunded: boolean; refundAmount: number; metadata: unknown; createdAt: Date; updatedAt: Date }) => (
                  <tr key={tx.id} className="border-b last:border-0">
                    <td className="py-3 text-muted">
                      {format(tx.createdAt, "MMM d, yyyy")}
                    </td>
                    <td className="py-3 text-white">
                      {tx.customerEmail ?? "—"}
                    </td>
                    <td className="py-3 text-white">
                      {formatMoney(tx.amount)}
                    </td>
                    <td className="py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          color: statusColor(tx.status),
                          background: `${statusColor(tx.status)}1a`,
                        }}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
