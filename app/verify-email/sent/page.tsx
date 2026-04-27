import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import VerifyEmailSentClient from "./verify-email-sent-client";

export const dynamic = "force-dynamic";

export default async function VerifyEmailSentPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { email?: string | null; emailVerified?: string | null }
    | undefined;

  if (!user?.email) {
    redirect("/login");
  }

  if (user.emailVerified) {
    redirect("/onboarding");
  }

  return <VerifyEmailSentClient email={user.email} />;
}
