import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PayoutsClient } from "./payouts-client";
import type { PayoutPublic } from "@/lib/payouts/types";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const { merchant } = await requireMerchant();

  const rows = await prisma.payout.findMany({
    where: { merchantId: merchant.id },
    orderBy: [{ arrivalDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const initialPayouts: PayoutPublic[] = rows.map((r) => ({
    id: r.id,
    merchantId: r.merchantId,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    arrivalDate: r.arrivalDate ? r.arrivalDate.toISOString() : null,
    description: r.description,
    batchId: r.batchId,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-[#1A1313] mb-1" style={{ letterSpacing: "-0.31px" }}>Payouts</h1>
      <p className="text-sm text-[#878787] mb-8">Money transferred to your bank account</p>
      <PayoutsClient initialPayouts={initialPayouts} />
    </div>
  );
}
