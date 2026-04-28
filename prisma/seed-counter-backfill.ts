/**
 * One-shot backfill: recompute Merchant.totalTransactions and totalVolume
 * from existing Transaction rows.
 *
 * Run with:
 *   npx vercel env pull .env.local --environment production
 *   export DIRECT_URL=$(grep '^DIRECT_URL=' .env.local | sed 's/^DIRECT_URL=//' | tr -d '"')
 *   export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | sed 's/^DATABASE_URL=//' | tr -d '"')
 *   npx tsx prisma/seed-counter-backfill.ts
 *   rm .env.local
 *
 * Safe to re-run — it OVERWRITES counters with the SUM/COUNT of actual succeeded
 * transactions, not increments. So even if you run it twice, the values will be correct.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL || process.env.DIRECT_URL;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const merchants = await prisma.merchant.findMany({
    select: { id: true, businessName: true },
  });
  console.log(`Backfilling counters for ${merchants.length} merchants...`);

  for (const m of merchants) {
    const agg = await prisma.transaction.aggregate({
      where: { merchantId: m.id, status: "succeeded" },
      _count: true,
      _sum: { amount: true },
    });
    const totalTransactions = agg._count;
    const totalVolume = agg._sum.amount ?? 0;

    await prisma.merchant.update({
      where: { id: m.id },
      data: { totalTransactions, totalVolume },
    });

    console.log(
      `  ${m.businessName} (${m.id}): ${totalTransactions} txns, $${totalVolume.toFixed(2)}`
    );
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
