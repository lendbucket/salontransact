import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { buildStatementData } from "@/lib/statements/aggregator";
import { buildStatementPdf, statementFilename } from "@/lib/statements/builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTH_REGEX = /^(\d{4})-(\d{2})$/;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const merchantIdParam = url.searchParams.get("merchantId") ?? "";
  if (merchantIdParam.length === 0) {
    return NextResponse.json({ error: "merchantId parameter required" }, { status: 400 });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantIdParam },
    select: { id: true },
  });
  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  const monthParam = url.searchParams.get("month") ?? "";
  const match = monthParam.match(MONTH_REGEX);
  if (!match) {
    return NextResponse.json({ error: "month parameter required in YYYY-MM format" }, { status: 400 });
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  const data = await buildStatementData({ merchantId: merchant.id, year, month });
  if (!data) {
    return NextResponse.json({ error: "Could not build statement" }, { status: 500 });
  }

  const pdfBuffer = buildStatementPdf(data);
  const filename = statementFilename(data);

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "statement.download",
    targetType: "Statement",
    targetId: `${merchant.id}:${year}-${month.toString().padStart(2, "0")}`,
    merchantId: merchant.id,
    metadata: { year, month, totalVolumeCents: data.summary.totalVolumeCents, transactionCount: data.summary.transactionCount, asMaster: true },
  });

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBuffer.length.toString(),
    },
  });
}
