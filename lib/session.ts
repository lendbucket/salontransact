import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export async function requireMerchant() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    redirect("/login");
  }

  const merchant = await prisma.merchant.findUnique({
    where: { userId },
  });

  if (!merchant) {
    redirect("/login");
  }

  return { session, merchant };
}

/**
 * Require a master portal user. Returns the session and userId.
 * Redirects to /login if not authenticated or not a master.
 */
export async function requireMaster() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!session?.user || !user?.id) {
    redirect("/login");
  }

  if (user.role !== "master portal") {
    redirect("/dashboard");
  }

  return { session, userId: user.id, userEmail: user.email ?? null };
}
