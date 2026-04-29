import { requireMerchant } from "@/lib/session";
import { BookingsClient } from "./bookings-client";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  await requireMerchant();
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "#1A1313", letterSpacing: "-0.31px" }}>Bookings</h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>View and manage appointments. Bookings appear when your booking system connects, or you can add one manually.</p>
      <BookingsClient />
    </div>
  );
}
