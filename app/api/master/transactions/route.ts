import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  TransactionListResponse,
  TransactionSummary,
} from "@/app/master/transactions/_lib/transaction-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const merchantIdParam = url.searchParams.get("merchantId");
  const statusParam = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(
    Math.max(parseInt(limitParam ?? "200", 10) || 200, 1),
    500
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (merchantIdParam && merchantIdParam.length > 0) {
    where.merchantId = merchantIdParam;
  }
  if (
    statusParam &&
    statusParam !== "all" &&
    statusParam !== "refunded" &&
    statusParam.length > 0
  ) {
    where.status = statusParam;
  }
  if (q.length > 0) {
    const orClauses: Array<Record<string, unknown>> = [
      { description: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { stripePaymentId: { contains: q } },
      { id: { contains: q } },
      { merchant: { businessName: { contains: q, mode: "insensitive" } } },
    ];

    const cleanedQ = q.replace(/[$,]/g, "").trim();
    const numericValue = parseFloat(cleanedQ);
    if (Number.isFinite(numericValue) && cleanedQ.length > 0) {
      orClauses.push({
        amount: { gte: numericValue - 0.005, lte: numericValue + 0.005 },
      });
    }

    where.OR = orClauses;
  }

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      merchant: {
        select: { id: true, businessName: true },
      },
    },
  });

  let filtered = rows;
  if (statusParam === "refunded") {
    filtered = rows.filter((r) => r.refunded);
  }

  const transactions: TransactionSummary[] = filtered.map((t) => ({
    id: t.id,
    merchantId: t.merchant.id,
    merchantBusinessName: t.merchant.businessName,
    amount: t.amount,
    currency: t.currency,
    status: t.status,
    description: t.description,
    customerEmail: t.customerEmail,
    customerName: t.customerName,
    fee: t.fee,
    net: t.net,
    refunded: t.refunded,
    refundAmount: t.refundAmount,
    stripePaymentId: t.stripePaymentId,
    createdAt: t.createdAt.toISOString(),
  }));

  const merchantsRepresented = new Set(
    transactions.map((t) => t.merchantId)
  ).size;

  const response: TransactionListResponse = {
    transactions,
    total: transactions.length,
    merchantsRepresented,
  };

  return NextResponse.json(response);
}
