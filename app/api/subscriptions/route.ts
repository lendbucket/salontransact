/**
 * Subscriptions — app/api/subscriptions/route.ts
 *
 * POST /api/subscriptions — Create a new subscription
 *   Requires authenticated merchant session.
 *   Body: { planId, customerId, savedCardId, source, mandateText,
 *           anchorDay, trialDays?, mandateIpAddress?, mandateUserAgent? }
 *   Returns 201 with { subscription, invoice } (invoice is null when trialing).
 *   Returns 400 on validation error.
 *   Returns 404 if plan/customer/savedCard not found.
 *   Returns 409 if plan archived or saved card not active.
 *
 *   Validation is two-stage:
 *     1. Zod validates structure + broad anchorDay range (0-365).
 *     2. After loading the plan, anchorDay is validated against plan.interval:
 *        MONTHLY → 1-28, WEEKLY → 0-6, ANNUAL → 1-365.
 *     This split is necessary because zod can't access the plan's interval
 *     at parse time.
 *
 *   Mandate fields (mandateText, mandateIpAddress, mandateUserAgent,
 *   mandateAcceptedAt) are set at creation and treated as IMMUTABLE in V1.
 *   No PATCH route accepts them. mandateAcceptedAt is set server-side
 *   to new Date() during creation.
 *
 *   When trialDays > 0:
 *     - Subscription starts in "trialing" state.
 *     - No SubscriptionInvoice is created — the billing-engine-tick cron
 *       creates the first invoice when the trial ends.
 *     - currentPeriodEnd = trialEnd = now + trialDays.
 *     - nextBillingDate = trialEnd.
 *
 *   When trialDays is absent or 0:
 *     - Subscription starts in "active" state.
 *     - A SubscriptionInvoice in "pending" status is created immediately
 *       with tax computed via calculateTax().
 *     - nextBillingDate = computeNextBillingDate() per anchor + interval.
 *     - currentPeriodEnd = computePeriodEnd() from currentPeriodStart.
 *
 * GET /api/subscriptions — List subscriptions for the current merchant
 *   Requires authenticated merchant session.
 *   Query: ?status=active&customerId=xxx&planId=xxx (all optional)
 *   Returns 200 with { subscriptions } including plan relation.
 *
 * Auth pattern mirrors app/api/payroc/checkout/route.ts.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { calculateTax } from "@/lib/subscriptions/tax";
import {
  computeNextBillingDate,
  computePeriodEnd,
} from "@/lib/subscriptions/billing-period";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CreateSubscriptionSchema = z
  .object({
    planId: z.string().min(1),
    customerId: z.string().min(1),
    savedCardId: z.string().min(1),
    source: z.enum(["master_portal", "stylist", "customer_signup"]),
    mandateText: z.string().min(1).max(5000),
    mandateIpAddress: z.string().max(45).optional(),
    mandateUserAgent: z.string().max(500).optional(),
    trialDays: z.number().int().min(1).max(365).optional(),
    anchorDay: z.number().int(),
  })
  .refine(
    (data) => data.anchorDay >= 0 && data.anchorDay <= 365,
    {
      message:
        "anchorDay must be 0-365 (exact range depends on plan interval; see route docs)",
      path: ["anchorDay"],
    }
  );

// ---------------------------------------------------------------------------
// POST — create subscription
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
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

    const body = await request.json();
    const parsed = CreateSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `Validation error: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ── Load plan ───────────────────────────────────────────────
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: data.planId, merchantId: merchant.id },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (plan.status !== "active") {
      return NextResponse.json(
        { error: "Plan is archived — cannot create new subscriptions against it" },
        { status: 409 }
      );
    }

    // ── Per-interval anchorDay validation ────────────────────────
    // Zod validated broad 0-365 range. Now check the plan-specific range.
    if (
      plan.interval === "MONTHLY" &&
      (data.anchorDay < 1 || data.anchorDay > 28)
    ) {
      return NextResponse.json(
        { error: "anchorDay must be 1-28 for MONTHLY plans" },
        { status: 400 }
      );
    }
    if (
      plan.interval === "WEEKLY" &&
      (data.anchorDay < 0 || data.anchorDay > 6)
    ) {
      return NextResponse.json(
        { error: "anchorDay must be 0-6 for WEEKLY plans (Sunday=0)" },
        { status: 400 }
      );
    }
    if (
      plan.interval === "ANNUAL" &&
      (data.anchorDay < 1 || data.anchorDay > 365)
    ) {
      return NextResponse.json(
        { error: "anchorDay must be 1-365 for ANNUAL plans" },
        { status: 400 }
      );
    }

    // ── Load customer ───────────────────────────────────────────
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, merchantId: merchant.id },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // ── Load saved card ─────────────────────────────────────────
    const savedCard = await prisma.savedPaymentMethod.findFirst({
      where: {
        id: data.savedCardId,
        merchantId: merchant.id,
        status: "active",
      },
    });

    if (!savedCard) {
      return NextResponse.json(
        { error: "Saved card not found or not active" },
        { status: 404 }
      );
    }

    // ── Compute billing periods and status ──────────────────────
    const now = new Date();
    const interval = plan.interval as "WEEKLY" | "MONTHLY" | "ANNUAL";
    const isTrialing = typeof data.trialDays === "number" && data.trialDays > 0;

    let status: string;
    let currentPeriodStart: Date;
    let currentPeriodEnd: Date;
    let nextBillingDate: Date;
    let trialEnd: Date | null = null;

    if (isTrialing) {
      status = "trialing";
      currentPeriodStart = now;
      trialEnd = new Date(now.getTime() + data.trialDays! * 24 * 60 * 60 * 1000);
      currentPeriodEnd = trialEnd;
      nextBillingDate = trialEnd;
    } else {
      status = "active";
      currentPeriodStart = now;
      nextBillingDate = computeNextBillingDate(
        interval,
        plan.intervalCount,
        data.anchorDay,
        now
      );
      currentPeriodEnd = computePeriodEnd(
        currentPeriodStart,
        interval,
        plan.intervalCount
      );
    }

    // ── Compute tax (only when creating an invoice — not trialing) ──
    const subtotalCents = plan.amountCents * plan.intervalCount;
    let taxCents = 0;
    let taxRateAtBilling: number | null = null;
    let taxJurisdictionAtBilling: string | null = null;

    if (!isTrialing) {
      const taxResult = calculateTax({
        subtotalCents,
        merchant: {
          taxEnabled: merchant.taxEnabled,
          taxRateBasisPoints: merchant.taxRateBasisPoints,
          taxJurisdiction: merchant.taxJurisdiction,
        },
        plan: { taxable: plan.taxable },
        customer: { taxExempt: customer.taxExempt },
      });
      taxCents = taxResult.taxCents;
      taxRateAtBilling = taxResult.taxRateApplied;
      taxJurisdictionAtBilling = taxResult.taxJurisdictionApplied;
    }

    const totalCents = subtotalCents + taxCents;

    // ── Create subscription + invoice + event in transaction ────
    const result = await prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          merchantId: merchant.id,
          planId: plan.id,
          customerId: customer.id,
          savedCardId: savedCard.id,
          status,
          anchorDay: data.anchorDay,
          currentPeriodStart,
          currentPeriodEnd,
          nextBillingDate,
          trialEnd,
          source: data.source,
          mandateAcceptedAt: now,
          mandateText: data.mandateText,
          mandateIpAddress: data.mandateIpAddress ?? null,
          mandateUserAgent: data.mandateUserAgent ?? null,
        },
      });

      // Create initial invoice only for non-trial subscriptions.
      // Trial subscriptions get their first invoice when the billing
      // engine fires at trial end.
      let invoice = null;
      if (!isTrialing) {
        invoice = await tx.subscriptionInvoice.create({
          data: {
            subscriptionId: subscription.id,
            merchantId: merchant.id,
            periodStart: currentPeriodStart,
            periodEnd: currentPeriodEnd,
            subtotalCents,
            taxCents,
            totalCents,
            taxRateAtBilling,
            taxJurisdictionAtBilling,
            status: "pending",
            attemptCount: 0,
          },
        });
      }

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          eventType: "subscription.created",
          actor: `merchant:${userId}`,
          payload: {
            planId: plan.id,
            customerId: customer.id,
            savedCardId: savedCard.id,
            source: data.source,
            anchorDay: data.anchorDay,
            status,
            ...(isTrialing
              ? { trialDays: data.trialDays, trialEnd: trialEnd!.toISOString() }
              : { invoiceId: invoice!.id, totalCents }),
          },
        },
      });

      return { subscription, invoice };
    });

    // ── Build response ──────────────────────────────────────────
    const responseSubscription = {
      ...result.subscription,
      plan: {
        id: plan.id,
        name: plan.name,
        amountCents: plan.amountCents,
        interval: plan.interval,
        intervalCount: plan.intervalCount,
      },
    };

    return NextResponse.json(
      {
        subscription: responseSubscription,
        invoice: result.invoice,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SUBSCRIPTIONS] POST error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — list subscriptions for current merchant
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);

    const where: Record<string, unknown> = { merchantId: merchant.id };

    const statusFilter = searchParams.get("status");
    if (statusFilter) {
      where.status = statusFilter;
    }

    const customerIdFilter = searchParams.get("customerId");
    if (customerIdFilter) {
      where.customerId = customerIdFilter;
    }

    const planIdFilter = searchParams.get("planId");
    if (planIdFilter) {
      where.planId = planIdFilter;
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            amountCents: true,
            interval: true,
            intervalCount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ subscriptions });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SUBSCRIPTIONS] GET error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
