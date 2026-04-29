import type { V1ChargeCreateInput, V1ChargeItem } from "./types";
import type { V1ApiError } from "@/lib/api/v1/types";

export interface ParsedChargeInput {
  amountCents: number;
  currency: string;
  description: string | null;
  source: { type: "saved_card" | "single_use_token"; id: string };
  customerId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  capture: boolean;
  stylistId: string | null;
  bookingId: string | null;
  tipAmountCents: number;
  items: V1ChargeItem[] | null;
  metadata: Record<string, unknown> | null;
}

export type ValidateResult =
  | { ok: true; parsed: ParsedChargeInput }
  | { ok: false; error: V1ApiError };

export function validateChargeInput(raw: unknown): ValidateResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: { code: "validation_error", message: "Request body must be a JSON object" } };
  }
  const body = raw as Partial<V1ChargeCreateInput>;

  if (typeof body.amount_cents !== "number" || !Number.isFinite(body.amount_cents) || body.amount_cents < 1 || !Number.isInteger(body.amount_cents)) {
    return { ok: false, error: { code: "validation_error", message: "amount_cents must be a positive integer", details: { field: "amount_cents" } } };
  }
  const amountCents = body.amount_cents;

  let currency = "usd";
  if (body.currency !== undefined) {
    if (typeof body.currency !== "string" || body.currency.length !== 3) {
      return { ok: false, error: { code: "validation_error", message: "currency must be a 3-letter ISO code", details: { field: "currency" } } };
    }
    currency = body.currency.toLowerCase();
  }

  let description: string | null = null;
  if (body.description !== undefined) {
    if (typeof body.description !== "string") return { ok: false, error: { code: "validation_error", message: "description must be a string", details: { field: "description" } } };
    if (body.description.length > 500) return { ok: false, error: { code: "validation_error", message: "description must be <= 500 characters", details: { field: "description" } } };
    description = body.description.trim() || null;
  }

  if (!body.source || typeof body.source !== "object" || typeof (body.source as unknown as Record<string, unknown>).type !== "string" || typeof (body.source as unknown as Record<string, unknown>).id !== "string") {
    return { ok: false, error: { code: "validation_error", message: "source must be { type: 'saved_card' | 'single_use_token', id: string }", details: { field: "source" } } };
  }
  const sourceType = (body.source as { type: string }).type;
  if (sourceType !== "saved_card" && sourceType !== "single_use_token") {
    return { ok: false, error: { code: "validation_error", message: "source.type must be 'saved_card' or 'single_use_token'", details: { field: "source.type" } } };
  }
  const sourceId = ((body.source as { id: string }).id || "").trim();
  if (!sourceId) return { ok: false, error: { code: "validation_error", message: "source.id is required", details: { field: "source.id" } } };

  const customerId = typeof body.customer_id === "string" && body.customer_id.length > 0 ? body.customer_id : null;
  let customerEmail: string | null = null;
  if (typeof body.customer_email === "string") {
    const trimmed = body.customer_email.trim().toLowerCase();
    if (trimmed.length > 0 && !trimmed.includes("@")) return { ok: false, error: { code: "validation_error", message: "customer_email must be a valid email", details: { field: "customer_email" } } };
    customerEmail = trimmed || null;
  }
  const customerName = typeof body.customer_name === "string" ? (body.customer_name.trim().slice(0, 200) || null) : null;

  let capture = true;
  if (body.capture !== undefined) {
    if (typeof body.capture !== "boolean") return { ok: false, error: { code: "validation_error", message: "capture must be a boolean", details: { field: "capture" } } };
    capture = body.capture;
  }

  const stylistId = typeof body.stylist_id === "string" && body.stylist_id.length > 0 ? body.stylist_id : null;
  const bookingId = typeof body.booking_id === "string" && body.booking_id.length > 0 ? body.booking_id : null;

  let tipAmountCents = 0;
  if (body.tip_amount_cents !== undefined) {
    if (typeof body.tip_amount_cents !== "number" || !Number.isFinite(body.tip_amount_cents) || body.tip_amount_cents < 0 || !Number.isInteger(body.tip_amount_cents)) {
      return { ok: false, error: { code: "validation_error", message: "tip_amount_cents must be a non-negative integer", details: { field: "tip_amount_cents" } } };
    }
    if (body.tip_amount_cents > amountCents) {
      return { ok: false, error: { code: "validation_error", message: "tip_amount_cents cannot exceed amount_cents", details: { field: "tip_amount_cents" } } };
    }
    tipAmountCents = body.tip_amount_cents;
  }

  let items: V1ChargeItem[] | null = null;
  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) return { ok: false, error: { code: "validation_error", message: "items must be an array", details: { field: "items" } } };
    if (body.items.length > 100) return { ok: false, error: { code: "validation_error", message: "items array exceeds max length of 100", details: { field: "items" } } };
    const parsed: V1ChargeItem[] = [];
    for (const [i, item] of body.items.entries()) {
      if (!item || typeof item !== "object" || typeof (item as unknown as Record<string, unknown>).name !== "string" || typeof (item as unknown as Record<string, unknown>).amount_cents !== "number" || !Number.isInteger((item as { amount_cents: number }).amount_cents) || (item as { amount_cents: number }).amount_cents < 0) {
        return { ok: false, error: { code: "validation_error", message: `items[${i}] must be { name: string, amount_cents: non-negative integer }`, details: { field: `items[${i}]` } } };
      }
      parsed.push({ name: ((item as { name: string }).name || "").slice(0, 200), amount_cents: (item as { amount_cents: number }).amount_cents });
    }
    items = parsed.length > 0 ? parsed : null;
  }

  let metadata: Record<string, unknown> | null = null;
  if (body.metadata !== undefined) {
    if (!body.metadata || typeof body.metadata !== "object" || Array.isArray(body.metadata)) return { ok: false, error: { code: "validation_error", message: "metadata must be a JSON object", details: { field: "metadata" } } };
    if (JSON.stringify(body.metadata).length > 10240) return { ok: false, error: { code: "validation_error", message: "metadata exceeds max size of 10KB", details: { field: "metadata" } } };
    metadata = body.metadata as Record<string, unknown>;
  }

  return { ok: true, parsed: { amountCents, currency, description, source: { type: sourceType, id: sourceId }, customerId, customerEmail, customerName, capture, stylistId, bookingId, tipAmountCents, items, metadata } };
}
