import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api/v1/auth";
import { computeChargebackRisk } from "@/lib/risk/chargeback-monitor";
import { VISA_MONITORING_THRESHOLD, VISA_EXCESSIVE_THRESHOLD } from "@/lib/risk/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "90", 10) || 90, 7), 365);

  const metrics = await computeChargebackRisk({ merchantId: auth.merchant.id, windowDays: days });

  const response = NextResponse.json({
    object: "report",
    type: "risk",
    window_days: days,
    completed_transactions: metrics.completedTransactions,
    chargeback_count: metrics.chargebackCount,
    chargeback_ratio: metrics.chargebackRatio,
    status: metrics.status,
    thresholds: {
      visa_monitoring: VISA_MONITORING_THRESHOLD,
      visa_excessive: VISA_EXCESSIVE_THRESHOLD,
    },
    computed_at: metrics.computedAt,
  });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
