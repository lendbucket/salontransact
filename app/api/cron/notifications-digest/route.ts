import { NextResponse } from "next/server";
import { runDigestForAllUsers } from "@/lib/notifications/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.VERCEL_ENV === "production";

  if (isProduction && !cronSecret) {
    console.error("[CRON-NOTIFICATIONS-DIGEST] CRON_SECRET not set in production");
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

  const result = await runDigestForAllUsers();

  return NextResponse.json({
    ok: true,
    triggeredBy: "cron",
    processed: result.processed,
    sent: result.sent,
    skippedOff: result.skippedOff,
    skippedEmpty: result.skippedEmpty,
    skippedThrottled: result.skippedThrottled,
    errors: result.errors,
  });
}
