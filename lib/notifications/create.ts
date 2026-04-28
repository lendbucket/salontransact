import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  NotificationCategory,
  NotificationSeverity,
} from "./types";

export interface CreateNotificationArgs {
  userId: string;
  merchantId?: string | null;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
  auditLogId?: string | null;
}

/**
 * Create a single notification for a single user.
 * Returns the created row.
 */
export async function createNotification(args: CreateNotificationArgs) {
  return prisma.notification.create({
    data: {
      userId: args.userId,
      merchantId: args.merchantId ?? null,
      category: args.category,
      severity: args.severity,
      title: args.title,
      message: args.message,
      link: args.link ?? null,
      metadata: args.metadata ? (args.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      auditLogId: args.auditLogId ?? null,
    },
  });
}

/**
 * Notify all users with the master portal role.
 * Useful for platform-wide events (cron failures, suspicious activity, etc.).
 */
export async function notifyAllMasters(
  args: Omit<CreateNotificationArgs, "userId">
): Promise<number> {
  const masters = await prisma.user.findMany({
    where: { role: "master portal" },
    select: { id: true },
  });
  if (masters.length === 0) return 0;
  await prisma.notification.createMany({
    data: masters.map((m) => ({
      userId: m.id,
      merchantId: args.merchantId ?? null,
      category: args.category,
      severity: args.severity,
      title: args.title,
      message: args.message,
      link: args.link ?? null,
      metadata: args.metadata ? (args.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      auditLogId: args.auditLogId ?? null,
    })),
  });
  return masters.length;
}

/**
 * Notify the merchant owner (the user with role "merchant" tied to a
 * specific merchantId).
 */
export async function notifyMerchantOwner(
  merchantId: string,
  args: Omit<CreateNotificationArgs, "userId" | "merchantId">
): Promise<boolean> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { userId: true },
  });
  if (!merchant) return false;
  await prisma.notification.create({
    data: {
      userId: merchant.userId,
      merchantId,
      category: args.category,
      severity: args.severity,
      title: args.title,
      message: args.message,
      link: args.link ?? null,
      metadata: args.metadata ? (args.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      auditLogId: args.auditLogId ?? null,
    },
  });
  return true;
}
