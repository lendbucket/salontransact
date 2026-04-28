import type { NotificationPublic } from "./types";

interface DigestData {
  recipientName: string;
  recipientEmail: string;
  frequency: "daily" | "weekly";
  notifications: NotificationPublic[];
  appUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SEVERITY_COLORS: Record<string, { bg: string; fg: string }> = {
  error: { bg: "#FEE2E2", fg: "#DC2626" },
  warning: { bg: "#FEF3C7", fg: "#92400E" },
  success: { bg: "#D1FAE5", fg: "#15803D" },
  info: { bg: "#DBEAFE", fg: "#017ea7" },
};

const CATEGORY_LABELS: Record<string, string> = {
  charge: "Charges",
  refund: "Refunds",
  dispute: "Disputes",
  payout: "Payouts",
  merchant: "Merchants",
  platform: "Platform",
  system: "System",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function buildDigestEmail(data: DigestData): { subject: string; html: string } {
  const period = data.frequency === "daily" ? "daily" : "weekly";
  const subject = `Your SalonTransact ${period} summary (${data.notifications.length})`;

  // Group by category
  const groups = new Map<string, NotificationPublic[]>();
  for (const n of data.notifications) {
    const key = n.category;
    const existing = groups.get(key) ?? [];
    existing.push(n);
    groups.set(key, existing);
  }

  const groupOrder = ["dispute", "refund", "charge", "payout", "merchant", "platform", "system"];
  const orderedGroups = groupOrder
    .filter((c) => groups.has(c))
    .map((c) => ({ category: c, items: groups.get(c)! }));

  // Add any remaining categories not in the order list
  for (const [k, v] of groups.entries()) {
    if (!groupOrder.includes(k)) {
      orderedGroups.push({ category: k, items: v });
    }
  }

  const groupHtml = orderedGroups
    .map((g) => {
      const itemsHtml = g.items
        .map((n) => {
          const colors = SEVERITY_COLORS[n.severity] ?? SEVERITY_COLORS.info;
          return `
            <div style="padding:12px 0;border-bottom:1px solid #F4F5F7;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${colors.fg};"></span>
                <span style="font-size:14px;font-weight:600;color:#1A1313;">${escapeHtml(n.title)}</span>
              </div>
              <div style="font-size:13px;color:#4A4A4A;line-height:1.5;margin-bottom:6px;">${escapeHtml(n.message)}</div>
              <div style="font-size:11px;color:#878787;">
                ${timeAgo(n.createdAt)}${n.link ? ` · <a href="${data.appUrl}${escapeHtml(n.link)}" style="color:#017ea7;text-decoration:none;">View</a>` : ""}
              </div>
            </div>`;
        })
        .join("");
      return `
        <div style="margin-bottom:24px;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#878787;font-weight:600;margin:0 0 8px;">${escapeHtml(CATEGORY_LABELS[g.category] ?? g.category)} (${g.items.length})</p>
          ${itemsHtml}
        </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FBFBFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Inter',sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="background:#FFFFFF;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="height:4px;background:linear-gradient(90deg,#017ea7 0%,#0290be 100%);border-radius:12px 12px 0 0;margin:-32px -32px 24px -32px;"></div>

      <h1 style="font-size:24px;font-weight:600;color:#1A1313;margin:0 0 8px;letter-spacing:-0.31px;">
        Your ${period} summary
      </h1>
      <p style="font-size:14px;color:#878787;margin:0 0 24px;">
        ${data.notifications.length} notification${data.notifications.length === 1 ? "" : "s"} since your last digest.
      </p>

      ${groupHtml}

      <div style="margin-top:24px;padding-top:24px;border-top:1px solid #E8EAED;text-align:center;">
        <a href="${data.appUrl}/notifications" style="display:inline-block;padding:10px 20px;background:#017ea7;color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">
          View all notifications
        </a>
      </div>

      <p style="text-align:center;font-size:11px;color:#878787;margin-top:24px;padding-top:16px;border-top:1px solid #E8EAED;">
        You're receiving this because your notification preference is set to ${period}.
        <br>
        <a href="${data.appUrl}/settings" style="color:#017ea7;text-decoration:none;">Update your preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
