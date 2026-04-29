import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RiskClient } from "./risk-client";

export const dynamic = "force-dynamic";

export default async function MasterRiskPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user || user.role !== "master portal") {
    redirect("/dashboard");
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "#1A1313", letterSpacing: "-0.31px" }}
      >
        Risk Monitor
      </h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>
        Chargeback ratios across all merchants. Visa places merchants on a Chargeback Monitoring Program at 0.65%. Take action before that line.
      </p>
      <RiskClient />
    </div>
  );
}
