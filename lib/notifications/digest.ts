import { prisma } from "@/lib/prisma";
import { buildDigestEmail } from "./digest-template";
import { RESEND_FROM } from "@/lib/email/sender";
import type { NotificationPublic } from "./types";
import type { DigestFrequency } from "./preferences";

function rowToPublic(row: {
  id: string;
  userId: string;
  merchantId: string | null;
  category: string;
  severity: string;
  title: string;
  message: string;
  link: string | null;
  metadata: unknown;
  auditLogId: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}): NotificationPublic {
  return {
    id: row.id,
    userId: row.userId,
    merchantId: row.merchantId,
    category: row.category as NotificationPublic["category"],
    severity: row.severity as NotificationPublic["severity"],
    title: row.title,
    message: row.message,
    link: row.link,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    auditLogId: row.auditLogId,
    read: row.read,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface SendDigestResult {
  userId: string;
  email: string;
  freq: DigestFrequency;
  notificationCount: number;
  status: "sent" | "skipped-empty" | "skipped-off" | "skipped-throttled" | "error";
  error?: string;
}

/**
 * Send a digest to a single user. Pulls notifications since lastDigestSentAt
 * (or last 7 days if never sent), builds email, sends via Resend, updates
 * lastDigestSentAt.
 *
 * Throttles: won't send another digest within 12 hours of the last one to
 * guard against the cron firing twice in close succession.
 */
export async function sendDigestForUser(userId: string): Promise<SendDigestResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      notificationDigestFrequency: true,
      notificationLastDigestSentAt: true,
    },
  });

  if (!user) {
    return {
      userId,
      email: "",
      freq: "off",
      notificationCount: 0,
      status: "error",
      error: "user not found",
    };
  }

  const freq = user.notificationDigestFrequency as DigestFrequency;

  if (freq !== "daily" && freq !== "weekly") {
    return {
      userId,
      email: user.email,
      freq: "off",
      notificationCount: 0,
      status: "skipped-off",
    };
  }

  // Throttle: skip if last digest sent < 12 hours ago
  if (user.notificationLastDigestSentAt) {
    const ageMs = Date.now() - user.notificationLastDigestSentAt.getTime();
    if (ageMs < 12 * 60 * 60 * 1000) {
      return {
        userId,
        email: user.email,
        freq,
        notificationCount: 0,
        status: "skipped-throttled",
      };
    }
  }

  // Window for "since last digest"
  const since = user.notificationLastDigestSentAt
    ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await prisma.notification.findMany({
    where: {
      userId,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (rows.length === 0) {
    // Still update lastDigestSentAt to avoid re-checking same window
    await prisma.user.update({
      where: { id: userId },
      data: { notificationLastDigestSentAt: new Date() },
    });
    return {
      userId,
      email: user.email,
      freq,
      notificationCount: 0,
      status: "skipped-empty",
    };
  }

  const notifications = rows.map(rowToPublic);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://portal.salontransact.com";

  const { subject, html } = buildDigestEmail({
    recipientName: user.name ?? user.email,
    recipientEmail: user.email,
    frequency: freq,
    notifications,
    appUrl,
  });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      userId,
      email: user.email,
      freq,
      notificationCount: notifications.length,
      status: "error",
      error: "RESEND_API_KEY not set",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: user.email,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        userId,
        email: user.email,
        freq,
        notificationCount: notifications.length,
        status: "error",
        error: `Resend ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { notificationLastDigestSentAt: new Date() },
    });

    return {
      userId,
      email: user.email,
      freq,
      notificationCount: notifications.length,
      status: "sent",
    };
  } catch (e) {
    return {
      userId,
      email: user.email,
      freq,
      notificationCount: notifications.length,
      status: "error",
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

/**
 * Run the daily cron sweep. For each user whose schedule matches today,
 * send their digest.
 *
 * Logic:
 *   - "off"     -> skip
 *   - "daily"   -> always
 *   - "weekly"  -> only on Mondays (UTC)
 */
export async function runDigestForAllUsers(): Promise<{
  processed: number;
  sent: number;
  skippedOff: number;
  skippedEmpty: number;
  skippedThrottled: number;
  errors: number;
  results: SendDigestResult[];
}> {
  const todayUtcDay = new Date().getUTCDay(); // 0 = Sunday, 1 = Monday
  const isMonday = todayUtcDay === 1;

  // Fetch users with daily or weekly preference
  const users = await prisma.user.findMany({
    where: {
      notificationDigestFrequency: { in: isMonday ? ["daily", "weekly"] : ["daily"] },
    },
    select: { id: true },
  });

  const results: SendDigestResult[] = [];
  for (const u of users) {
    const r = await sendDigestForUser(u.id);
    results.push(r);
  }

  return {
    processed: results.length,
    sent: results.filter((r) => r.status === "sent").length,
    skippedOff: results.filter((r) => r.status === "skipped-off").length,
    skippedEmpty: results.filter((r) => r.status === "skipped-empty").length,
    skippedThrottled: results.filter((r) => r.status === "skipped-throttled").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };
}
