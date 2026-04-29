export type StylistRole = "stylist" | "manager" | "owner";
export type StylistStatus = "active" | "inactive";

export interface StylistSummary {
  id: string;
  merchantId: string;
  merchantName?: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: StylistRole;
  commissionRate: number | null;
  hourlyRate: number | null;
  payoutMethod: string | null;
  status: StylistStatus;
  externalRef: string | null;
  createdAt: string;
}

export interface StylistDetail extends StylistSummary {
  totalTransactions: number;
  totalVolumeCents: number;
  totalTipsCents: number;
}

export interface StylistListResponse {
  data: StylistSummary[];
  count: number;
}
