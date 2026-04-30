export type VelocitySeverity = "info" | "warn" | "high" | "block";
export type VelocityStatus = "detected" | "reviewed" | "dismissed" | "actioned";

export interface VelocityRuleResult {
  ruleCode: string;
  ruleDescription: string;
  severity: VelocitySeverity;
  triggered: boolean;
  triggerData: Record<string, unknown>;
}

export interface VelocityCheckInput {
  merchantId: string;
  customerEmail: string | null;
  customerId: string | null;
  cardLast4: string | null;
  amountCents: number;
  now?: Date;
}

export interface VelocityCheckOutput {
  alerts: VelocityRuleResult[];
  shouldBlock: boolean;
  highestSeverity: VelocitySeverity;
}
