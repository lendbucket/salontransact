/**
 * Manual Charge Trigger — app/api/subscriptions/[id]/charge-now/route.ts
 *
 * POST /api/subscriptions/:id/charge-now — Trigger a charge for the
 *   current open invoice on a subscription.
 *   Requires authenticated merchant session. Subscription must belong to merchant.
 *
 *   Finds invoices in "pending" or "failed_retrying" status for this
 *   subscription:
 *     - 0 invoices → 404 "No chargeable invoice — subscription is current"
 *     - 1 invoice  → calls chargeInvoice() and returns the result
 *     - 2+ invoices → 500 "Data integrity error — multiple open invoices"
 *       (should never happen in normal operation; indicates a bug)
 *
 *   No request body. POST with empty body.
 *
 *   Response: { result: ChargeInvoiceResult }
 *   HTTP 200 in all chargeInvoice outcomes (success=true for approved,
 *   success=false for declined). The route itself only returns non-200
 *   for auth failures (401), not-found (404), or data integrity (500).
 *
 * Auth pattern mirrors app/api/payroc/checkout/route.ts.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargeInvoice } from "@/lib/subscriptions/billing";

// ---------------------------------------------------------------------------
// POST — manual charge trigger
// ---------------------------------------------------------------------------

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!session?.user || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({ where: { userId } });
    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 401 });
    }

    const { id } = await params;

    // Verify subscription exists and belongs to merchant
    const sub = await prisma.subscription.findFirst({
      where: { id, merchantId: merchant.id },
      select: { id: true },
    });

    if (!sub) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Find open invoices for this subscription
    const openInvoices = await prisma.subscriptionInvoice.findMany({
      where: {
        subscriptionId: sub.id,
        status: { in: ["pending", "failed_retrying"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (openInvoices.length === 0) {
      return NextResponse.json(
        { error: "No chargeable invoice — subscription is current" },
        { status: 404 }
      );
    }

    if (openInvoices.length > 1) {
      console.error(
        `[CHARGE-NOW] Data integrity error: subscription ${sub.id} has ` +
        `${openInvoices.length} open invoices: ${openInvoices.map((i) => i.id).join(", ")}`
      );
      return NextResponse.json(
        {
          error: "Data integrity error — multiple open invoices found",
          count: openInvoices.length,
        },
        { status: 500 }
      );
    }

    // Exactly one open invoice — charge it
    const result = await chargeInvoice(openInvoices[0].id);

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[CHARGE-NOW] POST error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
