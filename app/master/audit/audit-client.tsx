"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import type {
  AuditLogPublic,
  AuditLogListResponse,
} from "@/lib/audit/types";

const KNOWN_ACTIONS = [
  "all",
  "merchant.suspend",
  "merchant.reactivate",
  "merchant.plan_change",
  "merchant.update",
  "saved_card.revoke",
  "device.charge.initiated",
  "device.charge.failed",
  "transaction.refund",
  "transaction.reverse",
];

interface Props {
  initialEntries: AuditLogPublic[];
  allMerchants: { id: string; businessName: string }[];
}

export function AuditClient({ initialEntries, allMerchants }: Props) {
  const [entries, setEntries] = useState<AuditLogPublic[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [merchantFilter, setMerchantFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
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
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (merchantFilter) params.set("merchantId", merchantFilter);
      if (debouncedQuery.length > 0) params.set("q", debouncedQuery);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/master/audit?${params.toString()}`);
      if (!res.ok) {
        showToast("error", "Failed to load audit log");
        return;
      }
      const data = (await res.json()) as AuditLogListResponse;
      setEntries(data.data);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Reload failed");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, merchantFilter, debouncedQuery, fromDate, toDate]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    function handleFocus() {
      refetch();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetch]);

  const stats = useMemo(() => {
    const total = entries.length;
    const uniqueActors = new Set(entries.map((e) => e.actorId)).size;
    const uniqueMerchants = new Set(
      entries.map((e) => e.merchantId).filter((id) => !!id)
    ).size;
    const oneDayAgo = Date.now() - 86_400_000;
    const last24h = entries.filter(
      (e) => new Date(e.createdAt).getTime() > oneDayAgo
    ).length;
    return { total, uniqueActors, uniqueMerchants, last24h };
  }, [entries]);

  function actionLabel(action: string): string {
    return action
      .split(".")
      .map(
        (p) => p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " ")
      )
      .join(" \u2192 ");
  }

  return (
    <>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 80,
            right: 24,
            zIndex: 100,
            minWidth: 280,
          }}
        >
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Entries</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{stats.total}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Last 24h</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{stats.last24h}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Actors</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{stats.uniqueActors}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Merchants</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{stats.uniqueMerchants}</p>
        </Card>
      </div>

      <Card padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Input
              leadingIcon={<Search size={16} />}
              placeholder="Search actor, action, target..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1"
              style={{ minWidth: 220 }}
            />
            <Button variant="secondary" leadingIcon={<RefreshCw size={14} />} onClick={refetch} loading={loading}>
              Refresh
            </Button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E8EAED", fontSize: 13, background: "#fff", color: "#1A1313", cursor: "pointer" }}
            >
              {KNOWN_ACTIONS.map((a) => (
                <option key={a} value={a}>{a === "all" ? "All actions" : a}</option>
              ))}
            </select>
            <select
              value={merchantFilter}
              onChange={(e) => setMerchantFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E8EAED", fontSize: 13, background: "#fff", color: "#1A1313", cursor: "pointer" }}
            >
              <option value="">All merchants</option>
              {allMerchants.map((m) => (
                <option key={m.id} value={m.id}>{m.businessName}</option>
              ))}
            </select>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E8EAED", fontSize: 13, background: "#fff", color: "#1A1313" }} />
            <span style={{ fontSize: 12, color: "#878787" }}>to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E8EAED", fontSize: 13, background: "#fff", color: "#1A1313" }} />
            {(actionFilter !== "all" || merchantFilter || fromDate || toDate) && (
              <Button variant="ghost" onClick={() => { setActionFilter("all"); setMerchantFilter(""); setFromDate(""); setToDate(""); }}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {loading && entries.length === 0 ? (
        <Card><div style={{ padding: 32, textAlign: "center", fontSize: 14, color: "#878787" }}>Loading audit log...</div></Card>
      ) : entries.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <ScrollText size={48} strokeWidth={1.5} color="#878787" style={{ margin: "0 auto 16px" }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>No audit entries yet</p>
            <p style={{ fontSize: 14, color: "#878787" }}>Sensitive actions will appear here as they happen.</p>
          </div>
        </Card>
      ) : (
        <Card noPadding>
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead style={{ background: "#F9FAFB" }}>
                <tr>
                  <th style={{ width: 32, padding: "10px 12px" }} />
                  <Th>When</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Target</Th>
                  <Th>Merchant</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const isExpanded = expandedId === e.id;
                  const hasMetadata = e.metadata && Object.keys(e.metadata).length > 0;
                  return (
                    <tr key={e.id} style={{ borderTop: "1px solid #F4F5F7", cursor: hasMetadata ? "pointer" : "default" }} onClick={() => hasMetadata && setExpandedId(isExpanded ? null : e.id)}>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        {hasMetadata ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
                      </td>
                      <Td muted>{fmtDateLocale(e.createdAt)}</Td>
                      <Td>
                        <div>{e.actorEmail}</div>
                        <div style={{ fontSize: 11, color: "#878787", marginTop: 2 }}>{e.actorRole}</div>
                      </Td>
                      <Td mono>{actionLabel(e.action)}</Td>
                      <Td muted>
                        <div>{e.targetType}</div>
                        <div style={{ fontSize: 11, color: "#878787", fontFamily: "monospace", marginTop: 2 }}>{e.targetId.slice(0, 24)}{e.targetId.length > 24 ? "\u2026" : ""}</div>
                      </Td>
                      <Td>{e.merchantBusinessName ?? <span style={{ color: "#878787" }}>{"\u2014"}</span>}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            {entries.map((e) => {
              const isExpanded = expandedId === e.id;
              const hasMetadata = e.metadata && Object.keys(e.metadata).length > 0;
              return (
                <div key={e.id} style={{ padding: "14px 16px", borderBottom: "1px solid #F4F5F7" }} onClick={() => hasMetadata && setExpandedId(isExpanded ? null : e.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", fontFamily: "monospace" }}>{actionLabel(e.action)}</span>
                    {hasMetadata && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                  </div>
                  <div style={{ fontSize: 12, color: "#4A4A4A", marginBottom: 2 }}>{e.actorEmail} ({e.actorRole})</div>
                  <div style={{ fontSize: 12, color: "#878787" }}>{fmtDateLocale(e.createdAt)}</div>
                  {e.merchantBusinessName && <div style={{ fontSize: 12, color: "#017ea7", marginTop: 4 }}>{e.merchantBusinessName}</div>}
                  {isExpanded && hasMetadata && (
                    <pre style={{ fontSize: 11, marginTop: 8, padding: 8, background: "#F9FAFB", borderRadius: 6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {JSON.stringify(e.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</th>;
}

function Td({ children, muted, mono }: { children: React.ReactNode; muted?: boolean; mono?: boolean }) {
  return <td style={{ padding: "14px 16px", fontSize: 13, color: muted ? "#4A4A4A" : "#1A1313", fontFamily: mono ? "monospace" : undefined }}>{children}</td>;
}
