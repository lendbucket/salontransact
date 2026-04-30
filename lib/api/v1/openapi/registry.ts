/**
 * OpenAPI registry for the Reyna Pay engine v1 API.
 *
 * Every /api/v1/* endpoint registers its schema here. The generator
 * script (scripts/generate-openapi.ts) reads this registry and emits
 * docs/openapi.yaml on demand.
 *
 * Schemas defined here are STANDALONE OpenAPI schemas. They mirror
 * what lib/api/v1/<domain>/validate.ts enforces but are not currently
 * the source of truth for runtime validation. A future Phase 10.13.X
 * commit will migrate validators to use these schemas directly,
 * eliminating drift.
 *
 * Adding a new endpoint:
 *   1. Define request + response schemas as Zod schemas using `z`
 *      from "@asteasolutions/zod-to-openapi" (extends "zod" with
 *      `.openapi()` metadata)
 *   2. Call `registry.registerPath({ ... })` with method, path, and
 *      request/response references
 *   3. Run `npm run openapi:generate` to update docs/openapi.yaml
 *   4. Commit both the schema additions AND the regenerated YAML
 *
 * See https://github.com/asteasolutions/zod-to-openapi for full API.
 */

import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// ──────────────────────────────────────────────────────────────────
// Universal security + parameters (referenced by every protected endpoint)
// ──────────────────────────────────────────────────────────────────

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "Reyna Pay API key",
  description:
    "Bearer authentication using a Reyna Pay API key. Issued per merchant via the merchant portal. Pass as `Authorization: Bearer <key>`. Keys begin with `rp_live_` (production) or `rp_test_` (test mode).",
});

export const IdempotencyKeyParameter = registry.registerParameter(
  "IdempotencyKey",
  z
    .string()
    .uuid()
    .openapi({
      param: {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        description:
          "A UUID v4 unique to this logical request. Reyna Pay caches the response for 7 days. Replaying the same key with an identical body returns the cached response. Replaying with a different body returns 409 idempotency_conflict. Generate a fresh UUID for every distinct logical action; reuse the same UUID when retrying the same action.",
      },
      example: "550e8400-e29b-41d4-a716-446655440000",
    })
);

// ──────────────────────────────────────────────────────────────────
// Common error response schema (used by every endpoint)
// ──────────────────────────────────────────────────────────────────

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z
        .enum([
          "unauthorized",
          "forbidden",
          "not_found",
          "validation_error",
          "idempotency_conflict",
          "rate_limit_exceeded",
          "payment_failed",
          "internal_error",
          "method_not_allowed",
        ])
        .openapi({ description: "Machine-readable error code" }),
      message: z
        .string()
        .openapi({ description: "Human-readable error message" }),
      details: z
        .record(z.string(), z.unknown())
        .optional()
        .openapi({
          description:
            "Optional structured error details (e.g. failed field name)",
        }),
    }),
  })
  .openapi("ErrorResponse");

registry.register("ErrorResponse", ErrorResponseSchema);

// ──────────────────────────────────────────────────────────────────
// Health endpoint — proof-of-concept registration
// ──────────────────────────────────────────────────────────────────

const HealthResponseSchema = z
  .object({
    ok: z.literal(true).openapi({ example: true }),
    service: z.string().openapi({ example: "salontransact-engine" }),
    version: z.string().openapi({ example: "2026-04-29" }),
  })
  .openapi("HealthResponse");

