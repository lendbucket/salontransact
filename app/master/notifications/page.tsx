import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NotificationsFeed } from "@/components/notifications-feed";
import type {
  NotificationPublic,
  NotificationCategory,
  NotificationSeverity,
} from "@/lib/notifications/types";

export const dynamic = "force-dynamic";

export default async function MasterNotificationsPage() {
  const { userId } = await requireMaster();

  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const initialNotifications: NotificationPublic[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    merchantId: r.merchantId,
    category: r.category as NotificationCategory,
    severity: r.severity as NotificationSeverity,
    title: r.title,
    message: r.message,
    link: r.link,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    auditLogId: r.auditLogId,
    read: r.read,
    readAt: r.readAt ? r.readAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1
        className="text-2xl font-semibold text-[#1A1313] mb-1"
        style={{ letterSpacing: "-0.31px" }}
      >
        Notifications
      </h1>
      <p className="text-sm text-[#878787] mb-8">
        Platform-wide activity and alerts for the master portal
      </p>

      <NotificationsFeed initialNotifications={initialNotifications} />
    </div>
  );
}
