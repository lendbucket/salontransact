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

  const c1 = await payrocRefundRequest<unknown>("GET", "/ach-deposits", undefined, null);
  calls.depositsNoParams = { status: c1.status, ok: c1.ok, data: c1.data, rawBody: c1.rawBody.slice(0, 1500) };

  const c2 = await payrocRefundRequest<unknown>("GET", "/ach-deposits?limit=10", undefined, null);
  calls.depositsLimitOnly = { status: c2.status, ok: c2.ok, data: c2.data, rawBody: c2.rawBody.slice(0, 1500) };

  const c3 = await payrocRefundRequest<unknown>("GET", "/ach-deposits?date=2026-04-25", undefined, null);
  calls.depositsWithDate = { status: c3.status, ok: c3.ok, data: c3.data, rawBody: c3.rawBody.slice(0, 1500) };

  const c4 = await payrocRefundRequest<unknown>("GET", "/ach-deposits?date=2026-04-20", undefined, null);
  calls.depositsApr20 = { status: c4.status, ok: c4.ok, data: c4.data, rawBody: c4.rawBody.slice(0, 1500) };

  let firstDepositId: string | null = null;
  for (const result of [c1, c2, c3, c4]) {
    if (result.ok && result.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = result.data as any;
      if (Array.isArray(d?.data) && d.data.length > 0) {
        firstDepositId = d.data[0]?.achDepositId ?? d.data[0]?.id ?? null;
        if (firstDepositId) break;
      }
    }
  }

  let depositFees: unknown = null;
  if (firstDepositId) {
    const cFees = await payrocRefundRequest<unknown>(
      "GET",
      `/ach-deposits/${encodeURIComponent(firstDepositId)}/fees`,
      undefined,
      null
    );
    depositFees = {
      status: cFees.status,
      ok: cFees.ok,
      data: cFees.data,
      rawBody: cFees.rawBody.slice(0, 1500),
    };
  } else {
    const cFeesError = await payrocRefundRequest<unknown>(
      "GET",
      "/ach-deposits/FAKE_DEPOSIT_ID/fees",
      undefined,
      null
    );
    depositFees = {
      note: "no real depositId found; called with FAKE_DEPOSIT_ID to learn error shape",
      status: cFeesError.status,
      ok: cFeesError.ok,
      data: cFeesError.data,
      rawBody: cFeesError.rawBody.slice(0, 1500),
    };
  }

  return NextResponse.json({
    ...calls,
    firstDepositId,
    depositFees,
  });
}
