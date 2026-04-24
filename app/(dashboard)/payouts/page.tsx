import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Wallet } from "lucide-react";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function PayoutsPage() {
  const { merchant } = await requireMerchant();

  const [payouts, availableAgg] = await Promise.all([
    prisma.payout.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.transaction.aggregate({
      where: {
        merchantId: merchant.id,
        status: "succeeded",
      },
      _sum: { net: true },
    }),
  ]);

  const paidOut = payouts
    .filter((p: { status: string }) => p.status === "paid")
    .reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
  const available = (availableAgg._sum.net ?? 0) - paidOut;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-1">Payouts</h1>
      <p className="text-sm text-secondary mb-8">
        Funds transferred to your bank account
      </p>

      {/* Summary card */}
      <div className="st-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "#E6F4F8" }}
            >
              <DollarSign className="w-5 h-5" style={{ color: "#017ea7" }} />
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-0.5">
                Available Balance
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {formatMoney(Math.max(0, available))}
              </p>
            </div>
          </div>
          <button className="btn-primary flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Request Payout
          </button>
        </div>
      </div>

      {/* Payouts table */}
      <div className="st-card p-6">
        {payouts.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet className="w-8 h-8 mx-auto mb-3 text-muted" />
            <p className="text-sm text-muted">
              No payouts yet. Payouts appear after Stripe processes settlements.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Payout ID</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Arrival Date</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map(
                  (p: {
                    id: string;
                    stripePayoutId: string | null;
                    amount: number;
                    status: string;
                    arrivalDate: Date | null;
                    createdAt: Date;
                  }) => (
                    <tr
                      key={p.id}
                      className="border-t"
                      style={{ borderColor: "#E8EAED" }}
                    >
                      <td className="py-3 text-muted whitespace-nowrap">
                        {format(p.createdAt, "MMM d, yyyy")}
                      </td>
                      <td className="py-3 text-muted font-mono text-xs">
                        {p.stripePayoutId ?? p.id}
                      </td>
                      <td className="py-3 text-foreground text-right font-medium">
                        {formatMoney(p.amount)}
                      </td>
                      <td className="py-3">
                        <Badge status={p.status} />
                      </td>
                      <td className="py-3 text-secondary whitespace-nowrap">
                        {p.arrivalDate
                          ? format(p.arrivalDate, "MMM d, yyyy")
                          : "--"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
