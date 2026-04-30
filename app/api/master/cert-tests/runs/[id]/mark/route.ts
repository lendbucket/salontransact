import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireMaster();
  const { id } = await params;

  let body: { status?: unknown; paymentId?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.status !== "passed" && body.status !== "failed" && body.status !== "skipped") {
    return NextResponse.json({ error: "status must be passed | failed | skipped" }, { status: 400 });
  }

  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim().slice(0, 200) : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null;

  const run = await prisma.certTestRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  await prisma.certTestRun.update({
    where: { id },
    data: { status: body.status, paymentId, notes, ranAt: new Date() },
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

  return NextResponse.json({ status: body.status, paymentId, notes });
}
