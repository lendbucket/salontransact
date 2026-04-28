"use client";

import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";

type ToastKind = "success" | "error" | "info" | "warning";

interface ToastProps {
  kind: ToastKind;
  message: string;
}

const config: Record<
  ToastKind,
  { bg: string; color: string; icon: typeof CheckCircle2 }
> = {
  success: { bg: "#DCFCE7", color: "#15803D", icon: CheckCircle2 },
  error: { bg: "#FEF2F2", color: "#DC2626", icon: XCircle },
  info: { bg: "#DBEAFE", color: "#1E40AF", icon: Info },
  warning: { bg: "#FEF3C7", color: "#92400E", icon: AlertTriangle },
};

export function Toast({ kind, message }: ToastProps) {
  const c = config[kind];
  const Icon = c.icon;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 16px",
        background: c.bg,
        color: c.color,
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      <Icon size={16} />
      {message}
    </div>
  );
}
