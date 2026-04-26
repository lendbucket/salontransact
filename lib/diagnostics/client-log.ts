export interface ClientLogInput {
  sessionId: string;
  source: "client-form" | "client-sdk" | "client-button";
  eventName: string;
  payload?: Record<string, unknown>;
}

let lastFailure = 0;

export async function clientLogEvent(input: ClientLogInput): Promise<void> {
  if (Date.now() - lastFailure < 30000) return;
  try {
    await fetch("/api/diagnostics/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: input.sessionId,
        source: input.source,
        eventName: input.eventName.slice(0, 100),
        payload: input.payload ?? {},
      }),
      keepalive: true,
    });
  } catch {
    lastFailure = Date.now();
  }
}

let _sessionId: string | undefined;
let _mountTime: number | undefined;

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  if (!_sessionId) {
    _sessionId =
      "diag-" +
      Math.random().toString(36).slice(2, 10) +
      "-" +
      Date.now().toString(36);
    _mountTime = performance.now();
  }
  return _sessionId;
}

export function getMsSinceMount(): number {
  if (_mountTime === undefined) return 0;
  return Math.round(performance.now() - _mountTime);
}

export async function fingerprintToken(token: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return token.slice(0, 16);
  }
}
