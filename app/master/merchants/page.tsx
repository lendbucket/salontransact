import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MerchantsTableClient } from "./merchants-table-client";
import type { MerchantSummary } from "./_lib/merchant-types";

export const dynamic = "force-dynamic";

export default async function MasterMerchantsPage() {
  await requireMaster();

  const rows = await prisma.merchant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      businessName: true,
      dbaName: true,
      email: true,
      phone: true,
      status: true,
      plan: true,
      totalVolume: true,
      totalTransactions: true,
      createdAt: true,
      city: true,
      state: true,
      applicationSubmittedAt: true,
    },
  });

  const initialMerchants: MerchantSummary[] = rows.map((r) => ({
    id: r.id,
    businessName: r.businessName,
    dbaName: r.dbaName,
    email: r.email,
    phone: r.phone,
    status: r.status,
    plan: r.plan,
    totalVolume: r.totalVolume,
    totalTransactions: r.totalTransactions,
    createdAt: r.createdAt.toISOString(),
    city: r.city,
    state: r.state,
    applicationSubmittedAt: r.applicationSubmittedAt?.toISOString() ?? null,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-[#1A1313] mb-1">Merchants</h1>
      <p className="text-sm text-[#878787] mb-8">
        All merchants on the SalonTransact platform
      </p>
      <MerchantsTableClient initialMerchants={initialMerchants} />
    </div>
  );
}
