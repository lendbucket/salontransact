import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  NotificationDetailResponse,
  NotificationPublic,
  NotificationCategory,
  NotificationSeverity,
  AuditLogPreview,
} from "@/lib/notifications/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

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

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const response: NotificationDetailResponse = { notification, auditLog };
  return NextResponse.json(response);
}
