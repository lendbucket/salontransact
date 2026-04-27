import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateVerificationToken } from "@/lib/auth/verification-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email } = body;
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, emailVerified: true, name: true },
  });

  if (!user) {
    // Don't reveal whether email exists
    return NextResponse.json({ success: true });
  }

  if (user.emailVerified) {
    return NextResponse.json({ success: true, alreadyVerified: true });
  }

  const token = generateVerificationToken();

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: token },
  });

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  const verifyUrl = `${baseUrl}/verify-email/${token}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[RESEND-VERIFY] RESEND_API_KEY not configured");
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "SalonTransact <onboarding@resend.dev>",
      to: normalizedEmail,
      subject: "Verify your SalonTransact email",
      html: verificationEmailHtml(user.name ?? "there", verifyUrl),
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("[RESEND-VERIFY] Resend error:", JSON.stringify(errData));
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
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
        Hi ${name}, please verify your email address to complete your SalonTransact account setup.
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
