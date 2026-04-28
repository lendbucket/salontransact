import { prisma } from "@/lib/prisma";
import { listBatches } from "@/lib/payroc/transactions";
import type { SyncResult } from "./types";

export async function syncPayrocBatchesForMerchant(
  merchantId: string,
  options: { daysBack?: number } = {}
): Promise<SyncResult> {
  const daysBack = options.daysBack ?? 7;
  const result: SyncResult = {
    merchantId,
    batchesProcessed: 0,
    payoutsCreated: 0,
    errors: [],
  };

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    let batches: Array<Record<string, unknown>> = [];
    try {
      const resp = await listBatches({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
      });
      batches = ((resp as { batches?: unknown }).batches ?? []) as Array<
        Record<string, unknown>
      >;
    } catch (e) {
      result.errors.push(
        `Failed to fetch Payroc batches: ${e instanceof Error ? e.message : "unknown"}`
      );
      return result;
    }

    for (const payrocBatch of batches) {
      try {
        const batchId = payrocBatch.batchId as string | undefined;
        if (!batchId) continue;

        const closedAt = payrocBatch.closedAt as string | undefined;
        const date = payrocBatch.date as string | undefined;
        const status = (payrocBatch.status as string) ?? "closed";

        const windowEnd = closedAt
          ? new Date(closedAt)
          : date
            ? new Date(`${date}T23:59:59Z`)
            : null;

        if (!windowEnd || isNaN(windowEnd.getTime())) {
          result.errors.push(`Batch ${batchId}: invalid date`);
          continue;
        }

        const windowStart = new Date(
          windowEnd.getTime() - 24 * 60 * 60 * 1000
        );

        const txns = await prisma.transaction.findMany({
          where: {
            merchantId,
            status: "succeeded",
            createdAt: { gte: windowStart, lte: windowEnd },
          },
          select: { amount: true },
        });

        if (txns.length === 0) continue;

        const totalAmount = txns.reduce((sum, t) => sum + t.amount, 0);
        const totalFeesCustomer = totalAmount * 0.035 + 0.3 * txns.length;

        const compositeKey = `${batchId}:${merchantId}`;

        const batchRow = await prisma.batch.upsert({
          where: { payrocBatchId: compositeKey },
          update: {
            totalAmount,
            totalFeesCustomer,
            transactionCount: txns.length,
            status,
            closedAt: windowEnd,
          },
          create: {
            payrocBatchId: compositeKey,
            merchantId,
            totalAmount,
            totalFeesCustomer,
            transactionCount: txns.length,
            status,
            openedAt: windowStart,
            closedAt: windowEnd,
          },
        });

        result.batchesProcessed += 1;

        const existingPayout = await prisma.payout.findFirst({
          where: { batchId: batchRow.id },
          select: { id: true },
        });

        if (!existingPayout) {
          await prisma.payout.create({
            data: {
              merchantId,
              batchId: batchRow.id,
              amount: totalAmount,
              currency: "usd",
              status: status === "settled" ? "paid" : "in_transit",
              arrivalDate: windowEnd,
              description: `Batch ${batchId.slice(0, 12)}`,
            },
          });
          result.payoutsCreated += 1;
        }
      } catch (e) {
        const bid =
          (payrocBatch.batchId as string | undefined) ?? "unknown";
        result.errors.push(
          `Batch ${bid}: ${e instanceof Error ? e.message : "unknown"}`
        );
      }
    }
  } catch (e) {
    result.errors.push(
      `Sync failed: ${e instanceof Error ? e.message : "unknown"}`
    );
  }

  return result;
}

export async function syncAllMerchants(
  options: { daysBack?: number } = {}
): Promise<SyncResult[]> {
  const merchants = await prisma.merchant.findMany({
    where: { status: "active" },
    select: { id: true },
  });
  const results: SyncResult[] = [];
  for (const m of merchants) {
    const r = await syncPayrocBatchesForMerchant(m.id, options);
    results.push(r);
  }
  return results;
}
