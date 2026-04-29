import { prisma } from "@/lib/prisma";
import { listDisputes } from "@/lib/payroc/disputes";
import {
  type ChargebackRiskMetrics,
  statusForRatio,
} from "./types";

interface ComputeOptions {
  merchantId: string;
  windowDays?: number;
}

export async function computeChargebackRisk(
  options: ComputeOptions
): Promise<ChargebackRiskMetrics> {
  const windowDays = options.windowDays ?? 90;
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowDays * 86400000);

  const completedTransactions = await prisma.transaction.count({
    where: {
      merchantId: options.merchantId,
      status: "succeeded",
      createdAt: { gte: windowStart, lte: windowEnd },
    },
  });

  const txnsWithMeta = await prisma.transaction.findMany({
    where: {
      merchantId: options.merchantId,
      createdAt: { gte: windowStart, lte: windowEnd },
    },
    select: { metadata: true },
  });

  const merchantPaymentIds = new Set<string>();
  for (const txn of txnsWithMeta) {
    const meta = txn.metadata as { payrocPaymentId?: string } | null;
    if (meta?.payrocPaymentId) merchantPaymentIds.add(meta.payrocPaymentId);
  }

  let chargebackCount = 0;
  try {
    // listDisputes accepts startDate/endDate as YYYY-MM-DD
    const result = await listDisputes({
      startDate: windowStart.toISOString().slice(0, 10),
      endDate: windowEnd.toISOString().slice(0, 10),
    });
    const disputes = result.disputes ?? [];
    chargebackCount = disputes.filter((d) =>
      d.paymentId ? merchantPaymentIds.has(d.paymentId) : false
    ).length;
  } catch (e) {
    console.error(
      `[CHARGEBACK-MONITOR] Failed to fetch disputes for merchant ${options.merchantId}:`,
      e instanceof Error ? e.message : e
    );
  }

  const chargebackRatio =
    completedTransactions > 0
      ? (chargebackCount / completedTransactions) * 100
      : 0;

  return {
    merchantId: options.merchantId,
    windowDays,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    completedTransactions,
    chargebackCount,
    chargebackRatio,
    status: statusForRatio(chargebackRatio),
    computedAt: new Date().toISOString(),
  };
}
