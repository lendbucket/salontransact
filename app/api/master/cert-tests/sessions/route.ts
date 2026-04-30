import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ALL_TEST_CASES } from "@/lib/cert/test-cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { userId } = await requireMaster();

  let body: { name?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (body.description !== undefined && typeof body.description !== "string") {
    return NextResponse.json({ error: "description must be a string" }, { status: 400 });
  }

  const name = body.name.trim().slice(0, 200);
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : null;

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.certTestSession.create({
      data: {
        name,
        description,
        status: "in_progress",
        createdByUserId: userId,
        totalTests: ALL_TEST_CASES.length,
      },
    });

    await tx.certTestRun.createMany({
      data: ALL_TEST_CASES.map((tc) => ({
        sessionId: created.id,
        testCaseId: tc.id,
        sheetName: tc.sheetName,
        sectionName: tc.sectionName,
        transactionType: tc.transactionType,
        scenario: tc.scenario,
        expectedResult: tc.expectedResult,
        required: tc.required,
        status: "pending",
      })),
    });

    return created;
  });

  return NextResponse.json({ id: session.id }, { status: 201 });
}
