import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  // Use DIRECT_URL (port 5432) to bypass PgBouncer — avoids prepared
  // statement issues that cause silent failures in serverless cold starts.
  // Fall back to DATABASE_URL if DIRECT_URL is not set.
  const connectionString =
    process.env.DIRECT_URL || process.env.DATABASE_URL;

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
