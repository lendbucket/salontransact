import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

  if (user.role === "master portal") {
    const rows = await prisma.refundOperation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        operation: true,
        payrocPaymentId: true,
        payrocRefundId: true,
        amountCents: true,
        description: true,
        operatorEmail: true,
        status: true,
        payrocStatusCode: true,
        errorMessage: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ rows });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!merchant) {
    return NextResponse.json({ rows: [] });
  }

  const txs = await prisma.transaction.findMany({
    where: { merchantId: merchant.id },
    select: { metadata: true },
  });

  const merchantPaymentIds: string[] = [];
  for (const tx of txs) {
    const meta = tx.metadata as { payrocPaymentId?: string } | null;
    if (meta?.payrocPaymentId) {
      merchantPaymentIds.push(meta.payrocPaymentId);
    }
  }

  if (merchantPaymentIds.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  const rows = await prisma.refundOperation.findMany({
    where: {
      payrocPaymentId: { in: merchantPaymentIds },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      operation: true,
      payrocPaymentId: true,
      payrocRefundId: true,
      amountCents: true,
      description: true,
      operatorEmail: true,
      status: true,
      payrocStatusCode: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ rows });
}
