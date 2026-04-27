import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVerificationToken } from "@/lib/auth/verification-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null }
    | undefined;

  // Generic success response for all cases — don't leak session or email state
  const genericResponse = NextResponse.json({
    ok: true,
    message:
      "If that account exists and needs verification, a new email has been sent.",
  });

  if (!user?.id || !user.email) {
    return genericResponse;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, emailVerified: true },
  });

  if (!dbUser || dbUser.emailVerified) {
    return genericResponse;
  }

  const newToken = generateVerificationToken();
  await prisma.user.update({
    where: { id: dbUser.id },
    data: { emailVerificationToken: newToken },
  });

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  const verifyUrl = `${baseUrl}/verify-email/${newToken}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: "SalonTransact <noreply@salontransact.com>",
          to: dbUser.email,
          subject: "Verify your SalonTransact email",
          html: verificationEmailHtml(dbUser.name ?? "there", verifyUrl),
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error(
          "[RESEND-VERIFICATION] Resend rejected:",
          res.status,
          errBody
        );
      }
    } catch (err) {
      console.error("[RESEND-VERIFICATION] Email send failed:", err);
    }
  }

  return genericResponse;
}

function verificationEmailHtml(name: string, verifyUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBFBFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="color:#1A1313;font-weight:600;font-size:18px;">SalonTransact</span>
    </div>
    <div style="background:#FFFFFF;border:1px solid #E8EAED;border-radius:12px;padding:40px;text-align:center;">
      <h1 style="color:#1A1313;font-size:24px;font-weight:600;margin:0 0 16px;">Verify your email</h1>
      <p style="color:#4A4A4A;font-size:15px;line-height:1.6;margin:0 0 32px;">
        Hi ${name}, you requested a new verification link. Click below to verify your email address.
      </p>
      <a href="${verifyUrl}" style="display:inline-block;background:#017ea7;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
        Verify Email Address
      </a>
      <p style="color:#878787;font-size:12px;margin:24px 0 0;">This link expires in 24 hours.</p>
    </div>
    <p style="color:#878787;font-size:12px;text-align:center;margin-top:32px;">
      If you didn't create a SalonTransact account, you can safely ignore this email.<br/>
      &copy; 2026 SalonTransact
    </p>
  </div>
</body>
</html>`;
}
