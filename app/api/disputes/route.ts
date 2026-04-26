import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { payrocRefundRequest } from "@/lib/refunds/payroc-helper";
import { prisma } from "@/lib/prisma";
import type {
  PayrocDispute,
  PayrocPaginatedResponse,
} from "@/lib/disputes/types";

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
  if (!date || !ISO_DATE.test(date)) {
    return NextResponse.json(
      { error: "date query param required in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  const limitRaw = url.searchParams.get("limit");
  const limitNum = Number(limitRaw);
  const limit = Number.isFinite(limitNum)
    ? Math.min(Math.max(limitNum, 1), 100)
    : 25;

  const result = await payrocRefundRequest<
    PayrocPaginatedResponse<PayrocDispute>
  >("GET", `/disputes?date=${date}&limit=${limit}`, undefined, null);

  if (!result.ok || !result.data) {
    return NextResponse.json(
      {
        error: "Failed to fetch disputes from SalonTransact",
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
      debug: { date, limit, scope: "master" },
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
      debug: { date, limit, scope: "merchant", merchant: null },
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

  const filtered = result.data.data.filter((d) =>
    d.paymentId ? merchantPaymentIds.has(d.paymentId) : false
  );

  return NextResponse.json({
    ...result.data,
    data: filtered,
    count: filtered.length,
    debug: {
      date,
      limit,
      scope: "merchant",
      merchantId: merchant.id,
      merchantPaymentIdCount: merchantPaymentIds.size,
      filteredCount: filtered.length,
    },
  });
}
