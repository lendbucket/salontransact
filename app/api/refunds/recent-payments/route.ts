import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { payrocRefundRequest } from "@/lib/refunds/payroc-helper";
import { prisma } from "@/lib/prisma";
import type { PayrocPayment } from "@/lib/refunds/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PayrocListResponse {
  limit: number;
  count: number;
  hasMore: boolean;
  data: PayrocPayment[];
  links?: Array<{ rel: string; method: string; href: string }>;
}

const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LOOKBACK_DAYS = 90;

function parseIsoOrNull(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
  const limitRaw = url.searchParams.get("limit");
  const limitNum = Number(limitRaw);
  const limit = Number.isFinite(limitNum)
    ? Math.min(Math.max(limitNum, 1), 100)
    : 25;

  const now = new Date();
  const userTo = parseIsoOrNull(url.searchParams.get("to"));
  const userFrom = parseIsoOrNull(url.searchParams.get("from"));
  const dateTo = userTo && userTo <= now ? userTo : now;
  const earliestAllowedFrom = new Date(
    dateTo.getTime() - MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  );
  const defaultFrom = new Date(
    dateTo.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  );
  const dateFrom =
    userFrom && userFrom < dateTo && userFrom >= earliestAllowedFrom
      ? userFrom
      : defaultFrom;

  const dateFromIso = dateFrom.toISOString();
  const dateToIso = dateTo.toISOString();

  const payrocPath =
    `/payments` +
    `?limit=${limit}` +
    `&dateFrom=${encodeURIComponent(dateFromIso)}` +
    `&dateTo=${encodeURIComponent(dateToIso)}`;

  const result = await payrocRefundRequest<PayrocListResponse>(
    "GET",
    payrocPath,
    undefined,
    null
  );

  if (!result.ok || !result.data) {
    return NextResponse.json(
      {
        error: "Failed to fetch payments from Payroc",
        status: result.status,
        detail: result.rawBody.slice(0, 1000),
        debug: { dateFrom: dateFromIso, dateTo: dateToIso, limit },
      },
      {
        status:
          result.status >= 400 && result.status < 600 ? result.status : 502,
      }
    );
  }

  // Master portal sees everything
  if (user.role === "master portal") {
    return NextResponse.json({
      ...result.data,
      debug: {
        dateFrom: dateFromIso,
        dateTo: dateToIso,
        limit,
        scope: "master",
      },
    });
  }

  // Merchant sees only their own payments
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
      debug: {
        dateFrom: dateFromIso,
        dateTo: dateToIso,
        limit,
        scope: "merchant",
        merchant: null,
      },
    });
  }

  const txs = await prisma.transaction.findMany({
    where: {
      merchantId: merchant.id,
      createdAt: { gte: dateFrom, lte: dateTo },
    },
    select: { metadata: true },
  });

  const merchantPaymentIds = new Set<string>();
  for (const tx of txs) {
    const meta = tx.metadata as { payrocPaymentId?: string } | null;
    if (meta?.payrocPaymentId) {
      merchantPaymentIds.add(meta.payrocPaymentId);
    }
  }

  const filteredData = result.data.data.filter((p) =>
    merchantPaymentIds.has(p.paymentId)
  );

  return NextResponse.json({
    ...result.data,
    data: filteredData,
    count: filteredData.length,
    debug: {
      dateFrom: dateFromIso,
      dateTo: dateToIso,
      limit,
      scope: "merchant",
      merchantId: merchant.id,
      merchantTransactionCount: txs.length,
      merchantPaymentIdCount: merchantPaymentIds.size,
      filteredCount: filteredData.length,
    },
  });
}
