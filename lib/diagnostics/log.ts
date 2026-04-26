import { prisma } from "@/lib/prisma";

export interface LogEventInput {
  sessionId: string;
  source:
    | "server-checkout"
    | "server-session"
    | "server-payment"
    | "client-form"
    | "client-sdk"
    | "client-button";
  eventName: string;
  payload: Record<string, unknown>;
  userId?: string | null;
  merchantId?: string | null;
}

/**
 * Fire-and-forget diagnostic event logger. Never throws. Never blocks.
 * Gated by PAYMENTS_DIAGNOSTIC_LOGGING env var.
 */
export async function logEvent(input: LogEventInput): Promise<void> {
  if (process.env.PAYMENTS_DIAGNOSTIC_LOGGING !== "true") return;
  try {
    await prisma.diagnosticEvent.create({
      data: {
        sessionId: input.sessionId,
        source: input.source,
        eventName: input.eventName,
        payload: input.payload as object,
        userId: input.userId ?? null,
        merchantId: input.merchantId ?? null,
      },
    });
  } catch {
    // intentionally swallow — diagnostic logging must never disrupt payment flow
  }
}
