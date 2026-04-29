export type ReportingWindow = 7 | 30 | 90;

export function isValidWindow(v: number): v is ReportingWindow {
  return v === 7 || v === 30 || v === 90;
}

export function parseWindow(v: string | null): ReportingWindow {
  if (!v) return 30;
  const n = parseInt(v, 10);
  if (isValidWindow(n)) return n;
  return 30;
}

export interface SummaryResponse {
  window: ReportingWindow;
  totalVolumeCents: number;
  transactionCount: number;
  activeMerchantCount: number;
  averageTicketCents: number;
  dailyVolume: Array<{ date: string; volumeCents: number; count: number }>;
  generatedAt: string;
}

export interface TopMerchantRow {
  merchantId: string;
  businessName: string;
  volumeCents: number;
  transactionCount: number;
  averageTicketCents: number;
  rank: number;
}

export interface TopMerchantsResponse {
  window: ReportingWindow;
  data: TopMerchantRow[];
}

export interface VelocityRow {
  merchantId: string;
  businessName: string;
  transactionCount: number;
  avgPerDay: number;
  rank: number;
}

export interface VelocityResponse {
  window: ReportingWindow;
  data: VelocityRow[];
}
