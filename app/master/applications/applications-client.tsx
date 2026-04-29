"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  RefreshCw,
  ClipboardList,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import {
  type ApplicationListResponse,
  type ApplicationSummary,
  type ApplicationStatusFilter,
  APPLICATION_STATUS_LABELS,
} from "@/lib/applications/types";

const FILTERS: Array<{ id: ApplicationStatusFilter; label: string }> = [
  { id: "submitted", label: "Pending Review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

function statusKind(status: string): string {
  if (status === "approved") return "active";
  if (status === "rejected") return "failed";
  if (status === "submitted") return "pending";
  return "neutral";
}

export function ApplicationsClient() {
  const [filter, setFilter] = useState<ApplicationStatusFilter>("submitted");
  const [data, setData] = useState<ApplicationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchList = useCallback(
    async (statusFilter: ApplicationStatusFilter, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetch(`/api/master/applications?status=${statusFilter}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          showToast("error", (j as { error?: string }).error ?? `Load failed (${res.status})`);
          return;
        }
        const json = (await res.json()) as ApplicationListResponse;
        setData(json);
      } catch (e) {
        showToast("error", e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchList(filter);
  }, [fetchList, filter]);

  const rows = data?.data ?? [];
  const pendingCount = data?.pendingCount ?? 0;

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, padding: 4, background: "#F4F5F7", borderRadius: 8, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const isPendingTab = f.id === "submitted";
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: filter === f.id ? "#FFFFFF" : "transparent",
                  color: filter === f.id ? "#1A1313" : "#878787",
                  boxShadow: filter === f.id ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                {f.label}
                {isPendingTab && pendingCount > 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      padding: "2px 6px",
                      fontSize: 10,
                      fontWeight: 600,
                      background: "#017ea7",
                      color: "#FFFFFF",
                      borderRadius: 9999,
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Button
          variant="secondary"
          leadingIcon={<RefreshCw size={14} />}
          onClick={() => fetchList(filter, true)}
          loading={refreshing}
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card padding={32}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#878787", gap: 8 }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 13 }}>Loading applications…</span>
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card padding={48}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 16px", borderRadius: 9999, background: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardList size={32} strokeWidth={1.5} color="#878787" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>
              No applications {filter === "all" ? "yet" : `with status "${APPLICATION_STATUS_LABELS[filter as keyof typeof APPLICATION_STATUS_LABELS] ?? filter}"`}
            </p>
            <p style={{ fontSize: 13, color: "#878787" }}>
              {filter === "submitted" ? "All applications have been reviewed." : "Try a different filter."}
            </p>
          </div>
        </Card>
      ) : (
        <Card noPadding>
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead style={{ background: "#F9FAFB" }}>
                <tr>
                  <Th>Business</Th>
                  <Th>Owner</Th>
                  <Th>Email</Th>
                  <Th>Submitted</Th>
                  <Th>Agreement</Th>
                  <Th>Status</Th>
                  <th style={{ padding: "10px 16px" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid #F4F5F7" }}>
                    <Td>
                      <div style={{ fontWeight: 600, color: "#1A1313" }}>{row.legalBusinessName}</div>
                      {row.dba && <div style={{ fontSize: 11, color: "#878787" }}>DBA: {row.dba}</div>}
                    </Td>
                    <Td muted>{row.ownerFullName}</Td>
                    <Td muted>{row.ownerEmail}</Td>
                    <Td muted>{fmtDateLocale(row.submittedAt)}</Td>
                    <Td>
                      {row.hasSignedAgreement ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#15803D", fontSize: 12 }}>
                          <FileText size={12} /> Signed
                        </span>
                      ) : (
                        <span style={{ color: "#878787", fontSize: 12 }}>—</span>
                      )}
                    </Td>
                    <Td>
                      <StatusPill
                        status={statusKind(row.status)}
                        label={APPLICATION_STATUS_LABELS[row.status]}
                      />
                    </Td>
                    <td style={{ padding: "12px 16px" }}>
                      <Link
                        href={`/master/applications/${row.id}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#017ea7", textDecoration: "none", fontWeight: 500 }}
                      >
                        Review
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/master/applications/${row.id}`}
                style={{ display: "block", padding: "14px 16px", borderTop: "1px solid #F4F5F7", textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1A1313", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                      {row.legalBusinessName}
                    </div>
                    {row.dba && <div style={{ fontSize: 11, color: "#878787", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>DBA: {row.dba}</div>}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <StatusPill status={statusKind(row.status)} label={APPLICATION_STATUS_LABELS[row.status]} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#4A4A4A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                  {row.ownerFullName} · {row.ownerEmail}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#878787" }}>
                  <span>Submitted {fmtDateLocale(row.submittedAt)}</span>
                  {row.hasSignedAgreement && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#15803D" }}>
                      <FileText size={11} /> Signed
                    </span>
                  )}
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
