import { prisma } from "@/lib/prisma";
import type { VelocityRuleResult } from "./types";

export async function logVelocityAlerts(args: {
  merchantId: string;
  customerId: string | null;
  customerEmail: string | null;
  cardLast4: string | null;
  amountCents: number;
  alerts: VelocityRuleResult[];
}): Promise<void> {
  if (args.alerts.length === 0) return;
  try {
    await prisma.velocityAlert.createMany({
      data: args.alerts.map((a) => ({
        merchantId: args.merchantId,
        ruleCode: a.ruleCode,
        ruleDescription: a.ruleDescription,
        severity: a.severity,
        customerId: args.customerId,
        customerEmail: args.customerEmail,
        cardLast4: args.cardLast4,
        triggerData: a.triggerData as object,
        amountCents: args.amountCents,
      })),
    });
  } catch (e) {
    console.error("[VELOCITY-LOG] Failed to persist alerts:", e);
  }
}
