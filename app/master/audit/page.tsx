import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AuditClient } from "./audit-client";
import type { AuditLogPublic } from "@/lib/audit/types";

export const dynamic = "force-dynamic";

export default async function MasterAuditPage() {
  await requireMaster();

  const [rows, allMerchants] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.merchant.findMany({
      orderBy: { businessName: "asc" },
      select: { id: true, businessName: true },
    }),
  ]);

  const merchantMap = new Map(allMerchants.map((m) => [m.id, m.businessName]));

  const initialEntries: AuditLogPublic[] = rows.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    actorEmail: r.actorEmail,
    actorRole: r.actorRole,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    merchantId: r.merchantId,
    merchantBusinessName: r.merchantId
      ? merchantMap.get(r.merchantId) ?? null
      : null,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1
        className="text-2xl font-semibold text-[#1A1313] mb-1"
        style={{ letterSpacing: "-0.31px" }}
      >
        Audit Log
      </h1>
      <p className="text-sm text-[#878787] mb-8">
        Every sensitive action across the platform
      </p>
      <AuditClient
        initialEntries={initialEntries}
        allMerchants={allMerchants}
      />
    </div>
  );
}
