import { requireMaster } from "@/lib/session";
import { ReportingClient } from "./reporting-client";

export const dynamic = "force-dynamic";

export default async function MasterReportingPage() {
  await requireMaster();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "#1A1313", letterSpacing: "-0.31px" }}
      >
        Reporting
      </h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>
        Platform-wide volume, top merchants, and transaction velocity.
      </p>

      <ReportingClient />
    </div>
  );
}
