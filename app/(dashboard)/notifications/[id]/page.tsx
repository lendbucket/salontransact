import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NotificationDetail } from "@/components/notification-detail";
import type {
  NotificationPublic,
  NotificationCategory,
  NotificationSeverity,
  AuditLogPreview,
} from "@/lib/notifications/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NotificationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;
  if (!user || !user.id) redirect("/login");

  const row = await prisma.notification.findUnique({
    where: { id },
    include: {
      auditLog: {
        select: {
          id: true,
          actorEmail: true,
          actorRole: true,
          action: true,
          targetType: true,
          targetId: true,
          merchantId: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
  });

  if (!row) notFound();
  if (row.userId !== user.id) notFound();

  const notification: NotificationPublic = {
    id: row.id,
    userId: row.userId,
    merchantId: row.merchantId,
    category: row.category as NotificationCategory,
    severity: row.severity as NotificationSeverity,
    title: row.title,
    message: row.message,
    link: row.link,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    auditLogId: row.auditLogId,
    read: row.read,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };

  const auditLog: AuditLogPreview | null = row.auditLog
    ? {
        id: row.auditLog.id,
        actorEmail: row.auditLog.actorEmail,
        actorRole: row.auditLog.actorRole,
        action: row.auditLog.action,
        targetType: row.auditLog.targetType,
        targetId: row.auditLog.targetId,
        merchantId: row.auditLog.merchantId,
        metadata: (row.auditLog.metadata as Record<string, unknown> | null) ?? null,
        createdAt: row.auditLog.createdAt.toISOString(),
      }
    : null;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1
        className="text-2xl font-semibold text-[#1A1313] mb-1"
        style={{ letterSpacing: "-0.31px" }}
      >
        Notification
      </h1>
      <p className="text-sm text-[#878787] mb-6">Detail view</p>

      <NotificationDetail
        notification={notification}
        auditLog={auditLog}
        backHref="/notifications"
        auditLogHrefBase="/master/audit"
        showAuditLogLink={false}
      />
    </div>
  );
}
