import { prisma } from "@/lib/prisma";
import type { VelocityCheckInput, VelocityCheckOutput, VelocityRuleResult, VelocitySeverity } from "./types";

const SEVERITY_RANK: Record<VelocitySeverity, number> = { info: 0, warn: 1, high: 2, block: 3 };

export async function runVelocityChecks(input: VelocityCheckInput): Promise<VelocityCheckOutput> {
  const now = input.now ?? new Date();
  const alerts: VelocityRuleResult[] = [];

  // Rule 1: Same customer 10+ charges in 24h
  if (input.customerId) {
    const cutoff = new Date(now.getTime() - 86400000);
    const count = await prisma.transaction.count({ where: { customerId: input.customerId, createdAt: { gte: cutoff } } });
    if (count >= 10) {
      alerts.push({ ruleCode: "CUSTOMER_VELOCITY_24H", ruleDescription: "Customer has 10+ charges in last 24 hours", severity: "high", triggered: true, triggerData: { count, windowHours: 24 } });
    }
  }

  // Rule 2: Same email 5+ uses in 1h on same merchant
  if (input.cardLast4 && input.customerEmail) {
    const cutoff = new Date(now.getTime() - 3600000);
    const count = await prisma.transaction.count({ where: { merchantId: input.merchantId, customerEmail: input.customerEmail, createdAt: { gte: cutoff } } });
    if (count >= 5) {
      alerts.push({ ruleCode: "CARD_VELOCITY_1H", ruleDescription: "Same email 5+ charges in last hour", severity: "warn", triggered: true, triggerData: { count, windowHours: 1 } });
    }
  }

  // Rule 3: Merchant 100+ failed charges in 1h (card testing)
  const cutoff1h = new Date(now.getTime() - 3600000);
  const failedCount = await prisma.transaction.count({ where: { merchantId: input.merchantId, status: "failed", createdAt: { gte: cutoff1h } } });
  if (failedCount >= 100) {
    alerts.push({ ruleCode: "MERCHANT_FAILED_VELOCITY", ruleDescription: "Merchant has 100+ failed charges in last hour (possible card testing)", severity: "block", triggered: true, triggerData: { count: failedCount, windowHours: 1 } });
  }

  // Rule 4: Charge > 10x customer's average ticket
  if (input.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId }, select: { totalTransactions: true, totalSpentCents: true } });
    if (customer && customer.totalTransactions >= 3) {
      const avgCents = customer.totalSpentCents / customer.totalTransactions;
      if (avgCents > 0 && input.amountCents > avgCents * 10) {
        alerts.push({ ruleCode: "AMOUNT_OUTLIER", ruleDescription: `Charge is ${Math.round(input.amountCents / avgCents)}x customer's average ticket`, severity: "warn", triggered: true, triggerData: { chargeCents: input.amountCents, avgTicketCents: avgCents, multiplier: Math.round(input.amountCents / avgCents) } });
      }
    }
  }

  // Rule 5: New customer (< 1h old) charging > $500
  if (input.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId }, select: { firstSeenAt: true } });
    const ageMs = customer ? now.getTime() - customer.firstSeenAt.getTime() : Infinity;
    if (ageMs < 3600000 && input.amountCents > 50000) {
      alerts.push({ ruleCode: "NEW_CUSTOMER_HIGH_AMOUNT", ruleDescription: "New customer (< 1 hour old) charging > $500", severity: "warn", triggered: true, triggerData: { customerAgeMinutes: Math.round(ageMs / 60000), amountCents: input.amountCents } });
    }
  }

  let highestSeverity: VelocitySeverity = "info";
  let shouldBlock = false;
  for (const a of alerts) {
    if (SEVERITY_RANK[a.severity] > SEVERITY_RANK[highestSeverity]) highestSeverity = a.severity;
    if (a.severity === "block") shouldBlock = true;
  }

  return { alerts, shouldBlock, highestSeverity };
}
