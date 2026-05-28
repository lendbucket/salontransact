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

  // INTENTIONAL: these two reads are not wrapped in a transaction. A
  // subscription could be created or canceled between them, which would
  // make activeSubscriptionCount slightly stale relative to plan. This is
  // acceptable because:
  //   1. The API's PATCH /api/subscription-plans/[id] is the authoritative
  //      enforcement layer for the immutability guard (returns 409 if the
  //      plan has active subscriptions and the request tries to change
  //      pricing/interval fields).
  //   2. The race window is microseconds; the worst case is the UI shows
  //      fields as editable that the API will then reject with 409, which
  //      surfaces as a toast.
  // Wrapping in $transaction would add overhead without fixing the
  // underlying TOCTOU (the user could still submit later and race the API).
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
