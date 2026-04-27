/**
 * TODO COMPLIANCE — REVIEW BEFORE PRODUCTION
 *
 * This form collects sensitive financial data (banking, EIN). Before accepting
 * real merchant applications:
 *
 * 1. PRIVACY POLICY — must disclose collection of EIN, banking, contact info,
 *    purpose, retention period, sharing with Payroc
 * 2. TERMS OF SERVICE — must explicitly cover application review process
 * 3. ENCRYPTION AT REST — verify Supabase is encrypting MerchantApplication.accountNumber
 *    and routingNumber columns. Consider column-level encryption.
 * 4. ACCESS CONTROLS — restrict who can read full account/routing numbers
 *    (currently: anyone with database access)
 * 5. AUDIT LOGGING — log every read/write of banking fields with timestamp + user
 * 6. RETENTION POLICY — define how long applications stay; auto-delete rejected
 *    applications after N days
 * 7. BREACH NOTIFICATION PLAN — required by state law if banking is breached
 * 8. STATE COMPLIANCE — review TX, CA, NY, IL specific requirements
 * 9. GLBA COMPLIANCE — financial services data handling rules
 * 10. PCI ALIGNMENT — even though card data is in Payroc, banking data still
 *     needs comparable rigor
 *
 * Status: NOT PRODUCTION READY — collect data with eyes open about gaps above.
 */

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OnboardingForm from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; name?: string | null }
    | undefined;

  if (!user?.id) redirect("/login");

  const existingApp = await prisma.merchantApplication.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (existingApp) {
    redirect("/onboarding/thank-you");
  }

  return (
    <OnboardingForm userEmail={user.email ?? ""} userName={user.name ?? ""} />
  );
}
