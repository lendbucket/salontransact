import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SavedCardsClient } from "./saved-cards-client";
import type { SavedCardPublic } from "@/lib/saved-cards/types";

export const dynamic = "force-dynamic";

export default async function SavedCardsPage() {
  const { merchant } = await requireMerchant();

  const rows = await prisma.savedPaymentMethod.findMany({
    where: { merchantId: merchant.id, status: "active" },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const initialCards: SavedCardPublic[] = rows.map((r) => ({
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
        Customer payment methods stored for future use
      </p>
      <SavedCardsClient initialCards={initialCards} />
    </div>
  );
}
