import { NextResponse } from "next/server";
import type { V1ApiError, V1ErrorCode, V1ErrorResponse } from "./types";

const STATUS_FOR_CODE: Record<V1ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 400,
  idempotency_conflict: 409,
  rate_limit_exceeded: 429,
  payment_failed: 422,
  internal_error: 500,
  method_not_allowed: 405,
};

export function apiError(
  code: V1ErrorCode,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    status?: number;
    requestId?: string;
  }
): NextResponse {
  const error: V1ApiError = { code, message };
  if (options?.details) error.details = options.details;

  const body: V1ErrorResponse = { error };
  const status = options?.status ?? STATUS_FOR_CODE[code];

  const response = NextResponse.json(body, { status });
  if (options?.requestId) {
    response.headers.set("X-Request-ID", options.requestId);
  }
  return response;
}
