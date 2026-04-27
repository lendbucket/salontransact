import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateVerificationToken } from "@/lib/auth/verification-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    name?: string;
    businessName?: string;
    email?: string;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { name, businessName, email, password } = body;

  if (!name || !businessName || !email || !password) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Invalid email address" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "An account with this email already exists. Please sign in instead.",
      },
      { status: 409 }
    );
  }

  const hashed = await bcrypt.hash(password, 10);
  const verificationToken = generateVerificationToken();

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashed,
        emailVerificationToken: verificationToken,
        merchant: {
          create: {
            businessName,
            email: normalizedEmail,
          },
        },
      },
      select: { id: true, email: true, name: true },
    });

    // Send verification email via Resend (fire-and-forget, don't block signup)
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
    const verifyUrl = `${baseUrl}/verify-email/${verificationToken}`;

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      fetch("https://api.resend.com/emails", {
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
      }).catch((err) => {
        console.error("[SIGNUP] Failed to send verification email:", err);
      });
    } else {
      console.warn("[SIGNUP] RESEND_API_KEY not configured, skipping verification email");
    }

    return NextResponse.json(
      { id: user.id, email: user.email },
      { status: 201 }
    );
  } catch (err) {
    console.error("[SIGNUP] DB error:", err);
    return NextResponse.json(
      { error: "Could not create account" },
      { status: 500 }
    );
  }
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
