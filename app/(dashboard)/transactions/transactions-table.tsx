"use client";

import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { format } from "date-fns";

type Tx = {
  id: string;
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

function statusColor(status: string) {
  if (status === "succeeded") return "#22c55e";
  if (status === "pending" || status === "processing") return "#f59e0b";
  if (status === "failed" || status === "canceled") return "#ef4444";
  return "#8b949e";
}

export function TransactionsTable({ transactions }: { transactions: Tx[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (t) =>
        (t.customerEmail ?? "").toLowerCase().includes(q) ||
        (t.customerName ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q)
    );
  }, [query, transactions]);

  function exportCsv() {
    const headers = [
      "Date",
      "Customer",
      "Email",
      "Description",
      "Amount",
      "Fee",
      "Net",
      "Status",
    ];
    const rows = filtered.map((t) => [
      format(new Date(t.createdAt), "yyyy-MM-dd HH:mm"),
      t.customerName ?? "",
      t.customerEmail ?? "",
      (t.description ?? "").replace(/"/g, '""'),
      t.amount.toFixed(2),
      t.fee.toFixed(2),
      t.net.toFixed(2),
      t.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card p-6">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer, status, description..."
            className="input pl-9"
          />
        </div>
        <button
          onClick={exportCsv}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted py-12 text-center">
          No transactions found.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Fee</th>
                <th className="pb-3 font-medium">Net</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-3 text-muted whitespace-nowrap">
                    {format(new Date(t.createdAt), "MMM d, HH:mm")}
                  </td>
                  <td className="py-3 text-white">
                    {t.customerName ?? t.customerEmail ?? "—"}
                  </td>
                  <td className="py-3 text-white">{formatMoney(t.amount)}</td>
                  <td className="py-3 text-muted">{formatMoney(t.fee)}</td>
                  <td className="py-3 text-white">{formatMoney(t.net)}</td>
                  <td className="py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        color: statusColor(t.status),
                        background: `${statusColor(t.status)}1a`,
                      }}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
