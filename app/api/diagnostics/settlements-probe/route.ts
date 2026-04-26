import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { payrocRefundRequest } from "@/lib/refunds/payroc-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(r: { status: number; ok: boolean; data: any; rawBody: string }) {
  return { status: r.status, ok: r.ok, data: r.data, rawBody: r.rawBody.slice(0, 2000) };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user || user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tid = process.env.PAYROC_TERMINAL_ID ?? "";
  const dates = ["2026-04-26", "2026-04-25", "2026-04-24", "2026-04-23", "2026-04-22"];

  // 1-5. GET /batches?date=...&processingTerminalId=...
  const byDate: Record<string, ReturnType<typeof pick>> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let firstBatch: { batchId: string; date: string } | null = null;

  for (const d of dates) {
    const path = `/batches?date=${d}&processingTerminalId=${tid}`;
    console.log(`[SETTLEMENTS-PROBE] GET ${path}`);
    const r = await payrocRefundRequest<unknown>("GET", path, undefined, null);
    console.log(`[SETTLEMENTS-PROBE] ${d} status:`, r.status, "body:", r.rawBody.slice(0, 500));
    byDate[d] = pick(r);

    if (!firstBatch && r.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rd = r.data as any;
      const id = rd?.data?.[0]?.batchId ?? rd?.data?.[0]?.id ?? null;
      if (id) firstBatch = { batchId: id, date: d };
    }
  }

  // 8. GET /batches?date=2026-04-25 without terminalId
  console.log("[SETTLEMENTS-PROBE] GET /batches?date=2026-04-25 (no terminal)");
  const noTerm = await payrocRefundRequest<unknown>("GET", "/batches?date=2026-04-25", undefined, null);
  console.log("[SETTLEMENTS-PROBE] no-terminal status:", noTerm.status, "body:", noTerm.rawBody.slice(0, 500));

  // 6-7. Drill-down
  let drilldown = null;
  if (firstBatch) {
    console.log(`[SETTLEMENTS-PROBE] GET /batches/${firstBatch.batchId}?processingTerminalId=${tid}`);
    const bd = await payrocRefundRequest<unknown>("GET", `/batches/${firstBatch.batchId}?processingTerminalId=${tid}`, undefined, null);
    console.log("[SETTLEMENTS-PROBE] batch detail status:", bd.status, "body:", bd.rawBody.slice(0, 500));

    console.log(`[SETTLEMENTS-PROBE] GET /transactions?batchId=${firstBatch.batchId}&processingTerminalId=${tid}`);
    const tx = await payrocRefundRequest<unknown>("GET", `/transactions?batchId=${firstBatch.batchId}&processingTerminalId=${tid}`, undefined, null);
    console.log("[SETTLEMENTS-PROBE] tx by batch status:", tx.status, "body:", tx.rawBody.slice(0, 500));

    drilldown = { batchDetail: pick(bd), transactions: pick(tx), batchId: firstBatch.batchId, date: firstBatch.date };
  }

  return NextResponse.json({
    terminalIdUsed: tid || null,
    byDate,
    withoutTerminal: pick(noTerm),
    drilldown,
  });
}
