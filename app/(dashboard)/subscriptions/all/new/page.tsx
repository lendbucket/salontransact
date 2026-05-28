import { requireMerchant } from "@/lib/session";
import { NewSubscriptionClient } from "./new-subscription-client";

export default async function NewSubscriptionPage() {
  const { merchant } = await requireMerchant();
  return (
    <NewSubscriptionClient
      merchantTaxRateBasisPoints={merchant.taxRateBasisPoints}
      merchantTaxEnabled={merchant.taxEnabled}
      merchantTaxJurisdiction={merchant.taxJurisdiction}
      merchantBusinessName={merchant.businessName}
    />
  );
}
