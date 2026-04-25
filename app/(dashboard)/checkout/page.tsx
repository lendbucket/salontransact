import { requireMerchant } from "@/lib/session";
import { CheckoutForm } from "./checkout-form";

export default async function CheckoutPage() {
  await requireMerchant();

  return (
    <div style={{ background: "#FBFBFB", minHeight: "100%" }}>
      <div className="max-w-xl mx-auto px-4 py-8 md:py-12">
        <CheckoutForm />
      </div>
    </div>
  );
}
