import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  ApplicationDetail,
  ApplicationStatus,
} from "@/lib/applications/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function last4(s: string): string {
  if (!s) return "----";
  return s.length <= 4 ? s : s.slice(-4);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const row = await prisma.merchantApplication.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const detail: ApplicationDetail = {
    id: row.id,
    userId: row.userId,
    legalBusinessName: row.legalBusinessName,
    dba: row.dba,
    businessType: row.businessType,
    ein: row.ein,
    businessPhone: row.businessPhone,
    website: row.website,
    addressStreet: row.addressStreet,
    addressCity: row.addressCity,
    addressState: row.addressState,
    addressZip: row.addressZip,
    addressCountry: row.addressCountry,
    ownerFullName: row.ownerFullName,
    ownerEmail: row.ownerEmail,
    ownerPhone: row.ownerPhone,
    ownerTitle: row.ownerTitle,
    bankName: row.bankName,
    accountHolderName: row.accountHolderName,
    routingNumberLast4: last4(row.routingNumber),
    accountNumberLast4: last4(row.accountNumber),
    accountType: row.accountType,
    monthlyVolume: row.monthlyVolume,
    averageTicket: row.averageTicket,
    mccCode: row.mccCode,
    agreementAccepted: row.agreementAccepted,
    signedAgreementContractId: row.signedAgreementContractId,
    internalNotes: row.internalNotes,
    status: row.status as ApplicationStatus,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    approvedByEmail: row.approvedByEmail,
    rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : null,
    rejectedByEmail: row.rejectedByEmail,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  return NextResponse.json(detail);
}
