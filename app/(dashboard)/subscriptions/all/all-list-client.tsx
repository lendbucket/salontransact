"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ChevronRight, Repeat, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";

// ─────────────────────────────────────────────────────────────────
// Types — mirrors the GET /api/subscriptions response shape
// ─────────────────────────────────────────────────────────────────

interface SubscriptionListRow {
  id: string;
  status: string;
  anchorDay: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string | null;
  trialEnd: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  customerId: string;
  savedCardId: string;
  source: string;
  createdAt: string;
  plan: {
    id: string;
    name: string;
    amountCents: number;
    interval: string;
    intervalCount: number;
  };
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past Due" },
  { value: "paused", label: "Paused" },
  { value: "canceled", label: "Canceled" },
] as const;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtInterval(plan: SubscriptionListRow["plan"]): string {
  const unit = plan.interval === "MONTHLY" ? "mo" : plan.interval === "WEEKLY" ? "wk" : "yr";
  return plan.intervalCount === 1 ? `/ ${unit}` : `/ ${plan.intervalCount} ${unit}`;
}

function statusBadgeStyle(status: string): { background: string; color: string } {
  switch (status) {
    case "active":
      return { background: "#E6F4EA", color: "#1E8E3E" };
    case "trialing":
      return { background: "#E8F0FE", color: "#1A73E8" };
    case "past_due":
      return { background: "#FCE8E6", color: "#C5221F" };
    case "paused":
      return { background: "#FEF7E0", color: "#B06000" };
    case "canceled":
    case "incomplete_expired":
      return { background: "#F4F5F7", color: "#878787" };
    case "incomplete":
      return { background: "#FEF7E0", color: "#B06000" };
    default:
      return { background: "#F4F5F7", color: "#4A4A4A" };
  }
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

export function AllListClient() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [rows, setRows] = useState<SubscriptionListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/subscriptions?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Load failed (${res.status})`);
        setRows([]);
        return;
      }
      const json = (await res.json()) as { subscriptions: SubscriptionListRow[] };
      setRows(json.subscriptions ?? []);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      {/* Top bar: filter pills + create button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value || "all"}
                onClick={() => setStatusFilter(f.value)}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? "#017ea7" : "#4A4A4A",
                  background: active ? "#E8F4F8" : "#F9FAFB",
                  border: active ? "1px solid #017ea7" : "1px solid #E8EAED",
                  borderRadius: 6,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <Link
          href="/subscriptions/all/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 500,
            color: "white",
            background: "#017ea7",
            border: "none",
            borderRadius: 6,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <Plus size={14} />
          New Subscription
        </Link>
      </div>

      {/* Body */}
      {loading ? (
        <Card padding={32}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#878787", gap: 8 }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 13 }}>Loading subscriptions…</span>
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card padding={48}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 16px", borderRadius: 9999, background: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Repeat size={32} strokeWidth={1.5} color="#878787" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>
              {statusFilter ? `No ${statusFilter} subscriptions` : "No subscriptions yet"}
            </p>
            <p style={{ fontSize: 13, color: "#878787", marginBottom: 16 }}>
              {statusFilter ? "Try a different status filter." : "Subscriptions appear here once you create one."}
            </p>
            {!statusFilter && (
              <Link
                href="/subscriptions/all/new"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "white",
                  background: "#017ea7",
                  border: "none",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                <Plus size={14} />
                Create your first subscription
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <Card noPadding>
          {/* Desktop table */}
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead style={{ background: "#F9FAFB" }}>
                <tr>
                  <Th>Customer</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th>Next Billing</Th>
                  <Th>Amount</Th>
                  <th style={{ padding: "10px 16px" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const sty = statusBadgeStyle(row.status);
                  return (
                    <tr key={row.id} style={{ borderTop: "1px solid #F4F5F7" }}>
                      <Td>
                        <span style={{ fontWeight: 500, color: "#1A1313" }}>
                          {row.customerId.slice(0, 12)}…
                        </span>
                        <div style={{ fontSize: 11, color: "#878787", marginTop: 2 }}>
                          {row.source}
                        </div>
                      </Td>
                      <Td>
                        <span style={{ fontWeight: 500, color: "#1A1313" }}>{row.plan.name}</span>
                        <div style={{ fontSize: 11, color: "#878787", marginTop: 2 }}>
                          {fmtMoney(row.plan.amountCents)} {fmtInterval(row.plan)}
                        </div>
                      </Td>
                      <Td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            background: sty.background,
                            color: sty.color,
                            borderRadius: 4,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {row.status}
                        </span>
                      </Td>
                      <Td muted>{fmtDate(row.nextBillingDate)}</Td>
                      <Td>{fmtMoney(row.plan.amountCents)}</Td>
                      <td style={{ padding: "12px 16px" }}>
                        <Link
                          href={`/subscriptions/all/${row.id}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#017ea7", textDecoration: "none", fontWeight: 500 }}
                        >
                          View<ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden">
            {rows.map((row) => {
              const sty = statusBadgeStyle(row.status);
              return (
                <Link
                  key={row.id}
                  href={`/subscriptions/all/${row.id}`}
                  style={{ display: "block", padding: "14px 16px", borderTop: "1px solid #F4F5F7", textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1313" }}>{row.plan.name}</div>
                    <span
                      style={{
                        padding: "2px 6px",
                        fontSize: 10,
                        fontWeight: 600,
                        background: sty.background,
                        color: sty.color,
                        borderRadius: 4,
                        textTransform: "uppercase",
                      }}
                    >
                      {row.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#4A4A4A", marginBottom: 4 }}>
                    {row.customerId.slice(0, 16)}…
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#878787" }}>
                    <span>Next: {fmtDate(row.nextBillingDate)}</span>
                    <span>{fmtMoney(row.plan.amountCents)} {fmtInterval(row.plan)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td style={{ padding: "12px 16px", fontSize: 13, color: muted ? "#4A4A4A" : "#1A1313" }}>
      {children}
    </td>
  );
}
