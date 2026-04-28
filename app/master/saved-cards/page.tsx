import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MasterSavedCardsClient } from "./master-saved-cards-client";
import type { MasterSavedCardRow } from "@/lib/saved-cards/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ merchantId?: string }>;
}

export default async function MasterSavedCardsPage({
  searchParams,
}: PageProps) {
  await requireMaster();
  const params = await searchParams;
  const merchantIdScope = params.merchantId ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { status: "active" };
  if (merchantIdScope) where.merchantId = merchantIdScope;

  const [rows, scopeMerchant] = await Promise.all([
    prisma.savedPaymentMethod.findMany({
      where,
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
      take: 500,
      include: {
        merchant: { select: { id: true, businessName: true } },
      },
    }),
    merchantIdScope
      ? prisma.merchant.findUnique({
          where: { id: merchantIdScope },
          select: { id: true, businessName: true },
        })
      : Promise.resolve(null),
  ]);

  const initialCards: MasterSavedCardRow[] = rows.map((r) => ({
    id: r.id,
    customerEmail: r.customerEmail,
    payrocSecureTokenId: r.payrocSecureTokenId,
    cardScheme: r.cardScheme,
    last4: r.last4,
    expiryMonth: r.expiryMonth,
    expiryYear: r.expiryYear,
    cardholderName: r.cardholderName,
    label: r.label,
    status: r.status,
    mitAgreement: r.mitAgreement,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
    merchantId: r.merchant.id,
    merchantBusinessName: r.merchant.businessName,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1
        className="text-2xl font-semibold text-[#1A1313] mb-1"
        style={{ letterSpacing: "-0.31px" }}
      >
        Saved Cards
      </h1>
      <p className="text-sm text-[#878787] mb-8">
        {scopeMerchant
          ? `Customer cards saved at ${scopeMerchant.businessName}`
          : "All saved customer cards across the platform"}
      </p>
      <MasterSavedCardsClient
        initialCards={initialCards}
        scopedMerchantId={merchantIdScope}
      />
    </div>
  );
}
