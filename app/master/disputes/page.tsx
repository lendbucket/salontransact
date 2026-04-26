import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import DisputesClient from "./disputes-client";

export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user || (user.role !== "master portal" && user.role !== "merchant")) {
    redirect("/dashboard");
  }
  return <DisputesClient />;
}
