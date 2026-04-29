import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { getInviteExpiresAt } from "@/lib/merchant-invites/generate";
import { buildInviteEmail } from "@/lib/merchant-invites/email-template";
import { RESEND_FROM } from "@/lib/email/sender";
import type {
  MerchantInviteListResponse,
  MerchantInvitePublic,
  InviteStatus,
} from "@/lib/merchant-invites/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  email?: unknown;
  businessName?: unknown;
  note?: unknown;
}

function rowToPublic(row: {
  id: string;
  email: string;
  businessName: string;
  note: string | null;
  invitedByEmail: string;
  status: string;
  acceptedAt: Date | null;
  applicationId: string | null;
  expiresAt: Date;
  createdAt: Date;
}): MerchantInvitePublic {
  const isExpiredNow =
    row.status === "pending" && row.expiresAt < new Date();
  return {
    id: row.id,
    email: row.email,
    businessName: row.businessName,
    note: row.note,
    invitedByEmail: row.invitedByEmail,
    status: row.status as InviteStatus,
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    applicationId: row.applicationId,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    isExpiredNow,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.merchantInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const data = rows.map(rowToPublic);
  const response: MerchantInviteListResponse = {
    data,
    count: data.length,
    pendingCount: data.filter(
      (i) => i.status === "pending" && !i.isExpiredNow
    ).length,
  };
  return NextResponse.json(response);
}

export async function POST(request: Request) {
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

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  if (typeof body.businessName !== "string" || body.businessName.trim().length === 0) {
    return NextResponse.json({ error: "businessName required" }, { status: 400 });
  }
  if (body.businessName.trim().length > 200) {
    return NextResponse.json({ error: "businessName too long" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const businessName = body.businessName.trim();
  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 500)
      : null;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "A SalonTransact account with this email already exists" },
      { status: 409 }
    );
  }

  const existingInvite = await prisma.merchantInvite.findFirst({
    where: {
      email,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
  });
  if (existingInvite) {
    return NextResponse.json(
      { error: "A pending invite already exists for this email. Resend or revoke it first." },
      { status: 409 }
    );
  }

  const invite = await prisma.merchantInvite.create({
    data: {
      email,
      businessName,
      note,
      invitedById: user.id,
      invitedByEmail: user.email ?? "",
      status: "pending",
      expiresAt: getInviteExpiresAt(),
    },
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://portal.salontransact.com";
  const inviteUrl = `${baseUrl}/master-invite/${invite.token}`;

  const { subject, html } = buildInviteEmail({
    recipientEmail: email,
    businessName,
    inviterEmail: user.email ?? "",
    inviteUrl,
    baseUrl,
    note,
    expiresAt: invite.expiresAt,
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
          to: email,
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
    action: "merchant_invite.create",
    targetType: "MerchantInvite",
    targetId: invite.id,
    merchantId: null,
    metadata: {
      email,
      businessName,
      hasNote: note !== null,
      emailSent,
      emailError,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      invite: rowToPublic(invite),
      inviteUrl,
      emailSent,
      emailError,
    },
    { status: 201 }
  );
}
