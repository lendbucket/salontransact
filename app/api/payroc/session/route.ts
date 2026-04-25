import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHostedFieldsSessionToken } from "@/lib/payroc/client";
import { getHostedFieldsConfig } from "@/lib/payroc/hosted-fields";

export async function GET() {
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
      integrity: "", // Temporarily removed for debugging — integrity mismatch blocks script loading
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
