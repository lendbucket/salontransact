"use client";

import { Badge } from "@/components/ui/badge";

type Tx = {
  id: string;
  stripePaymentId: string | null;
  createdAt: string;
  customerEmail: string | null;
  customerName: string | null;
  amount: number;
  fee: number;
  net: number;
  status: string;
  description: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TransactionCard({ transaction: t }: { transaction: Tx }) {
  const customer = t.customerName || t.customerEmail || "\u2014";
  const detail = t.description
    ? `${t.description} \u00B7 ${formatRelativeTime(t.createdAt)}`
    : formatRelativeTime(t.createdAt);

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p
            className="font-semibold tabular-nums"
            style={{ fontSize: 15, color: "#1A1313" }}
          >
            {formatMoney(t.amount)}
          </p>
          <Badge status={t.status} showDot={false} />
        </div>
        <p
          className="truncate"
          style={{ fontSize: 13, color: "#4A4A4A" }}
        >
          {customer}
        </p>
        <p
          className="truncate mt-0.5"
          style={{ fontSize: 12, color: "#878787" }}
        >
          {detail}
        </p>
      </div>
    </div>
  );
}
