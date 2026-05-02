import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHostedFieldsSessionToken } from "@/lib/payroc/client";
import { getHostedFieldsConfig } from "@/lib/payroc/hosted-fields";

export async function GET() {
  console.log("=========== ENV CHECK ===========");
  console.log("PAYROC_ENV:", process.env.PAYROC_ENV);
  console.log("PAYROC_API_URL:", process.env.PAYROC_API_URL);
  console.log("PAYROC_AUTH_URL:", process.env.PAYROC_AUTH_URL);
  console.log("PAYROC_TERMINAL_ID:", process.env.PAYROC_TERMINAL_ID);
  console.log("PAYROC_API_KEY set:", !!process.env.PAYROC_API_KEY);
  console.log("PAYROC_SESSION_HOST:", process.env.PAYROC_SESSION_HOST || "(not set)");
  console.log("==================================");

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionCreatedAt = Date.now();
    const result = await getHostedFieldsSessionToken("tokenization");
    const config = getHostedFieldsConfig();

    console.log("[SESSION-DEBUG] Token received in", Date.now() - sessionCreatedAt, "ms");
    console.log("[SESSION-DEBUG] Token length:", result.token?.length);
    console.log("[SESSION-DEBUG] Token prefix:", result.token?.substring(0, 30));
    console.log("[SESSION-DEBUG] Expires at:", result.expiresAt);
    console.log("[SESSION-DEBUG] SDK URL:", config.url);
    console.log("[SESSION-DEBUG] Integrity hash:", config.integrityHash?.substring(0, 20));

    return NextResponse.json({
      sessionToken: result.token,
      expiresAt: result.expiresAt,
      terminalId: process.env.PAYROC_TERMINAL_ID,
      libUrl: config.url,
      integrity: config.integrityHash,
      _sessionCreatedAt: sessionCreatedAt,
      _diag: {
        sessionHost:
          process.env.PAYROC_SESSION_HOST ||
          process.env.PAYROC_API_URL,
        gatewayHost:
          process.env.PAYROC_GATEWAY_HOST ||
          "https://testpayments.worldnettps.com",
        tokenLength: result.token?.length,
      },
    });
  } catch (error) {
    console.error("[SESSION] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
