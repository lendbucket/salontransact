"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronRight,
  Inbox,
  Building2,
  X,
  RefreshCw,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import type {
  TransactionSummary,
  TransactionListResponse,
  TransactionStatusFilter,
} from "./_lib/transaction-types";

function fmtMoney(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    n
  );
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface Props {
  initialTransactions: TransactionSummary[];
  scopedMerchantId: string | null;
  scopedMerchant: { id: string; businessName: string } | null;
}

export function MasterTransactionsClient({
  initialTransactions,
  scopedMerchantId,
  scopedMerchant,
}: Props) {
  const [transactions, setTransactions] =
    useState<TransactionSummary[]>(initialTransactions);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] =
    useState<TransactionStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (scopedMerchantId) params.set("merchantId", scopedMerchantId);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedQuery.length > 0) params.set("q", debouncedQuery);
      const res = await fetch(
        `/api/master/transactions?${params.toString()}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as TransactionListResponse;
      setTransactions(data.transactions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [scopedMerchantId, statusFilter, debouncedQuery]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    function handleFocus() { refetch(); }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetch]);

  const stats = useMemo(() => {
    const total = transactions.length;
    const succeeded = transactions.filter(
      (t) => t.status === "succeeded"
    ).length;
    const refunded = transactions.filter((t) => t.refunded).length;
    const totalVolume = transactions
      .filter((t) => t.status === "succeeded")
      .reduce((s, t) => s + t.amount, 0);
    return { total, succeeded, refunded, totalVolume };
  }, [transactions]);

  function exportCsv() {
    const headers = [
      "Date",
      "ID",
      "Payment ID",
      "Merchant",
      "Customer",
      "Email",
      "Description",
      "Amount",
      "Fee",
      "Net",
      "Status",
      "Refunded",
    ];
    const rows = transactions.map((t) => [
      new Date(t.createdAt).toISOString(),
      t.id,
      t.stripePaymentId ?? "",
      t.merchantBusinessName,
      t.customerName ?? "",
      t.customerEmail ?? "",
      (t.description ?? "").replace(/"/g, '""'),
      t.amount.toFixed(2),
      t.fee.toFixed(2),
      t.net.toFixed(2),
      t.status,
      t.refunded ? "yes" : "no",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Volume</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{fmtMoney(stats.totalVolume)}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Transactions</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{stats.total}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Succeeded</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#15803D", letterSpacing: "-0.31px" }}>{stats.succeeded}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Refunded</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#878787", letterSpacing: "-0.31px" }}>{stats.refunded}</p>
        </Card>
      </div>

      <Card padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Input
              leadingIcon={<Search size={16} />}
              placeholder=""
              aria-label="Search transactions"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1"
              style={{ minWidth: 220 }}
            />
            <Button variant="secondary" leadingIcon={<RefreshCw size={14} />} onClick={refetch} loading={loading}>
              Refresh
            </Button>
            <Button variant="secondary" leadingIcon={<Download size={14} />} onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {(["all", "succeeded", "pending", "failed", "refunded"] as TransactionStatusFilter[]).map((s) => (
              <Button key={s} variant={statusFilter === s ? "primary" : "secondary"} onClick={() => setStatusFilter(s)}>
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
            {scopedMerchantId && (
              <Button variant="ghost" leadingIcon={<X size={14} />} onClick={() => (window.location.href = "/master/transactions")}>
                Clear merchant filter
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card noPadding>
        {loading && transactions.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", fontSize: 14, color: "#878787" }}>Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Inbox size={32} style={{ margin: "0 auto 12px", color: "#878787" }} strokeWidth={1.5} />
            <p style={{ fontSize: 14, fontWeight: 500, color: "#1A1313", marginBottom: 4 }}>No transactions found</p>
            <p style={{ fontSize: 13, color: "#878787" }}>
              {searchQuery || statusFilter !== "all" ? "Try adjusting your filters" : "No transactions yet"}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead style={{ background: "#F9FAFB" }}>
                  <tr>
                    <Th>Date</Th>
                    {!scopedMerchantId && <Th>Merchant</Th>}
                    <Th>Description</Th>
                    <Th>Customer</Th>
                    <Th align="right">Amount</Th>
                    <Th>Status</Th>
                    <th style={{ padding: "10px 16px" }} />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      style={{ borderTop: "1px solid #F4F5F7", cursor: "pointer", transition: "background 100ms ease" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      onClick={() => (window.location.href = `/transactions/${t.id}`)}
                    >
                      <Td muted>{fmtDateTime(t.createdAt)}</Td>
                      {!scopedMerchantId && (
                        <Td>
                          <Link
                            href={`/master/transactions?merchantId=${t.merchantId}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: "#017ea7", display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <Building2 size={12} />
                            {t.merchantBusinessName}
                          </Link>
                        </Td>
                      )}
                      <Td>{t.description ?? "Payment"}</Td>
                      <Td muted>{t.customerName ?? t.customerEmail ?? "\u2014"}</Td>
                      <Td align="right" mono>
                        {fmtMoney(t.amount, t.currency.toUpperCase())}
                        {t.refunded && (
                          <div style={{ fontSize: 11, color: "#878787", marginTop: 2 }}>
                            Refunded {fmtMoney(t.refundAmount)}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <StatusPill status={t.refunded ? "refunded" : t.status} />
                      </Td>
                      <td style={{ padding: "14px 16px" }}>
                        <ChevronRight size={16} color="#878787" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden">
              {transactions.map((t) => (
                <Link
                  key={t.id}
                  href={`/transactions/${t.id}`}
                  style={{ display: "block", padding: "14px 16px", borderBottom: "1px solid #F4F5F7", color: "inherit", textDecoration: "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", fontFamily: "monospace" }}>
                      {fmtMoney(t.amount, t.currency.toUpperCase())}
                    </span>
                    <StatusPill status={t.refunded ? "refunded" : t.status} />
                  </div>
                  <div style={{ fontSize: 13, color: "#4A4A4A", marginBottom: 2 }}>{t.description ?? "Payment"}</div>
                  <div style={{ fontSize: 12, color: "#878787" }}>
                    {t.merchantBusinessName} &middot; {fmtDateTime(t.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>
    </>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{ textAlign: align ?? "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {children}
    </th>
  );
}

function Td({ children, align, muted, mono }: { children: React.ReactNode; align?: "left" | "right"; muted?: boolean; mono?: boolean }) {
  return (
    <td style={{ padding: "14px 16px", textAlign: align ?? "left", fontSize: 13, color: muted ? "#4A4A4A" : "#1A1313", fontFamily: mono ? "monospace" : undefined }}>
      {children}
    </td>
  );
}
