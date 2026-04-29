import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isValidStatusFilter,
  type ApplicationListResponse,
  type ApplicationSummary,
  type ApplicationStatus,
} from "@/lib/applications/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const filterParam = url.searchParams.get("status") ?? "all";
  const filter = isValidStatusFilter(filterParam) ? filterParam : "all";

  const whereClause = filter === "all" ? {} : { status: filter };

  const rows = await prisma.merchantApplication.findMany({
    where: whereClause,
    orderBy: { submittedAt: "desc" },
    take: 500,
  });

  const data: ApplicationSummary[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    legalBusinessName: r.legalBusinessName,
    dba: r.dba,
    ownerFullName: r.ownerFullName,
    ownerEmail: r.ownerEmail,
    status: r.status as ApplicationStatus,
    submittedAt: r.submittedAt.toISOString(),
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    rejectedAt: r.rejectedAt ? r.rejectedAt.toISOString() : null,
    hasSignedAgreement: r.signedAgreementContractId !== null,
  }));

  const pendingCount = await prisma.merchantApplication.count({
    where: { status: "submitted" },
  });

  const response: ApplicationListResponse = {
    data,
    count: data.length,
    pendingCount,
  };
  return NextResponse.json(response);
}
