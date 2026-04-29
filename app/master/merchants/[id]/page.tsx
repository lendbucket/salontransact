import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MerchantDetailClient } from "./merchant-detail-client";
import type { MerchantDetail } from "../_lib/merchant-types";

export const dynamic = "force-dynamic";

export default async function MasterMerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId: currentUserId } = await requireMaster();
  const { id } = await params;

  const m = await prisma.merchant.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          transactions: true,
          payouts: true,
          devices: true,
          savedPaymentMethods: true,
        },
      },
    },
  });

  if (!m) notFound();

  const detail: MerchantDetail = {
    id: m.id,
    userId: m.userId,
    businessName: m.businessName,
    dbaName: m.dbaName,
    businessType: m.businessType,
    email: m.email,
    phone: m.phone,
    address: m.address,
    city: m.city,
    state: m.state,
    zip: m.zip,
    ein: m.ein,
    ownerFirstName: m.ownerFirstName,
    ownerLastName: m.ownerLastName,
    ownerTitle: m.ownerTitle,
    ownerDob: m.ownerDob,
    ownerSsnLast4: m.ownerSsnLast4,
    ownerAddress: m.ownerAddress,
    ownershipPercentage: m.ownershipPercentage,
    bankAccountHolder: m.bankAccountHolder,
    bankRoutingNumber: m.bankRoutingNumber,
    bankAccountNumber: m.bankAccountNumber,
    bankAccountType: m.bankAccountType,
    fundingSpeed: m.fundingSpeed,
    avgTransaction: m.avgTransaction,
    paymentMethods: m.paymentMethods,
    monthlyVolume: m.monthlyVolume,
    totalVolume: m.totalVolume,
    totalTransactions: m.totalTransactions,
    payoutsEnabled: m.payoutsEnabled,
    chargesEnabled: m.chargesEnabled,
    stripeAccountStatus: m.stripeAccountStatus,
    plan: m.plan,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    applicationSubmittedAt: m.applicationSubmittedAt?.toISOString() ?? null,
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <Link
        href="/master/merchants"
        className="inline-flex items-center gap-1.5 text-sm text-[#878787] hover:text-[#1A1313] transition-colors mb-4"
      >
        <ArrowLeft size={14} />
        Back to merchants
      </Link>

      <MerchantDetailClient
        merchant={detail}
        counts={{
          transactions: m._count.transactions,
          payouts: m._count.payouts,
          devices: m._count.devices,
          savedCards: m._count.savedPaymentMethods,
        }}
        currentUserId={currentUserId}
        currentUserRole="master portal"
      />
    </div>
  );
}
