import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api/v1/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const response = NextResponse.json({
    apiKey: {
      id: auth.apiKey.id,
      name: auth.apiKey.name,
      keyPrefix: auth.apiKey.keyPrefix,
    },
    merchant: {
      id: auth.merchant.id,
      businessName: auth.merchant.businessName,
      email: auth.merchant.email,
    },
  });

  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
