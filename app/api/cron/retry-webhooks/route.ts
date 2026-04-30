import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retryFailedDelivery } from "@/lib/webhooks/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 100;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.VERCEL_ENV === "production";

  if (isProduction && !cronSecret) {
    console.error("[CRON-RETRY-WEBHOOKS] CRON_SECRET not set in production");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 503 });
  }

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const now = new Date();

  let processed = 0;
  let succeeded = 0;
  let stillFailed = 0;
  let exhausted = 0;
  const errors: Array<{ deliveryId: string; error: string }> = [];

  try {
    const due = await prisma.webhookDelivery.findMany({
      where: { status: "failed", nextRetryAt: { lte: now }, attemptCount: { lt: 5 } },
      orderBy: { nextRetryAt: "asc" },
      take: BATCH_SIZE,
      select: { id: true },
    });

    for (const d of due) {
      try {
        const result = await retryFailedDelivery(d.id);
        processed += 1;
        if (result.succeeded) succeeded += 1;
        else if (result.newStatus === "exhausted") exhausted += 1;
        else stillFailed += 1;
      } catch (e) {
        errors.push({ deliveryId: d.id, error: e instanceof Error ? e.message : String(e) });
      }
    }
  } catch (e) {
    console.error("[CRON-RETRY-WEBHOOKS] Top-level failure:", e);
    return NextResponse.json({ error: "Cron failed", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    processed,
    succeeded,
    stillFailed,
    exhausted,
    errors: errors.length,
    elapsedMs: Date.now() - startedAt,
    timestamp: now.toISOString(),
  });
}
