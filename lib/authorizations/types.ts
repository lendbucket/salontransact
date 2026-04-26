export interface PayrocAuthorization {
  authorizationId: string;
  paymentId?: string;
  date?: string;
  amount?: number;
  currency?: string;
  status?: string;
  responseCode?: string;
  cardScheme?: string;
  last4?: string;
  approvalCode?: string;
  merchantReference?: string;
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
