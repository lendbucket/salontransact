import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DollarSign, CreditCard, CheckCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default async function AnalyticsPage() {
  const { merchant } = await requireMerchant();

  const [totalCount, successCount, totalAgg, recent] = await Promise.all([
    prisma.transaction.count({ where: { merchantId: merchant.id } }),
    prisma.transaction.count({ where: { merchantId: merchant.id, status: "succeeded" } }),
    prisma.transaction.aggregate({ where: { merchantId: merchant.id, status: "succeeded" }, _sum: { amount: true } }),
    prisma.transaction.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const totalVolume = totalAgg._sum.amount ?? 0;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  const stats = [
    { label: "Total Transactions", value: totalCount.toString(), Icon: CreditCard, iconBg: "#E6F4F8", iconColor: "#017ea7" },
    { label: "Total Volume", value: fmt(totalVolume), Icon: DollarSign, iconBg: "#E6F4F8", iconColor: "#017ea7" },
    { label: "Success Rate", value: `${successRate}%`, Icon: CheckCircle, iconBg: "#F0FDF4", iconColor: "#166534" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-[#1A1313] mb-1">Analytics</h1>
      <p className="text-sm text-[#878787] mb-8">Payment processing insights and metrics</p>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-card-icon" style={{ background: s.iconBg }}>
                <s.Icon size={18} strokeWidth={1.5} style={{ color: s.iconColor }} />
              </div>
              <span className="stat-card-label">{s.label}</span>
            </div>
            <p className="stat-card-value">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="section-header" style={{ padding: "16px 20px" }}>
          <span className="section-title">Recent Transactions</span>
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-[#E6F4F8] flex items-center justify-center mb-4">
              <TrendingUp size={20} strokeWidth={1.5} className="text-[#017ea7]" />
            </div>
            <p className="text-sm font-medium text-[#1A1313] mb-1">No transactions yet</p>
            <p className="text-[13px] text-[#878787]">Analytics will populate as you process payments</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {["Date", "Description", "Customer", "Amount", "Status"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ color: "#878787", fontSize: 13 }}>
                      {format(tx.createdAt, "MMM d, yyyy")}
                    </td>
                    <td>{tx.description || "Payment"}</td>
                    <td style={{ color: "#4A4A4A" }}>
                      {tx.customerName || tx.customerEmail || "--"}
                    </td>
                    <td style={{ fontWeight: 500, fontFamily: "monospace" }}>
                      {fmt(tx.amount)}
                    </td>
                    <td>
                      <span className={`badge ${tx.status === "succeeded" ? "badge-success" : "badge-pending"}`}>
                        <span className="badge-dot" />
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
