import type { RiskBand, RiskFactor, RiskScoreInput, RiskScoreResult } from "./types";

const SEVERITY_POINTS: Record<string, number> = { info: 5, warn: 15, high: 30, block: 50 };

export function computeRiskScore(input: RiskScoreInput): RiskScoreResult {
  const factors: RiskFactor[] = [];
  let score = 0;

  for (const alert of input.velocityAlerts) {
    const points = SEVERITY_POINTS[alert.severity] ?? 0;
    if (points > 0) {
      factors.push({ code: `VELOCITY_${alert.severity.toUpperCase()}`, description: `Velocity alert: ${alert.severity}`, points });
      score += points;
    }
  }

  if (!input.customerId) {
    factors.push({ code: "NO_CUSTOMER", description: "No linked customer record", points: 5 });
    score += 5;
  }

  if (input.customerAgeMs !== null && input.customerAgeMs < 86400000) {
    factors.push({ code: "NEW_CUSTOMER", description: "Customer created in last 24 hours", points: 10 });
    score += 10;
  }

  if (input.customerAgeMs !== null && input.customerAgeMs < 86400000 && input.amountCents > 50000) {
    factors.push({ code: "NEW_CUSTOMER_HIGH_AMOUNT", description: "New customer charging > $500", points: 15 });
    score += 15;
  }

  if (input.amountCents > 100000) {
    factors.push({ code: "HIGH_AMOUNT", description: "Charge > $1000", points: 5 });
    score += 5;
  }

  if (input.amountCents > 500000) {
    factors.push({ code: "VERY_HIGH_AMOUNT", description: "Charge > $5000", points: 20 });
    score += 20;
  }

  if (input.isFirstTimeCard) {
    factors.push({ code: "FIRST_TIME_CARD", description: "Card just tokenized this session", points: 5 });
    score += 5;
  }

  if (score > 100) score = 100;

  const band: RiskBand = score >= 80 ? "critical" : score >= 50 ? "high" : score >= 20 ? "medium" : "low";

  return { score, band, factors };
}
