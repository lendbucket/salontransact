import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ALL_TEST_CASES } from "@/lib/cert/test-cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { userId } = await requireMaster();

  let body: { name?: unknown; description?: unknown; merchantId?: unknown; apiKeyId?: unknown; terminalSerial?: unknown };
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
  if (typeof body.merchantId !== "string" || body.merchantId.length === 0) {
    return NextResponse.json({ error: "merchantId is required" }, { status: 400 });
  }
  if (typeof body.apiKeyId !== "string" || body.apiKeyId.length === 0) {
    return NextResponse.json({ error: "apiKeyId is required" }, { status: 400 });
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: body.apiKeyId },
    select: { id: true, merchantId: true, active: true },
  });
  if (!apiKey || apiKey.merchantId !== body.merchantId || !apiKey.active) {
    return NextResponse.json({ error: "API key does not match merchant or is inactive" }, { status: 400 });
  }

  const name = body.name.trim().slice(0, 200);
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : null;
  const merchantId = body.merchantId;
  const apiKeyId = body.apiKeyId;
  let terminalSerial: string | null = null;
  if (typeof body.terminalSerial === "string" && body.terminalSerial.trim().length > 0) {
    terminalSerial = body.terminalSerial.trim().slice(0, 50);
    const device = await prisma.device.findUnique({
      where: { serialNumber: terminalSerial },
      select: { merchantId: true, status: true },
    });
    if (!device || device.merchantId !== merchantId) {
      return NextResponse.json({ error: "Terminal serial does not belong to chosen merchant" }, { status: 400 });
    }
    if (device.status !== "active") {
      return NextResponse.json({ error: `Terminal is ${device.status}, must be active` }, { status: 400 });
    }
  }

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.certTestSession.create({
      data: {
        name,
        description,
        status: "in_progress",
        merchantId,
        apiKeyId,
        terminalSerial,
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
