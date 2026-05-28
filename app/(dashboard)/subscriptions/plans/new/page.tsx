import { requireMerchant } from "@/lib/session";
import { PlanNewClient } from "./plan-new-client";

export default async function NewPlanPage() {
  const { merchant } = await requireMerchant();
  return (
    <PlanNewClient
      merchantTaxRateBasisPoints={merchant.taxRateBasisPoints}
      merchantTaxEnabled={merchant.taxEnabled}
      merchantTaxJurisdiction={merchant.taxJurisdiction}
    />
  );
}
