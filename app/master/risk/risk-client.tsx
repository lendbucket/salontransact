"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Toast } from "@/components/ui/toast";
import {
  type MerchantRiskRow,
  type RiskStatus,
  VISA_MONITORING_THRESHOLD,
  VISA_EXCESSIVE_THRESHOLD,
} from "@/lib/risk/types";

const WINDOW_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
];

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtRatio(ratio: number): string {
  return `${ratio.toFixed(2)}%`;
}

function statusKindForPill(s: RiskStatus): string {
  if (s === "critical") return "failed";
  if (s === "warning") return "pending";
  return "active";
}

function statusLabel(s: RiskStatus): string {
  if (s === "critical") return "Critical";
  if (s === "warning") return "Warning";
  return "Safe";
}

export function RiskClient() {
  const [windowDays, setWindowDays] = useState<number>(90);
  const [rows, setRows] = useState<MerchantRiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchRisk = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/master/risk?windowDays=${windowDays}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Load failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setRows(data.data ?? []);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [windowDays, showToast]);

  useEffect(() => {
    fetchRisk();
  }, [fetchRisk]);

  const criticalCount = rows.filter((r) => r.status === "critical").length;
  const warningCount = rows.filter((r) => r.status === "warning").length;
  const safeCount = rows.filter((r) => r.status === "safe").length;

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {WINDOW_OPTIONS.map((opt) => {
          const active = opt.value === windowDays;
          return (
            <button
              key={opt.value}
              onClick={() => setWindowDays(opt.value)}
              style={{
                height: 36,
                padding: "0 14px",
                background: active ? "#017ea7" : "#FFFFFF",
                color: active ? "#FFFFFF" : "#1A1313",
                border: `1px solid ${active ? "#017ea7" : "#D1D5DB"}`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card padding={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldAlert size={20} strokeWidth={1.5} color="#DC2626" />
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Critical</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: "#1A1313" }}>{criticalCount}</p>
            </div>
          </div>
        </Card>
        <Card padding={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={20} strokeWidth={1.5} color="#9A3412" />
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Warning</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: "#1A1313" }}>{warningCount}</p>
            </div>
          </div>
        </Card>
        <Card padding={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={20} strokeWidth={1.5} color="#15803D" />
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Safe</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: "#1A1313" }}>{safeCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={16}>
        <p style={{ fontSize: 11, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Visa thresholds</p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, color: "#4A4A4A" }}>
          <span><strong style={{ color: "#15803D" }}>{"<"} 0.40%</strong> safe</span>
          <span><strong style={{ color: "#9A3412" }}>0.40% – 0.65%</strong> warning</span>
          <span><strong style={{ color: "#DC2626" }}>{"\u2265"} {VISA_MONITORING_THRESHOLD}%</strong> Visa Chargeback Monitoring</span>
          <span><strong style={{ color: "#DC2626" }}>{"\u2265"} {VISA_EXCESSIVE_THRESHOLD}%</strong> excessive (penalty zone)</span>
        </div>
      </Card>

      <div style={{ height: 24 }} />

      {loading ? (
        <Card padding={32}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#878787", gap: 8 }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 13 }}>Loading risk metrics…</span>
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card padding={48}>
          <div style={{ textAlign: "center", color: "#878787", fontSize: 13 }}>No active merchants to monitor.</div>
        </Card>
      ) : (
        <Card noPadding>
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead style={{ background: "#F9FAFB" }}>
                <tr>
                  <Th>Merchant</Th>
                  <Th>Volume ({windowDays}d)</Th>
                  <Th>Transactions</Th>
                  <Th>Chargebacks</Th>
                  <Th>Ratio</Th>
                  <Th>Status</Th>
                  <th style={{ padding: "10px 16px" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.merchantId} style={{ borderTop: "1px solid #F4F5F7" }}>
                    <Td>
                      <Link href={`/master/merchants/${r.merchantId}`} style={{ fontWeight: 600, color: "#1A1313", textDecoration: "none" }}>
                        {r.businessName}
                      </Link>
                      <div style={{ fontSize: 11, color: "#878787" }}>{r.ownerEmail}</div>
                    </Td>
                    <Td muted>{fmtMoney(r.totalVolumeCents)}</Td>
                    <Td muted>{r.completedTransactions.toLocaleString()}</Td>
                    <Td muted>{r.chargebackCount.toLocaleString()}</Td>
                    <Td>
                      <span style={{ fontWeight: 600, color: r.status === "critical" ? "#DC2626" : r.status === "warning" ? "#9A3412" : "#15803D" }}>
                        {fmtRatio(r.chargebackRatio)}
                      </span>
                    </Td>
                    <Td><StatusPill status={statusKindForPill(r.status)} label={statusLabel(r.status)} /></Td>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/master/merchants/${r.merchantId}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#017ea7", textDecoration: "none", fontWeight: 500 }}>
                        View<ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            {rows.map((r) => (
              <Link key={r.merchantId} href={`/master/merchants/${r.merchantId}`} style={{ display: "block", padding: "14px 16px", borderTop: "1px solid #F4F5F7", textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.businessName}</div>
                    <div style={{ fontSize: 11, color: "#878787" }}>{r.ownerEmail}</div>
                  </div>
                  <StatusPill status={statusKindForPill(r.status)} label={statusLabel(r.status)} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#878787" }}>
                  <span>{r.completedTransactions} txns · {r.chargebackCount} CB</span>
                  <span style={{ fontWeight: 600, color: r.status === "critical" ? "#DC2626" : r.status === "warning" ? "#9A3412" : "#15803D" }}>
                    {fmtRatio(r.chargebackRatio)}
                  </span>
                </div>
              </Link>
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
  return <td style={{ padding: "12px 16px", fontSize: 13, color: muted ? "#4A4A4A" : "#1A1313" }}>{children}</td>;
}
