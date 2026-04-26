import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayrocSecret, isWithinTimeWindow } from "@/lib/webhooks/verify";
import { routeEvent } from "@/lib/webhooks/handlers";
import type { CloudEvent } from "@/lib/webhooks/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NO NextAuth gate — Payroc is not a logged-in user

const ENV_SECRET_KEY = "PAYROC_WEBHOOK_SECRET";

export async function POST(req: Request) {
  // 1. Read raw body BEFORE parsing (in case future signature schemes need it verbatim)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Could not read body" }, { status: 400 });
  }

  // 2. Verify the shared secret BEFORE doing any work with the body
  const receivedSecret = req.headers.get("payroc-secret");
  const expectedSecret = process.env[ENV_SECRET_KEY];

  if (!verifyPayrocSecret(receivedSecret, expectedSecret)) {
    // Don't reveal whether secret is missing, wrong, or env not set
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parse the CloudEvents envelope
  let event: CloudEvent<unknown>;
  try {
    event = JSON.parse(rawBody) as CloudEvent<unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 4. Validate envelope shape
  if (
    typeof event.specversion !== "string" ||
    typeof event.type !== "string" ||
    typeof event.id !== "string" ||
    typeof event.source !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid CloudEvents envelope" },
      { status: 400 }
    );
  }

  // 5. Replay protection — reject events with time field > 10 minutes old
  if (event.time && !isWithinTimeWindow(event.time, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Event time outside acceptable window" },
      { status: 400 }
    );
  }

  // 6. Get caller IP for audit trail
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  // 7. Persist raw event FIRST. This survives even if routing/handlers fail.
  try {
    const inserted = await prisma.webhookEvent.create({
      data: {
        source: "payroc",
        eventId: event.id,
        eventType: event.type,
        payload: event as object,
        status: "received",
        ipAddress,
      },
      select: { id: true },
    });

    // 8. Route to handler
    let handlerResult: { ok: boolean; reason?: string };
    try {
      handlerResult = await routeEvent(event);
    } catch (handlerErr) {
      const errMsg =
        handlerErr instanceof Error
          ? handlerErr.message
          : "unknown handler error";
      await prisma.webhookEvent.update({
        where: { id: inserted.id },
        data: {
          status: "failed",
          processedAt: new Date(),
          errorMessage: errMsg.slice(0, 500),
        },
      });
      // Return 200 anyway — we've persisted the event, Payroc shouldn't retry endlessly
      return NextResponse.json(
        { received: true, processed: false },
        { status: 200 }
      );
    }

    // 9. Mark as processed
    await prisma.webhookEvent.update({
      where: { id: inserted.id },
      data: {
        status: handlerResult.ok ? "processed" : "failed",
        processedAt: new Date(),
        errorMessage: handlerResult.ok
          ? null
          : (handlerResult.reason ?? "handler returned not-ok"),
      },
    });

    return NextResponse.json(
      { received: true, processed: handlerResult.ok },
      { status: 200 }
    );
  } catch (dbErr) {
    // Unique constraint on eventId means this is a duplicate
    const errMsg = dbErr instanceof Error ? dbErr.message : "unknown db error";
    if (errMsg.includes("Unique constraint") || errMsg.includes("P2002")) {
      // Idempotency: we already saw this event. Acknowledge.
      return NextResponse.json(
        { received: true, duplicate: true },
        { status: 200 }
      );
    }
    // Database actually unreachable
    console.error("[WEBHOOK] DB error:", errMsg);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 }
    );
  }
}
