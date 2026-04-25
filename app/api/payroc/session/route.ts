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

    const result = await getHostedFieldsSessionToken("payment");
    const config = getHostedFieldsConfig();

    console.log(
      "[SESSION] Returning token:",
      result.token ? result.token.slice(0, 20) + "..." : "MISSING",
      "expiresAt:",
      result.expiresAt
    );

    return NextResponse.json({
      sessionToken: result.token,
      expiresAt: result.expiresAt,
      terminalId: process.env.PAYROC_TERMINAL_ID,
      libUrl: config.url,
      integrity: config.integrityHash,
      _diag: {
        sessionHost:
          process.env.PAYROC_SESSION_HOST ||
          process.env.PAYROC_API_URL,
        gatewayHost:
          process.env.PAYROC_GATEWAY_HOST ||
          "https://testpayments.worldnettps.com",
      },
    });
  } catch (error) {
    console.error("[SESSION] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
