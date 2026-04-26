import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { payrocRefundRequest } from "@/lib/refunds/payroc-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const dateFrom = encodeURIComponent(from.toISOString());
  const dateTo = encodeURIComponent(now.toISOString());

  // 1. GET /batches
  console.log("[SETTLEMENTS-PROBE] Fetching batches...");
  const batchesResult = await payrocRefundRequest<unknown>(
    "GET",
    `/batches?limit=5&dateFrom=${dateFrom}&dateTo=${dateTo}`,
    undefined,
    null
  );
  console.log(
    "[SETTLEMENTS-PROBE] Batches status:",
    batchesResult.status,
    "ok:",
    batchesResult.ok
  );
  console.log("[SETTLEMENTS-PROBE] Batches body:", batchesResult.rawBody);

  // 2. GET /batches/{id} for the first batch if available
  let singleBatchResult = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batchesData = batchesResult.data as any;
  const firstBatchId =
    batchesData?.data?.[0]?.batchId ??
    batchesData?.data?.[0]?.id ??
    null;

  if (firstBatchId) {
    console.log(
      "[SETTLEMENTS-PROBE] Fetching single batch:",
      firstBatchId
    );
    const single = await payrocRefundRequest<unknown>(
      "GET",
      `/batches/${firstBatchId}`,
      undefined,
      null
    );
    console.log(
      "[SETTLEMENTS-PROBE] Single batch status:",
      single.status,
      "ok:",
      single.ok
    );
    console.log("[SETTLEMENTS-PROBE] Single batch body:", single.rawBody);
    singleBatchResult = {
      status: single.status,
      ok: single.ok,
      data: single.data,
      rawBody: single.rawBody.slice(0, 2000),
    };
  }

  // 3. GET /transactions
  console.log("[SETTLEMENTS-PROBE] Fetching transactions...");
  const txResult = await payrocRefundRequest<unknown>(
    "GET",
    `/transactions?limit=5&dateFrom=${dateFrom}&dateTo=${dateTo}`,
    undefined,
    null
  );
  console.log(
    "[SETTLEMENTS-PROBE] Transactions status:",
    txResult.status,
    "ok:",
    txResult.ok
  );
  console.log("[SETTLEMENTS-PROBE] Transactions body:", txResult.rawBody);

  return NextResponse.json({
    batches: {
      status: batchesResult.status,
      ok: batchesResult.ok,
      data: batchesResult.data,
      rawBody: batchesResult.rawBody.slice(0, 2000),
    },
    singleBatch: singleBatchResult,
    transactions: {
      status: txResult.status,
      ok: txResult.ok,
      data: txResult.data,
      rawBody: txResult.rawBody.slice(0, 2000),
    },
  });
}
