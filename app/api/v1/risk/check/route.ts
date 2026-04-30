import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { runVelocityChecks } from "@/lib/velocity/check";
import { computeRiskScore } from "@/lib/risk/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customer_id");
  const customerEmail = url.searchParams.get("customer_email");
  const amountCentsRaw = url.searchParams.get("amount_cents");
  const cardLast4 = url.searchParams.get("card_last4");

  if (!amountCentsRaw) {
    return apiError("validation_error", "amount_cents is required", { requestId: auth.requestId });
  }
  const amountCents = parseInt(amountCentsRaw, 10);
  if (!Number.isInteger(amountCents) || amountCents < 1) {
    return apiError("validation_error", "amount_cents must be a positive integer", { requestId: auth.requestId });
  }

  let customerAgeMs: number | null = null;
  let customerTotalTransactions = 0;
  let resolvedCustomerEmail: string | null = customerEmail;

  if (customerId) {
    const cust = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { firstSeenAt: true, totalTransactions: true, email: true, merchantId: true },
    });
    if (!cust || cust.merchantId !== auth.merchant.id) {
      return apiError("not_found", "Customer not found", { requestId: auth.requestId });
    }
    customerAgeMs = Date.now() - cust.firstSeenAt.getTime();
    customerTotalTransactions = cust.totalTransactions;
    resolvedCustomerEmail = cust.email;
  }

  const velocity = await runVelocityChecks({
    merchantId: auth.merchant.id,
    customerEmail: resolvedCustomerEmail,
    customerId,
    cardLast4,
    amountCents,
  });

  const risk = computeRiskScore({
    amountCents,
    customerId,
    customerEmail: resolvedCustomerEmail,
    customerAgeMs,
    customerTotalTransactions,
    isFirstTimeCard: false,
    velocityAlerts: velocity.alerts.map((a) => ({ severity: a.severity })),
  });

  let recommendation: string;
  if (risk.band === "critical") recommendation = "decline_or_manual_review";
  else if (risk.band === "high") recommendation = "require_additional_verification";
  else if (risk.band === "medium") recommendation = "proceed_with_caution";
  else recommendation = "proceed";

  const response = NextResponse.json({
    object: "risk_check",
    score: risk.score,
    band: risk.band,
    recommendation,
    factors: risk.factors,
    velocity_alerts: velocity.alerts,
    should_block: velocity.shouldBlock,
    checked_at: new Date().toISOString(),
  });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
