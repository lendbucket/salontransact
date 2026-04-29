import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireMerchant } from "@/lib/session";
import { redirect } from "next/navigation";
import { ContractsPageClient } from "./contracts-page-client";

export const dynamic = "force-dynamic";

export default async function MerchantContractsPage() {
  const { merchant } = await requireMerchant();
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  if (!sessionUser?.id) redirect("/login");

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "#1A1313", letterSpacing: "-0.31px" }}
      >
        Documents
      </h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>
        Your contracts, signed agreements, and supporting documents.
      </p>

      <ContractsPageClient
        merchantId={merchant.id}
        currentUserId={sessionUser.id}
        currentUserRole={sessionUser.role ?? "merchant"}
      />
    </div>
  );
}
