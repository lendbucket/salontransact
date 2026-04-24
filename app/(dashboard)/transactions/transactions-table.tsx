"use client";

import { useMemo, useState } from "react";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
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

const PAGE_SIZE = 20;

export function TransactionsTable({ transactions }: { transactions: Tx[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = transactions;
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (t) =>
          (t.customerEmail ?? "").toLowerCase().includes(q) ||
          (t.customerName ?? "").toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          (t.stripePaymentId ?? "").toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q)
      );
    }
    return result;
  }, [query, statusFilter, transactions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function exportCsv() {
    const headers = [
      "Date",
      "Transaction ID",
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
      t.stripePaymentId ?? t.id,
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
    <div className="st-card">
      {/* Filter bar */}
      <div className="p-6 pb-0">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search transactions..."
              className="st-input pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="st-input w-auto"
          >
            <option value="all">All statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={exportCsv}
            className="btn-outline flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      {paged.length === 0 ? (
        <div className="px-6 pb-6">
          <div className="py-12 text-center">
            <Search className="w-8 h-8 mx-auto mb-3 text-muted" />
            <p className="text-sm text-muted">No transactions found.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Transaction ID</th>
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium text-right">Fee</th>
                  <th className="pb-3 font-medium text-right">Net</th>
                  <th className="pb-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t"
                    style={{ borderColor: "#E8EAED" }}
                  >
                    <td className="py-3 text-muted whitespace-nowrap">
                      {format(new Date(t.createdAt), "MMM d, HH:mm")}
                    </td>
                    <td className="py-3 text-muted font-mono text-xs max-w-[120px] truncate">
                      {t.stripePaymentId ?? t.id}
                    </td>
                    <td className="py-3 text-foreground">
                      {t.customerName ?? t.customerEmail ?? "--"}
                    </td>
                    <td className="py-3 text-secondary max-w-[140px] truncate">
                      {t.description ?? "--"}
                    </td>
                    <td className="py-3 text-foreground text-right font-medium">
                      {formatMoney(t.amount)}
                    </td>
                    <td className="py-3 text-muted text-right">
                      {formatMoney(t.fee)}
                    </td>
                    <td className="py-3 text-foreground text-right">
                      {formatMoney(t.net)}
                    </td>
                    <td className="py-3 text-right">
                      <Badge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: "#E8EAED" }}>
            <p className="text-xs text-muted">
              {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg disabled:opacity-30 cursor-pointer"
                style={{ color: "#878787" }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setPage(Math.min(totalPages - 1, page + 1))
                }
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg disabled:opacity-30 cursor-pointer"
                style={{ color: "#878787" }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
