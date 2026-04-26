export interface PayrocBatch {
  batchId: string;
  date?: string;
  closedAt?: string;
  status?: string;
  totalAmount?: number;
  currency?: string;
  transactionCount?: number;
  [key: string]: unknown;
}

export interface PayrocSettlementTransaction {
  transactionId: string;
  paymentId?: string;
  batchId?: string;
  amount?: number;
  currency?: string;
  type?: string;
  status?: string;
  cardScheme?: string;
  last4?: string;
  approvalCode?: string;
  dateTime?: string;
  [key: string]: unknown;
}

export interface PayrocPaginatedResponse<T> {
  limit: number;
  count: number;
  hasMore: boolean;
  data: T[];
  links?: Array<{ rel: string; method: string; href: string }>;
}
