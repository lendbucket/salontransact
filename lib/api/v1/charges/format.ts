import type { ProcessChargeResult } from "./process";
import type { ParsedChargeInput } from "./validate";
import type { V1ChargeResponse, V1ChargeStatus } from "./types";

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
