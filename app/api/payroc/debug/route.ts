import { NextResponse } from "next/server";
import { getHostedFieldsConfig } from "@/lib/payroc/hosted-fields";

export async function GET() {
  // Only available in non-production environments
  if (process.env.NODE_ENV === "production" && process.env.PAYROC_ENV !== "uat") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const config = getHostedFieldsConfig();

  return NextResponse.json({
    sessionHost:
      process.env.PAYROC_SESSION_HOST ||
      process.env.PAYROC_API_URL ||
      "(not set)",
    gatewayHost:
      process.env.PAYROC_GATEWAY_HOST ||
      "https://testpayments.worldnettps.com (default)",
    terminalId: process.env.PAYROC_TERMINAL_ID || "(not set)",
    sdkUrl: config.url,
    sdkIntegrity: config.integrityHash,
    hasApiKey: !!process.env.PAYROC_API_KEY,
    authUrl: process.env.PAYROC_AUTH_URL || "(not set)",
    env: process.env.PAYROC_ENV || "(not set)",
  });
}
