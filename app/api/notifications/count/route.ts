import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NotificationCountResponse } from "@/lib/notifications/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;

  if (!user || !user.id) {
    // Don't 401 — bell polls and 401 floods sentry. Return 0 silently.
    return NextResponse.json({ unreadCount: 0 } satisfies NotificationCountResponse);
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });

  return NextResponse.json({ unreadCount } satisfies NotificationCountResponse);
}
