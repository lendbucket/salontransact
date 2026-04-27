"use client";

import { Badge } from "@/components/ui/badge";

type Payout = {
  id: string;
  stripePayoutId: string | null;
  amount: number;
  status: string;
  arrivalDate: Date | string | null;
  createdAt: Date | string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PayoutCard({ payout: p }: { payout: Payout }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p
            className="font-semibold tabular-nums"
            style={{ fontSize: 15, color: "#1A1313" }}
          >
            {formatMoney(p.amount)}
          </p>
          <Badge status={p.status} showDot={false} />
        </div>
        <p className="truncate" style={{ fontSize: 13, color: "#4A4A4A" }}>
          {p.arrivalDate
            ? `Arrives ${fmtDate(p.arrivalDate)}`
            : "Arrival date pending"}
        </p>
        <p className="truncate mt-0.5" style={{ fontSize: 12, color: "#878787" }}>
          {fmtDate(p.createdAt)}
        </p>
      </div>
    </div>
  );
}
