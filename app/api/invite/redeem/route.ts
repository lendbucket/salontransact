import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const body = await request.json()
  const { token, businessName, password } = body as {
    token: string
    businessName: string
    password: string
  }

  if (!token || !businessName || !password) {
    return Response.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const invite = await prisma.invite.findUnique({ where: { token } })
  if (!invite) {
    return Response.json({ error: 'Invalid invitation' }, { status: 404 })
  }
  if (invite.used) {
    return Response.json({ error: 'This invitation has already been used' }, { status: 400 })
  }
  if (invite.expiresAt < new Date()) {
    return Response.json({ error: 'This invitation has expired' }, { status: 400 })
  }

  const hashedPassword = bcrypt.hashSync(password, 12)

  const user = await prisma.user.create({
    data: {
      email: invite.email,
      password: hashedPassword,
      role: 'merchant',
    },
  })

  await prisma.merchant.create({
    data: {
      userId: user.id,
      businessName: businessName.trim(),
      email: invite.email,
    },
  })

  await prisma.invite.update({
    where: { token },
    data: { used: true, usedAt: new Date() },
  })

  const dashboardUrl = `${process.env.NEXTAUTH_URL}/login`
  await resend.emails.send({
    from: 'SalonTransact <noreply@salontransact.com>',
    to: invite.email,
    subject: `Welcome to SalonTransact, ${businessName.trim()}!`,
    html: `<!DOCTYPE html>
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
      <h1 style="color:#fff;font-size:28px;font-weight:700;margin:0 0 16px;">Welcome to SalonTransact!</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 32px;">
        Your merchant account for <strong style="color:#fff;">${businessName.trim()}</strong> is ready.
        Start accepting payments, managing transactions, and growing your salon business.
      </p>
      <a href="${dashboardUrl}" style="display:block;background:#635bff;color:#fff;text-decoration:none;padding:16px;border-radius:12px;font-weight:600;font-size:15px;">
        Go to Dashboard →
      </a>
    </div>
    <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:32px;">
      SalonTransact by Reyna Pay LLC · salontransact.com
    </p>
  </div>
</body>
</html>`,
  })

  return Response.json({ success: true })
}
