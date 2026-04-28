import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { WebhooksClient } from "./webhooks-client";
import type { WebhookPublic } from "@/lib/webhooks/subscription-types";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const { merchant } = await requireMerchant();

  const rows = await prisma.webhook.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const initialWebhooks: WebhookPublic[] = rows.map((r) => ({
    id: r.id,
    merchantId: r.merchantId,
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
        Receive real-time event notifications at your endpoints
      </p>

      <WebhooksClient initialWebhooks={initialWebhooks} mode="merchant" />
    </div>
  );
}
