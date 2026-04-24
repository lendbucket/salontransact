type BadgeStatus =
  | "succeeded"
  | "pending"
  | "failed"
  | "paid"
  | "in_transit"
  | "active"
  | "inactive"
  | "approved"
  | "declined"
  | "suspended"
  | "processing"
  | "pending_review";

const config: Record<
  BadgeStatus,
  { bg: string; text: string; border: string }
> = {
  succeeded: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  paid: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  active: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  approved: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  pending: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  pending_review: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  processing: { bg: "#E6F4F8", text: "#015f80", border: "#BAE6FD" },
  in_transit: { bg: "#E6F4F8", text: "#015f80", border: "#BAE6FD" },
  failed: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  declined: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  suspended: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  inactive: { bg: "#F9FAFB", text: "#374151", border: "#D1D5DB" },
};

export function Badge({ status }: { status: string }) {
  const c = config[status as BadgeStatus] ?? {
    bg: "#F9FAFB",
    text: "#374151",
    border: "#D1D5DB",
  };

  return (
    <span
      className="badge"
      style={{
        background: c.bg,
        color: c.text,
        borderColor: c.border,
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
