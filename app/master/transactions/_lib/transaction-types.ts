export interface TransactionSummary {
  id: string;
  merchantId: string;
  merchantBusinessName: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  customerEmail: string | null;
  customerName: string | null;
  fee: number;
  net: number;
  refunded: boolean;
  refundAmount: number;
  stripePaymentId: string | null;
  createdAt: string;
}

export interface TransactionListResponse {
  transactions: TransactionSummary[];
  total: number;
  merchantsRepresented: number;
}

export interface TransactionDetail extends TransactionSummary {
  metadata: Record<string, unknown> | null;
  updatedAt: string;
  merchantCity: string | null;
  merchantState: string | null;
}

export type TransactionStatusFilter =
  | "all"
  | "succeeded"
  | "pending"
  | "failed"
  | "refunded";
