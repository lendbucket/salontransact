import { prisma } from "@/lib/prisma";

interface SessionUser {
  id?: string;
  email?: string | null;
  role?: string;
}

/**
 * Returns true if the session user can initiate a refund or reversal
 * against the given merchantId.
 *
 * Rules:
 * - Master portal users (role === 'master portal') can do anything.
 * - Merchant users (role === 'merchant') can only operate on their own merchant.
 * - All other roles (or no session) are denied.
 */
export async function canInitiateRefund(
  user: SessionUser | null | undefined,
  merchantId: string
): Promise<boolean> {
  if (!user || !user.id) return false;
  if (user.role === "master portal") return true;
  if (user.role !== "merchant") return false;

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { userId: true },
  });

  if (!merchant) return false;
  return merchant.userId === user.id;
}