registry.registerPath({
  method: "get",
  path: "/api/v1/health",
  summary: "Health check",
  description:
    "Returns the engine's liveness status. Does not require authentication. Use this endpoint for uptime monitoring and to verify the engine is reachable.",
  tags: ["Health"],
  responses: {
    200: {
      description: "Engine is healthy and accepting requests.",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

// ──────────────────────────────────────────────────────────────────
// Charges domain
// ──────────────────────────────────────────────────────────────────

const ChargeSourceSchema = z
  .object({
    type: z
      .enum(["saved_card", "single_use_token"])
      .openapi({
        description:
          "saved_card = use a previously stored Payroc secureToken. single_use_token = use a freshly tokenized card from Hosted Fields (one-time use, ~30 minute lifetime).",
      }),
    id: z
      .string()
      .nullable()
      .openapi({
        description:
          "For saved_card: the SavedPaymentMethod row ID. For single_use_token: the Payroc single-use token. Null when the source identifier is not available in the response (e.g., older transactions without source metadata).",
      }),
    last4: z
      .string()
      .length(4)
      .nullable()
      .openapi({ description: "Last 4 digits of the card. Null if unknown." }),
    brand: z
      .string()
      .nullable()
      .openapi({
        description:
          "Card brand (Visa, Mastercard, AmEx, Discover, etc). Null if unknown.",
      }),
  })
  .openapi("ChargeSource");

const ChargeItemSchema = z
  .object({
    name: z
      .string()
      .max(200)
      .openapi({ example: "Haircut & Style" }),
    amount_cents: z
      .number()
      .int()
      .nonnegative()
      .openapi({ example: 8500 }),
  })
  .openapi("ChargeItem");

const ChargeResponseSchema = z
  .object({
    id: z
      .string()
      .openapi({ example: "ch_clx7y8z9a0001b2c3d4e5f6g7" }),
    object: z.literal("charge"),
    status: z
      .enum(["succeeded", "failed", "requires_capture"])
      .openapi({
        description:
          "succeeded = funds captured. failed = card declined or processing error. requires_capture = auth-only, awaiting POST /charges/:id/capture.",
      }),
    amount_cents: z.number().int().positive().openapi({ example: 8500 }),
    currency: z.string().length(3).openapi({ example: "usd" }),
    captured: z.boolean(),
    captured_at: z.string().datetime().nullable(),
    description: z.string().nullable(),
    source: ChargeSourceSchema,
    customer_id: z.string().nullable(),
    stylist_id: z.string().nullable(),
    booking_id: z.string().nullable(),
    tip_amount_cents: z.number().int().nonnegative(),
    items: z.array(ChargeItemSchema).nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    approval_code: z.string().nullable(),
    decline_reason: z.string().nullable(),
    created_at: z.string().datetime(),
    payroc: z.object({
      payment_id: z.string().nullable(),
    }),
  })
  .openapi("Charge");

const ChargeCreateRequestSchema = z
  .object({
    amount_cents: z
      .number()
      .int()
      .positive()
      .openapi({
        example: 8500,
        description: "Amount to charge in cents. Must be a positive integer.",
      }),
    currency: z
      .string()
      .length(3)
      .optional()
      .openapi({
        example: "usd",
        description: "ISO 4217 currency code, lowercase. Defaults to 'usd'.",
      }),
    description: z
      .string()
      .max(500)
      .optional()
      .openapi({ example: "Haircut & color — Apr 30" }),
    source: z
      .object({
        type: z.enum(["saved_card", "single_use_token"]),
        id: z.string().min(1),
      })
      .openapi({
        description:
          "Payment source. saved_card.id = SavedPaymentMethod row ID. single_use_token.id = Payroc single-use token from Hosted Fields submissionSuccess event.",
      }),
    customer_id: z.string().optional(),
    customer_email: z.string().email().optional(),
    customer_name: z.string().max(200).optional(),
    capture: z
      .boolean()
      .optional()
      .openapi({
        description:
          "true (default) = authorize and capture immediately. false = authorize only; call POST /charges/:id/capture to capture later. Auths expire per Payroc rules (typically 7 days for most card brands).",
      }),
    stylist_id: z.string().optional(),
    booking_id: z.string().optional(),
    tip_amount_cents: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .openapi({
        description:
          "Tip in cents. Must not exceed amount_cents. Tracked separately for stylist attribution.",
      }),
    items: z
      .array(ChargeItemSchema)
      .max(100)
      .optional(),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({
        description:
          "Arbitrary JSON object for merchant-specific data. Max 10KB serialized. Stripped of internal Reyna Pay keys before being returned in responses.",
      }),
  })
  .openapi("ChargeCreateRequest");

const ChargeListResponseSchema = z
  .object({
    data: z.array(ChargeResponseSchema),
    has_more: z.boolean(),
    next_cursor: z
      .string()
      .nullable()
      .openapi({
        description:
          "Opaque base64url-encoded cursor. Pass to the next request as ?cursor=<value>. Null when there are no more pages.",
      }),
  })
  .openapi("ChargeListResponse");

const RefundResponseSchema = z
  .object({
    id: z.string().openapi({ example: "rf_clx7y8z9a0001b2c3d4e5f6g7" }),
    object: z.literal("refund"),
    charge_id: z.string().openapi({ example: "ch_clx7y8z9a0001b2c3d4e5f6g7" }),
    amount_cents: z.number().int().positive(),
    total_refunded_cents: z.number().int().nonnegative(),
    original_amount_cents: z.number().int().positive(),
    fully_refunded: z.boolean(),
    reason: z.string().nullable(),
    created_at: z.string().datetime(),
    payroc: z.object({ refund_id: z.string().nullable() }),
  })
  .openapi("Refund");

const RefundCreateRequestSchema = z
  .object({
    amount_cents: z
      .number()
      .int()
      .positive()
      .optional()
      .openapi({
        description:
          "Amount to refund in cents. Defaults to the remaining unrefunded amount on the charge. Must not exceed (original - already refunded).",
      }),
    reason: z.string().max(200).optional(),
  })
  .openapi("RefundCreateRequest");

const VoidResponseSchema = z
  .object({
    id: z.string().openapi({ example: "vd_clx7y8z9a0001b2c3d4e5f6g7_1234567890" }),
    object: z.literal("void"),
    charge_id: z.string(),
    reason: z.string().nullable(),
    voided_at: z.string().datetime(),
    payroc: z.object({ void_id: z.string().nullable() }),
  })
  .openapi("Void");

const VoidCreateRequestSchema = z
  .object({
    reason: z.string().max(200).optional(),
  })
  .openapi("VoidCreateRequest");

const CaptureCreateRequestSchema = z
  .object({
    amount_cents: z
      .number()
      .int()
      .positive()
      .optional()
      .openapi({
        description:
          "Capture amount in cents. Defaults to the original auth amount. May be less than the original auth (partial capture) but not greater.",
      }),
  })
  .openapi("CaptureCreateRequest");

// Path: GET /api/v1/charges
registry.registerPath({
  method: "get",
  path: "/api/v1/charges",
  summary: "List charges",
  description:
    "Returns a paginated list of charges, ordered by creation time descending. Supports filtering by status, customer, stylist, booking, and date range. Uses cursor-based pagination — pass `next_cursor` from a previous response to fetch the next page.",
  tags: ["Charges"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .openapi({ description: "Page size. Default 50, max 200." }),
      status: z
        .enum(["succeeded", "failed", "requires_capture", "refunded"])
        .optional(),
      customer_id: z.string().optional(),
      stylist_id: z.string().optional(),
      booking_id: z.string().optional(),
      from: z
        .string()
        .datetime()
        .optional()
        .openapi({ description: "ISO 8601 lower bound (inclusive)." }),
      to: z
        .string()
        .datetime()
        .optional()
        .openapi({ description: "ISO 8601 upper bound (inclusive)." }),
      cursor: z
        .string()
        .optional()
        .openapi({ description: "Opaque cursor from a previous response." }),
    }),
  },
  responses: {
    200: {
      description: "List of charges with pagination metadata.",
      content: {
        "application/json": { schema: ChargeListResponseSchema },
      },
    },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Path: POST /api/v1/charges
registry.registerPath({
  method: "post",
  path: "/api/v1/charges",
  summary: "Create a charge",
  description:
    "Charges a payment source. Supports saved cards (saved_card) and freshly tokenized cards from Hosted Fields (single_use_token). On success returns the Charge object with status 'succeeded' (or 'requires_capture' if capture: false was sent). On card decline returns 422 with payment_failed error code.",
  tags: ["Charges"],
  security: [{ bearerAuth: [] }],
  request: {
    headers: z.object({
      "Idempotency-Key": z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": { schema: ChargeCreateRequestSchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Charge succeeded.",
      content: {
        "application/json": { schema: ChargeResponseSchema },
      },
    },
    409: {
      description: "Idempotency conflict — same key replayed with different body.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    422: {
      description: "Validation error or card declined.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Path: GET /api/v1/charges/{id}
registry.registerPath({
  method: "get",
  path: "/api/v1/charges/{id}",
  summary: "Retrieve a charge",
  description:
    "Returns the Charge object for the given ID. Accepts both `ch_<id>` (full prefixed ID) and bare `<id>` formats.",
  tags: ["Charges"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ example: "ch_clx7y8z9a0001b2c3d4e5f6g7" }),
    }),
  },
  responses: {
    200: {
      description: "Charge found.",
      content: { "application/json": { schema: ChargeResponseSchema } },
    },
    404: {
      description: "Charge not found or not owned by this merchant.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Path: POST /api/v1/charges/{id}/capture
registry.registerPath({
  method: "post",
  path: "/api/v1/charges/{id}/capture",
  summary: "Capture an auth-only charge",
  description:
    "Captures funds for a charge that was created with capture: false. Optional partial capture by sending amount_cents less than the original auth. Returns the updated Charge with status 'succeeded'.",
  tags: ["Charges"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    headers: z.object({ "Idempotency-Key": z.string().uuid() }),
    body: {
      content: {
        "application/json": { schema: CaptureCreateRequestSchema },
      },
      required: false,
    },
  },
  responses: {
    200: {
      description: "Capture succeeded.",
      content: { "application/json": { schema: ChargeResponseSchema } },
    },
    404: { description: "Charge not found.", content: { "application/json": { schema: ErrorResponseSchema } } },
    422: { description: "Capture failed (e.g., already captured, expired, decline).", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Path: POST /api/v1/charges/{id}/refund
registry.registerPath({
  method: "post",
  path: "/api/v1/charges/{id}/refund",
  summary: "Refund a charge",
  description:
    "Refunds part or all of a previous charge. If amount_cents is omitted, refunds the full remaining unrefunded amount. Multiple partial refunds are allowed up to the original charge amount.",
  tags: ["Charges"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    headers: z.object({ "Idempotency-Key": z.string().uuid() }),
    body: {
      content: {
        "application/json": { schema: RefundCreateRequestSchema },
      },
      required: false,
    },
  },
  responses: {
    201: {
      description: "Refund succeeded.",
      content: { "application/json": { schema: RefundResponseSchema } },
    },
    404: { description: "Charge not found.", content: { "application/json": { schema: ErrorResponseSchema } } },
    422: { description: "Refund failed (e.g., over-refund, payroc rejection).", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Path: POST /api/v1/charges/{id}/void
registry.registerPath({
  method: "post",
  path: "/api/v1/charges/{id}/void",
  summary: "Void an auth-only charge",
  description:
    "Voids a charge that has not yet been captured. Use this instead of refund for charges in 'requires_capture' status — voiding releases the auth hold without creating a refund record. After capture, use refund instead.",
  tags: ["Charges"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    headers: z.object({ "Idempotency-Key": z.string().uuid() }),
    body: {
      content: {
        "application/json": { schema: VoidCreateRequestSchema },
      },
      required: false,
    },
  },
  responses: {
    200: {
      description: "Void succeeded.",
      content: { "application/json": { schema: VoidResponseSchema } },
    },
    404: { description: "Charge not found.", content: { "application/json": { schema: ErrorResponseSchema } } },
    422: { description: "Void failed (e.g., already captured — use refund instead).", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// ──────────────────────────────────────────────────────────────────
// Tokenization sessions
// ──────────────────────────────────────────────────────────────────

const TokenizationSessionResponseSchema = z
  .object({
    object: z.literal("tokenization_session"),
    session_token: z
      .string()
      .openapi({
        description:
          "Short-lived token used to bootstrap a Hosted Fields session in the browser. Pass to Payroc.hostedFields() as sessionToken.",
      }),
    expires_at: z.string().datetime(),
    terminal_id: z.string(),
    lib_url: z
      .string()
      .url()
      .openapi({
        description:
          "Pinned CDN URL of the Hosted Fields SDK. Load this script in the browser BEFORE calling Payroc.hostedFields().",
      }),
    integrity: z
      .string()
      .openapi({
        description:
          "Subresource Integrity hash for the SDK script tag. Pass as the integrity attribute on the <script> tag for tamper protection.",
      }),
    scenario: z.enum(["payment", "tokenization"]),
  })
  .openapi("TokenizationSession");

const TokenizationSessionCreateRequestSchema = z
  .object({
    scenario: z
      .enum(["payment", "tokenization"])
      .optional()
      .openapi({
        description:
          "payment (default) = single-use card tokenization for an immediate charge. tokenization = card tokenization for storage as a saved card.",
      }),
  })
  .openapi("TokenizationSessionCreateRequest");

// Path: POST /api/v1/tokenization/sessions
registry.registerPath({
  method: "post",
  path: "/api/v1/tokenization/sessions",
  summary: "Create a Hosted Fields tokenization session",
  description:
    "Creates a short-lived session token + SDK config bundle for client-side card tokenization via Payroc Hosted Fields. The merchant calls this server-side, then passes the response to the browser to initialize Payroc.hostedFields(). Card data flows directly from the customer's browser to Payroc — never touches your server.",
  tags: ["Tokenization"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: TokenizationSessionCreateRequestSchema },
      },
      required: false,
    },
  },
  responses: {
    200: {
      description: "Tokenization session created.",
      content: { "application/json": { schema: TokenizationSessionResponseSchema } },
    },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Failed to create session (e.g., Payroc unreachable).", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// ──────────────────────────────────────────────────────────────────
// Customers domain
// ──────────────────────────────────────────────────────────────────

const CustomerTierSchema = z
  .enum(["new", "regular", "occasional", "lapsed"])
  .openapi({
    description:
      "Customer engagement tier computed from visit history: new (no transactions yet), occasional (1–3 visits in last 365d), regular (4+ visits in last 365d), lapsed (had transactions but last visit was more than 365 days ago).",
  });

const CustomerSavedCardInlineSchema = z
  .object({
    id: z.string(),
    last4: z.string().length(4).nullable(),
    brand: z.string().nullable(),
    expiry_month: z.string().nullable(),
    expiry_year: z.string().nullable(),
    cardholder_name: z.string().nullable(),
    label: z.string().nullable(),
    status: z.string(),
    created_at: z.string().datetime(),
    last_used_at: z.string().datetime().nullable(),
  })
  .openapi("CustomerSavedCardInline");

const CustomerRecentTransactionInlineSchema = z
  .object({
    id: z.string().openapi({ example: "ch_clx7y8z9a0001b2c3d4e5f6g7" }),
    amount_cents: z.number().int().nonnegative(),
    tip_amount_cents: z.number().int().nonnegative(),
    status: z.string(),
    description: z.string().nullable(),
    stylist_id: z.string().nullable(),
    booking_id: z.string().nullable(),
    created_at: z.string().datetime(),
  })
  .openapi("CustomerRecentTransactionInline");

const CustomerSchema = z
  .object({
    id: z.string(),
    object: z.literal("customer"),
    email: z.string().email(),
    name: z.string().nullable(),
    phone: z.string().nullable(),
    tier: CustomerTierSchema,
    total_transactions: z.number().int().nonnegative(),
    total_spent_cents: z.number().int().nonnegative(),
    saved_card_count: z.number().int().nonnegative(),
    days_since_last_visit: z.number().int().nullable(),
    first_seen_at: z.string().datetime(),
    last_seen_at: z.string().datetime(),
    created_at: z.string().datetime(),
  })
  .openapi("Customer");

const CustomerDetailSchema = z
  .object({
    id: z.string(),
    object: z.literal("customer"),
    email: z.string().email(),
    name: z.string().nullable(),
    phone: z.string().nullable(),
    tier: CustomerTierSchema,
    total_transactions: z.number().int().nonnegative(),
    total_spent_cents: z.number().int().nonnegative(),
    saved_card_count: z.number().int().nonnegative(),
    days_since_last_visit: z.number().int().nullable(),
    first_seen_at: z.string().datetime(),
    last_seen_at: z.string().datetime(),
    created_at: z.string().datetime(),
    saved_cards: z.array(CustomerSavedCardInlineSchema),
    recent_transactions: z.array(CustomerRecentTransactionInlineSchema),
  })
  .openapi("CustomerDetail");

const CustomerListResponseSchema = z
  .object({
    data: z.array(CustomerSchema),
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
  })
  .openapi("CustomerListResponse");

const CustomerLtvByYearSchema = z
  .object({
    year: z.number().int(),
    spent_cents: z.number().int().nonnegative(),
    transaction_count: z.number().int().nonnegative(),
  })
  .openapi("CustomerLtvByYear");

const CustomerLtvSchema = z
  .object({
    customer_id: z.string(),
    total_spent_cents: z.number().int().nonnegative(),
    total_transactions: z.number().int().nonnegative(),
    average_ticket_cents: z.number().int().nonnegative(),
    highest_ticket_cents: z.number().int().nonnegative(),
    by_year: z.array(CustomerLtvByYearSchema),
    computed_at: z.string().datetime(),
  })
  .openapi("CustomerLtv");

const CustomerVisitInlineSchema = z
  .object({
    transaction_id: z.string(),
    visited_at: z.string().datetime(),
    amount_cents: z.number().int().nonnegative(),
    tip_amount_cents: z.number().int().nonnegative(),
    description: z.string().nullable(),
    stylist_id: z.string().nullable(),
    stylist_name: z.string().nullable(),
  })
  .openapi("CustomerVisitInline");

const CustomerVisitsSchema = z
  .object({
    customer_id: z.string(),
    total_visits: z.number().int().nonnegative(),
    visits_last_30_days: z.number().int().nonnegative(),
    visits_last_90_days: z.number().int().nonnegative(),
    visits_last_365_days: z.number().int().nonnegative(),
    average_days_between_visits: z.number().nullable(),
    tier: CustomerTierSchema,
    first_visit_at: z.string().datetime().nullable(),
    last_visit_at: z.string().datetime().nullable(),
    visits: z.array(CustomerVisitInlineSchema),
  })
  .openapi("CustomerVisits");

// Path: GET /api/v1/customers
registry.registerPath({
  method: "get",
  path: "/api/v1/customers",
  summary: "List customers",
  description:
    "Returns a paginated list of customers ordered by most-recent visit descending. Supports filtering by engagement tier and free-text search on email/name/phone.",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      limit: z.number().int().min(1).max(200).optional(),
      search: z
        .string()
        .optional()
        .openapi({
          description:
            "Substring match on email, name, or phone. Case-insensitive.",
        }),
      tier: CustomerTierSchema.optional(),
      cursor: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "List of customers.",
      content: {
        "application/json": { schema: CustomerListResponseSchema },
      },
    },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Path: GET /api/v1/customers/lookup
registry.registerPath({
  method: "get",
  path: "/api/v1/customers/lookup",
  summary: "Look up a customer by email or phone",
  description:
    "Finds a single customer matching the provided email or phone. Useful for de-duplication during checkout or walk-in flows. Either email or phone is required.",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z
      .object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .openapi({
        description: "Provide email OR phone (at least one required).",
      }),
  },
  responses: {
    200: {
      description: "Customer found.",
      content: { "application/json": { schema: CustomerSchema } },
    },
    400: {
      description: "Neither email nor phone provided.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Customer not found.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Path: GET /api/v1/customers/{id}
registry.registerPath({
  method: "get",
  path: "/api/v1/customers/{id}",
  summary: "Retrieve a customer with saved cards + recent transactions",
  description:
    "Returns a customer detail object including up to 50 saved payment methods and the 25 most recent transactions inline. Optimized for checkout / customer profile views — fetches everything needed to display a customer profile in one call.",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Customer detail.",
      content: { "application/json": { schema: CustomerDetailSchema } },
    },
    404: {
      description: "Customer not found or not owned by this merchant.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Path: GET /api/v1/customers/{id}/lifetime-value
registry.registerPath({
  method: "get",
  path: "/api/v1/customers/{id}/lifetime-value",
  summary: "Customer lifetime value with annual breakdown",
  description:
    "Computes total spend, transaction count, average ticket, highest ticket, and a year-by-year breakdown for the customer. Computed live from successful transactions; cache at the consumer if needed.",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Lifetime value computed.",
      content: { "application/json": { schema: CustomerLtvSchema } },
    },
    404: { description: "Customer not found.", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Path: GET /api/v1/customers/{id}/visits
registry.registerPath({
  method: "get",
  path: "/api/v1/customers/{id}/visits",
  summary: "Customer visit summary + history",
  description:
    "Returns visit cadence statistics (visits in last 30/90/365 days, average days between visits, tier classification) plus the most recent visits with stylist attribution. Use limit query param to control how many visits are returned (default 50, max 200).",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    query: z.object({
      limit: z.number().int().min(1).max(200).optional(),
    }),
  },
  responses: {
    200: {
      description: "Visit summary computed.",
      content: { "application/json": { schema: CustomerVisitsSchema } },
    },
    404: { description: "Customer not found.", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// ──────────────────────────────────────────────────────────────────
// Cards domain (saved payment methods)
// ──────────────────────────────────────────────────────────────────

const CardSchema = z
  .object({
    id: z.string().openapi({ example: "card_clx7y8z9a0001b2c3d4e5f6g7" }),
    object: z.literal("card"),
    customer_id: z.string().nullable(),
    customer_email: z.string().email(),
    last4: z.string().length(4).nullable(),
    brand: z.string().nullable().openapi({ description: "Visa, Mastercard, AmEx, Discover, etc. Null if unknown." }),
    expiry_month: z.string().nullable(),
    expiry_year: z.string().nullable(),
    cardholder_name: z.string().nullable(),
    label: z.string().nullable(),
    status: z
      .string()
      .openapi({
        description: "active, revoked, or expired.",
      }),
    last_used_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
  })
  .openapi("Card");

const CardListResponseSchema = z
  .object({
    data: z.array(CardSchema),
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
  })
  .openapi("CardListResponse");

const CardDeleteResponseSchema = z
  .object({
    id: z.string(),
    deleted: z.literal(true),
  })
  .openapi("CardDeleteResponse");

// Path: GET /api/v1/cards
registry.registerPath({
  method: "get",
  path: "/api/v1/cards",
  summary: "List saved cards",
  description:
    "Returns saved payment methods for the merchant. Filter by customer_id, customer_email (substring match), or status. Cursor pagination via next_cursor.",
  tags: ["Cards"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      limit: z.number().int().min(1).max(200).optional(),
      customer_id: z.string().optional(),
      customer_email: z.string().optional(),
      status: z.enum(["active", "revoked", "expired"]).optional(),
      cursor: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "List of cards.",
      content: { "application/json": { schema: CardListResponseSchema } },
    },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Path: GET /api/v1/cards/{id}
registry.registerPath({
  method: "get",
  path: "/api/v1/cards/{id}",
  summary: "Retrieve a saved card",
  description:
    "Returns a single saved card. ID accepts both `card_<id>` and bare `<id>` formats.",
  tags: ["Cards"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Card found.",
      content: { "application/json": { schema: CardSchema } },
    },
    404: { description: "Card not found.", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Path: DELETE /api/v1/cards/{id}
registry.registerPath({
  method: "delete",
  path: "/api/v1/cards/{id}",
  summary: "Revoke a saved card",
  description:
    "Deletes the saved payment method. The Payroc secureToken is deleted on the processor side FIRST; only after Payroc confirms (or returns 404) is the local row marked revoked. This prevents drift between local state and Payroc state. If Payroc is unreachable, returns 502 and the card is NOT revoked locally — retry later.",
  tags: ["Cards"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Card revoked.",
      content: { "application/json": { schema: CardDeleteResponseSchema } },
    },
    404: { description: "Card not found.", content: { "application/json": { schema: ErrorResponseSchema } } },
    422: {
      description: "Card already revoked or expired.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    502: {
      description: "Payroc deletion failed; card remains active locally — retry.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// ──────────────────────────────────────────────────────────────────
// Locations domain (multi-location franchise support)
//
// Currently exposes POST only. GET (list, retrieve) and PATCH (update)
// are blocked on Phase 10.8 Round 3 Commits 66-68 per docs/engine-roadmap.md
// blocker annotations.
// ──────────────────────────────────────────────────────────────────

const LocationSchema = z
  .object({
    id: z.string().openapi({ example: "loc_clx7y8z9a0001b2c3d4e5f6g7" }),
    object: z.literal("location"),
    name: z.string().openapi({ example: "Salon Envy — Corpus Christi" }),
    address_line1: z.string().nullable().openapi({ example: "5601 S Padre Island Dr STE E" }),
    address_line2: z.string().nullable(),
    city: z.string().nullable().openapi({ example: "Corpus Christi" }),
    state: z.string().nullable().openapi({ example: "TX" }),
    zip: z.string().nullable().openapi({ example: "78412" }),
    phone: z.string().nullable().openapi({ example: "+13618891102" }),
    timezone: z
      .string()
      .openapi({ example: "America/Chicago", description: "IANA timezone identifier." }),
    status: z.enum(["active", "inactive"]),
    is_primary: z
      .boolean()
      .openapi({
        description:
          "Exactly one location per merchant is primary. The first location created is forced primary regardless of request body. Setting is_primary: true on a new location automatically unmarks the previous primary.",
      }),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .openapi("Location");

const LocationCreateRequestSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(200)
      .openapi({ example: "Salon Envy — San Antonio" }),
    address_line1: z.string().optional(),
    address_line2: z.string().optional(),
    city: z.string().optional(),
    state: z
      .string()
      .length(2)
      .optional()
      .openapi({
        description: "2-letter US state code (uppercase). Validated.",
        example: "TX",
      }),
    zip: z
      .string()
      .optional()
      .openapi({
        description: "5-digit or 9-digit US zip code. Validated by regex.",
        example: "78258",
      }),
    phone: z.string().optional(),
    timezone: z
      .string()
      .optional()
      .openapi({
        description: "IANA timezone. Defaults to America/Chicago.",
      }),
    is_primary: z
      .boolean()
      .optional()
      .openapi({
        description:
          "Set true to make this the primary location, automatically demoting the existing primary. The first location for a merchant is always primary regardless of this field.",
      }),
  })
  .openapi("LocationCreateRequest");

// Path: POST /api/v1/locations
registry.registerPath({
  method: "post",
  path: "/api/v1/locations",
  summary: "Create a location",
  description:
    "Creates a new physical location for the merchant. Use for multi-location franchises — Salon Envy operates two locations (Corpus Christi + San Antonio), other franchises operate dozens. The first location created for a merchant is automatically the primary. Subsequent locations can be marked primary via is_primary: true (which demotes the previous primary in a single transaction).",
  tags: ["Locations"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: LocationCreateRequestSchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Location created.",
      content: { "application/json": { schema: LocationSchema } },
    },
    400: {
      description: "Validation error (missing name, invalid state/zip, etc.).",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: { description: "Missing or invalid API key.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Re-export the registry as default for the generator script
export default registry;
