import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DollarSign, TrendingUp, CreditCard, Clock, ShieldCheck } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { DashboardCharts } from "./dashboard-charts";
import { format } from "date-fns";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function DashboardPage() {
  const { merchant } = await requireMerchant();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const [monthAgg, lastMonthAgg, recent, pendingPayoutsAgg, weekAgg, lastWeekAgg, last30] =
    await Promise.all([
      prisma.transaction.aggregate({
        where: {
          merchantId: merchant.id,
          status: "succeeded",
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: {
          merchantId: merchant.id,
          status: "succeeded",
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
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
      prisma.transaction.aggregate({
        where: {
          merchantId: merchant.id,
          status: "succeeded",
          createdAt: { gte: startOfWeek },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          merchantId: merchant.id,
          status: "succeeded",
          createdAt: { gte: startOfLastWeek, lt: startOfWeek },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: {
          merchantId: merchant.id,
          status: "succeeded",
          createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
        },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  // Fetch chargeback risk for this merchant (90-day window)
  let riskRatio = 0;
  let riskStatus = "safe";
  let riskSubtitle = "90-day window";
  try {
    const { computeChargebackRisk } = await import("@/lib/risk/chargeback-monitor");
    const riskMetrics = await computeChargebackRisk({ merchantId: merchant.id, windowDays: 90 });
    riskRatio = riskMetrics.chargebackRatio;
    riskStatus = riskMetrics.status;
    riskSubtitle = `${riskMetrics.chargebackCount} of ${riskMetrics.completedTransactions} (90d)`;
  } catch {
    // Graceful degradation — dashboard still renders without risk data
  }

  const thisMonthVal = monthAgg._sum.amount ?? 0;
  const lastMonthVal = lastMonthAgg._sum.amount ?? 0;
  const monthTrend =
    lastMonthVal > 0
      ? (((thisMonthVal - lastMonthVal) / lastMonthVal) * 100).toFixed(1) + "%"
      : thisMonthVal > 0
        ? "100%"
        : "0%";

  const thisWeekVal = weekAgg._sum.amount ?? 0;
  const lastWeekVal = lastWeekAgg._sum.amount ?? 0;

  const totalSucceeded = merchant.totalTransactions;
  const avgTx = totalSucceeded > 0 ? merchant.totalVolume / totalSucceeded : 0;

  // Build 30-day chart data
  const chartData: { date: string; amount: number }[] = [];
  const dateMap = new Map<string, number>();
  for (const tx of last30) {
    const key = format(tx.createdAt, "MMM d");
    dateMap.set(key, (dateMap.get(key) ?? 0) + tx.amount);
  }
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = format(d, "MMM d");
    chartData.push({ date: key, amount: dateMap.get(key) ?? 0 });
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-1">
        Dashboard
      </h1>
      <p className="text-sm text-secondary mb-8">
        Welcome back, {merchant.businessName}
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Volume"
          value={formatMoney(merchant.totalVolume)}
          trend={{
            value: monthTrend,
            positive: thisMonthVal >= lastMonthVal,
          }}
          subtitle="vs last month"
          icon={DollarSign}
          iconBg="#E6F4F8"
          iconColor="#017ea7"
        />
        <StatCard
          title="This Month"
          value={formatMoney(thisMonthVal)}
          subtitle={`${monthAgg._count} transactions`}
          icon={TrendingUp}
          iconBg="#E6F4F8"
          iconColor="#017ea7"
        />
        <StatCard
          title="Transactions"
          value={merchant.totalTransactions.toLocaleString()}
          icon={CreditCard}
          iconBg="#F0FDF4"
          iconColor="#166534"
        />
        <StatCard
          title="Pending Payouts"
          value={formatMoney(pendingPayoutsAgg._sum.amount ?? 0)}
          subtitle="Est. 2-3 business days"
          icon={Clock}
          iconBg="#FFFBEB"
          iconColor="#92400E"
        />
        <StatCard
          title="Chargeback Health"
          value={`${riskRatio.toFixed(2)}%`}
          subtitle={riskSubtitle}
          icon={ShieldCheck}
          iconBg={riskStatus === "critical" ? "#FEF2F2" : riskStatus === "warning" ? "#FFF7ED" : "#F0FDF4"}
          iconColor={riskStatus === "critical" ? "#DC2626" : riskStatus === "warning" ? "#9A3412" : "#15803D"}
        />
      </div>

      {/* Chart */}
      <DashboardCharts chartData={chartData} />

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Recent transactions */}
        <div className="lg:col-span-2 st-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Recent Transactions
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">
              No transactions yet. Connect Stripe to start accepting payments.
            </p>
          ) : (
            <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(
                    (tx: {
                      id: string;
                      amount: number;
                      status: string;
                      description: string | null;
                      customerEmail: string | null;
                      customerName: string | null;
                      createdAt: Date;
                    }) => (
                      <tr
                        key={tx.id}
                        className="border-t"
                        style={{ borderColor: "#E8EAED" }}
                      >
                        <td className="py-3 text-muted whitespace-nowrap">
                          {format(tx.createdAt, "MMM d")}
                        </td>
                        <td className="py-3 text-foreground">
                          {tx.description ?? "Payment"}
                        </td>
                        <td className="py-3 text-secondary">
                          {tx.customerName ?? tx.customerEmail ?? "--"}
                        </td>
                        <td className="py-3 text-foreground text-right font-medium">
                          {formatMoney(tx.amount)}
                        </td>
                        <td className="py-3 text-right">
                          <StatusPill status={tx.status} />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#F4F5F7]">
              {recent.map(
                (tx: {
                  id: string;
                  amount: number;
                  status: string;
                  description: string | null;
                  customerEmail: string | null;
                  customerName: string | null;
                  createdAt: Date;
                }) => (
                  <div key={tx.id} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-foreground font-medium truncate">
                        {tx.description ?? "Payment"}
                      </span>
                      <StatusPill status={tx.status} />
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-semibold text-foreground">
                        {formatMoney(tx.amount)}
                      </span>
                      <span className="text-xs text-muted">
                        {format(tx.createdAt, "MMM d")}
                      </span>
                    </div>
                    <div className="text-xs text-secondary truncate">
                      {tx.customerName ?? tx.customerEmail ?? "\u2014"}
                    </div>
                  </div>
                )
              )}
            </div>
            </>
          )}
        </div>

        {/* Quick stats */}
        <div className="st-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-5">
            Quick Stats
          </h2>

          <div className="space-y-5">
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-1">
                Avg Transaction Value
              </p>
              <p className="text-xl font-semibold text-foreground">
                {formatMoney(avgTx)}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted uppercase tracking-wider">
                  Success Rate
                </p>
                <span className="text-xs text-foreground font-medium">
                  {totalSucceeded > 0 ? "99.8%" : "0%"}
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "#E8EAED" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    background: "#017ea7",
                    width: totalSucceeded > 0 ? "99.8%" : "0%",
                  }}
                />
              </div>
            </div>

            <div
              className="pt-4"
              style={{ borderTop: "1px solid #E8EAED" }}
            >
              <p className="text-xs text-muted uppercase tracking-wider mb-3">
                This Week vs Last Week
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary">This week</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatMoney(thisWeekVal)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-secondary">Last week</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatMoney(lastWeekVal)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
