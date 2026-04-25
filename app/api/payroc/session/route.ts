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

    return NextResponse.json({
      sessionToken: result.token,
      expiresAt: result.expiresAt,
      terminalId: process.env.PAYROC_TERMINAL_ID,
      libUrl: config.url,
      integrity: config.integrityHash,
    });
  } catch (error) {
    console.error("[PAYROC-SESSION] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
