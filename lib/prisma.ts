import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  // Runtime: prefer DATABASE_URL (transaction pooler, port 6543) for serverless connection pooling.
  // Falls back to DIRECT_URL (session pooler, port 5432) only if DATABASE_URL is not set.
  // Migrations (prisma db push) use DIRECT_URL via prisma/schema.prisma directUrl config.
  const connectionString =
    process.env.DATABASE_URL || process.env.DIRECT_URL;

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
