export interface PayrocDispute {
  disputeId: string;
  paymentId?: string;
  date?: string;
  reasonCode?: string;
  reasonDescription?: string;
  amount?: number;
  currency?: string;
  status?: string;
  cardScheme?: string;
  last4?: string;
  responseDeadline?: string;
  [key: string]: unknown;
}

export interface PayrocDisputeStatus {
  status: string;
  dateTime?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface PayrocPaginatedResponse<T> {
  limit: number;
  count: number;
  hasMore: boolean;
  data: T[];
  links?: Array<{ rel: string; method: string; href: string }>;
}
