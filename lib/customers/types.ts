export interface CustomerSummary {
  id: string;
  merchantId: string;
  merchantName?: string;
  email: string;
  name: string | null;
  phone: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  totalTransactions: number;
  totalSpentCents: number;
  savedCardCount: number;
}

export interface CustomerDetail {
  id: string;
  merchantId: string;
  merchantName?: string;
  email: string;
  name: string | null;
  phone: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  totalTransactions: number;
  totalSpentCents: number;

  savedCards: Array<{
    id: string;
    payrocSecureTokenId: string;
    cardScheme: string | null;
    last4: string | null;
    expiryMonth: string | null;
    expiryYear: string | null;
    cardholderName: string | null;
    label: string | null;
    status: string;
    createdAt: string;
    lastUsedAt: string | null;
  }>;

  recentTransactions: Array<{
    id: string;
    amount: number;
    status: string;
    description: string | null;
    createdAt: string;
  }>;
}

export interface CustomerListResponse {
  data: CustomerSummary[];
  count: number;
}
