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
