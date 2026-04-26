import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { payrocRefundRequest } from "@/lib/refunds/payroc-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(r: { status: number; ok: boolean; data: any; rawBody: string }) {
  return { status: r.status, ok: r.ok, data: r.data, rawBody: r.rawBody.slice(0, 1500) };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user || user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tid = process.env.PAYROC_TERMINAL_ID ?? "";

  const c1 = await payrocRefundRequest<unknown>("GET", "/ach-deposits?date=2025-12-15", undefined, null);
  const c2 = await payrocRefundRequest<unknown>("GET", `/ach-deposits?date=2026-04-26&processingTerminalId=${tid}`, undefined, null);
  const c3 = await payrocRefundRequest<unknown>("GET", "/ach-deposits?date=2026-04-26&merchantId=any", undefined, null);
  const c4 = await payrocRefundRequest<unknown>("GET", "/ach-deposits?date=2026-04-26T00:00:00Z", undefined, null);
  const c5 = await payrocRefundRequest<unknown>("GET", "/ach-deposits?date=2026-04-26&processingAccountId=any", undefined, null);

  return NextResponse.json({
    v1_olderDate: pick(c1),
    v2_terminalId: pick(c2),
    v3_merchantId: pick(c3),
    v4_isoDateTime: pick(c4),
    v5_processingAccountId: pick(c5),
    terminalIdUsed: tid || null,
  });
}
