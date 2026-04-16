import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ADMIN_EMAIL } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function inviteEmailHtml(token: string, email: string): string {
  const url = `${process.env.NEXTAUTH_URL}/invite/${token}`
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:40px;height:40px;background:#635bff;border-radius:10px;line-height:40px;text-align:center;">
        <span style="color:#fff;font-weight:700;font-size:16px;">ST</span>
      </div>
      <span style="color:#fff;font-weight:600;font-size:18px;margin-left:12px;vertical-align:middle;">SalonTransact</span>
    </div>
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:40px;text-align:center;">
      <h1 style="color:#fff;font-size:28px;font-weight:700;margin:0 0 16px;">You've been invited</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 32px;">
        Robert Reyna has invited you to join SalonTransact — the payment platform built for salon businesses.
      </p>
      <a href="${url}" style="display:block;background:#635bff;color:#fff;text-decoration:none;padding:16px;border-radius:12px;font-weight:600;font-size:15px;">
        Accept Invitation →
      </a>
      <p style="color:#6b7280;font-size:12px;margin:16px 0 0;word-break:break-all;">${url}</p>
      <p style="color:#6b7280;font-size:13px;margin:24px 0 0;">This invitation expires in 7 days.</p>
    </div>
    <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:32px;">
      SalonTransact by Reyna Pay LLC · salontransact.com
    </p>
  </div>
</body>
</html>`
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (session?.user?.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const email = (body.email as string)?.trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return Response.json({ error: 'Account already exists' }, { status: 409 })
  }

  const existingInvite = await prisma.invite.findUnique({ where: { email } })
  if (existingInvite && !existingInvite.used && existingInvite.expiresAt > new Date()) {
    return Response.json({ error: 'Invite already pending' }, { status: 409 })
  }

  // If there's an expired/used invite for this email, delete it first
  if (existingInvite) {
    await prisma.invite.delete({ where: { email } })
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const invite = await prisma.invite.create({
    data: {
      email,
      expiresAt,
      sentBy: session.user.email!,
    },
  })

  await resend.emails.send({
    from: 'SalonTransact <noreply@salontransact.com>',
    to: email,
    subject: "You've been invited to SalonTransact",
    html: inviteEmailHtml(invite.token, email),
  })

  return Response.json({
    success: true,
    invite: { id: invite.id, email: invite.email, token: invite.token, expiresAt: invite.expiresAt },
  })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.user?.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const invites = await prisma.invite.findMany({ orderBy: { createdAt: 'desc' } })
  const now = new Date()

  const rows = invites.map((inv) => ({
    id: inv.id,
    email: inv.email,
    used: inv.used,
    usedAt: inv.usedAt?.toISOString() ?? null,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    isExpired: !inv.used && inv.expiresAt < now,
  }))

  return Response.json(rows)
}
