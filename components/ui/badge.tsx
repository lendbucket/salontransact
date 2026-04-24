type BadgeStatus =
  | "succeeded"
  | "paid"
  | "active"
  | "approved"
  | "pending"
  | "pending_review"
  | "in_transit"
  | "processing"
  | "info"
  | "failed"
  | "error"
  | "inactive"
  | "suspended"
  | "declined"
  | "restricted"
  | "neutral"
  | "incomplete"
  | "starter"
  | "plan";

const statusMap: Record<
  BadgeStatus,
  { label: string; className: string }
> = {
  succeeded: { label: "Succeeded", className: "badge badge-success" },
  paid: { label: "Paid", className: "badge badge-success" },
  active: { label: "Active", className: "badge badge-success" },
  approved: { label: "Approved", className: "badge badge-success" },
  pending: { label: "Pending", className: "badge badge-pending" },
  pending_review: { label: "Under Review", className: "badge badge-pending" },
  in_transit: { label: "In Transit", className: "badge badge-info" },
  processing: { label: "Processing", className: "badge badge-processing" },
  info: { label: "Info", className: "badge badge-info" },
  failed: { label: "Failed", className: "badge badge-error" },
  error: { label: "Error", className: "badge badge-error" },
  inactive: { label: "Inactive", className: "badge badge-neutral" },
  suspended: { label: "Suspended", className: "badge badge-error" },
  declined: { label: "Declined", className: "badge badge-error" },
  restricted: { label: "Restricted", className: "badge badge-error" },
  neutral: { label: "Neutral", className: "badge badge-neutral" },
  incomplete: { label: "Incomplete", className: "badge badge-neutral" },
  starter: { label: "Starter", className: "badge badge-plan" },
  plan: { label: "Starter", className: "badge badge-plan" },
};

export function Badge({
  status,
  label,
  showDot = true,
}: {
  status: string;
  label?: string;
  showDot?: boolean;
}) {
  const config = statusMap[status as BadgeStatus] ?? statusMap.neutral;
  const displayLabel = label ?? config.label;
  const hasDot = showDot && !["starter", "plan"].includes(status);

  return (
    <span className={config.className}>
      {hasDot && <span className="badge-dot" />}
      {displayLabel}
    </span>
  );
}
