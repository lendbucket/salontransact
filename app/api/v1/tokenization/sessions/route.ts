import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { getHostedFieldsSessionToken } from "@/lib/payroc/client";
import { getHostedFieldsConfig } from "@/lib/payroc/hosted-fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  scenario?: unknown;
}

const VALID_SCENARIOS = ["payment", "tokenization"];

export async function POST(request: Request) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  let body: PostBody = {};
  try {
    const text = await request.text();
    body = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return apiError("validation_error", "Invalid JSON", { requestId: auth.requestId });
  }

  const scenario =
    typeof body.scenario === "string" && VALID_SCENARIOS.includes(body.scenario)
      ? (body.scenario as "payment" | "tokenization")
      : "payment";

  try {
    const session = await getHostedFieldsSessionToken(scenario);
    const config = getHostedFieldsConfig();

    const response = NextResponse.json({
      object: "tokenization_session",
      session_token: session.token,
      expires_at: session.expiresAt,
      terminal_id: process.env.PAYROC_TERMINAL_ID,
      lib_url: config.url,
      integrity: config.integrityHash,
      scenario,
    });

    response.headers.set("X-Request-ID", auth.requestId);
    return response;
  } catch (e) {
    return apiError(
      "internal_error",
      `Failed to create tokenization session: ${e instanceof Error ? e.message : "unknown"}`,
      { requestId: auth.requestId }
    );
  }
}
