import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ApiKeysClient } from "./api-keys-client";
import type { ApiKeyPublic } from "@/lib/api-keys/types";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const { merchant } = await requireMerchant();

  const rows = await prisma.apiKey.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const initialKeys: ApiKeyPublic[] = rows.map((r) => ({
    id: r.id,
    merchantId: r.merchantId,
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
        Authenticate API requests to SalonTransact
      </p>

      <ApiKeysClient initialKeys={initialKeys} mode="merchant" />
    </div>
  );
}
