import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { payrocRefundRequest } from "@/lib/refunds/payroc-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(r: { status: number; ok: boolean; data: any; rawBody: string }) {
  return {
    status: r.status,
    ok: r.ok,
    data: r.data,
    rawBody: r.rawBody.slice(0, 2000),
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dates = ["2026-04-26", "2026-04-25", "2026-04-20"];

  // 1-3. GET /batches?date=...
  const batchResults: Record<string, ReturnType<typeof pick>> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let firstBatch: { batchId: string; date: string } | null = null;

  for (const d of dates) {
    const label = d === "2026-04-26" ? "today" : d === "2026-04-25" ? "yesterday" : "april20";
    console.log(`[SETTLEMENTS-PROBE] GET /batches?date=${d}`);
    const r = await payrocRefundRequest<unknown>("GET", `/batches?date=${d}`, undefined, null);
    console.log(`[SETTLEMENTS-PROBE] /batches?date=${d} status:`, r.status, "body:", r.rawBody);
    batchResults[label] = pick(r);

    if (!firstBatch && r.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rd = r.data as any;
      const id = rd?.data?.[0]?.batchId ?? rd?.data?.[0]?.id ?? null;
      if (id) firstBatch = { batchId: id, date: d };
    }
  }

  // 4-6. Drill-down if we found a batch
  let singleBatch = null;
  let txByBatchId = null;
  let txByDate = null;

  if (firstBatch) {
    console.log(`[SETTLEMENTS-PROBE] GET /batches/${firstBatch.batchId}`);
    const sb = await payrocRefundRequest<unknown>("GET", `/batches/${firstBatch.batchId}`, undefined, null);
    console.log(`[SETTLEMENTS-PROBE] single batch status:`, sb.status, "body:", sb.rawBody);
    singleBatch = pick(sb);

    console.log(`[SETTLEMENTS-PROBE] GET /transactions?batchId=${firstBatch.batchId}`);
    const tb = await payrocRefundRequest<unknown>("GET", `/transactions?batchId=${firstBatch.batchId}`, undefined, null);
    console.log(`[SETTLEMENTS-PROBE] tx by batchId status:`, tb.status, "body:", tb.rawBody);
    txByBatchId = pick(tb);

    console.log(`[SETTLEMENTS-PROBE] GET /transactions?date=${firstBatch.date}`);
    const td = await payrocRefundRequest<unknown>("GET", `/transactions?date=${firstBatch.date}`, undefined, null);
    console.log(`[SETTLEMENTS-PROBE] tx by date status:`, td.status, "body:", td.rawBody);
    txByDate = pick(td);
  }

  return NextResponse.json({
    batchesToday: batchResults.today,
    batchesYesterday: batchResults.yesterday,
    batchesAprilTwentieth: batchResults.april20,
    firstBatchFound: firstBatch,
    singleBatch,
    transactionsByBatchId: txByBatchId,
    transactionsByDate: txByDate,
  });
}
