import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { payrocRefundRequest } from "@/lib/refunds/payroc-helper";
import { prisma } from "@/lib/prisma";
import type {
  PayrocSettlementTransaction,
  PayrocPaginatedResponse,
} from "@/lib/settlements/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal" && user.role !== "merchant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const batchId = url.searchParams.get("batchId");

  if (!date && !batchId) {
    return NextResponse.json(
      { error: "Either date (YYYY-MM-DD) or batchId is required" },
      { status: 400 }
    );
  }
  if (date && !ISO_DATE.test(date)) {
    return NextResponse.json(
      { error: "date must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  const limitRaw = url.searchParams.get("limit");
  const limitNum = Number(limitRaw);
  const limit = Number.isFinite(limitNum)
    ? Math.min(Math.max(limitNum, 1), 100)
    : 25;

  const queryParts = [`limit=${limit}`];
  if (date) queryParts.push(`date=${date}`);
  if (batchId) queryParts.push(`batchId=${encodeURIComponent(batchId)}`);
  const query = queryParts.join("&");

  const result = await payrocRefundRequest<
    PayrocPaginatedResponse<PayrocSettlementTransaction>
  >("GET", `/transactions?${query}`, undefined, null);

  if (!result.ok || !result.data) {
    return NextResponse.json(
      {
        error: "Failed to fetch transactions from SalonTransact",
        status: result.status,
        detail: result.rawBody.slice(0, 500),
      },
      {
        status:
          result.status >= 400 && result.status < 600 ? result.status : 502,
      }
    );
  }

  if (user.role === "master portal") {
    return NextResponse.json({
      ...result.data,
      debug: { date, batchId, limit, scope: "master" },
    });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!merchant) {
    return NextResponse.json({
      data: [],
      count: 0,
      hasMore: false,
      limit,
      debug: { date, batchId, limit, scope: "merchant", merchant: null },
    });
  }

  const txs = await prisma.transaction.findMany({
    where: { merchantId: merchant.id },
    select: { metadata: true },
  });

  const merchantPaymentIds = new Set<string>();
  for (const tx of txs) {
    const meta = tx.metadata as { payrocPaymentId?: string } | null;
    if (meta?.payrocPaymentId) merchantPaymentIds.add(meta.payrocPaymentId);
  }

  const filtered = result.data.data.filter((stx) =>
    stx.paymentId ? merchantPaymentIds.has(stx.paymentId) : false
  );

  return NextResponse.json({
    ...result.data,
    data: filtered,
    count: filtered.length,
    debug: {
      date,
      batchId,
      limit,
      scope: "merchant",
      merchantId: merchant.id,
      merchantPaymentIdCount: merchantPaymentIds.size,
      filteredCount: filtered.length,
    },
  });
}
