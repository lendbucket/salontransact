import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { deleteContractFile } from "@/lib/supabase/storage";
import { canDeleteContract, type AuthedUser } from "@/lib/contracts/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthedUser(): Promise<AuthedUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;
  if (!u || !u.id) return null;
  return { id: u.id, email: u.email ?? "", role: u.role ?? "" };
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const row = await prisma.contract.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await canDeleteContract(user, row))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let storageError: string | null = null;
  try {
    await deleteContractFile(row.storagePath);
  } catch (e) {
    storageError = e instanceof Error ? e.message : "delete failed";
  }

  await prisma.contract.delete({ where: { id: row.id } });

  await writeAuditLog({
    actor: { id: user.id, email: user.email, role: user.role },
    action: "contract.delete",
    targetType: "Contract",
    targetId: row.id,
    merchantId: row.merchantId,
    metadata: {
      fileName: row.fileName,
      docType: row.docType,
      storageDeleted: storageError === null,
      storageError,
    },
  });

  return NextResponse.json({ ok: true, storageDeleted: storageError === null });
}
