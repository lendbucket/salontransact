/**
 * Subscription Plans — app/api/subscription-plans/route.ts
 *
 * POST /api/subscription-plans — Create a new subscription plan
 *   Requires authenticated merchant session.
 *   Body: { name, amountCents, interval, ...optional fields }
 *   Returns 201 with the created plan.
 *   Returns 400 on validation error.
 *   Returns 409 if publicSignupSlug already exists.
 *
 * GET /api/subscription-plans — List plans for the current merchant
 *   Requires authenticated merchant session.
 *   Query: ?status=archived|all (optional, defaults to "active")
 *   Returns 200 with array of plans.
 *
 * Note: anchorDay is NOT on plans — it lives on Subscription (per-customer
 * billing anchor). Plans define product + pricing; subscriptions define
 * customer-specific billing schedule. See POST /api/subscriptions.
 *
 * Auth pattern mirrors app/api/payroc/checkout/route.ts.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CreatePlanSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  amountCents: z.number().int().min(1).max(100_000_000),
  currency: z.string().length(3).default("usd"),
  taxable: z.boolean().default(true),
  interval: z.enum(["WEEKLY", "MONTHLY", "ANNUAL"]),
  intervalCount: z.number().int().min(1).max(365).default(1),
  trialDays: z.number().int().min(1).max(365).optional(),
  publicSignupEnabled: z.boolean().default(false),
  publicSignupSlug: z.string().min(1).max(100).optional(),
});

// ---------------------------------------------------------------------------
// POST — create plan
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
    const parsed = CreatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: `Validation error: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const plan = await prisma.subscriptionPlan.create({
      data: {
        merchantId: merchant.id,
        name: data.name,
        description: data.description ?? null,
        status: "active",
        amountCents: data.amountCents,
        currency: data.currency.toLowerCase(),
        taxable: data.taxable,
        interval: data.interval,
        intervalCount: data.intervalCount,
        trialDays: data.trialDays ?? null,
        publicSignupEnabled: data.publicSignupEnabled,
        publicSignupSlug: data.publicSignupSlug ?? null,
      },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    // Unique constraint violation on publicSignupSlug
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A plan with this publicSignupSlug already exists" },
        { status: 409 }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error("[SUBSCRIPTION-PLANS] POST error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — list plans for current merchant
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
    const statusFilter = searchParams.get("status");

    const where: { merchantId: string; status?: string } = {
      merchantId: merchant.id,
    };

    if (statusFilter === "archived") {
      where.status = "archived";
    } else if (statusFilter === "all") {
      // No status filter — return both active and archived
    } else {
      // Default: active only
      where.status = "active";
    }

    const plans = await prisma.subscriptionPlan.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ plans });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SUBSCRIPTION-PLANS] GET error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
