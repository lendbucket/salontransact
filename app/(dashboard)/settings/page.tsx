import { requireMerchant } from "@/lib/session";
import { SettingsForm } from "./settings-form";
import { StripeConnectCard } from "./stripe-connect-card";

export default async function SettingsPage() {
  const { merchant } = await requireMerchant();

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-1">Settings</h1>
      <p className="text-sm text-muted mb-8">
        Manage your business and payments connection
      </p>

      <div className="space-y-6">
        <StripeConnectCard
          stripeAccountId={merchant.stripeAccountId}
          status={merchant.stripeAccountStatus}
          chargesEnabled={merchant.chargesEnabled}
          payoutsEnabled={merchant.payoutsEnabled}
          onboardingUrl={merchant.stripeOnboardingUrl}
        />

        <SettingsForm
          merchant={{
            businessName: merchant.businessName,
            businessType: merchant.businessType,
            email: merchant.email,
            phone: merchant.phone,
            address: merchant.address,
            city: merchant.city,
            state: merchant.state,
            zip: merchant.zip,
          }}
        />
      </div>
    </div>
  );
}
