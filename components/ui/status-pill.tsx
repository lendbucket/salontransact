import type { ReactNode } from "react";

type StatusKind =
  | "succeeded"
  | "active"
  | "approved"
  | "pending"
  | "in_review"
  | "processing"
  | "failed"
  | "declined"
  | "suspended"
  | "refunded"
  | "disputed"
  | "neutral";

const stylesByKind: Record<
  StatusKind,
  { bg: string; text: string; dot: string }
> = {
  succeeded: { bg: "#DCFCE7", text: "#15803D", dot: "#22c55e" },
  active: { bg: "#DCFCE7", text: "#15803D", dot: "#22c55e" },
  approved: { bg: "#DCFCE7", text: "#15803D", dot: "#22c55e" },
  pending: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  in_review: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  processing: { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  failed: { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444" },
  declined: { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444" },
  suspended: { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444" },
  refunded: { bg: "#F4F5F7", text: "#4A4A4A", dot: "#878787" },
  disputed: { bg: "#FFEDD5", text: "#C2410C", dot: "#F97316" },
  neutral: { bg: "#F4F5F7", text: "#4A4A4A", dot: "#878787" },
};

function resolveKind(status: string): StatusKind {
  const s = status.toLowerCase().trim();
  if (s in stylesByKind) return s as StatusKind;
  if (
    ["paid", "complete", "completed", "captured", "success"].includes(s)
  )
    return "succeeded";
  if (["pending_review"].includes(s)) return "in_review";
  if (["error"].includes(s)) return "failed";
  if (["inactive", "incomplete"].includes(s)) return "neutral";
  return "neutral";
}

interface StatusPillProps {
  status: string;
  label?: ReactNode;
  showDot?: boolean;
}

export function StatusPill({
  status,
  label,
  showDot = true,
}: StatusPillProps) {
  const kind = resolveKind(status);
  const c = stylesByKind[kind];
  const display =
    label ?? status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 22,
        padding: "0 8px",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        borderRadius: 11,
        background: c.bg,
        color: c.text,
        whiteSpace: "nowrap",
      }}
    >
      {showDot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 9999,
            background: c.dot,
            display: "inline-block",
          }}
        />
      )}
      {display}
    </span>
  );
}
