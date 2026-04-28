/**
 * Catalog of all webhook event types we emit.
 *
 * Used by the UI to populate the event-selection checkboxes when creating a
 * webhook subscription, and by the firing engine (Phase 10) to look up which
 * subscribers should receive a given event.
 *
 * Add new events here; the UI auto-discovers them.
 */

export interface WebhookEventDef {
  id: string;
  label: string;
  description: string;
  category: "charge" | "refund" | "dispute" | "customer" | "payout" | "other";
}

export const WEBHOOK_EVENTS: WebhookEventDef[] = [
  // Charges
  { id: "charge.succeeded", label: "Charge succeeded", description: "A charge was successfully captured", category: "charge" },
  { id: "charge.failed", label: "Charge failed", description: "A charge attempt failed", category: "charge" },
  { id: "charge.refunded", label: "Charge refunded", description: "A charge was fully or partially refunded", category: "charge" },
  // Refunds
  { id: "refund.created", label: "Refund created", description: "A refund was initiated", category: "refund" },
  { id: "refund.succeeded", label: "Refund succeeded", description: "A refund completed successfully", category: "refund" },
  { id: "refund.failed", label: "Refund failed", description: "A refund attempt failed", category: "refund" },
  // Disputes
  { id: "dispute.created", label: "Dispute created", description: "A new chargeback or dispute was opened", category: "dispute" },
  { id: "dispute.updated", label: "Dispute updated", description: "An existing dispute was updated", category: "dispute" },
  { id: "dispute.closed", label: "Dispute closed", description: "A dispute was finalized (won or lost)", category: "dispute" },
  // Customers
  { id: "customer.created", label: "Customer created", description: "A new customer was added", category: "customer" },
  { id: "customer.updated", label: "Customer updated", description: "Customer details changed", category: "customer" },
  // Payouts
  { id: "payout.paid", label: "Payout paid", description: "A payout landed in the merchant's bank", category: "payout" },
  { id: "payout.failed", label: "Payout failed", description: "A payout attempt failed", category: "payout" },
];

export function getEventCategories(): Array<{ category: WebhookEventDef["category"]; events: WebhookEventDef[] }> {
  const groups = new Map<WebhookEventDef["category"], WebhookEventDef[]>();
  for (const ev of WEBHOOK_EVENTS) {
    const existing = groups.get(ev.category) ?? [];
    existing.push(ev);
    groups.set(ev.category, existing);
  }
  const order: WebhookEventDef["category"][] = ["charge", "refund", "dispute", "customer", "payout", "other"];
  return order
    .filter((c) => groups.has(c))
    .map((c) => ({ category: c, events: groups.get(c)! }));
}

export function isValidEventId(id: string): boolean {
  return WEBHOOK_EVENTS.some((e) => e.id === id);
}
