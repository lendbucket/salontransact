import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { WebhooksClient } from "@/app/(dashboard)/webhooks/webhooks-client";
import type { MasterWebhookRow } from "@/lib/webhooks/subscription-types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ merchantId?: string }>;
}

export default async function MasterWebhooksPage({ searchParams }: PageProps) {
  await requireMaster();
  const params = await searchParams;
  const merchantIdScope = params.merchantId ?? null;

  const where: { merchantId?: string } = {};
  if (merchantIdScope) where.merchantId = merchantIdScope;

  const [rows, allMerchants] = await Promise.all([
    prisma.webhook.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        merchant: { select: { id: true, businessName: true } },
      },
    }),
    prisma.merchant.findMany({
      orderBy: { businessName: "asc" },
      select: { id: true, businessName: true },
    }),
  ]);

  const initialWebhooks: MasterWebhookRow[] = rows.map((r) => ({
    id: r.id,
    merchantId: r.merchantId,
    merchantBusinessName: r.merchant.businessName,
    url: r.url,
    description: r.description,
    events: r.events,
    active: r.active,
    lastTriggeredAt: r.lastTriggeredAt ? r.lastTriggeredAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1
        className="text-2xl font-semibold text-[#1A1313] mb-1"
        style={{ letterSpacing: "-0.31px" }}
      >
        Webhooks
      </h1>
      <p className="text-sm text-[#878787] mb-8">
        {merchantIdScope
          ? `Webhook subscriptions for selected merchant`
          : "All webhook subscriptions across the platform — view, create, revoke"}
      </p>

      <WebhooksClient
        initialWebhooks={initialWebhooks}
        mode="master"
        allMerchants={allMerchants}
        scopedMerchantId={merchantIdScope}
      />
    </div>
  );
}
