import type { ApiKey, Merchant } from "@prisma/client";

export type V1ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "idempotency_conflict"
  | "rate_limit_exceeded"
  | "payment_failed"
  | "internal_error"
  | "method_not_allowed";

export interface V1ApiError {
  code: V1ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface V1AuthContext {
  apiKey: Pick<ApiKey, "id" | "merchantId" | "name" | "keyPrefix">;
  merchant: Pick<Merchant, "id" | "businessName" | "email">;
  requestId: string;
}

export interface V1ErrorResponse {
  error: V1ApiError;
}
