import { requireMerchant } from "@/lib/session";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const { session, merchant } = await requireMerchant();

  const sessionUser = session.user as { id?: string; role?: string };
  const currentUserId = sessionUser.id ?? "";
  const currentUserRole = sessionUser.role ?? "merchant";

  return (
    <SettingsClient
      merchant={{
        businessName: merchant.businessName,
        businessType: merchant.businessType,
        email: merchant.email,
        phone: merchant.phone,
        address: merchant.address,
        city: merchant.city,
        state: merchant.state,
        zip: merchant.zip,
        ein: merchant.ein,
        dbaName: merchant.dbaName,
        stripeAccountId: merchant.stripeAccountId,
        stripeAccountStatus: merchant.stripeAccountStatus,
        fundingSpeed: merchant.fundingSpeed,
        status: merchant.status,
      }}
      merchantId={merchant.id}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
    />
  );
}
