import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { payrocRefundRequest } from "@/lib/refunds/payroc-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const calls: Record<string, unknown> = {};

  const c1 = await payrocRefundRequest<unknown>("GET", "/authorizations", undefined, null);
  calls.noParams = { status: c1.status, ok: c1.ok, data: c1.data, rawBody: c1.rawBody.slice(0, 1500) };

  const c2 = await payrocRefundRequest<unknown>("GET", "/authorizations?limit=10", undefined, null);
  calls.limitOnly = { status: c2.status, ok: c2.ok, data: c2.data, rawBody: c2.rawBody.slice(0, 1500) };

  const c3 = await payrocRefundRequest<unknown>("GET", "/authorizations?date=2026-04-25", undefined, null);
  calls.withDate = { status: c3.status, ok: c3.ok, data: c3.data, rawBody: c3.rawBody.slice(0, 1500) };

  const c4 = await payrocRefundRequest<unknown>("GET", "/authorizations?date=2026-04-20", undefined, null);
  calls.olderDate = { status: c4.status, ok: c4.ok, data: c4.data, rawBody: c4.rawBody.slice(0, 1500) };

  const c5 = await payrocRefundRequest<unknown>(
    "GET",
    "/authorizations?dateFrom=2026-04-01T00:00:00Z&dateTo=2026-04-26T23:59:59Z",
    undefined,
    null
  );
  calls.dateRange = { status: c5.status, ok: c5.ok, data: c5.data, rawBody: c5.rawBody.slice(0, 1500) };

  let firstAuthId: string | null = null;
  for (const result of [c1, c2, c3, c4, c5]) {
    if (result.ok && result.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = result.data as any;
      if (Array.isArray(d?.data) && d.data.length > 0) {
        firstAuthId = d.data[0]?.authorizationId ?? d.data[0]?.id ?? null;
        if (firstAuthId) break;
      }
    }
  }

  let drilldown: unknown = null;
  if (firstAuthId) {
    const cDrill = await payrocRefundRequest<unknown>(
      "GET",
      `/authorizations/${encodeURIComponent(firstAuthId)}`,
      undefined,
      null
    );
    drilldown = {
      status: cDrill.status,
      ok: cDrill.ok,
      data: cDrill.data,
      rawBody: cDrill.rawBody.slice(0, 1500),
    };
  } else {
    const cDrillError = await payrocRefundRequest<unknown>(
      "GET",
      "/authorizations/FAKE_AUTH_ID",
      undefined,
      null
    );
    drilldown = {
      note: "no real authorizationId found; called with FAKE_AUTH_ID to learn error shape",
      status: cDrillError.status,
      ok: cDrillError.ok,
      data: cDrillError.data,
      rawBody: cDrillError.rawBody.slice(0, 1500),
    };
  }

  return NextResponse.json({
    ...calls,
    firstAuthId,
    drilldown,
  });
}
