import { NextResponse } from "next/server";
import { syncAllMerchants } from "@/lib/payouts/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.VERCEL_ENV === "production";

  if (isProduction && !cronSecret) {
    console.error("[CRON-SYNC-PAYOUTS] CRON_SECRET not set in production");
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 503 }
    );
  }

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = await syncAllMerchants({ daysBack: 2 });
  const totalBatches = results.reduce((s, r) => s + r.batchesProcessed, 0);
  const totalPayouts = results.reduce((s, r) => s + r.payoutsCreated, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

  return NextResponse.json({
    ok: true, triggeredBy: "cron", merchantsProcessed: results.length,
    batchesProcessed: totalBatches, payoutsCreated: totalPayouts, errors: totalErrors,
  });
}
