import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MasterPayoutsClient } from "./master-payouts-client";
import type { MasterPayoutRow } from "@/lib/payouts/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ merchantId?: string }>;
}

export default async function MasterPayoutsPage({ searchParams }: PageProps) {
  await requireMaster();
  const params = await searchParams;
  const merchantIdScope = params.merchantId ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (merchantIdScope) where.merchantId = merchantIdScope;

  const [rows, scopeMerchant] = await Promise.all([
    prisma.payout.findMany({
      where,
      orderBy: [{ arrivalDate: "desc" }, { createdAt: "desc" }],
      take: 500,
      include: { merchant: { select: { id: true, businessName: true } } },
    }),
    merchantIdScope
      ? prisma.merchant.findUnique({ where: { id: merchantIdScope }, select: { id: true, businessName: true } })
      : Promise.resolve(null),
  ]);

  const initialPayouts: MasterPayoutRow[] = rows.map((r) => ({
    id: r.id, merchantId: r.merchantId, merchantBusinessName: r.merchant.businessName,
    amount: r.amount, currency: r.currency, status: r.status,
    arrivalDate: r.arrivalDate?.toISOString() ?? null,
    description: r.description, batchId: r.batchId, createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-[#1A1313] mb-1" style={{ letterSpacing: "-0.31px" }}>Payouts</h1>
      <p className="text-sm text-[#878787] mb-8">
        {scopeMerchant ? `Payouts for ${scopeMerchant.businessName}` : "All merchant payouts"}
      </p>
      <MasterPayoutsClient initialPayouts={initialPayouts} scopedMerchantId={merchantIdScope} />
    </div>
  );
}
