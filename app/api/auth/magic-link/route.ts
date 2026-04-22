import { NextResponse } from "next/server";

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
    console.log("[MAGIC-LINK] Request for:", email);

    // Fresh PrismaClient — bypass PrismaPg driver adapter issues
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();

    try {
      const user = await db.user.findUnique({
        where: { email },
      });
      if (!user) {
        console.log("[MAGIC-LINK] User not found:", email);
        return NextResponse.json(
          { error: "No account found with this email" },
          { status: 404 }
        );
      }

      // Delete existing unused tokens for this email
      await db.passwordReset.deleteMany({
        where: { email: user.email, used: false },
      });

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      const reset = await db.passwordReset.create({
        data: { email: user.email, expiresAt },
      });
      console.log("[MAGIC-LINK] Token created:", reset.token.substring(0, 8));

      const baseUrl =
        process.env.NEXTAUTH_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");
      const magicUrl = `${baseUrl}/magic/${reset.token}`;
      console.log("[MAGIC-LINK] URL:", magicUrl);

      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.error("[MAGIC-LINK] RESEND_API_KEY is not set");
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
          to: user.email,
          subject: "Your SalonTransact sign-in link",
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
      <h1 style="color:#fff;font-size:28px;font-weight:700;margin:0 0 16px;">Sign in to SalonTransact</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 32px;">
        Click the button below to securely sign in to your account. No password needed.
      </p>
      <a href="${magicUrl}" style="display:block;background:#635bff;color:#fff;text-decoration:none;padding:16px;border-radius:12px;font-weight:600;font-size:15px;">
        Sign In to SalonTransact &rarr;
      </a>
      <p style="color:#6b7280;font-size:12px;margin:16px 0 0;word-break:break-all;">${magicUrl}</p>
      <p style="color:#6b7280;font-size:13px;margin:24px 0 0;">This link expires in 15 minutes.</p>
    </div>
    <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:32px;">
      If you didn't request this, you can safely ignore this email.<br/>
      SalonTransact by Reyna Pay LLC
    </p>
  </div>
</body>
</html>`,
        }),
      });

      const resData = await res.json();
      console.log(
        "[MAGIC-LINK] Resend status:",
        res.status,
        "response:",
        JSON.stringify(resData)
      );

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
    } finally {
      await db.$disconnect();
    }
  } catch (error) {
    console.error("[MAGIC-LINK] Unhandled error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
