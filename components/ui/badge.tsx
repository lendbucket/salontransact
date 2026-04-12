type BadgeStatus =
  | "succeeded"
  | "pending"
  | "failed"
  | "paid"
  | "in_transit"
  | "active"
  | "inactive";

const colorMap: Record<BadgeStatus, { color: string; bg: string }> = {
  succeeded: { color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  paid: { color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  active: { color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  pending: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  in_transit: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  failed: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  inactive: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

export function Badge({ status }: { status: string }) {
  const mapped = colorMap[status as BadgeStatus] ?? {
    color: "#6b7280",
    bg: "rgba(107,114,128,0.1)",
  };

  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: mapped.color, background: mapped.bg }}
    >
      {status.replace("_", " ")}
    </span>
  );
}
