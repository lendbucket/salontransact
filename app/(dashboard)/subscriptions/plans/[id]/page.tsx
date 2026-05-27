import { notFound } from "next/navigation";
import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PlanDetailClient } from "./plan-detail-client";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { merchant } = await requireMerchant();
  const { id } = await params;

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { id, merchantId: merchant.id },
  });
  if (!plan) return notFound();

  const activeSubscriptionCount = await prisma.subscription.count({
    where: {
      planId: id,
      status: { notIn: ["canceled", "incomplete_expired"] },
    },
  });

  return (
    <PlanDetailClient
      plan={{
        ...plan,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      }}
      activeSubscriptionCount={activeSubscriptionCount}
      merchantTaxRateBasisPoints={merchant.taxRateBasisPoints}
      merchantTaxEnabled={merchant.taxEnabled}
      merchantTaxJurisdiction={merchant.taxJurisdiction}
    />
  );
}
