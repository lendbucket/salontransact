import type { ProcessChargeResult } from "./process";
import type { ParsedChargeInput } from "./validate";
import type { V1ChargeResponse, V1ChargeStatus, V1ChargeItem } from "./types";

/**
 * Format a Prisma Transaction row into V1ChargeResponse.
 * Used by GET /api/v1/charges/[id] and GET /api/v1/charges (list).
 */
export function formatTransactionAsCharge(txn: {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  customerEmail: string | null;
  customerName: string | null;
  customerId: string | null;
  stylistId: string | null;
  bookingId: string | null;
  tipAmount: number;
  items: unknown;
  fee: number;
  net: number;
  refunded: boolean;
  refundAmount: number;
  metadata: unknown;
  createdAt: Date;
}): V1ChargeResponse {
  const meta = (txn.metadata ?? {}) as Record<string, unknown>;
  const amountCents = Math.round(txn.amount * 100);
  const tipCents = Math.round(txn.tipAmount * 100);
  const succeeded = txn.status === "succeeded";

  // Extract card info from metadata (set during checkout/v1 charge)
  const last4 = (meta.last4 as string) ?? (meta.cardLast4 as string) ?? null;
  const brand = (meta.cardBrand as string) ?? (meta.cardScheme as string) ?? null;
  const payrocPaymentId = (meta.payrocPaymentId as string) ?? null;
  const approvalCode = (meta.approvalCode as string) ?? null;
  const sourceInfo = meta.source as { type?: string; id?: string } | undefined;

  let status: V1ChargeStatus = "failed";
  if (succeeded) status = "succeeded";
  else if (txn.status === "requires_capture") status = "requires_capture";

  const items = Array.isArray(txn.items) ? (txn.items as V1ChargeItem[]) : null;

  // Strip internal metadata keys before exposing
  const { payrocPaymentId: _pid, payrocIdempotencyKey: _ik, payrocStatus: _ps,
    source: _src, apiKeyId: _ak, requestId: _rid, v1: _v1,
    orderId: _oid, approvalCode: _ac, last4: _l4, cardBrand: _cb, cardScheme: _cs,
    ...userMetadata } = meta;

  return {
    id: `ch_${txn.id}`,
    object: "charge",
    status,
    amount_cents: amountCents,
    currency: txn.currency,
    captured: succeeded,
    captured_at: succeeded ? txn.createdAt.toISOString() : null,
    description: txn.description,
    source: {
      type: (sourceInfo?.type as "saved_card" | "single_use_token") ?? "single_use_token",
      id: (sourceInfo?.id as string) ?? null,
      last4,
      brand,
    },
    customer_id: txn.customerId,
    stylist_id: txn.stylistId,
    booking_id: txn.bookingId,
    tip_amount_cents: tipCents,
    items,
    metadata: Object.keys(userMetadata).length > 0 ? userMetadata : null,
    approval_code: approvalCode,
    decline_reason: succeeded ? null : (meta.declineReason as string) ?? null,
    created_at: txn.createdAt.toISOString(),
    payroc: { payment_id: payrocPaymentId },
  };
}

export function formatChargeResponse(args: {
  result: ProcessChargeResult;
  parsed: ParsedChargeInput;
  createdAt: Date;
}): V1ChargeResponse {
  const { result, parsed, createdAt } = args;
  const status: V1ChargeStatus = result.status;
  const captured = status === "succeeded";

  return {
    id: result.transactionId ? `ch_${result.transactionId}` : `ch_unknown_${Date.now()}`,
    object: "charge",
    status,
    amount_cents: parsed.amountCents,
    currency: parsed.currency,
    captured,
    captured_at: captured ? createdAt.toISOString() : null,
    description: parsed.description,
    source: {
      type: parsed.source.type,
      id: result.sourceSavedPaymentMethodId,
      last4: result.sourceLast4,
      brand: result.sourceBrand,
    },
    customer_id: parsed.customerId,
    stylist_id: parsed.stylistId,
    booking_id: parsed.bookingId,
    tip_amount_cents: parsed.tipAmountCents,
    items: parsed.items,
    metadata: parsed.metadata,
    approval_code: result.approvalCode,
    decline_reason: result.declineReason,
    created_at: createdAt.toISOString(),
    payroc: { payment_id: result.payrocPaymentId },
  };
}
