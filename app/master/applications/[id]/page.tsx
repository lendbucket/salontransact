import { requireMaster } from "@/lib/session";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ApplicationDetailClient } from "./application-detail-client";
import type {
  ApplicationDetail,
  ApplicationStatus,
} from "@/lib/applications/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function last4(s: string): string {
  if (!s) return "----";
  return s.length <= 4 ? s : s.slice(-4);
}

export default async function MasterApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  await requireMaster();

  const row = await prisma.merchantApplication.findUnique({ where: { id } });
  if (!row) notFound();

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

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <ApplicationDetailClient initialApplication={detail} />
    </div>
  );
}
