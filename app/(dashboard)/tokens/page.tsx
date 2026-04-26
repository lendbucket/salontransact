import { requireMerchant } from "@/lib/session";
import { CreditCard } from "lucide-react";

export default async function TokensPage() {
  await requireMerchant();

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-[#1A1313] mb-1">Secure Tokens</h1>
      <p className="text-sm text-[#878787] mb-8">
        Saved payment methods for recurring transactions
      </p>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 rounded-full bg-[#E6F4F8] flex items-center justify-center mb-4">
            <CreditCard size={20} strokeWidth={1.5} className="text-[#017ea7]" />
          </div>
          <p className="text-sm font-medium text-[#1A1313] mb-1">No saved payment methods</p>
          <p className="text-[13px] text-[#878787] text-center max-w-sm">
            Secure tokens will appear here when customers save their card for recurring payments. Tokens are created automatically from successful transactions.
          </p>
        </div>
      </div>
    </div>
  );
}
