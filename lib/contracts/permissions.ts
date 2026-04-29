import { prisma } from "@/lib/prisma";

export interface AuthedUser {
  id: string;
  email: string;
  role: string;
}

export async function getMerchantIdForUser(userId: string): Promise<string | null> {
  const m = await prisma.merchant.findUnique({
    where: { userId },
    select: { id: true },
  });
  return m?.id ?? null;
}

export async function canViewContractsForMerchant(
  user: AuthedUser,
  merchantId: string
): Promise<boolean> {
  if (user.role === "master portal") return true;
  if (user.role === "merchant") {
    const myMerchantId = await getMerchantIdForUser(user.id);
    return myMerchantId === merchantId;
  }
  return false;
}

export async function canUploadContractsForMerchant(
  user: AuthedUser,
  merchantId: string
): Promise<boolean> {
  return canViewContractsForMerchant(user, merchantId);
}

export async function canDeleteContract(
  user: AuthedUser,
  contract: { merchantId: string; uploadedById: string }
): Promise<boolean> {
  if (user.role === "master portal") return true;
  if (user.role === "merchant") {
    if (contract.uploadedById !== user.id) return false;
    const myMerchantId = await getMerchantIdForUser(user.id);
    return myMerchantId === contract.merchantId;
  }
  return false;
}
