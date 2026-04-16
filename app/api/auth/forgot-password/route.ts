import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email: string }
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Always return success for security — don't leak whether user exists
    if (!user) {
      return Response.json({ success: true })
    }

    // Delete any existing unused reset tokens for this email
    await prisma.passwordReset.deleteMany({
      where: { email: user.email, used: false },
    })

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    const reset = await prisma.passwordReset.create({
      data: { email: user.email, expiresAt },
    })

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password/${reset.token}`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'SalonTransact <noreply@salontransact.com>',
        to: user.email,
        subject: 'Reset your SalonTransact password',
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
      <h1 style="color:#fff;font-size:28px;font-weight:700;margin:0 0 16px;">Reset your password</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 32px;">
        We received a request to reset the password for your SalonTransact account. Click the button below to set a new password.
      </p>
      <a href="${resetUrl}" style="display:block;background:#635bff;color:#fff;text-decoration:none;padding:16px;border-radius:12px;font-weight:600;font-size:15px;">
        Reset Password
      </a>
      <p style="color:#6b7280;font-size:12px;margin:16px 0 0;word-break:break-all;">${resetUrl}</p>
      <p style="color:#6b7280;font-size:13px;margin:24px 0 0;">This link expires in 1 hour.</p>
    </div>
    <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:32px;">
      If you didn't request this, you can safely ignore this email.<br/>
      SalonTransact by Reyna Pay LLC &middot; salontransact.com
    </p>
  </div>
</body>
</html>`,
      }),
    })

    if (!res.ok) {
      console.error('Resend error:', await res.text())
      return Response.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      )
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('Forgot password error:', err)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
