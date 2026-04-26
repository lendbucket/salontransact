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

  // 1. GET /disputes — no params
  console.log("[DISPUTES-PROBE] GET /disputes (no params)");
  const noParams = await payrocRefundRequest<unknown>("GET", "/disputes", undefined, null);
  console.log("[DISPUTES-PROBE] no params status:", noParams.status, "body:", noParams.rawBody.slice(0, 500));

  // 2. GET /disputes?limit=10
  console.log("[DISPUTES-PROBE] GET /disputes?limit=10");
  const limitOnly = await payrocRefundRequest<unknown>("GET", "/disputes?limit=10", undefined, null);
  console.log("[DISPUTES-PROBE] limit=10 status:", limitOnly.status, "body:", limitOnly.rawBody.slice(0, 500));

  // 3. GET /disputes?date=2026-04-25
  console.log("[DISPUTES-PROBE] GET /disputes?date=2026-04-25");
  const singleDate = await payrocRefundRequest<unknown>("GET", "/disputes?date=2026-04-25", undefined, null);
  console.log("[DISPUTES-PROBE] date status:", singleDate.status, "body:", singleDate.rawBody.slice(0, 500));

  // 4. GET /disputes?dateFrom=...&dateTo=...
  console.log("[DISPUTES-PROBE] GET /disputes?dateFrom=2026-04-01&dateTo=2026-04-26");
  const dateRange = await payrocRefundRequest<unknown>(
    "GET",
    "/disputes?dateFrom=2026-04-01T00:00:00Z&dateTo=2026-04-26T23:59:59Z",
    undefined,
    null
  );
  console.log("[DISPUTES-PROBE] dateRange status:", dateRange.status, "body:", dateRange.rawBody.slice(0, 500));

  // Find first dispute from any successful response
  let firstDisputeId: string | null = null;
  for (const r of [noParams, limitOnly, singleDate, dateRange]) {
    if (r.ok && r.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rd = r.data as any;
      const id = rd?.data?.[0]?.disputeId ?? rd?.data?.[0]?.id ?? null;
      if (id) { firstDisputeId = id; break; }
    }
  }

  // 5. Drill-down if we found a dispute
  let drilldown = null;
  if (firstDisputeId) {
    console.log(`[DISPUTES-PROBE] GET /disputes/${firstDisputeId}/statuses`);
    const statuses = await payrocRefundRequest<unknown>("GET", `/disputes/${firstDisputeId}/statuses`, undefined, null);
    console.log("[DISPUTES-PROBE] statuses status:", statuses.status, "body:", statuses.rawBody.slice(0, 500));
    drilldown = pick(statuses);
  }

  return NextResponse.json({
    noParams: pick(noParams),
    limitOnly: pick(limitOnly),
    withSingleDate: pick(singleDate),
    withDateRange: pick(dateRange),
    drilldown,
    firstDisputeId,
  });
}
