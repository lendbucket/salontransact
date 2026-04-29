import { requireMerchant } from "@/lib/session";
import { StatementsClient } from "./statements-client";

export const dynamic = "force-dynamic";

export default async function StatementsPage() {
  await requireMerchant();

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "#1A1313", letterSpacing: "-0.31px" }}
      >
        Processing Statements
      </h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>
        Download a PDF statement of your processing activity for any month.
      </p>
      <StatementsClient />
    </div>
  );
}
