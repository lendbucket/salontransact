import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { payrocRefundRequest } from "@/lib/refunds/payroc-helper";
import type { PayrocBatch } from "@/lib/settlements/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal" && user.role !== "merchant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { batchId } = await params;
  if (!batchId || batchId.length < 1 || batchId.length > 100) {
    return NextResponse.json({ error: "invalid batchId" }, { status: 400 });
  }

  const result = await payrocRefundRequest<PayrocBatch>(
    "GET",
    `/batches/${encodeURIComponent(batchId)}`,
    undefined,
    null
  );

  if (!result.ok || !result.data) {
    return NextResponse.json(
      {
        error: "Failed to fetch batch from SalonTransact",
        status: result.status,
        detail: result.rawBody.slice(0, 500),
      },
      {
        status:
          result.status >= 400 && result.status < 600 ? result.status : 502,
      }
    );
  }

  return NextResponse.json(result.data);
}
