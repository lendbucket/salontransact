import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getDispatchEntry, resolvePrereq } from "@/lib/cert/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  await requireMaster();
  const { sessionId } = await params;

  let body: { sheetName?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sheetName = body.sheetName;
  if (sheetName !== "CNP" && sheetName !== "CP") {
    return NextResponse.json(
      { error: "sheetName must be 'CNP' or 'CP'" },
      { status: 400 }
    );
  }

  const session = await prisma.certTestSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (!session.merchantId || !session.apiKeyId) {
    return NextResponse.json(
      { error: "Session is missing merchantId or apiKeyId" },
      { status: 400 }
    );
  }

  const pendingRuns = await prisma.certTestRun.findMany({
    where: {
      sessionId,
      sheetName,
      status: "pending",
    },
    orderBy: [{ sectionName: "asc" }, { createdAt: "asc" }],
  });

  let executed = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const results: Array<{ testCaseId: string; status: string; paymentId: string | null }> = [];
  const consumedIds = new Set<string>();

  for (const run of pendingRuns) {
    const dispatch = getDispatchEntry(run.testCaseId);

    if (dispatch.kind !== "auto") {
      await prisma.certTestRun.update({
        where: { id: run.id },
        data: {
          status: "skipped",
          notes: `Auto-skipped (manual entry required): ${dispatch.reason}`,
          ranAt: new Date(),
        },
      });
      skipped += 1;
      results.push({ testCaseId: run.testCaseId, status: "skipped", paymentId: null });
      continue;
    }

    const prereq = await resolvePrereq(
      prisma,
      run.testCaseId,
      run.sessionId,
      run.sheetName,
      run.sectionName,
      consumedIds
    );
    if (prereq) consumedIds.add(prereq.id);
    const previousPaymentId = prereq?.paymentId ?? null;

    await prisma.certTestRun.update({
      where: { id: run.id },
      data: { status: "running" },
    });

    try {
      const result = await dispatch.run({
        sessionId: run.sessionId,
        merchantId: session.merchantId,
        apiKeyId: session.apiKeyId,
        testRunId: run.id,
        terminalSerial: session.terminalSerial,
        previousPaymentId,
      });

      await prisma.certTestRun.update({
        where: { id: run.id },
        data: {
          status: result.status,
          paymentId: result.paymentId,
          notes: result.notes,
          errorMessage: result.errorMessage,
          ranAt: new Date(),
        },
      });

      if (result.status === "passed") passed += 1;
      else failed += 1;
      results.push({ testCaseId: run.testCaseId, status: result.status, paymentId: result.paymentId });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      await prisma.certTestRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          errorMessage: `Batch executor error: ${errorMessage}`,
          ranAt: new Date(),
        },
      });
      failed += 1;
      results.push({ testCaseId: run.testCaseId, status: "failed", paymentId: null });
    }

    executed += 1;

    // 500ms delay between tests for Payroc UAT politeness
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const counts = await prisma.certTestRun.groupBy({
    by: ["status"],
    where: { sessionId },
    _count: true,
  });
  const totalPassed = counts.find((c) => c.status === "passed")?._count ?? 0;
  const totalFailed = counts.find((c) => c.status === "failed")?._count ?? 0;
  const totalSkipped = counts.find((c) => c.status === "skipped")?._count ?? 0;

  await prisma.certTestSession.update({
    where: { id: sessionId },
    data: {
      passedTests: totalPassed,
      failedTests: totalFailed,
      skippedTests: totalSkipped,
    },
  });

  return NextResponse.json({
    sheetName,
    executed,
    passed,
    failed,
    skipped,
    sessionTotals: { passed: totalPassed, failed: totalFailed, skipped: totalSkipped },
    results,
  });
}
