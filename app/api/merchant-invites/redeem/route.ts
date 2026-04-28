import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { notifyAllMasters } from "@/lib/notifications/create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RedeemBody {
  token?: unknown;
  password?: unknown;
  legalBusinessName?: unknown;
  dba?: unknown;
  businessType?: unknown;
  ein?: unknown;
  businessPhone?: unknown;
  website?: unknown;
  addressStreet?: unknown;
  addressCity?: unknown;
  addressState?: unknown;
  addressZip?: unknown;
  ownerFullName?: unknown;
  ownerPhone?: unknown;
  ownerTitle?: unknown;
  bankName?: unknown;
  accountHolderName?: unknown;
  routingNumber?: unknown;
  accountNumber?: unknown;
  accountType?: unknown;
  monthlyVolume?: unknown;
  averageTicket?: unknown;
  mccCode?: unknown;
  agreementAccepted?: unknown;
}

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function POST(request: Request) {
  let body: RedeemBody;
  try {
    body = (await request.json()) as RedeemBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = asString(body.token);
  const password = typeof body.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const invite = await prisma.merchantInvite.findUnique({ where: { token } });
  if (!invite) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  }
  if (invite.status === "accepted") {
    return NextResponse.json(
      { error: "This invitation has already been used" },
      { status: 410 }
    );
  }
  if (invite.status === "revoked") {
    return NextResponse.json(
      { error: "This invitation was revoked" },
      { status: 410 }
    );
  }
  if (invite.expiresAt < new Date()) {
    await prisma.merchantInvite.update({
      where: { id: invite.id },
      data: { status: "expired" },
    });
    return NextResponse.json(
      { error: "This invitation has expired" },
      { status: 410 }
    );
  }

  const legalBusinessName = asString(body.legalBusinessName);
  const businessType = asString(body.businessType);
  const ein = asString(body.ein);
  const businessPhone = asString(body.businessPhone);
  const addressStreet = asString(body.addressStreet);
  const addressCity = asString(body.addressCity);
  const addressState = asString(body.addressState);
  const addressZip = asString(body.addressZip);
  const ownerFullName = asString(body.ownerFullName);
  const ownerPhone = asString(body.ownerPhone);
  const bankName = asString(body.bankName);
  const accountHolderName = asString(body.accountHolderName);
  const routingNumber = asString(body.routingNumber);
  const accountNumber = asString(body.accountNumber);
  const accountType = asString(body.accountType);
  const monthlyVolume = asString(body.monthlyVolume);
  const averageTicket = asString(body.averageTicket);
  const mccCode = asString(body.mccCode);

  const required = {
    legalBusinessName, businessType, ein, businessPhone,
    addressStreet, addressCity, addressState, addressZip,
    ownerFullName, ownerPhone,
    bankName, accountHolderName, routingNumber, accountNumber, accountType,
    monthlyVolume, averageTicket, mccCode,
  };
  for (const [k, v] of Object.entries(required)) {
    if (!v) {
      return NextResponse.json({ error: `${k} is required` }, { status: 400 });
    }
  }

  if (body.agreementAccepted !== true) {
    return NextResponse.json(
      { error: "Agreement must be accepted" },
      { status: 400 }
    );
  }

  const dba = asString(body.dba);
  const website = asString(body.website);
  const ownerTitle = asString(body.ownerTitle) ?? "Owner";

  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });
  if (existingUser) {
    return NextResponse.json(
      { error: "Account already exists for this email" },
      { status: 409 }
    );
  }

  const hashedPassword = bcrypt.hashSync(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: invite.email,
        password: hashedPassword,
        role: "merchant",
        approvalStatus: "pending",
      },
    });

    const application = await tx.merchantApplication.create({
      data: {
        userId: user.id,
        legalBusinessName: legalBusinessName!,
        dba,
        businessType: businessType!,
        ein: ein!,
        businessPhone: businessPhone!,
        website,
        addressStreet: addressStreet!,
        addressCity: addressCity!,
        addressState: addressState!,
        addressZip: addressZip!,
        ownerFullName: ownerFullName!,
        ownerEmail: invite.email,
        ownerPhone: ownerPhone!,
        ownerTitle,
        bankName: bankName!,
        accountHolderName: accountHolderName!,
        routingNumber: routingNumber!,
        accountNumber: accountNumber!,
        accountType: accountType!,
        monthlyVolume: monthlyVolume!,
        averageTicket: averageTicket!,
        mccCode: mccCode!,
        agreementAccepted: true,
        status: "submitted",
      },
    });

    await tx.merchantInvite.update({
      where: { id: invite.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedById: user.id,
        applicationId: application.id,
      },
    });

    return { user, application };
  });

  try {
    await notifyAllMasters({
      category: "merchant",
      severity: "success",
      title: "Invite accepted",
      message: `${invite.businessName} (${invite.email}) accepted your invite and submitted their application.`,
      link: `/master/applications`,
      metadata: {
        inviteId: invite.id,
        merchantBusinessName: invite.businessName,
        merchantEmail: invite.email,
        applicationId: result.application.id,
      },
    });
  } catch {
    // Notification failure should not break the redeem flow
  }

  return NextResponse.json({
    ok: true,
    applicationId: result.application.id,
  });
}
