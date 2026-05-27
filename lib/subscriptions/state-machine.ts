// ---------------------------------------------------------------------------
// Subscription State Machine — lib/subscriptions/state-machine.ts
//
// Single owner of all subscription status transitions. Every status change
// in the entire codebase MUST go through transition(). No raw
// prisma.subscription.update({ status: ... }) anywhere else.
//
// Design doc: docs/subscriptions-platform-design.md Section 5
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "incomplete"
  | "incomplete_expired";

// ---------------------------------------------------------------------------
// Allowed transitions lookup
//
// Key = fromState, Value = set of legal toStates.
// Design doc Section 5.2. incomplete → canceled is included for admin
// cleanup of abandoned signups before the 24h auto-expiry fires.
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, Set<SubscriptionStatus>> = {
  incomplete:          new Set(["trialing", "active", "incomplete_expired", "canceled"]),
  trialing:            new Set(["active", "past_due", "canceled"]),
  active:              new Set(["active", "past_due", "paused", "canceled"]),
  past_due:            new Set(["active", "paused", "canceled"]),
  paused:              new Set(["active", "canceled"]),
  canceled:            new Set(),
  incomplete_expired:  new Set(),
};

// ---------------------------------------------------------------------------
// Transition → event type mapping
//
// Maps (fromState, toState) pairs to the semantic event type for the
// SubscriptionEvent audit log. Per design doc Section 4.1 event vocabulary.
//
// NOTE: billing-attempt events (subscription.billed_attempt,
// subscription.billed_success, subscription.billed_failed) are emitted
// by billing.ts, not here. The state machine handles lifecycle events;
// billing.ts handles billing-attempt events. Both write to the same
// SubscriptionEvent table.
// ---------------------------------------------------------------------------

const TRANSITION_EVENT_TYPES: Record<string, string> = {
  "incomplete->trialing":           "subscription.activated",
  "incomplete->active":             "subscription.activated",
  "incomplete->canceled":           "subscription.canceled",
  "incomplete->incomplete_expired": "subscription.expired",
  "trialing->active":               "subscription.activated",
  "trialing->past_due":             "subscription.payment_failed",
  "trialing->canceled":             "subscription.canceled",
  "active->active":                 "subscription.renewed",
  "active->past_due":               "subscription.payment_failed",
  "active->paused":                 "subscription.paused",
  "active->canceled":               "subscription.canceled",
  "past_due->active":               "subscription.recovered",
  "past_due->paused":               "subscription.paused",
  "past_due->canceled":             "subscription.canceled",
  "paused->active":                 "subscription.resumed",
  "paused->canceled":               "subscription.canceled",
};

// ---------------------------------------------------------------------------
// canTransition — public predicate, no side effects
// ---------------------------------------------------------------------------

export function canTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed !== undefined && allowed.has(to);
}

// ---------------------------------------------------------------------------
// transition — the single entry point for all status changes
//
// Uses an interactive Prisma transaction with a raw SQL row lock
// (SELECT ... FOR UPDATE) to prevent race conditions when two cron
// ticks or two API calls try to transition the same subscription
// concurrently.
//
// Returns { success, error } — never throws.
// ---------------------------------------------------------------------------

