import { prisma } from "@/lib/prisma";
import { payrocRequest } from "@/lib/payroc/client";
import type { PayrocBatch } from "@/lib/settlements/types";
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

    // Fetch Payroc batches one day at a time. Payroc UAT /v1/batches rejects
    // startDate/endDate (returns HTTP 400 "Unknown query parameter"). The only
    // working format is ?date=YYYY-MM-DD&limit=N per the working
    // /api/settlements/batches route.
    const batches: PayrocBatch[] = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = fmt(d);
      try {
        const resp = await payrocRequest<{
          limit: number;
          count: number;
          hasMore: boolean;
          data: PayrocBatch[];
        }>("GET", `/batches?date=${dateStr}&limit=100`);
        if (resp && Array.isArray(resp.data)) {
          batches.push(...resp.data);
        }
      } catch (e) {
        // One day's failure shouldn't kill the whole sync — record and continue
        result.errors.push(
          `Failed to fetch batches for ${dateStr}: ${e instanceof Error ? e.message : "unknown"}`
        );
      }
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
