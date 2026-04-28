import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { MerchantInviteValidateResponse } from "@/lib/merchant-invites/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.merchantInvite.findUnique({
    where: { token },
  });

  if (!invite) {
    return NextResponse.json(
      { valid: false, reason: "not-found" } satisfies MerchantInviteValidateResponse
    );
  }

  if (invite.status === "accepted") {
    return NextResponse.json(
      { valid: false, reason: "already-accepted" } satisfies MerchantInviteValidateResponse
    );
  }

  if (invite.status === "revoked") {
    return NextResponse.json(
      { valid: false, reason: "revoked" } satisfies MerchantInviteValidateResponse
    );
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json(
      { valid: false, reason: "expired" } satisfies MerchantInviteValidateResponse
    );
  }

  return NextResponse.json({
    valid: true,
    email: invite.email,
    businessName: invite.businessName,
    note: invite.note,
    invitedByEmail: invite.invitedByEmail,
    expiresAt: invite.expiresAt.toISOString(),
  } satisfies MerchantInviteValidateResponse);
}
