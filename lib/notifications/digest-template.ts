import {
  buildEmailHtml,
  emailHeading,
  emailParagraph,
  emailButton,
  emailDivider,
  emailMutedParagraph,
  emailSectionLabel,
  emailNotificationRow,
} from "@/lib/email/components";
import type { NotificationPublic } from "./types";

interface DigestData {
  recipientName: string;
  recipientEmail: string;
  frequency: "daily" | "weekly";
  notifications: NotificationPublic[];
  appUrl: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  charge: "Charges",
  refund: "Refunds",
  dispute: "Disputes",
  payout: "Payouts",
  merchant: "Merchants",
  platform: "Platform",
  system: "System",
};

const CATEGORY_ORDER = [
  "dispute",
  "refund",
  "charge",
  "payout",
  "merchant",
  "platform",
  "system",
];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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

  const orderedGroups = CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => ({
    category: c,
    items: groups.get(c)!,
  }));
  for (const [k, v] of groups.entries()) {
    if (!CATEGORY_ORDER.includes(k)) {
      orderedGroups.push({ category: k, items: v });
    }
  }

  const groupsHtml = orderedGroups
    .map((g) => {
      const rows = g.items
        .map((n) =>
          emailNotificationRow({
            title: n.title,
            message: n.message,
            severity: n.severity,
            link: n.link,
            baseUrl: data.appUrl,
            ageLabel: timeAgo(n.createdAt),
          })
        )
        .join("");
      return emailSectionLabel(CATEGORY_LABELS[g.category] ?? g.category, g.items.length) + rows;
    })
    .join("");

  const content = `
${emailHeading(`Your ${period} summary`)}
${emailParagraph(`${data.notifications.length} notification${data.notifications.length === 1 ? "" : "s"} since your last digest.`)}

${groupsHtml}

${emailDivider()}

${emailButton(`${data.appUrl}/notifications`, "View all notifications")}

${emailMutedParagraph(`You're receiving this because your notification preference is set to ${period}. <a href="${data.appUrl}/settings" style="color:#017ea7;text-decoration:none;">Update preferences</a>`)}`;

  const html = buildEmailHtml({
    baseUrl: data.appUrl,
    preheader: `${data.notifications.length} notifications in your ${period} digest`,
    content,
  });

  return { subject, html };
}
