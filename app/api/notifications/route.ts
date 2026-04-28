import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  NotificationListResponse,
  NotificationPublic,
  NotificationCategory,
  NotificationSeverity,
} from "@/lib/notifications/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const categoryParam = url.searchParams.get("category");
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitRaw ?? "50", 10) || 50, 1), 200);

  const where: { userId: string; read?: boolean; category?: string } = {
    userId: user.id,
  };
  if (unreadOnly) where.read = false;
  if (categoryParam && categoryParam.length > 0) where.category = categoryParam;

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId: user.id, read: false },
    }),
  ]);

  const data = rows.map(rowToPublic);
  const response: NotificationListResponse = {
    data,
    count: data.length,
    unreadCount,
  };
  return NextResponse.json(response);
}
