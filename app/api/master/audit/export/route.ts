import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { auditLogsToCsv, csvFilename } from "@/lib/audit/csv";
import type { AuditLogPublic } from "@/lib/audit/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const actionParam = url.searchParams.get("action");
  const targetTypeParam = url.searchParams.get("targetType");
  const merchantIdParam = url.searchParams.get("merchantId");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const q = url.searchParams.get("q")?.trim() ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (actionParam && actionParam !== "all" && actionParam.length > 0) {
    where.action = actionParam;
  }
  if (targetTypeParam && targetTypeParam !== "all" && targetTypeParam.length > 0) {
    where.targetType = targetTypeParam;
  }
  if (merchantIdParam && merchantIdParam.length > 0) {
    where.merchantId = merchantIdParam;
  }
  if (fromParam || toParam) {
    where.createdAt = {};
    if (fromParam) {
      const d = new Date(fromParam);
      if (!isNaN(d.getTime())) where.createdAt.gte = d;
    }
    if (toParam) {
      const d = new Date(toParam);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }
  }
  if (q.length > 0) {
    where.OR = [
      { actorEmail: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
      { targetType: { contains: q, mode: "insensitive" } },
      { targetId: { contains: q } },
    ];
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const merchantIds = Array.from(
    new Set(rows.map((r) => r.merchantId).filter((id): id is string => !!id))
  );
  const merchantMap = new Map<string, string>();
  if (merchantIds.length > 0) {
    const merchants = await prisma.merchant.findMany({
      where: { id: { in: merchantIds } },
      select: { id: true, businessName: true },
    });
    for (const m of merchants) merchantMap.set(m.id, m.businessName);
  }

  const data: Array<AuditLogPublic & { merchantBusinessName: string | null }> = rows.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    actorEmail: r.actorEmail,
    actorRole: r.actorRole,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    merchantId: r.merchantId,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    createdAt: r.createdAt.toISOString(),
    merchantBusinessName: r.merchantId ? merchantMap.get(r.merchantId) ?? null : null,
  }));

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "audit.export",
    targetType: "AuditLog",
    targetId: "export",
    merchantId: null,
    metadata: {
      exportedRows: data.length,
      filters: {
        action: actionParam,
        targetType: targetTypeParam,
        merchantId: merchantIdParam,
        q,
        from: fromParam,
        to: toParam,
      },
    },
  });

  const csv = auditLogsToCsv(data);
  const filename = csvFilename("audit-log");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
