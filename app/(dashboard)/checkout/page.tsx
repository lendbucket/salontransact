import { requireMerchant } from "@/lib/session";
import { getHostedFieldsConfig } from "@/lib/payroc/hosted-fields";
import { CheckoutForm } from "./checkout-form";

export default async function CheckoutPage() {
  await requireMerchant();
  const hostedFieldsConfig = getHostedFieldsConfig();
  const terminalId = process.env.PAYROC_TERMINAL_ID!;

  return (
    <div className="min-h-screen" style={{ background: "#FBFBFB" }}>
      <div className="max-w-xl mx-auto px-4 py-8 md:py-12">
        <h1
          className="text-xl font-semibold mb-6"
          style={{ color: "#1A1313", letterSpacing: "-0.31px" }}
        >
          New Payment
        </h1>
        <CheckoutForm
          hostedFieldsUrl={hostedFieldsConfig.url}
          hostedFieldsIntegrity={hostedFieldsConfig.integrityHash}
          terminalId={terminalId}
        />
      </div>
    </div>
  );
}
