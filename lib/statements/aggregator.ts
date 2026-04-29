import { prisma } from "@/lib/prisma";
import type {
  StatementData,
  StatementMerchant,
  StatementSummary,
  DailySummary,
} from "./types";

export interface BuildStatementInput {
  merchantId: string;
  year: number;
  month: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

export async function buildStatementData(
  input: BuildStatementInput
): Promise<StatementData | null> {
  const { merchantId, year, month } = input;

  if (year < 2020 || year > 2100) return null;
  if (month < 1 || month > 12) return null;

  const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  const merchantRow = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      businessName: true,
      dbaName: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      ein: true,
    },
  });

  if (!merchantRow) return null;

  const merchant: StatementMerchant = {
    id: merchantRow.id,
    businessName: merchantRow.businessName,
    dbaName: merchantRow.dbaName,
    email: merchantRow.email,
    phone: merchantRow.phone,
    address: merchantRow.address,
    city: merchantRow.city,
    state: merchantRow.state,
    zip: merchantRow.zip,
    ein: merchantRow.ein,
  };

  const txns = await prisma.transaction.findMany({
    where: {
      merchantId,
      createdAt: { gte: periodStart, lt: periodEnd },
    },
    select: {
      amount: true,
      fee: true,
      net: true,
      refunded: true,
      refundAmount: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const dailyMap = new Map<string, DailySummary>();

  let totalVolumeCents = 0;
  let succeededCount = 0;
  let totalFeesCents = 0;
  let totalNetCents = 0;
  let totalRefundsCents = 0;
  let refundCount = 0;

  for (const t of txns) {
    const isSucceeded =
      t.status.toLowerCase() === "succeeded" ||
      t.status.toLowerCase() === "complete" ||
      t.status.toLowerCase() === "captured" ||
      t.status.toLowerCase() === "approved";

    if (!isSucceeded) continue;

    const amountCents = Math.round(t.amount * 100);
    const feeCents = Math.round(t.fee * 100);
    const netCents = Math.round(t.net * 100);
    const refundCents = Math.round(t.refundAmount * 100);

    const dateKey = t.createdAt.toISOString().slice(0, 10);
    let bucket = dailyMap.get(dateKey);
    if (!bucket) {
      bucket = {
        date: dateKey,
        transactionCount: 0,
        volumeCents: 0,
        feesCents: 0,
        netCents: 0,
        refundsCents: 0,
        refundCount: 0,
      };
      dailyMap.set(dateKey, bucket);
    }

    bucket.transactionCount += 1;
    bucket.volumeCents += amountCents;
    bucket.feesCents += feeCents;
    bucket.netCents += netCents;

    succeededCount += 1;
    totalVolumeCents += amountCents;
    totalFeesCents += feeCents;
    totalNetCents += netCents;

    if (t.refunded && refundCents > 0) {
      bucket.refundsCents += refundCents;
      bucket.refundCount += 1;
      totalRefundsCents += refundCents;
      refundCount += 1;
    }
  }

  const averageTicketCents =
    succeededCount > 0 ? Math.round(totalVolumeCents / succeededCount) : 0;

  const summary: StatementSummary = {
    totalVolumeCents,
    transactionCount: succeededCount,
    averageTicketCents,
    totalFeesCents,
    totalNetCents,
    totalRefundsCents,
    refundCount,
    disputesNote: "Not tracked in this statement",
  };

  const daily: DailySummary[] = Array.from(dailyMap.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return {
    merchant,
    periodLabel,
    periodStart,
    periodEnd,
    generatedAt: new Date(),
    summary,
    daily,
  };
}
