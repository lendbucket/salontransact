import type {
  CloudEvent,
  ProcessingAccountStatusChangedData,
  TerminalOrderStatusChangedData,
} from "./types";

export interface HandlerResult {
  ok: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

/**
 * Handle processingAccount.status.changed.
 *
 * Per Phase 1 discovery, this fires when a Payroc merchant account status changes
 * (entered -> pending -> approved -> subjectTo -> ... -> terminated/cancelled).
 *
 * For now: log only. We don't have a clean mapping from processingAccountId to our
 * internal Merchant model yet. Future work: update Merchant.status when we have that mapping.
 */
export async function handleProcessingAccountStatusChanged(
  event: CloudEvent<ProcessingAccountStatusChangedData>
): Promise<HandlerResult> {
  console.log("[WEBHOOK] processingAccount.status.changed", {
    eventId: event.id,
    processingAccountId: event.data?.processingAccountId,
    oldStatus: event.data?.oldStatus,
    newStatus: event.data?.newStatus,
  });
  return {
    ok: true,
    details: {
      handler: "processingAccount.status.changed",
      processingAccountId: event.data?.processingAccountId,
    },
  };
}

/**
 * Handle terminalOrder.status.changed.
 *
 * Log-only for now. We don't currently track terminal hardware orders.
 */
export async function handleTerminalOrderStatusChanged(
  event: CloudEvent<TerminalOrderStatusChangedData>
): Promise<HandlerResult> {
  console.log("[WEBHOOK] terminalOrder.status.changed", {
    eventId: event.id,
    terminalOrderId: event.data?.terminalOrderId,
    oldStatus: event.data?.oldStatus,
    newStatus: event.data?.newStatus,
  });
  return {
    ok: true,
    details: {
      handler: "terminalOrder.status.changed",
      terminalOrderId: event.data?.terminalOrderId,
    },
  };
}

/**
 * Route a verified CloudEvent to the appropriate handler.
 */
export async function routeEvent(
  event: CloudEvent<unknown>
): Promise<HandlerResult> {
  switch (event.type) {
    case "processingAccount.status.changed":
      return handleProcessingAccountStatusChanged(
        event as CloudEvent<ProcessingAccountStatusChangedData>
      );
    case "terminalOrder.status.changed":
      return handleTerminalOrderStatusChanged(
        event as CloudEvent<TerminalOrderStatusChangedData>
      );
    default:
      console.log("[WEBHOOK] Unknown event type, persisted but not routed:", {
        eventId: event.id,
        type: event.type,
      });
      return {
        ok: true,
        reason: "unknown-type-persisted-only",
        details: { type: event.type },
      };
  }
}
