import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncAllMerchants, syncPayrocBatchesForMerchant } from "@/lib/payouts/sync";
import { writeAuditLog } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string | null; role?: string } | undefined;
  if (!user || !user.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.role !== "master portal") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { merchantId?: unknown; daysBack?: unknown } = {};
  try { body = (await request.json().catch(() => ({}))) as typeof body; } catch { body = {}; }

  const daysBack = typeof body.daysBack === "number" && body.daysBack > 0 && body.daysBack <= 30 ? body.daysBack : 7;
  const merchantId = typeof body.merchantId === "string" && body.merchantId.length > 0 ? body.merchantId : null;

  const results = merchantId
    ? [await syncPayrocBatchesForMerchant(merchantId, { daysBack })]
    : await syncAllMerchants({ daysBack });

  const totalBatches = results.reduce((s, r) => s + r.batchesProcessed, 0);
  const totalPayouts = results.reduce((s, r) => s + r.payoutsCreated, 0);

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "payout.sync",
    targetType: "Payout",
    targetId: merchantId ?? "all",
    merchantId: merchantId ?? null,
    metadata: { daysBack, merchantsProcessed: results.length, batchesProcessed: totalBatches, payoutsCreated: totalPayouts, trigger: "manual" },
  });

  return NextResponse.json({
    ok: true, merchantsProcessed: results.length, batchesProcessed: totalBatches,
    payoutsCreated: totalPayouts, errors: results.flatMap((r) => r.errors).slice(0, 50), results,
  });
}
