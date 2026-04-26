import { getPayrocToken } from "@/lib/payroc/client";

const PAYROC_API_URL = process.env.PAYROC_API_URL;

export interface PayrocHelperResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  rawBody: string;
  error?: string;
}

/**
 * Make a Payroc API request with a CALLER-PROVIDED idempotency key.
 *
 * Why this exists separately from `payrocRequest` in lib/payroc/client.ts:
 * the existing function generates a fresh UUID per call, which prevents
 * the caller from coordinating idempotency keys with our refund_operation
 * audit table for double-click protection.
 *
 * This function imports `getPayrocToken` from the working payment client
 * (read-only) so we share the bearer token cache and don't double up on
 * Payroc auth calls.
 *
 * NEVER modifies lib/payroc/client.ts. NEVER replaces or shadows
 * payrocRequest. Used ONLY by lib/refunds/* code.
 */
export async function payrocRefundRequest<T>(
  method: "GET" | "POST",
  path: string,
  body: unknown | undefined,
  idempotencyKey: string | null
): Promise<PayrocHelperResult<T>> {
  if (!PAYROC_API_URL) {
    return {
      ok: false,
      status: 0,
      data: null,
      rawBody: "",
      error: "PAYROC_API_URL not configured",
    };
  }

  const token = await getPayrocToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  if (method === "POST") {
    if (!idempotencyKey) {
      return {
        ok: false,
        status: 0,
        data: null,
        rawBody: "",
        error: "POST requests require an Idempotency-Key",
      };
    }
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const response = await fetch(`${PAYROC_API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const rawBody = await response.text();
  let data: T | null = null;
  try {
    data = rawBody ? (JSON.parse(rawBody) as T) : null;
  } catch {
    // leave as null; rawBody preserved for debugging
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    rawBody,
  };
}
