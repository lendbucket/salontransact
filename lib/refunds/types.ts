// Payroc payment response shape per docs
// https://docs.payroc.com/api/schema/card-payments/payments/retrieve

export interface PayrocOrder {
  orderId: string;
  amount: number;
  currency: string;
  dateTime: string;
  description?: string;
}

export interface PayrocCard {
  type: string;
  cardNumber: string;
  expiryDate: string;
  entryMethod?: string;
  cardholderName?: string;
  securityChecks?: {
    cvvResult?: string;
    avsResult?: string;
  };
}

export interface PayrocTransactionResult {
  status: string;
  responseCode?: string;
  type?: string;
  approvalCode?: string;
  authorizedAmount?: number;
  currency?: string;
  responseMessage?: string;
  cardSchemeReferenceId?: string;
}

export interface PayrocLink {
  rel: string;
  method: string;
  href: string;
}

export interface PayrocRefundSummary {
  refundId: string;
  dateTime: string;
  amount: number; // negative number per docs
  currency: string;
  status: string;
  responseCode?: string;
  responseMessage?: string;
  link?: PayrocLink;
}

export type SupportedOperation =
  | "capture"
  | "refund"
  | "fullyReverse"
  | "partiallyReverse"
  | "incrementAuthorization"
  | "adjustTip"
  | "addSignature"
  | "setAsReady"
  | "setAsPending";

// Full payment retrieval response
export interface PayrocPayment {
  paymentId: string;
  processingTerminalId: string;
  order: PayrocOrder;
  card: PayrocCard;
  transactionResult: PayrocTransactionResult;
  operator?: string;
  customer?: unknown;
  refunds?: PayrocRefundSummary[];
  supportedOperations?: SupportedOperation[];
  customFields?: Array<{ name: string; value: string }>;
}

// Refund request body per docs (Step 2 of Referenced Refund for Card)
export interface RefundRequestBody {
  amount: number; // long, REQUIRED, in cents
  description: string; // string, REQUIRED, 1-100 chars
  operator?: string; // string, optional, 0-50 chars
}

// Reverse request body per docs (Step 2 of Reverse Card Sale)
export interface ReverseRequestBody {
  amount?: number; // long, optional; omit for full reverse
  operator?: string;
}

// Operation kinds we record in RefundOperation.operation
export type OperationKind = "refund" | "reverse";

// Status values we record in RefundOperation.status
export type OperationStatus = "pending" | "success" | "failed";
