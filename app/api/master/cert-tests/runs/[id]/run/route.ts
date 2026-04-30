import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getDispatchEntry } from "@/lib/cert/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireMaster();
  const { id } = await params;

  const run = await prisma.certTestRun.findUnique({
    where: { id },
    include: { session: true },
  });
  if (!run) {
    return NextResponse.json({ error: "Test run not found" }, { status: 404 });
  }

  if (run.status === "running") {
    return NextResponse.json({ error: "Test is already running" }, { status: 409 });
  }

  const dispatch = getDispatchEntry(run.testCaseId);
  if (dispatch.kind !== "auto") {
    return NextResponse.json(
      { error: `This test requires manual entry: ${dispatch.reason}` },
      { status: 422 }
    );
  }

  if (!run.session.merchantId || !run.session.apiKeyId) {
    return NextResponse.json(
      { error: "Session is missing merchantId or apiKeyId." },
      { status: 400 }
    );
  }

  await prisma.certTestRun.update({
    where: { id },
    data: { status: "running" },
  });

  // Look up previousPaymentId for chained tests (capture/void/refund need it)
  let previousPaymentId: string | null = null;
  const needsPrevious =
    run.transactionType.toLowerCase().includes("capture") ||
    run.transactionType.toLowerCase().includes("void") ||
    run.transactionType.toLowerCase().includes("reversal") ||
    run.transactionType.toLowerCase().includes("refund");

  if (needsPrevious) {
    const previous = await prisma.certTestRun.findFirst({
      where: {
        sessionId: run.sessionId,
        sectionName: run.sectionName,
        status: "passed",
        paymentId: { not: null },
        id: { not: run.id },
      },
      orderBy: { ranAt: "desc" },
      select: { paymentId: true },
    });
    previousPaymentId = previous?.paymentId ?? null;
  }

  try {
    const result = await dispatch.run({
      sessionId: run.sessionId,
      merchantId: run.session.merchantId,
      apiKeyId: run.session.apiKeyId,
      testRunId: run.id,
      terminalSerial: run.session.terminalSerial,
      previousPaymentId,
    });

    await prisma.certTestRun.update({
      where: { id },
      data: {
        status: result.status,
        paymentId: result.paymentId,
        notes: result.notes,
        errorMessage: result.errorMessage,
        ranAt: new Date(),
      },
    });

    const counts = await prisma.certTestRun.groupBy({
      by: ["status"],
      where: { sessionId: run.sessionId },
      _count: true,
    });
    const passed = counts.find((c) => c.status === "passed")?._count ?? 0;
    const failed = counts.find((c) => c.status === "failed")?._count ?? 0;
    const skipped = counts.find((c) => c.status === "skipped")?._count ?? 0;

    await prisma.certTestSession.update({
      where: { id: run.sessionId },
      data: { passedTests: passed, failedTests: failed, skippedTests: skipped },
    });

    return NextResponse.json({
      status: result.status,
      paymentId: result.paymentId,
      notes: result.notes,
      errorMessage: result.errorMessage,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    await prisma.certTestRun.update({
      where: { id },
      data: { status: "failed", errorMessage: `Executor error: ${errorMessage}`, ranAt: new Date() },
    });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
