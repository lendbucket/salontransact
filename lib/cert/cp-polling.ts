/**
 * Card-Present polling helper for cert testing.
 *
 * After sendPaymentInstruction is called, the Pax terminal beeps and
 * waits for the customer to dip/tap/swipe. Payroc's response from the
 * initial submit returns a paymentInstructionId immediately, but the
 * actual payment outcome only resolves when the customer interacts
 * with the device.
 *
 * This helper polls Payroc's getPaymentInstruction endpoint until:
 * - status === "completed" — extract paymentId from link.href
 * - status === "canceled" — customer canceled or timed out
 * - status === "failure" — chip read error, decline, etc.
 * - timeout reached — abort and let caller mark test failed
 *
 * Used by Commit 19b's CP executors:
 *   executeCardPresentSale, executeCardPresentPreAuth,
 *   executeCardPresentRefund, etc.
 *
 * IMPORTANT: This file uses PaymentInstructionResponse from
 * lib/payroc/types.ts line 283 — the CANONICAL type used by
 * lib/payroc/devices.ts. Do NOT confuse with the stale duplicate
 * PayrocPaymentInstructionResponse at line 101.
 */

import { getPaymentInstruction } from "@/lib/payroc/devices";
import type { PaymentInstructionResponse } from "@/lib/payroc/types";

export interface PollResult {
  ok: boolean;
  status: "completed" | "canceled" | "failure" | "timeout";
  paymentInstructionId: string;
  paymentId: string | null;
  errorMessage: string | null;
  pollDurationMs: number;
  pollAttempts: number;
}

export interface PollOptions {
  paymentInstructionId: string;
  intervalMs?: number;       // default 2000 (2 seconds)
  timeoutMs?: number;        // default 90000 (90 seconds)
  onPoll?: (status: string, attempt: number) => void;  // optional progress hook
}

/**
 * Extract the Payroc paymentId from a PaymentInstructionResponse.link.href.
 *
 * Payroc returns a `link` object on completed instructions like:
 *   { rel: "payment", method: "GET", href: "/payments/PYC-12345-abc" }
 *
 * The paymentId is the last URL segment after "/payments/".
 * Returns null if link is missing or malformed.
 */
export function extractPaymentId(response: PaymentInstructionResponse): string | null {
  if (!response.link?.href) return null;
  const href = response.link.href;
  const match = href.match(/\/payments\/([^/?#]+)/);
  return match ? match[1] : null;
}

/**
 * Poll a payment instruction until terminal outcome or timeout.
 *
 * Default 90-second timeout matches typical Pax customer interaction
 * timeout (chip insert + PIN/sign + receipt prompt). 2-second polling
 * interval keeps us under Payroc rate limits while still feeling
 * responsive in the UI.
 */
export async function pollPaymentInstruction(
  options: PollOptions
): Promise<PollResult> {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 90000;
  const startedAt = Date.now();
  let attempts = 0;

  while (Date.now() - startedAt < timeoutMs) {
    attempts += 1;
    let response: PaymentInstructionResponse;
    try {
      response = await getPaymentInstruction(options.paymentInstructionId);
    } catch (e) {
      // Transient errors during polling are non-fatal — log and continue
      console.warn(
        `[CP-POLL] attempt=${attempts} fetch error: ${e instanceof Error ? e.message : "unknown"}`
      );
      await sleep(intervalMs);
      continue;
    }

    if (options.onPoll) options.onPoll(response.status, attempts);

    if (response.status === "completed") {
      return {
        ok: true,
        status: "completed",
        paymentInstructionId: options.paymentInstructionId,
        paymentId: extractPaymentId(response),
        errorMessage: null,
        pollDurationMs: Date.now() - startedAt,
        pollAttempts: attempts,
      };
    }

    if (response.status === "canceled") {
      return {
        ok: false,
        status: "canceled",
        paymentInstructionId: options.paymentInstructionId,
        paymentId: null,
        errorMessage: response.errorMessage ?? "Transaction canceled on terminal",
        pollDurationMs: Date.now() - startedAt,
        pollAttempts: attempts,
      };
    }

    if (response.status === "failure") {
      return {
        ok: false,
        status: "failure",
        paymentInstructionId: options.paymentInstructionId,
        paymentId: extractPaymentId(response),  // failure may still have a paymentId
        errorMessage: response.errorMessage ?? "Transaction failed on terminal",
        pollDurationMs: Date.now() - startedAt,
        pollAttempts: attempts,
      };
    }

    // status === "inProgress" — keep polling
    await sleep(intervalMs);
  }

  // Timed out
  return {
    ok: false,
    status: "timeout",
    paymentInstructionId: options.paymentInstructionId,
    paymentId: null,
    errorMessage: `Polling timed out after ${timeoutMs}ms (${attempts} attempts). Customer may not have completed the transaction on the terminal.`,
    pollDurationMs: Date.now() - startedAt,
    pollAttempts: attempts,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
