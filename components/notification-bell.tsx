"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import type {
  NotificationPublic,
  NotificationListResponse,
  NotificationCountResponse,
} from "@/lib/notifications/types";

const POLL_INTERVAL_MS = 30000;

interface Props {
  fullPagePath: string;
}

export function NotificationBell({ fullPagePath }: Props) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count");
      if (!res.ok) return;
      const data = (await res.json()) as NotificationCountResponse;
      setUnreadCount(data.unreadCount);
    } catch {
      // silent
    }
  }, []);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=5");
      if (!res.ok) return;
      const data = (await res.json()) as NotificationListResponse;
      setItems(data.data);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    function onFocus() { fetchCount(); }
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchCount]);

  useEffect(() => {
    if (open) fetchPreview();
  }, [open, fetchPreview]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  async function markRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  }

  async function markAllRead() {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }

  function severityDot(severity: string): string {
    if (severity === "error") return "#DC2626";
    if (severity === "warning") return "#92400E";
    if (severity === "success") return "#15803D";
    return "#017ea7";
  }

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: "none",
          color: "#878787",
          cursor: "pointer",
          position: "relative",
        }}
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <Bell size={16} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 8,
              background: "#DC2626",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 40,
            width: 360,
            maxWidth: "calc(100vw - 32px)",
            background: "#FFFFFF",
            border: "1px solid #E8EAED",
            borderRadius: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid #E8EAED",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontSize: 11,
                  color: "#017ea7",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Check size={12} />
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#878787" }}>
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <Bell size={32} strokeWidth={1.5} color="#878787" style={{ margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontSize: 13, fontWeight: 500, color: "#1A1313", marginBottom: 2 }}>
                  No notifications
                </p>
                <p style={{ fontSize: 11, color: "#878787" }}>
                  You&apos;re all caught up
                </p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                    if (n.link) {
                      window.location.href = n.link;
                    }
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    borderBottom: "1px solid #F4F5F7",
                    background: n.read ? "transparent" : "#F0F9FF",
                    border: "none",
                    cursor: n.link || !n.read ? "pointer" : "default",
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: severityDot(n.severity),
                      flexShrink: 0,
                      marginTop: 6,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 2 }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#4A4A4A", lineHeight: 1.4, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: 10, color: "#878787" }}>
                      {timeAgo(n.createdAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div
            style={{
              padding: "8px 14px",
              borderTop: "1px solid #E8EAED",
              textAlign: "center",
            }}
          >
            <Link
              href={fullPagePath}
              onClick={() => setOpen(false)}
              style={{ fontSize: 12, color: "#017ea7", textDecoration: "none" }}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}
