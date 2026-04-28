import { prisma } from "@/lib/prisma";

interface PersistDeviceChargeParams {
  merchantId: string;
  paymentInstructionId: string;
  paymentId: string;
  amountCents: number;
  description?: string;
  operatorEmail?: string;
}

interface PersistResult {
  transactionId: string;
  alreadyExisted: boolean;
}

/**
 * Persist a completed device charge to the Transaction table and bump merchant
 * counters atomically. Idempotent via stripePaymentId @unique constraint.
 *
 * Mirrors the checkout route's persistence pattern (commit ca95593).
 *
 * Lookup approach: the charge route writes a PayrocPaymentRecord at submit time
 * with payrocPaymentId = paymentInstructionId (unique, different format from
 * payment IDs). The polling route looks up this record to find merchantId + amount,
 * then calls this helper with the real paymentId from Payroc's completed response.
 */
export async function persistDeviceCharge(
  params: PersistDeviceChargeParams
): Promise<PersistResult> {
  const { merchantId, paymentId, amountCents, description } = params;
  const amountDollars = amountCents / 100;

  // Idempotency: don't double-write or double-count
  const existing = await prisma.transaction.findFirst({
    where: {
      merchantId,
      metadata: { path: ["payrocPaymentId"], equals: paymentId },
    },
    select: { id: true },
  });

  if (existing) {
    return { transactionId: existing.id, alreadyExisted: true };
  }

  const [created] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        merchantId,
        amount: amountDollars,
        currency: "usd",
        status: "succeeded",
        description: description ?? "Device charge",
        fee: 0,
        net: amountDollars,
        metadata: {
          payrocPaymentId: paymentId,
          source: "device",
        },
      },
      select: { id: true },
    }),
    prisma.merchant.update({
      where: { id: merchantId },
      data: {
        totalTransactions: { increment: 1 },
        totalVolume: { increment: amountDollars },
      },
    }),
  ]);

  console.log(
    `[DEVICE-PERSIST] Transaction created: ${created.id} for paymentId ${paymentId} (${amountDollars} USD)`
  );

  return { transactionId: created.id, alreadyExisted: false };
}
