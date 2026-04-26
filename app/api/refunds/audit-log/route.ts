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

  if (!user || user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
