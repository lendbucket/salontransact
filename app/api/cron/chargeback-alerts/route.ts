import { NextResponse } from "next/server";
import { checkAndAlertMerchants } from "@/lib/risk/chargeback-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.VERCEL_ENV === "production";

  if (isProduction && !cronSecret) {
    console.error("[CRON-CB-ALERTS] CRON_SECRET not set in production");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 503 });
  }

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startedAt = Date.now();

  try {
    const result = await checkAndAlertMerchants();

    return NextResponse.json({
      ok: true,
      checked: result.checked,
      alertsTriggered: result.alerts.length,
      alerts: result.alerts,
      errors: result.errors.length,
      elapsedMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[CRON-CB-ALERTS] Top-level failure:", e);
    return NextResponse.json(
      { error: "Cron failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
