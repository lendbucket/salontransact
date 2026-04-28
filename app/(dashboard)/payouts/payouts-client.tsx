"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import type { PayoutPublic, PayoutListResponse } from "@/lib/payouts/types";

function fmtUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function payoutStatusKind(status: string): string {
  const s = status.toLowerCase();
  if (s === "paid" || s === "settled" || s === "complete") return "active";
  if (s === "in_transit" || s === "pending" || s === "open") return "pending";
  if (s === "failed" || s === "returned") return "failed";
  return "neutral";
}

interface Props {
  initialPayouts: PayoutPublic[];
}

export function PayoutsClient({ initialPayouts }: Props) {
  const [payouts, setPayouts] = useState<PayoutPublic[]>(initialPayouts);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "in_transit" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/payouts?${params.toString()}`);
      if (!res.ok) { showToast("error", "Failed to load payouts"); return; }
      const data = (await res.json()) as PayoutListResponse;
      setPayouts(data.data);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Reload failed");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { refetch(); }, [refetch]);
  useEffect(() => {
    function handleFocus() { refetch(); }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetch]);

  const filtered = useMemo(() => {
    if (!debouncedQuery) return payouts;
    return payouts.filter((p) => `${p.description ?? ""} ${p.batchId ?? ""} ${fmtUSD(p.amount)}`.toLowerCase().includes(debouncedQuery));
  }, [payouts, debouncedQuery]);

  const stats = useMemo(() => {
    const total = payouts.length;
    const totalAmount = payouts.reduce((s, p) => s + p.amount, 0);
    const paidAmount = payouts.filter((p) => p.status === "paid" || p.status === "settled").reduce((s, p) => s + p.amount, 0);
    const pendingAmount = payouts.filter((p) => p.status === "in_transit" || p.status === "pending").reduce((s, p) => s + p.amount, 0);
    return { total, totalAmount, paidAmount, pendingAmount };
  }, [payouts]);

  return (
    <>
      {toast && <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}><Toast kind={toast.kind} message={toast.message} /></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card padding={16}><p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Payouts</p><p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313" }}>{stats.total}</p></Card>
        <Card padding={16}><p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Volume</p><p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313" }}>{fmtUSD(stats.totalAmount)}</p></Card>
        <Card padding={16}><p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Paid</p><p style={{ fontSize: 24, fontWeight: 600, color: "#15803D" }}>{fmtUSD(stats.paidAmount)}</p></Card>
        <Card padding={16}><p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Pending</p><p style={{ fontSize: 24, fontWeight: 600, color: "#92400E" }}>{fmtUSD(stats.pendingAmount)}</p></Card>
      </div>

      <Card padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Input leadingIcon={<Search size={16} />} placeholder="Search payouts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} containerClassName="flex-1" style={{ minWidth: 220 }} />
            <Button variant="secondary" leadingIcon={<RefreshCw size={14} />} onClick={refetch} loading={loading}>Refresh</Button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["all", "paid", "in_transit", "failed"] as const).map((s) => (
              <Button key={s} variant={statusFilter === s ? "primary" : "secondary"} onClick={() => setStatusFilter(s)}>
                {s === "all" ? "All" : s === "in_transit" ? "In Transit" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card><div style={{ textAlign: "center", padding: "32px 0" }}>
          <Wallet size={48} strokeWidth={1.5} color="#878787" style={{ margin: "0 auto 16px" }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>No payouts yet</p>
          <p style={{ fontSize: 14, color: "#878787" }}>When batches close, payouts will appear here.</p>
        </div></Card>
      ) : (
        <Card noPadding>
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead style={{ background: "#F9FAFB" }}>
                <tr><Th>Date</Th><Th>Amount</Th><Th>Description</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid #F4F5F7" }}>
                    <Td muted>{fmtDateLocale(p.arrivalDate ?? p.createdAt)}</Td>
                    <Td><span style={{ fontWeight: 600 }}>{fmtUSD(p.amount)}</span></Td>
                    <Td muted>{p.description ?? "\u2014"}</Td>
                    <Td><StatusPill status={payoutStatusKind(p.status)} label={p.status.toUpperCase().replace("_", " ")} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden">
            {filtered.map((p) => (
              <div key={p.id} style={{ padding: "14px 16px", borderBottom: "1px solid #F4F5F7" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "#1A1313" }}>{fmtUSD(p.amount)}</span>
                  <StatusPill status={payoutStatusKind(p.status)} label={p.status.toUpperCase().replace("_", " ")} />
                </div>
                <div style={{ fontSize: 12, color: "#878787" }}>{fmtDateLocale(p.arrivalDate ?? p.createdAt)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</th>;
}
function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <td style={{ padding: "14px 16px", fontSize: 13, color: muted ? "#4A4A4A" : "#1A1313" }}>{children}</td>;
}
