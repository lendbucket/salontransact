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
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const row = await prisma.merchantInvite.findUnique({
    where: { id },
    select: { id: true, status: true, email: true, businessName: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot revoke invite with status '${row.status}'` },
      { status: 410 }
    );
  }

  await prisma.merchantInvite.update({
    where: { id: row.id },
    data: { status: "revoked" },
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "merchant_invite.revoke",
    targetType: "MerchantInvite",
    targetId: row.id,
    merchantId: null,
    metadata: {
      email: row.email,
      businessName: row.businessName,
    },
  });

  return NextResponse.json({ ok: true });
}
