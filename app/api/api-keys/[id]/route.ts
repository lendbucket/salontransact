import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  const row = await prisma.apiKey.findUnique({
    where: { id },
    select: { id: true, merchantId: true, active: true, name: true, keyPrefix: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Authorization check
  if (user.role === "merchant") {
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!merchant || merchant.id !== row.merchantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!row.active) {
    return NextResponse.json(
      { error: "Already revoked" },
      { status: 410 }
    );
  }

  await prisma.apiKey.update({
    where: { id: row.id },
    data: { active: false },
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "api_key.revoke",
    targetType: "ApiKey",
    targetId: row.id,
    merchantId: row.merchantId,
    metadata: {
      name: row.name,
      keyPrefix: row.keyPrefix,
    },
  });

  return NextResponse.json({ ok: true });
}