export async function transition(
  subscriptionId: string,
  fromState: SubscriptionStatus,
  toState: SubscriptionStatus,
  actor: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const cid = Math.random().toString(36).slice(2, 10);
  console.log(
    `[STATE-MACHINE] cid=${cid} attempting ${fromState} → ${toState} ` +
    `sub=${subscriptionId} actor=${actor}`
  );

  // ---- Fast-fail: is this transition even legal? ----
  if (!canTransition(fromState, toState)) {
    const msg =
      `Illegal transition ${fromState} → ${toState} for subscription ${subscriptionId}`;
    console.log(`[STATE-MACHINE] cid=${cid} REJECTED: ${msg}`);
    return { success: false, error: msg };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // ---- Row lock: prevent concurrent transitions ----
      await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id = ${subscriptionId} FOR UPDATE`;

      // ---- Re-read current state under lock ----
      const sub = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        select: { id: true, status: true },
      });

      if (!sub) {
        throw new TransitionError(`Subscription ${subscriptionId} not found`);
      }

      if (sub.status !== fromState) {
        throw new TransitionError(
          `State mismatch: expected ${fromState} but found ${sub.status} ` +
          `for subscription ${subscriptionId} (likely concurrent transition)`
        );
      }

      // ---- Build side-effect fields ----
      const sideEffects: Record<string, unknown> = {};
      const now = new Date();

      if (toState === "canceled") {
        sideEffects.canceledAt = now;
        sideEffects.nextBillingDate = null;
      }

      if (toState === "paused") {
        sideEffects.nextBillingDate = null;
      }

      // When leaving active with a scheduled cancel, clear cancelAt
      // (the cancel has now been executed or the sub moved to another state)
      if (fromState === "active" && toState !== "active") {
        sideEffects.cancelAt = null;
      }

      // ---- Update subscription status + side effects ----
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: toState,
          ...sideEffects,
        },
      });

      // ---- Resolve semantic event type ----
      const eventTypeKey = `${fromState}->${toState}`;
      const eventType = TRANSITION_EVENT_TYPES[eventTypeKey];
      if (!eventType) {
        throw new TransitionError(
          `No event type mapped for transition ${eventTypeKey}. ` +
          `This is a bug — every legal transition must have a mapped event type.`
        );
      }

      // ---- Write audit event ----
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId,
          eventType,
          actor,
          payload: {
            fromState,
            toState,
            ...data,
          },
        },
      });
    });

    console.log(
      `[STATE-MACHINE] cid=${cid} SUCCESS ${fromState} → ${toState} sub=${subscriptionId}`
    );
    return { success: true };

  } catch (err) {
    if (err instanceof TransitionError) {
      console.log(`[STATE-MACHINE] cid=${cid} FAILED: ${err.message}`);
      return { success: false, error: err.message };
    }

    // Unexpected error (DB down, network, etc.)
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[STATE-MACHINE] cid=${cid} UNEXPECTED ERROR on ${fromState} → ${toState} ` +
      `sub=${subscriptionId}: ${message}`
    );
    return { success: false, error: `Unexpected error: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Helper transition functions — thin wrappers for common transitions
//
// Each helper encodes the expected fromState so callers don't have to
// remember which transitions are legal. The caller still passes actor
// and data for the audit trail.
// ---------------------------------------------------------------------------

export function transitionToActive(
  subscriptionId: string,
  fromState: "incomplete" | "trialing" | "past_due" | "paused" | "active",
  actor: string,
  data: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  return transition(subscriptionId, fromState, "active", actor, data);
}

export function transitionToPaused(
  subscriptionId: string,
  fromState: "active" | "past_due",
  actor: string,
  data: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  return transition(subscriptionId, fromState, "paused", actor, data);
}

export function transitionToCanceled(
  subscriptionId: string,
  fromState: "incomplete" | "trialing" | "active" | "past_due" | "paused",
  actor: string,
  data: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  return transition(subscriptionId, fromState, "canceled", actor, data);
}

export function transitionToPastDue(
  subscriptionId: string,
  fromState: "trialing" | "active",
  actor: string,
  data: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  return transition(subscriptionId, fromState, "past_due", actor, data);
}

export function transitionToTrialing(
  subscriptionId: string,
  fromState: "incomplete",
  actor: string,
  data: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  return transition(subscriptionId, fromState, "trialing", actor, data);
}

export function transitionToIncompleteExpired(
  subscriptionId: string,
  fromState: "incomplete",
  actor: string,
  data: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  return transition(subscriptionId, fromState, "incomplete_expired", actor, data);
}

// ---------------------------------------------------------------------------
// Internal error class — used to signal known transition failures inside
// the Prisma transaction so we can catch them outside and return
// { success: false, error } instead of letting them propagate as
// unhandled exceptions.
// ---------------------------------------------------------------------------

class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}
