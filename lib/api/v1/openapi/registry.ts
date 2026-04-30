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

// Re-export the registry as default for the generator script
export default registry;
