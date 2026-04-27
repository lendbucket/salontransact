import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VERIFICATION_TOKEN_EXPIRY_HOURS } from "@/lib/auth/verification-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token } = body;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
    select: { id: true, createdAt: true, emailVerified: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Invalid or expired verification link" },
      { status: 400 }
    );
  }

  if (user.emailVerified) {
    return NextResponse.json({ alreadyVerified: true });
  }

  const expiresAt = new Date(user.createdAt);
  expiresAt.setHours(expiresAt.getHours() + VERIFICATION_TOKEN_EXPIRY_HOURS);

  if (new Date() > expiresAt) {
    return NextResponse.json(
      { error: "Verification link has expired. Please request a new one." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      emailVerificationToken: null,
    },
  });

  return NextResponse.json({ verified: true });
}
