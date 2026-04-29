import { requireMaster } from "@/lib/session";
import { CustomersClient } from "@/app/(dashboard)/customers/customers-client";

export const dynamic = "force-dynamic";

export default async function MasterCustomersPage() {
  await requireMaster();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "#1A1313", letterSpacing: "-0.31px" }}
      >
        Customers
      </h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>
        Search all customers across the platform by email or name.
      </p>
      <CustomersClient mode="master" />
    </div>
  );
}
