/**
 * Subscription Plan Detail — app/api/subscription-plans/[id]/route.ts
 *
 * GET /api/subscription-plans/:id — Fetch a single plan
 *   Requires authenticated merchant session. Plan must belong to merchant.
 *   Returns 200 with the plan, or 404 if not found.
 *
 * PATCH /api/subscription-plans/:id — Update a plan
 *   Requires authenticated merchant session. Plan must belong to merchant.
 *   Mutable fields: name, description, status (active|archived).
 *   Immutable fields (when non-terminal subscriptions exist):
 *     amountCents, currency, taxable, interval, intervalCount.
 *   If the request body includes any immutable field AND the plan has
 *   subscriptions in a non-terminal state (not canceled/incomplete_expired),
 *   the request is rejected with 409. The merchant should archive the plan
 *   and create a new one instead.
 *   If no live subscriptions exist, all fields are freely mutable.
 *   Returns 200 with the updated plan, 400 on validation, 404 if not
 *   found, or 409 if immutable fields conflict.
 *
 * Auth pattern mirrors app/api/payroc/checkout/route.ts.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const UpdatePlanSchema = z.object({
  // Mutable fields
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),

  // Immutable fields — included so we can detect and reject them when
  // live subscriptions exist, rather than silently ignoring them.
  amountCents: z.number().int().min(1).max(100_000_000).optional(),
  currency: z.string().length(3).optional(),
  taxable: z.boolean().optional(),
  interval: z.enum(["WEEKLY", "MONTHLY", "ANNUAL"]).optional(),
  intervalCount: z.number().int().min(1).max(365).optional(),
});

const IMMUTABLE_FIELDS = [
  "amountCents",
  "currency",
  "taxable",
  "interval",
  "intervalCount",
] as const;

// ---------------------------------------------------------------------------
// GET — single plan
// ---------------------------------------------------------------------------

export async function GET(
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

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id, merchantId: merchant.id },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SUBSCRIPTION-PLANS] GET [id] error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — update plan (with immutability guard)
// ---------------------------------------------------------------------------

export async function PATCH(
  request: Request,
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

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id, merchantId: merchant.id },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: `Validation error: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Detect which immutable fields the caller is trying to change
    const attemptedImmutable = IMMUTABLE_FIELDS.filter(
      (field) => data[field] !== undefined
    );

    if (attemptedImmutable.length > 0) {
      // Count subscriptions in non-terminal states
      const subscriptionCount = await prisma.subscription.count({
        where: {
          planId: id,
          status: { notIn: ["canceled", "incomplete_expired"] },
        },
      });

      if (subscriptionCount > 0) {
        // Known race: between this count and the eventual update below,
        // a new subscription could be created against this plan from
        // another request. V1 accepts this rare edge case; V2 will wrap
        // count + update in a transaction with stronger isolation if
        // needed.
        return NextResponse.json(
          {
            error:
              `Cannot modify pricing/interval fields on a plan with ${subscriptionCount} ` +
              `active subscription(s). Archive this plan and create a new one.`,
            immutableFields: attemptedImmutable,
            subscriptionCount,
          },
          { status: 409 }
        );
      }
    }

    // Build update payload — include immutable fields only if they
    // passed the guard above (i.e., zero live subscriptions).
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.amountCents !== undefined) updateData.amountCents = data.amountCents;
    if (data.currency !== undefined) updateData.currency = data.currency.toLowerCase();
    if (data.taxable !== undefined) updateData.taxable = data.taxable;
    if (data.interval !== undefined) updateData.interval = data.interval;
    if (data.intervalCount !== undefined) updateData.intervalCount = data.intervalCount;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updateResult = await prisma.subscriptionPlan.updateMany({
      where: { id, merchantId: merchant.id },
      data: updateData,
    });

    if (updateResult.count === 0) {
      // Should not happen — findFirst above proved existence + ownership.
      // But in the rare race where the plan was deleted between find and
      // update, return 404 instead of 500.
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Re-read for response (updateMany doesn't return the row)
    const updated = await prisma.subscriptionPlan.findFirst({
      where: { id, merchantId: merchant.id },
    });

    return NextResponse.json({ plan: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SUBSCRIPTION-PLANS] PATCH [id] error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
