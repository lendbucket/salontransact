import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logEvent } from "@/lib/diagnostics/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClientEventBody {
  sessionId?: unknown;
  source?: unknown;
  eventName?: unknown;
  payload?: unknown;
}

export async function POST(req: Request) {
  if (process.env.PAYMENTS_DIAGNOSTIC_LOGGING !== "true") {
    return NextResponse.json({ ok: true, recorded: false }, { status: 200 });
  }

  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: ClientEventBody;
  try {
    body = (await req.json()) as ClientEventBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId : "";
  const source = typeof body.source === "string" ? body.source : "";
  const eventName =
    typeof body.eventName === "string" ? body.eventName : "";
  const payload =
    body.payload && typeof body.payload === "object"
      ? (body.payload as Record<string, unknown>)
      : {};

  if (!sessionId || !source || !eventName) {
    return NextResponse.json(
      { ok: false, error: "Missing required: sessionId, source, eventName" },
      { status: 400 }
    );
  }

  const allowed = ["client-form", "client-sdk", "client-button"];
  if (!allowed.includes(source)) {
    return NextResponse.json(
      { ok: false, error: "Invalid source for client event" },
      { status: 400 }
    );
  }

  await logEvent({
    sessionId,
    source: source as "client-form" | "client-sdk" | "client-button",
    eventName: eventName.slice(0, 100),
    payload,
    userId: user.id,
  });

  return NextResponse.json({ ok: true });
}
