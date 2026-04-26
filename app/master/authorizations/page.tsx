import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AuthorizationsClient from "./authorizations-client";

export const dynamic = "force-dynamic";

export default async function AuthorizationsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user || (user.role !== "master portal" && user.role !== "merchant")) {
    redirect("/dashboard");
  }
  return <AuthorizationsClient />;
}
