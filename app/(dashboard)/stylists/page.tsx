import { requireMerchant } from "@/lib/session";
import { StylistsClient } from "./stylists-client";

export const dynamic = "force-dynamic";

export default async function StylistsPage() {
  await requireMerchant();
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "#1A1313", letterSpacing: "-0.31px" }}>Stylists</h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>Manage your team. Add stylists manually or sync from Kasse.</p>
      <StylistsClient />
    </div>
  );
}
