"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Calendar, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import type { BookingSummary, BookingListResponse } from "@/lib/bookings/types";

const STATUS_FILTERS = ["all", "booked", "arrived", "completed", "cancelled", "no_show"] as const;

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function bookingStatusKind(status: string): string {
  if (status === "completed") return "active";
  if (status === "booked" || status === "arrived") return "pending";
  if (status === "cancelled" || status === "no_show") return "failed";
  return "neutral";
}

export function BookingsClient() {
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message }); setTimeout(() => setToast(null), 4000);
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/bookings?${params.toString()}`);
      if (!res.ok) { showToast("error", "Load failed"); return; }
      const data = (await res.json()) as BookingListResponse;
      setBookings(data.data);
    } catch (e) { showToast("error", e instanceof Error ? e.message : "Load failed"); }
    finally { setLoading(false); }
  }, [statusFilter, showToast]);

  useEffect(() => { refetch(); }, [refetch]);

  return (
    <>
      {toast && <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}><Toast kind={toast.kind} message={toast.message} /></div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, padding: 4, background: "#F4F5F7", borderRadius: 8, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "6px 12px", fontSize: 13, fontWeight: 500, borderRadius: 6, border: "none", cursor: "pointer", background: statusFilter === s ? "#FFFFFF" : "transparent", color: statusFilter === s ? "#1A1313" : "#878787", boxShadow: statusFilter === s ? "0 1px 2px rgba(0,0,0,0.05)" : "none" }}>
              {s === "all" ? "All" : s === "no_show" ? "No-Show" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <Button variant="secondary" leadingIcon={<RefreshCw size={14} />} onClick={refetch} loading={loading}>Refresh</Button>
      </div>

      {loading ? (
        <Card padding={32}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#878787", gap: 8 }}><Loader2 size={16} className="animate-spin" /><span style={{ fontSize: 13 }}>Loading…</span></div></Card>
      ) : bookings.length === 0 ? (
        <Card padding={48}><div style={{ textAlign: "center" }}><div style={{ width: 80, height: 80, margin: "0 auto 16px", borderRadius: 9999, background: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}><Calendar size={32} strokeWidth={1.5} color="#878787" /></div><p style={{ fontSize: 15, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>No bookings yet</p><p style={{ fontSize: 13, color: "#878787" }}>Bookings appear when your booking system connects, or you can add one manually.</p></div></Card>
      ) : (
        <Card noPadding>
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead style={{ background: "#F9FAFB" }}><tr><Th>Scheduled</Th><Th>Service</Th><Th>Stylist</Th><Th>Customer</Th><Th>Amount</Th><Th>Card</Th><Th>Status</Th></tr></thead>
              <tbody>{bookings.map((b) => (
                <tr key={b.id} style={{ borderTop: "1px solid #F4F5F7" }}>
                  <Td>{fmtDateLocale(b.scheduledFor)}</Td>
                  <Td>{b.serviceName ?? "—"}</Td>
                  <Td muted>{b.stylistName ?? "—"}</Td>
                  <Td muted>{b.customerName ?? b.customerEmail ?? "—"}</Td>
                  <Td>{b.expectedAmountCents > 0 ? fmtMoney(b.expectedAmountCents) : "—"}</Td>
                  <Td muted>{b.hasCardOnFile ? "✓" : "—"}{b.hasAuthHold ? " (held)" : ""}</Td>
                  <Td><StatusPill status={bookingStatusKind(b.status)} label={b.status === "no_show" ? "No-Show" : b.status.charAt(0).toUpperCase() + b.status.slice(1)} /></Td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="md:hidden">{bookings.map((b) => (
            <div key={b.id} style={{ padding: "14px 16px", borderTop: "1px solid #F4F5F7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1313" }}>{b.serviceName ?? "Appointment"}</span>
                <StatusPill status={bookingStatusKind(b.status)} label={b.status === "no_show" ? "No-Show" : b.status.charAt(0).toUpperCase() + b.status.slice(1)} />
              </div>
              <div style={{ fontSize: 12, color: "#878787" }}>{fmtDateLocale(b.scheduledFor)}{b.stylistName ? ` · ${b.stylistName}` : ""}</div>
              {b.expectedAmountCents > 0 && <div style={{ fontSize: 12, color: "#4A4A4A", marginTop: 4 }}>{fmtMoney(b.expectedAmountCents)}{b.hasCardOnFile ? " · Card on file" : ""}</div>}
            </div>
          ))}</div>
        </Card>
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</th>; }
function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) { return <td style={{ padding: "12px 16px", fontSize: 13, color: muted ? "#4A4A4A" : "#1A1313" }}>{children}</td>; }
