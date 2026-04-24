import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!session?.user || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { userId },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: "Merchant not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        businessName: body.businessName || merchant.businessName,
        businessType: body.businessType,
        phone: body.phone,
        ein: body.ein,
        dbaName: body.dbaName,
        ownerFirstName: body.ownerFirstName,
        ownerLastName: body.ownerLastName,
        ownerDob: body.ownerDob,
        ownerSsnLast4: body.ownerSsnLast4,
        ownerTitle: body.ownerTitle,
        ownershipPercentage: body.ownershipPercentage
          ? parseInt(body.ownershipPercentage, 10)
          : null,
        ownerAddress: body.ownerAddress,
        address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zip,
        bankAccountHolder: body.bankAccountHolder,
        bankRoutingNumber: body.bankRoutingNumber,
        bankAccountNumber: body.bankAccountNumber,
        bankAccountType: body.bankAccountType,
        fundingSpeed: body.fundingSpeed,
        monthlyVolume: 0,
        avgTransaction: body.avgTransaction,
        paymentMethods: body.paymentMethods || [],
        status: "pending_review",
        applicationSubmittedAt: new Date(),
      },
    });

    // Send notification email to admin
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: "SalonTransact <onboarding@resend.dev>",
            to: "ceo@36west.org",
            subject: `New Merchant Application - ${body.businessName || merchant.businessName}`,
            html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="color:#635bff;font-weight:700;font-size:18px;">SalonTransact</span>
      <span style="color:#6b7280;font-size:14px;margin-left:8px;">New Application</span>
    </div>
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;">
      <h2 style="color:#fff;font-size:20px;margin:0 0 24px;">Merchant Application</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Business Name</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.businessName || merchant.businessName}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">DBA</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.dbaName || "N/A"}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Type</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.businessType || "N/A"}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">EIN</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.ein || "N/A"}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Phone</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.phone || "N/A"}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Owner</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.ownerFirstName || ""} ${body.ownerLastName || ""}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Title</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.ownerTitle || "N/A"}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Ownership</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.ownershipPercentage || "N/A"}%</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Address</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.address || ""}, ${body.city || ""} ${body.state || ""} ${body.zip || ""}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Bank Routing</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.bankRoutingNumber || "N/A"}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Account Type</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.bankAccountType || "N/A"}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Funding</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.fundingSpeed || "N/A"}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Volume</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.monthlyVolume || "N/A"}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Avg Transaction</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${body.avgTransaction || "N/A"}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding:6px 0;">Payment Methods</td><td style="color:#fff;font-size:13px;padding:6px 0;text-align:right;">${(body.paymentMethods || []).join(", ") || "N/A"}</td></tr>
      </table>
    </div>
  </div>
</body>
</html>`,
          }),
        });
      } catch (emailErr) {
        console.error("[ONBOARDING] Email notification error:", emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ONBOARDING] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
