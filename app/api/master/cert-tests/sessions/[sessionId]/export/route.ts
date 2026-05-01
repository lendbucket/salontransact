import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildExportXlsx } from "@/lib/cert/spreadsheet-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  await requireMaster();
  const { sessionId } = await params;

  const session = await prisma.certTestSession.findUnique({
    where: { id: sessionId },
    select: { id: true, name: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const runs = await prisma.certTestRun.findMany({
    where: { sessionId },
    select: {
      id: true,
      sheetName: true,
      sectionName: true,
      transactionType: true,
      scenario: true,
      status: true,
      paymentId: true,
      notes: true,
      errorMessage: true,
      ranAt: true,
    },
  });

  const { buffer, filename } = await buildExportXlsx(runs, session.name);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
