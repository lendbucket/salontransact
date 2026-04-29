export interface DailySummary {
  date: string;
  transactionCount: number;
  volumeCents: number;
  feesCents: number;
  netCents: number;
  refundsCents: number;
  refundCount: number;
}

export interface StatementSummary {
  totalVolumeCents: number;
  transactionCount: number;
  averageTicketCents: number;
  totalFeesCents: number;
  totalNetCents: number;
  totalRefundsCents: number;
  refundCount: number;
  disputesNote: string;
}

export interface StatementMerchant {
  id: string;
  businessName: string;
  dbaName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  ein: string | null;
}

export interface StatementData {
  merchant: StatementMerchant;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  summary: StatementSummary;
  daily: DailySummary[];
}
