"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import type {
  NotificationPublic,
  NotificationListResponse,
  NotificationCategory,
} from "@/lib/notifications/types";

interface Props {
  initialNotifications: NotificationPublic[];
}

const CATEGORIES: { id: "all" | NotificationCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "charge", label: "Charges" },
  { id: "refund", label: "Refunds" },
  { id: "dispute", label: "Disputes" },
  { id: "payout", label: "Payouts" },
  { id: "merchant", label: "Merchants" },
  { id: "platform", label: "Platform" },
  { id: "system", label: "System" },
];

export function NotificationsFeed({ initialNotifications }: Props) {
  const [items, setItems] = useState<NotificationPublic[]>(initialNotifications);
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | NotificationCategory>("all");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (unreadOnly) params.set("unreadOnly", "true");
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("limit", "200");
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) {
        showToast("error", "Failed to load notifications");
        return;
      }
      const data = (await res.json()) as NotificationListResponse;
      setItems(data.data);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Reload failed");
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, categoryFilter]);

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

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function markRead(id: string) {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (!res.ok) return;
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // silent
    }
  }

  async function markAllRead() {
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!res.ok) {
        showToast("error", "Failed");
        return;
      }
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      showToast("success", "All marked as read");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Failed");
    }
  }

  const stats = useMemo(() => {
    const unread = items.filter((n) => !n.read).length;
    return { total: items.length, unread };
  }, [items]);

  function severityColor(severity: string): { bg: string; fg: string } {
    if (severity === "error") return { bg: "#FEE2E2", fg: "#DC2626" };
    if (severity === "warning") return { bg: "#FEF3C7", fg: "#92400E" };
    if (severity === "success") return { bg: "#D1FAE5", fg: "#15803D" };
    return { bg: "#DBEAFE", fg: "#017ea7" };
  }

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <Card padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#878787" }}>
                {stats.unread} unread of {stats.total}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="secondary" leadingIcon={<RefreshCw size={14} />} onClick={refetch} loading={loading}>
                Refresh
              </Button>
              <Button variant="primary" leadingIcon={<Check size={14} />} onClick={markAllRead} disabled={stats.unread === 0}>
                Mark all read
              </Button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Button
              variant={unreadOnly ? "primary" : "secondary"}
              onClick={() => setUnreadOnly((u) => !u)}
            >
              {unreadOnly ? "Showing unread" : "Show unread only"}
            </Button>
            <div style={{ width: 1, height: 24, background: "#E8EAED", margin: "0 8px" }} />
            {CATEGORIES.map((c) => (
              <Button
                key={c.id}
                variant={categoryFilter === c.id ? "primary" : "secondary"}
                onClick={() => setCategoryFilter(c.id)}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ width: 120, height: 120, margin: "0 auto 16px", borderRadius: 9999, background: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={48} strokeWidth={1.5} color="#878787" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>
              No notifications
            </p>
            <p style={{ fontSize: 14, color: "#878787", maxWidth: 360, margin: "0 auto" }}>
              You&apos;re all caught up
            </p>
          </div>
        </Card>
      ) : (
        <Card noPadding>
          {items.map((n) => {
            const colors = severityColor(n.severity);
            return (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "14px 16px",
                  borderBottom: "1px solid #F4F5F7",
                  background: n.read ? "transparent" : "#FAFCFF",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (!n.read) markRead(n.id);
                  const isMaster = window.location.pathname.startsWith("/master");
                  window.location.href = isMaster
                    ? `/master/notifications/${n.id}`
                    : `/notifications/${n.id}`;
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    borderRadius: 18,
                    background: colors.bg,
                    color: colors.fg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {n.category.slice(0, 1)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1313" }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: 11, color: "#878787", flexShrink: 0 }}>
                      {fmtDateLocale(n.createdAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#4A4A4A", lineHeight: 1.5 }}>
                    {n.message}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "#878787", display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                      {n.category}
                    </span>
                    {!n.read && (
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: "#017ea7" }} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
