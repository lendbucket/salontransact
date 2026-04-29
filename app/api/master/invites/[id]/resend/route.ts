import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { getInviteExpiresAt } from "@/lib/merchant-invites/generate";
import { buildInviteEmail } from "@/lib/merchant-invites/email-template";
import { RESEND_FROM } from "@/lib/email/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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

  const invite = await prisma.merchantInvite.findUnique({ where: { id } });
  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invite.status === "accepted") {
    return NextResponse.json(
      { error: "Invite already accepted" },
      { status: 410 }
    );
  }
  if (invite.status === "revoked") {
    return NextResponse.json(
      { error: "Invite was revoked. Create a new one." },
      { status: 410 }
    );
  }

  const newExpiresAt = getInviteExpiresAt();
  await prisma.merchantInvite.update({
    where: { id: invite.id },
    data: { status: "pending", expiresAt: newExpiresAt },
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://portal.salontransact.com";
  const inviteUrl = `${baseUrl}/master-invite/${invite.token}`;

  const { subject, html } = buildInviteEmail({
    recipientEmail: invite.email,
    businessName: invite.businessName,
    inviterEmail: user.email ?? "",
    inviteUrl,
    baseUrl,
    note: invite.note,
    expiresAt: newExpiresAt,
  });

  const apiKey = process.env.RESEND_API_KEY;
  let emailSent = false;
  let emailError: string | null = null;

  if (!apiKey) {
    emailError = "RESEND_API_KEY not set";
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: invite.email,
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
    action: "merchant_invite.resend",
    targetType: "MerchantInvite",
    targetId: invite.id,
    merchantId: null,
    metadata: {
      email: invite.email,
      businessName: invite.businessName,
      newExpiresAt: newExpiresAt.toISOString(),
      emailSent,
      emailError,
    },
  });

  return NextResponse.json({ ok: true, emailSent, emailError });
}
