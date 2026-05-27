import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PlansListClient } from "./plans-list-client";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const { merchant } = await requireMerchant();

  const plans = await prisma.subscriptionPlan.findMany({
    where: { merchantId: merchant.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  const planIds = plans.map((p) => p.id);
  const subCounts =
    planIds.length > 0
      ? await prisma.subscription.groupBy({
          by: ["planId"],
          where: {
            planId: { in: planIds },
            status: { notIn: ["canceled", "incomplete_expired"] },
          },
          _count: { _all: true },
        })
      : [];
  const countByPlan = new Map<string, number>(
    subCounts.map((c) => [c.planId, c._count._all])
  );

  const initialPlans = plans.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    activeSubscriptionCount: countByPlan.get(p.id) ?? 0,
  }));

  return <PlansListClient initialPlans={initialPlans} />;
}
