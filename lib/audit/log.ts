import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditAction } from "./types";

interface WriteAuditLogParams {
  actor: { id: string; email: string; role: string };
  action: AuditAction | string;
  targetType: string;
  targetId: string;
  merchantId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Write an audit log entry. Non-blocking — never throws to caller.
 * If the write fails, the failure is logged to console but the calling
 * action continues normally.
 */
export async function writeAuditLog(
  params: WriteAuditLogParams
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        actorRole: params.actor.role,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        merchantId: params.merchantId ?? null,
        metadata: params.metadata
          ? (params.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(
      `[AUDIT-LOG] Failed to write (action=${params.action}, target=${params.targetType}/${params.targetId}): ${message}`
    );
  }
}
