import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { getSignedDownloadUrl } from "@/lib/supabase/storage";
import {
  canViewContractsForMerchant,
  type AuthedUser,
} from "@/lib/contracts/permissions";

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

export async function GET(
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

  if (!(await canViewContractsForMerchant(user, row.merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let signedUrl: string;
  try {
    signedUrl = await getSignedDownloadUrl(row.storagePath);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Signed URL failed" },
      { status: 502 }
    );
  }

  await writeAuditLog({
    actor: { id: user.id, email: user.email, role: user.role },
    action: "contract.download",
    targetType: "Contract",
    targetId: row.id,
    merchantId: row.merchantId,
    metadata: {
      fileName: row.fileName,
      docType: row.docType,
    },
  });

  return NextResponse.json({ url: signedUrl, expiresInSeconds: 60 * 60 });
}
