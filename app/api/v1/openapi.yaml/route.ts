/**
 * GET /api/v1/openapi.yaml
 *
 * Serves the engine's OpenAPI 3.1 specification at a public URL.
 *
 * - Public (no auth) so developers and AI agents can discover the
 *   engine without credentials.
 * - Cached 5 minutes at the edge to keep latency low.
 * - Spec source is docs/openapi.yaml in the repo, regenerated via
 *   `npm run openapi:generate` after registry changes.
 *
 * Why this exists: external developers want to do
 *   curl https://portal.salontransact.com/api/v1/openapi.yaml | jq
 * to inspect the engine's contract. AI agents (per Stripe + Link
 * agent commerce announcement) need a stable spec URL to discover
 * what the engine supports. Embedding the spec only in the docs
 * page HTML makes both of those workflows clumsy.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 300; // 5 minutes

export async function GET(): Promise<Response> {
  try {
    const filePath = join(process.cwd(), "docs", "openapi.yaml");
    const content = await readFile(filePath, "utf-8");

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "application/yaml; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[/api/v1/openapi.yaml] Failed to read spec:", error);
    return new Response(
      "Failed to load OpenAPI spec",
      { status: 500, headers: { "Content-Type": "text/plain" } }
    );
  }
}
