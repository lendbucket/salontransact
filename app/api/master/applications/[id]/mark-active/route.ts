import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  payrocMid?: unknown;
  internalNotes?: unknown;
}

export async function POST(
  request: Request,
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

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payrocMid = typeof body.payrocMid === "string" ? body.payrocMid.trim() : "";
  if (payrocMid.length === 0) {
    return NextResponse.json({ error: "payrocMid is required" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]{4,40}$/.test(payrocMid)) {
    return NextResponse.json({ error: "payrocMid must be 4-40 alphanumeric characters" }, { status: 400 });
  }

  const internalNotes =
    typeof body.internalNotes === "string" && body.internalNotes.trim().length > 0
      ? body.internalNotes.trim().slice(0, 1000)
      : null;

  const application = await prisma.merchantApplication.findUnique({ where: { id } });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (application.status !== "submitted_to_payroc") {
    return NextResponse.json(
      { error: `Cannot mark active — application is currently '${application.status}'. Only submitted_to_payroc applications can be marked active.` },
      { status: 409 }
    );
  }

  const now = new Date();

  const updated = await prisma.merchantApplication.update({
    where: { id },
    data: {
      status: "active",
      payrocActivatedAt: now,
      payrocActivatedById: user.id,
      payrocActivatedByEmail: user.email ?? "",
      payrocMid,
      ...(internalNotes
        ? {
            internalNotes: application.internalNotes
              ? `${application.internalNotes}\n\n[Mark Active] ${internalNotes}`
              : `[Mark Active] ${internalNotes}`,
          }
        : {}),
    },
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "application.mark_active",
    targetType: "MerchantApplication",
    targetId: id,
    merchantId: null,
    metadata: {
      legalBusinessName: application.legalBusinessName,
      ownerEmail: application.ownerEmail,
      previousStatus: application.status,
      newStatus: "active",
      payrocMid,
      notes: internalNotes,
    },
  });

  return NextResponse.json({
    ok: true,
    application: {
      id: updated.id,
      status: updated.status,
      payrocActivatedAt: updated.payrocActivatedAt?.toISOString() ?? null,
      payrocActivatedByEmail: updated.payrocActivatedByEmail,
      payrocMid: updated.payrocMid,
    },
  });
}
