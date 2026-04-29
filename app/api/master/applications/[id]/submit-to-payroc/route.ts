import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
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
    // body is optional
  }

  const internalNotes =
    typeof body.internalNotes === "string" && body.internalNotes.trim().length > 0
      ? body.internalNotes.trim().slice(0, 1000)
      : null;

  const application = await prisma.merchantApplication.findUnique({ where: { id } });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (application.status !== "approved") {
    return NextResponse.json(
      { error: `Cannot submit to Payroc — application is currently '${application.status}'. Only approved applications can be submitted.` },
      { status: 409 }
    );
  }

  const now = new Date();

  const updated = await prisma.merchantApplication.update({
    where: { id },
    data: {
      status: "submitted_to_payroc",
      payrocSubmittedAt: now,
      payrocSubmittedById: user.id,
      payrocSubmittedByEmail: user.email ?? "",
      ...(internalNotes
        ? {
            internalNotes: application.internalNotes
              ? `${application.internalNotes}\n\n[Submit to Payroc] ${internalNotes}`
              : `[Submit to Payroc] ${internalNotes}`,
          }
        : {}),
    },
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "application.submit_to_payroc",
    targetType: "MerchantApplication",
    targetId: id,
    merchantId: null,
    metadata: {
      legalBusinessName: application.legalBusinessName,
      ownerEmail: application.ownerEmail,
      previousStatus: application.status,
      newStatus: "submitted_to_payroc",
      notes: internalNotes,
    },
  });

  return NextResponse.json({
    ok: true,
    application: {
      id: updated.id,
      status: updated.status,
      payrocSubmittedAt: updated.payrocSubmittedAt?.toISOString() ?? null,
      payrocSubmittedByEmail: updated.payrocSubmittedByEmail,
    },
  });
}
