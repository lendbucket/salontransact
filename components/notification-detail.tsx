"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import type {
  NotificationPublic,
  AuditLogPreview,
} from "@/lib/notifications/types";

interface Props {
  notification: NotificationPublic;
  auditLog: AuditLogPreview | null;
  backHref: string;
  auditLogHrefBase: string;
  showAuditLogLink: boolean;
}

function severityKind(severity: string): "active" | "pending" | "failed" | "neutral" {
  if (severity === "success") return "active";
  if (severity === "warning") return "pending";
  if (severity === "error") return "failed";
  return "neutral";
}

function severityLabel(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function NotificationDetail({
  notification: initial,
  auditLog,
  backHref,
  auditLogHrefBase,
  showAuditLogLink,
}: Props) {
  const [notification, setNotification] = useState(initial);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 3000);
  }

  async function toggleRead() {
    setUpdating(true);
    try {
      const path = notification.read
        ? `/api/notifications/${notification.id}/unread`
        : `/api/notifications/${notification.id}/read`;
      const res = await fetch(path, { method: "POST" });
      if (!res.ok) {
        showToast("error", "Failed to update");
        return;
      }
      setNotification((n) => ({
        ...n,
        read: !n.read,
        readAt: !n.read ? new Date().toISOString() : null,
      }));
      showToast("success", notification.read ? "Marked unread" : "Marked read");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setUpdating(false);
    }
  }

  const metadataEntries = notification.metadata
    ? Object.entries(notification.metadata)
    : [];

  const auditLogMetadataEntries = auditLog?.metadata
    ? Object.entries(auditLog.metadata)
    : [];

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Link
          href={backHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "#017ea7",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} />
          Back to notifications
        </Link>
      </div>

      <Card padding={24} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#1A1313",
              letterSpacing: "-0.31px",
              margin: 0,
            }}
          >
            {notification.title}
          </h2>
          <StatusPill
            status={severityKind(notification.severity)}
            label={severityLabel(notification.severity).toUpperCase()}
          />
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16, fontSize: 12, color: "#878787" }}>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            {notification.category}
          </span>
          <span>{fmtDateLocale(notification.createdAt)}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {notification.read ? (
              <>
                <CheckCircle2 size={12} />
                Read{notification.readAt ? ` · ${fmtDateLocale(notification.readAt)}` : ""}
              </>
            ) : (
              <>
                <CircleDot size={12} />
                Unread
              </>
            )}
          </span>
        </div>

        <p style={{ fontSize: 14, color: "#4A4A4A", lineHeight: 1.6, margin: "0 0 16px" }}>
          {notification.message}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {notification.link && (
            <Button
              variant="primary"
              leadingIcon={<ExternalLink size={14} />}
              onClick={() => {
                if (notification.link) {
                  window.location.href = notification.link;
                }
              }}
            >
              Go to entity
            </Button>
          )}
          <Button
            variant="secondary"
            leadingIcon={notification.read ? <CircleDot size={14} /> : <CheckCircle2 size={14} />}
            onClick={toggleRead}
            loading={updating}
          >
            {notification.read ? "Mark unread" : "Mark read"}
          </Button>
        </div>
      </Card>

      {metadataEntries.length > 0 && (
        <Card padding={20} style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", marginBottom: 12 }}>
            Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {metadataEntries.map(([k, v], idx) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 0",
                  borderTop: idx === 0 ? "none" : "1px solid #F4F5F7",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#878787", textTransform: "capitalize" }}>{k}</span>
                <span style={{ color: "#1A1313", fontFamily: "monospace", textAlign: "right", wordBreak: "break-all", maxWidth: 480 }}>
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {auditLog && (
        <Card padding={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <FileText size={14} color="#878787" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", margin: 0 }}>
              Linked audit log entry
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
            <Row label="Action" value={auditLog.action} mono />
            <Row label="Actor" value={`${auditLog.actorEmail} (${auditLog.actorRole})`} />
            <Row label="Target" value={`${auditLog.targetType} · ${auditLog.targetId}`} mono />
            <Row label="When" value={fmtDateLocale(auditLog.createdAt)} />
            {auditLogMetadataEntries.length > 0 && (
              <Row
                label="Metadata"
                value={JSON.stringify(auditLog.metadata)}
                mono
              />
            )}
          </div>
          {showAuditLogLink && (
            <Link
              href={`${auditLogHrefBase}?id=${auditLog.id}`}
              style={{
                fontSize: 12,
                color: "#017ea7",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <ExternalLink size={12} />
              View in audit log
            </Link>
          )}
        </Card>
      )}
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#878787" }}>{label}</span>
      <span
        style={{
          color: "#1A1313",
          fontFamily: mono ? "monospace" : undefined,
          textAlign: "right",
          wordBreak: "break-all",
          maxWidth: 480,
        }}
      >
        {value}
      </span>
    </div>
  );
}
