import { requireMerchant } from "@/lib/session";
import { TrendingUp } from "lucide-react";

export default async function AnalyticsPage() {
  await requireMerchant();

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-[#1A1313] mb-1">Analytics</h1>
      <p className="text-sm text-[#878787] mb-8">
        Payment processing insights and metrics
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {["Total Transactions", "Total Volume", "Success Rate"].map((label) => (
          <div
            key={label}
            className="bg-white border border-[#E8EAED] rounded-xl p-6"
            style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#878787] mb-2">{label}</p>
            <p className="text-2xl font-semibold text-[#1A1313]">--</p>
          </div>
        ))}
      </div>

      <div
        className="bg-white border border-[#E8EAED] rounded-xl p-8 flex flex-col items-center justify-center"
        style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05)", minHeight: 300 }}
      >
        <div className="w-12 h-12 rounded-full bg-[#E6F4F8] flex items-center justify-center mb-4">
          <TrendingUp size={20} strokeWidth={1.5} className="text-[#017ea7]" />
        </div>
        <p className="text-base font-semibold text-[#1A1313] mb-1">Analytics Coming Soon</p>
        <p className="text-sm text-[#878787] text-center max-w-md">
          Transaction trends, revenue charts, and processing insights will be available here once you have payment history.
        </p>
      </div>
    </div>
  );
}
