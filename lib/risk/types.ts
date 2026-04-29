export type RiskStatus = "safe" | "warning" | "critical";

export interface ChargebackRiskMetrics {
  merchantId: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  completedTransactions: number;
  chargebackCount: number;
  chargebackRatio: number;
  status: RiskStatus;
  computedAt: string;
}

export interface MerchantRiskRow extends ChargebackRiskMetrics {
  businessName: string;
  ownerEmail: string;
  totalVolumeCents: number;
}

export const VISA_MONITORING_THRESHOLD = 0.65;
export const VISA_EXCESSIVE_THRESHOLD = 1.0;

export const SAFE_THRESHOLD = 0.4;
export const WARNING_THRESHOLD = 0.65;

export function statusForRatio(ratio: number): RiskStatus {
  if (ratio >= WARNING_THRESHOLD) return "critical";
  if (ratio >= SAFE_THRESHOLD) return "warning";
  return "safe";
}
