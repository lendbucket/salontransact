import { prisma } from "@/lib/prisma";

interface SessionUser {
  id?: string;
  email?: string | null;
  role?: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  merchantId?: string;
}

/**
 * Determine whether the session user can perform a refund or reverse on a
 * given Payroc payment.
 *
 * Rules:
 * - Master portal users (role === 'master portal') can act on any payment.
 * - Merchant users (role === 'merchant') can only act on payments where the
 *   stored Transaction row's merchantId matches their own merchant.
 * - All other roles are denied.
 */
export async function canInitiateRefundForPayment(
  user: SessionUser | null | undefined,
  payrocPaymentId: string
): Promise<PermissionResult> {
  if (!user || !user.id) {
    return { allowed: false, reason: "not-authenticated" };
  }

  if (user.role === "master portal") {
    return { allowed: true };
  }

  if (user.role !== "merchant") {
    return { allowed: false, reason: "role-not-permitted" };
  }

  if (!payrocPaymentId || typeof payrocPaymentId !== "string") {
    return { allowed: false, reason: "missing-payment-id" };
  }

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!merchant) {
    return { allowed: false, reason: "no-merchant-for-user" };
  }

  const tx = await prisma.transaction.findFirst({
    where: {
      metadata: {
        path: ["payrocPaymentId"],
        equals: payrocPaymentId,
      },
    },
    select: { merchantId: true },
  });

  if (!tx) {
    return {
      allowed: false,
      reason: "no-transaction-for-payment",
      merchantId: merchant.id,
    };
  }

  if (tx.merchantId !== merchant.id) {
    return {
      allowed: false,
      reason: "payment-belongs-to-other-merchant",
    };
  }

  return { allowed: true, merchantId: merchant.id };
}

/**
 * Legacy export kept for any code that still imports the old function name.
 */
export async function canInitiateRefund(
  user: SessionUser | null | undefined,
  _merchantId: string
): Promise<boolean> {
  if (!user || !user.id) return false;
  if (user.role === "master portal") return true;
  return false;
}
