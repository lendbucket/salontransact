import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { buildApprovalEmail } from "@/lib/applications/email-templates";
import { RESEND_FROM } from "@/lib/email/sender";
import { notifyMerchantOwner } from "@/lib/notifications/create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  internalNotes?: unknown;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    // body is optional
  }

  const internalNotes =
    typeof body.internalNotes === "string" && body.internalNotes.trim().length > 0
      ? body.internalNotes.trim().slice(0, 1000)
      : null;

  const application = await prisma.merchantApplication.findUnique({
    where: { id },
  });
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (application.status !== "submitted") {
    return NextResponse.json(
      { error: `Cannot approve application with status '${application.status}'` },
      { status: 410 }
    );
  }

  const now = new Date();

  const existingMerchant = await prisma.merchant.findUnique({
    where: { userId: application.userId },
  });

  const result = await prisma.$transaction(async (tx) => {
    await tx.merchantApplication.update({
      where: { id: application.id },
      data: {
        status: "approved",
        approvedAt: now,
        approvedById: user.id,
        approvedByEmail: user.email ?? "",
        internalNotes: internalNotes ?? application.internalNotes,
      },
    });

    await tx.user.update({
      where: { id: application.userId },
      data: { approvalStatus: "approved" },
    });

    const merchantData = {
      businessName: application.legalBusinessName,
      businessType: application.businessType,
      email: application.ownerEmail,
      phone: application.businessPhone,
      ein: application.ein,
      dbaName: application.dba,
      address: application.addressStreet,
      city: application.addressCity,
      state: application.addressState,
      zip: application.addressZip,
      ownerFirstName: application.ownerFullName.split(" ")[0] ?? application.ownerFullName,
      ownerLastName: application.ownerFullName.split(" ").slice(1).join(" ") || null,
      ownerTitle: application.ownerTitle,
      bankAccountHolder: application.accountHolderName,
      bankRoutingNumber: application.routingNumber,
      bankAccountNumber: application.accountNumber,
      bankAccountType: application.accountType,
      applicationSubmittedAt: application.submittedAt,
      status: "active",
      stripeAccountStatus: "skipped",
      chargesEnabled: false,
      payoutsEnabled: false,
    };

    let merchant;
    if (existingMerchant) {
      merchant = await tx.merchant.update({
        where: { id: existingMerchant.id },
        data: merchantData,
      });
    } else {
      merchant = await tx.merchant.create({
        data: {
          userId: application.userId,
          ...merchantData,
        },
      });
    }

    return { merchant };
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://portal.salontransact.com";

  let emailSent = false;
  let emailError: string | null = null;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    emailError = "RESEND_API_KEY not set";
  } else {
    try {
      const { subject, html } = buildApprovalEmail({
        recipientEmail: application.ownerEmail,
        businessName: application.legalBusinessName,
        baseUrl,
      });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: application.ownerEmail,
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        emailError = `Resend ${res.status}: ${t.slice(0, 200)}`;
      } else {
        emailSent = true;
      }
    } catch (e) {
      emailError = e instanceof Error ? e.message : "send failed";
    }
  }

  try {
    await notifyMerchantOwner(result.merchant.id, {
      category: "merchant",
      severity: "success",
      title: "Application approved",
      message: `Welcome to SalonTransact! Your application for ${application.legalBusinessName} has been approved. You can now access your dashboard.`,
      link: "/dashboard",
      metadata: {
        applicationId: application.id,
        approvedByEmail: user.email ?? "",
      },
    });
  } catch {
    // ignore
  }

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "application.approve",
    targetType: "MerchantApplication",
    targetId: application.id,
    merchantId: result.merchant.id,
    metadata: {
      applicantEmail: application.ownerEmail,
      businessName: application.legalBusinessName,
      hasInternalNotes: internalNotes !== null,
      emailSent,
      emailError,
    },
  });

  return NextResponse.json({
    ok: true,
    merchantId: result.merchant.id,
    emailSent,
    emailError,
  });
}
