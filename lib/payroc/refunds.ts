import { payrocRequest } from "./client";

export interface PayrocRefund {
  refundId: string;
  paymentId?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export async function listRefunds(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ refunds: PayrocRefund[] }> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  const qs = query.toString();
  return payrocRequest("GET", `/refunds${qs ? `?${qs}` : ""}`);
}

export async function getRefund(refundId: string): Promise<PayrocRefund> {
  return payrocRequest("GET", `/refunds/${refundId}`);
}

/**
 * Adjustment variant for adjustRefund.
 * Per Payroc docs: refund adjustments support `status` and `customer` variants only.
 * https://docs.payroc.com/api/schema/card-payments/refunds/adjust
 */
export type RefundAdjustment =
  | { type: "status"; status: "ready" | "pending" }
  | {
      type: "customer";
      firstName?: string;
      lastName?: string;
      contactMethods?: Array<{ type: "mobile" | "email"; value: string }>;
      shippingAddress?: {
        recipientName?: string;
        address: {
          address1: string;
          address2?: string;
          address3?: string;
          city: string;
          state: string;
          country: string;
          postalCode: string;
        };
      };
    };

export interface AdjustRefundRequest {
  adjustments: RefundAdjustment[];
  operator?: string;
}

/**
 * Adjust a refund in an open batch.
 * Per docs, body must be { adjustments: [...] }.
 * https://docs.payroc.com/api/schema/card-payments/refunds/adjust
 */
export async function adjustRefund(
  refundId: string,
  request: AdjustRefundRequest
): Promise<PayrocRefund> {
  return payrocRequest("POST", `/refunds/${refundId}/adjust`, request);
}

export interface ReverseRefundRequest {
  amount?: number;
  operator?: string;
}

/**
 * Reverse a refund in an open batch.
 * - Omit `amount` to fully reverse the refund.
 * - Provide `amount` (in cents) for a partial reversal.
 */
export async function reverseRefund(
  refundId: string,
  request: ReverseRefundRequest = {}
): Promise<PayrocRefund> {
  return payrocRequest("POST", `/refunds/${refundId}/reverse`, request);
}

export interface UnreferencedRefundCardKeyed {
  cardNumber: string;
  expiryDate: string;
  cardholderName?: string;
}

export type UnreferencedRefundMethod =
  | { type: "card"; cardDetails: { keyed: UnreferencedRefundCardKeyed } }
  | { type: "secureToken"; secureTokenId: string };

export interface CreateUnreferencedRefundRequest {
  channel: "pos" | "moto";
  order: {
    orderId: string;
    description?: string;
    amount: number;
    currency?: "USD";
  };
  refundMethod: UnreferencedRefundMethod;
  operator?: string;
  processingTerminalId?: string;
}

/**
 * Create an unreferenced refund (a refund not linked to a prior payment).
 * Per docs, requires channel, processingTerminalId, structured order, and refundMethod.
 * https://docs.payroc.com/api/schema/card-payments/refunds/create-unreferenced-refund
 */
export async function createUnreferencedRefund(
  request: CreateUnreferencedRefundRequest
): Promise<PayrocRefund> {
  const body = {
    channel: request.channel,
    processingTerminalId:
      request.processingTerminalId ?? process.env.PAYROC_TERMINAL_ID,
    order: {
      orderId: request.order.orderId,
      description: request.order.description,
      amount: request.order.amount,
      currency: request.order.currency ?? "USD",
    },
    refundMethod: request.refundMethod,
    operator: request.operator,
  };
  return payrocRequest<PayrocRefund>("POST", "/refunds", body);
}
