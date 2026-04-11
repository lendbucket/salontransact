import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function statusColor(status: string) {
  if (status === "paid") return "#22c55e";
  if (status === "pending" || status === "in_transit") return "#f59e0b";
  if (status === "failed" || status === "canceled") return "#ef4444";
  return "#8b949e";
}

export default async function PayoutsPage() {
  const { merchant } = await requireMerchant();

  const payouts = await prisma.payout.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-1">Payouts</h1>
      <p className="text-sm text-muted mb-8">
        Funds transferred to your bank account
      </p>

      <div className="card p-6">
        {payouts.length === 0 ? (
          <p className="text-sm text-muted py-12 text-center">
            No payouts yet. Payouts appear after Stripe processes settlements.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b">
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium">Arrival</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p: { id: string; merchantId: string; stripePayoutId: string | null; amount: number; currency: string; status: string; arrivalDate: Date | null; description: string | null; createdAt: Date; updatedAt: Date }) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-3 text-muted whitespace-nowrap">
                      {format(p.createdAt, "MMM d, yyyy")}
                    </td>
                    <td className="py-3 text-white whitespace-nowrap">
                      {p.arrivalDate
                        ? format(p.arrivalDate, "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="py-3 text-white">
                      {formatMoney(p.amount)}
                    </td>
                    <td className="py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          color: statusColor(p.status),
                          background: `${statusColor(p.status)}1a`,
                        }}
                      >
                        {p.status}
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
