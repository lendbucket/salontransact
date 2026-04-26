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

  // 1. GET /batches — no params
  console.log("[SETTLEMENTS-PROBE] Fetching /batches (no params)...");
  const batchesNoParams = await payrocRefundRequest<unknown>(
    "GET",
    "/batches",
    undefined,
    null
  );
  console.log("[SETTLEMENTS-PROBE] /batches no params status:", batchesNoParams.status);
  console.log("[SETTLEMENTS-PROBE] /batches no params body:", batchesNoParams.rawBody);

  // 2. GET /batches?limit=5 — limit only
  console.log("[SETTLEMENTS-PROBE] Fetching /batches?limit=5...");
  const batchesLimitOnly = await payrocRefundRequest<unknown>(
    "GET",
    "/batches?limit=5",
    undefined,
    null
  );
  console.log("[SETTLEMENTS-PROBE] /batches limit=5 status:", batchesLimitOnly.status);
  console.log("[SETTLEMENTS-PROBE] /batches limit=5 body:", batchesLimitOnly.rawBody);

  // 3. GET /batches/{id} — drill into first batch from limit-only call
  let singleBatchResult = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const limitData = batchesLimitOnly.data as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noParamData = batchesNoParams.data as any;
  const firstBatchId =
    limitData?.data?.[0]?.batchId ??
    limitData?.data?.[0]?.id ??
    noParamData?.data?.[0]?.batchId ??
    noParamData?.data?.[0]?.id ??
    null;

  if (firstBatchId) {
    console.log("[SETTLEMENTS-PROBE] Fetching /batches/" + firstBatchId);
    const single = await payrocRefundRequest<unknown>(
      "GET",
      `/batches/${firstBatchId}`,
      undefined,
      null
    );
    console.log("[SETTLEMENTS-PROBE] Single batch status:", single.status);
    console.log("[SETTLEMENTS-PROBE] Single batch body:", single.rawBody);
    singleBatchResult = {
      status: single.status,
      ok: single.ok,
      data: single.data,
      rawBody: single.rawBody.slice(0, 2000),
    };
  }

  // 4. GET /transactions — no params
  console.log("[SETTLEMENTS-PROBE] Fetching /transactions (no params)...");
  const txNoParams = await payrocRefundRequest<unknown>(
    "GET",
    "/transactions",
    undefined,
    null
  );
  console.log("[SETTLEMENTS-PROBE] /transactions no params status:", txNoParams.status);
  console.log("[SETTLEMENTS-PROBE] /transactions no params body:", txNoParams.rawBody);

  return NextResponse.json({
    batchesNoParams: {
      status: batchesNoParams.status,
      ok: batchesNoParams.ok,
      data: batchesNoParams.data,
      rawBody: batchesNoParams.rawBody.slice(0, 2000),
    },
    batchesLimitOnly: {
      status: batchesLimitOnly.status,
      ok: batchesLimitOnly.ok,
      data: batchesLimitOnly.data,
      rawBody: batchesLimitOnly.rawBody.slice(0, 2000),
    },
    singleBatch: singleBatchResult,
    transactionsNoParams: {
      status: txNoParams.status,
      ok: txNoParams.ok,
      data: txNoParams.data,
      rawBody: txNoParams.rawBody.slice(0, 2000),
    },
  });
}
