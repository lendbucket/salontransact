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

// Re-export the registry as default for the generator script
export default registry;
