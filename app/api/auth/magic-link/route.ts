import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RESEND_FROM } from "@/lib/email/sender";
import {
  buildEmailHtml,
  emailHeading,
  emailParagraph,
  emailButton,
  emailFallbackUrl,
  emailDivider,
  emailMutedParagraph,
} from "@/lib/email/components";

function buildMagicLinkEmail({ magicUrl, baseUrl }: { magicUrl: string; baseUrl: string }): string {
  const content = `
${emailHeading("Sign in to SalonTransact")}
${emailParagraph("Click the button below to securely sign in to your account. No password needed.")}
${emailButton(magicUrl, "Sign in to SalonTransact")}
${emailFallbackUrl(magicUrl)}
${emailDivider()}
${emailMutedParagraph("This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.")}`;

  return buildEmailHtml({
    baseUrl,
    preheader: "Your sign-in link for SalonTransact",
    content,
  });
}

export async function POST(request: Request) {
  try {
    const { email: rawEmail } = (await request.json()) as { email: string };
    if (!rawEmail) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email" },
        { status: 404 }
      );
    }

    // Delete existing unused tokens for this email
    await prisma.passwordReset.deleteMany({
      where: { email: user.email, used: false },
    });

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const reset = await prisma.passwordReset.create({
      data: { email: user.email, expiresAt },
    });

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
    const magicUrl = `${baseUrl}/magic/${reset.token}`;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
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
        from: RESEND_FROM,
        to: user.email,
        subject: "Your SalonTransact sign-in link",
        html: buildMagicLinkEmail({ magicUrl, baseUrl }),
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error("[MAGIC-LINK] Resend error:", JSON.stringify(resData));
      return NextResponse.json(
        {
          error:
            resData?.message ||
            "Failed to send email. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MAGIC-LINK] Unhandled error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
