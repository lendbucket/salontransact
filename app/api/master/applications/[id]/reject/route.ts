import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { buildRejectionEmail } from "@/lib/applications/email-templates";
import { RESEND_FROM } from "@/lib/email/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  reason?: unknown;
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
    // empty body acceptable
  }

  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 500)
      : null;
  const internalNotes =
    typeof body.internalNotes === "string" && body.internalNotes.trim().length > 0
      ? body.internalNotes.trim().slice(0, 1000)
      : null;

  const application = await prisma.merchantApplication.findUnique({
    where: { id },
  });
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (application.status !== "submitted") {
    return NextResponse.json(
      { error: `Cannot reject application with status '${application.status}'` },
      { status: 410 }
    );
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.merchantApplication.update({
      where: { id: application.id },
      data: {
        status: "rejected",
        rejectedAt: now,
        rejectedById: user.id,
        rejectedByEmail: user.email ?? "",
        rejectionReason: reason,
        internalNotes: internalNotes ?? application.internalNotes,
      },
    });

    await tx.user.update({
      where: { id: application.userId },
      data: { approvalStatus: "rejected" },
    });
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://portal.salontransact.com";

  let emailSent = false;
  let emailError: string | null = null;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    emailError = "RESEND_API_KEY not set";
  } else {
    try {
      const { subject, html } = buildRejectionEmail({
        recipientEmail: application.ownerEmail,
        businessName: application.legalBusinessName,
        baseUrl,
        reason,
      });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: application.ownerEmail,
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        emailError = `Resend ${res.status}: ${t.slice(0, 200)}`;
      } else {
        emailSent = true;
      }
    } catch (e) {
      emailError = e instanceof Error ? e.message : "send failed";
    }
  }

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "application.reject",
    targetType: "MerchantApplication",
    targetId: application.id,
    merchantId: null,
    metadata: {
      applicantEmail: application.ownerEmail,
      businessName: application.legalBusinessName,
      hasReason: reason !== null,
      hasInternalNotes: internalNotes !== null,
      emailSent,
      emailError,
    },
  });

  return NextResponse.json({
    ok: true,
    emailSent,
    emailError,
  });
}
