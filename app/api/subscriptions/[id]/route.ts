/**
 * Subscription Detail — app/api/subscriptions/[id]/route.ts
 *
 * GET /api/subscriptions/:id — Fetch a single subscription
 *   Requires authenticated merchant session. Subscription must belong to merchant.
 *   Returns 200 with subscription + plan, savedCard, customer, currentInvoice,
 *   and last 10 events.
 *   Returns 404 if not found.
 *
 * PATCH /api/subscriptions/:id — Perform a state transition
 *   Requires authenticated merchant session. Subscription must belong to merchant.
 *   Body: discriminated union on "action":
 *     { action: "pause", reason?: string }
 *     { action: "resume", reason?: string }
 *     { action: "cancel", reason?: string, cancelAt?: ISO datetime }
 *
 *   PAUSE / RESUME / CANCEL-immediate (no cancelAt):
 *     Calls transition() from state-machine.ts which acquires a row lock,
 *     verifies the transition is legal, updates status, and writes a
 *     SubscriptionEvent. Returns 409 if the transition is illegal.
 *     After a successful RESUME, nextBillingDate is recomputed via
 *     updateMany with a status="active" guard for defensive concurrency.
 *     After a successful CANCEL-immediate, nextBillingDate is cleared
 *     with a status="canceled" guard.
 *
 *   CANCEL with cancelAt (scheduled cancellation):
 *     Does NOT call transition(). Instead, writes cancelAt to the
 *     subscription row and creates a "subscription.cancel_scheduled"
 *     SubscriptionEvent. This is a non-transition lifecycle event,
 *     similar to how billing.ts writes "subscription.billed_attempt"
 *     without going through the state machine.
 *     "subscription.cancel_scheduled" is NOT in TRANSITION_EVENT_TYPES —
 *     it's emitted only by this route. The actual cancel transition fires
 *     when the cron or a future PATCH executes it at period end.
 *
 * Auth pattern mirrors app/api/payroc/checkout/route.ts.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  transition,
  type SubscriptionStatus,
} from "@/lib/subscriptions/state-machine";
import { computeNextBillingDate } from "@/lib/subscriptions/billing-period";

// ---------------------------------------------------------------------------
// Action → state transition map
// ---------------------------------------------------------------------------

const ACTION_MAP = {
  pause: {
    toState: "paused" as const,
    validFromStates: ["active", "past_due"] as const,
  },
  resume: {
    toState: "active" as const,
    validFromStates: ["paused"] as const,
  },
  cancel: {
    toState: "canceled" as const,
    validFromStates: [
      "incomplete",
      "trialing",
      "active",
      "past_due",
      "paused",
    ] as const,
  },
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SubscriptionActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("pause"),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("resume"),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("cancel"),
    reason: z.string().max(500).optional(),
    cancelAt: z.string().datetime().optional(),
  }),
]);

// ---------------------------------------------------------------------------
// GET — single subscription with full relations
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

    const sub = await prisma.subscription.findFirst({
      where: { id, merchantId: merchant.id },
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
        savedCard: {
          select: {
            id: true,
            last4: true,
            cardScheme: true,
            expiryMonth: true,
            expiryYear: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        invoices: {
          where: { status: { in: ["pending", "failed_retrying"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!sub) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    const { invoices, events, ...rest } = sub;

    return NextResponse.json({
      subscription: {
        ...rest,
        currentInvoice: invoices[0] ?? null,
        recentEvents: events,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SUBSCRIPTIONS] GET [id] error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — state transition (pause / resume / cancel / schedule cancel)
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

    // Load subscription with plan (needed for RESUME nextBillingDate recompute)
    const sub = await prisma.subscription.findFirst({
      where: { id, merchantId: merchant.id },
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
    });

    if (!sub) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = SubscriptionActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `Validation error: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        },
        { status: 400 }
      );
    }

    const action = parsed.data;
    const actor = `merchant:${userId}`;

    // ── CANCEL with cancelAt → schedule, don't transition ───────
    if (action.action === "cancel" && action.cancelAt) {
      // Verify subscription is in a cancellable state (same valid states
      // as immediate cancel — you can't schedule a cancel for an already-
      // terminal subscription).
      if (
        !ACTION_MAP.cancel.validFromStates.includes(
          sub.status as (typeof ACTION_MAP.cancel.validFromStates)[number]
        )
      ) {
        return NextResponse.json(
          {
            error:
              `Cannot schedule cancellation for subscription in "${sub.status}" state. ` +
              `Valid states for cancel: ${ACTION_MAP.cancel.validFromStates.join(", ")}`,
          },
          { status: 409 }
        );
      }

      const cancelAtDate = new Date(action.cancelAt);

      if (cancelAtDate <= new Date()) {
        return NextResponse.json(
          { error: "cancelAt must be in the future" },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { cancelAt: cancelAtDate },
        });
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            eventType: "subscription.cancel_scheduled",
            actor,
            payload: {
              cancelAt: action.cancelAt,
              reason: action.reason ?? null,
              scheduledBy: userId,
            },
          },
        });
      });

      // Re-read for response
      const updated = await prisma.subscription.findFirst({
        where: { id: sub.id, merchantId: merchant.id },
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
      });

      return NextResponse.json({ subscription: updated });
    }

    // ── PAUSE / RESUME / CANCEL-immediate ───────────────────────
    const mapping = ACTION_MAP[action.action];

    // Verify current status is a valid starting state for this action
    if (
      !(mapping.validFromStates as readonly string[]).includes(sub.status)
    ) {
      return NextResponse.json(
        {
          error:
            `Cannot ${action.action} a subscription in "${sub.status}" state. ` +
            `Valid states for ${action.action}: ${mapping.validFromStates.join(", ")}`,
        },
        { status: 409 }
      );
    }

    // Call the state machine — it acquires a row lock, re-verifies
    // state, updates status + side effects, and writes the audit event.
    const result = await transition(
      sub.id,
      sub.status as SubscriptionStatus,
      mapping.toState,
      actor,
      { reason: action.reason ?? null, action: action.action }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Transition failed" },
        { status: 409 }
      );
    }

    // ── Post-transition side effects ────────────────────────────

    if (action.action === "resume") {
      // Recompute nextBillingDate for the resumed subscription.
      // Uses updateMany with status="active" guard so this is a
      // no-op if a concurrent call paused it again.
      const interval = sub.plan.interval as "WEEKLY" | "MONTHLY" | "ANNUAL";
      const newNextBilling = computeNextBillingDate(
        interval,
        sub.plan.intervalCount,
        sub.anchorDay,
        new Date()
      );
      await prisma.subscription.updateMany({
        where: { id: sub.id, status: "active" },
        data: { nextBillingDate: newNextBilling },
      });
      // Note: On resume, currentPeriodStart/End are intentionally NOT
      // updated. The customer paused billing, then resumed today — they
      // continue in the same period they were in when paused. Phase 2
      // may revisit if proration becomes a requirement.
    }

    if (action.action === "cancel" && !action.cancelAt) {
      // Clear nextBillingDate for the canceled subscription.
      // Uses updateMany with status="canceled" guard for defensive
      // concurrency — no-op if another call already resumed it.
      await prisma.subscription.updateMany({
        where: { id: sub.id, status: "canceled" },
        data: { nextBillingDate: null },
      });
    }

    // ── Re-read and return ──────────────────────────────────────
    const updated = await prisma.subscription.findFirst({
      where: { id: sub.id, merchantId: merchant.id },
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
    });

    return NextResponse.json({ subscription: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SUBSCRIPTIONS] PATCH [id] error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
