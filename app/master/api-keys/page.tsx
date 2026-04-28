import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ApiKeysClient } from "@/app/(dashboard)/api-keys/api-keys-client";
import type { MasterApiKeyRow } from "@/lib/api-keys/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ merchantId?: string }>;
}

export default async function MasterApiKeysPage({ searchParams }: PageProps) {
  await requireMaster();
  const params = await searchParams;
  const merchantIdScope = params.merchantId ?? null;

  const where: { merchantId?: string } = {};
  if (merchantIdScope) where.merchantId = merchantIdScope;

  const [rows, allMerchants] = await Promise.all([
    prisma.apiKey.findMany({
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

  const initialKeys: MasterApiKeyRow[] = rows.map((r) => ({
    id: r.id,
    merchantId: r.merchantId,
    merchantBusinessName: r.merchant.businessName,
    name: r.name,
    keyPrefix: r.keyPrefix ?? "",
    active: r.active,
    lastUsed: r.lastUsed ? r.lastUsed.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1
        className="text-2xl font-semibold text-[#1A1313] mb-1"
        style={{ letterSpacing: "-0.31px" }}
      >
        API Keys
      </h1>
      <p className="text-sm text-[#878787] mb-8">
        {merchantIdScope
          ? `API keys for selected merchant`
          : "All API keys across the platform — view, create, revoke"}
      </p>

      <ApiKeysClient
        initialKeys={initialKeys}
        mode="master"
        allMerchants={allMerchants}
        scopedMerchantId={merchantIdScope}
      />
    </div>
  );
}
