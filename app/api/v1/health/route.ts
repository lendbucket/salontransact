import { NextResponse } from "next/server";
import { generateRequestId } from "@/lib/api/v1/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = generateRequestId();
  const response = NextResponse.json({
    ok: true,
    version: "2026-04-29",
    service: "salontransact-engine",
  });
  response.headers.set("X-Request-ID", requestId);
  return response;
}
