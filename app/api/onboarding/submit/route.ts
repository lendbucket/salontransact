/**
 * TODO COMPLIANCE — REVIEW BEFORE PRODUCTION
 *
 * This form collects sensitive financial data (banking, EIN). Before accepting
 * real merchant applications:
 *
 * 1. PRIVACY POLICY — must disclose collection of EIN, banking, contact info,
 *    purpose, retention period, sharing with Payroc
 * 2. TERMS OF SERVICE — must explicitly cover application review process
 * 3. ENCRYPTION AT REST — verify Supabase is encrypting MerchantApplication.accountNumber
 *    and routingNumber columns. Consider column-level encryption.
 * 4. ACCESS CONTROLS — restrict who can read full account/routing numbers
 *    (currently: anyone with database access)
 * 5. AUDIT LOGGING — log every read/write of banking fields with timestamp + user
 * 6. RETENTION POLICY — define how long applications stay; auto-delete rejected
 *    applications after N days
 * 7. BREACH NOTIFICATION PLAN — required by state law if banking is breached
 * 8. STATE COMPLIANCE — review TX, CA, NY, IL specific requirements
 * 9. GLBA COMPLIANCE — financial services data handling rules
 * 10. PCI ALIGNMENT — even though card data is in Payroc, banking data still
 *     needs comparable rigor
 *
 * Status: NOT PRODUCTION READY — collect data with eyes open about gaps above.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as v from "@/lib/onboarding/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null }
    | undefined;

  if (!user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await prisma.merchantApplication.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Application already submitted" },
      { status: 409 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const errors: Record<string, string> = {};

  if (!body.legalBusinessName?.trim())
    errors.legalBusinessName = "Required";
  if (
    ![
      "hair_salon",
      "barbershop",
      "nail_salon",
      "spa",
      "suite_rental",
      "other",
    ].includes(body.businessType)
  )
    errors.businessType = "Invalid";
  if (!v.validateEIN(body.ein)) errors.ein = "Must be XX-XXXXXXX format";
  if (!v.validateUSPhone(body.businessPhone))
    errors.businessPhone = "Invalid US phone";
  if (body.website && !v.validateWebsite(body.website))
    errors.website = "Invalid URL";

  if (!body.addressStreet?.trim()) errors.addressStreet = "Required";
  if (!body.addressCity?.trim()) errors.addressCity = "Required";
  if (!v.validateStateCode(body.addressState))
    errors.addressState = "Invalid state";
  if (!v.validateZIP(body.addressZip)) errors.addressZip = "Invalid ZIP";

  if (!body.ownerFullName?.trim()) errors.ownerFullName = "Required";
  if (!v.validateEmail(body.ownerEmail)) errors.ownerEmail = "Invalid email";
  if (!v.validateUSPhone(body.ownerPhone))
    errors.ownerPhone = "Invalid US phone";

  if (!body.bankName?.trim()) errors.bankName = "Required";
  if (!body.accountHolderName?.trim())
    errors.accountHolderName = "Required";
  if (!v.validateRoutingNumber(body.routingNumber))
    errors.routingNumber = "Invalid routing number (failed checksum)";
  if (!v.validateAccountNumber(body.accountNumber))
    errors.accountNumber = "Invalid account number";
  if (body.accountNumber !== body.confirmAccountNumber)
    errors.confirmAccountNumber = "Doesn't match";
  if (!["checking", "savings"].includes(body.accountType))
    errors.accountType = "Invalid";

  const validVolumes = ["<10k", "10k-50k", "50k-100k", "100k-500k", "500k+"];
  const validTickets = [
    "<25",
    "25-50",
    "50-100",
    "100-250",
    "250-500",
    "500+",
  ];
  const validMccs = ["7230", "7298", "7297", "5977"];
  if (!validVolumes.includes(body.monthlyVolume))
    errors.monthlyVolume = "Invalid";
  if (!validTickets.includes(body.averageTicket))
    errors.averageTicket = "Invalid";
  if (!validMccs.includes(body.mccCode)) errors.mccCode = "Invalid";
  if (!body.agreementAccepted) errors.agreementAccepted = "Required";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    await prisma.merchantApplication.create({
      data: {
        userId: user.id,
        legalBusinessName: body.legalBusinessName.trim(),
        dba: body.dba?.trim() || null,
        businessType: body.businessType,
        ein: body.ein,
        businessPhone: body.businessPhone,
        website: body.website?.trim() || null,
        addressStreet: body.addressStreet.trim(),
        addressCity: body.addressCity.trim(),
        addressState: body.addressState.toUpperCase(),
        addressZip: body.addressZip,
        addressCountry: "US",
        ownerFullName: body.ownerFullName.trim(),
        ownerEmail: body.ownerEmail.trim().toLowerCase(),
        ownerPhone: body.ownerPhone,
        ownerTitle: body.ownerTitle?.trim() || "Owner",
        bankName: body.bankName.trim(),
        accountHolderName: body.accountHolderName.trim(),
        routingNumber: body.routingNumber,
        accountNumber: body.accountNumber,
        accountType: body.accountType,
        monthlyVolume: body.monthlyVolume,
        averageTicket: body.averageTicket,
        mccCode: body.mccCode,
        agreementAccepted: true,
        status: "submitted",
      },
    });
  } catch (err) {
    console.error("[ONBOARDING-SUBMIT] DB error:", err);
    return NextResponse.json(
      { error: "Could not save application" },
      { status: 500 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SalonTransact <noreply@salontransact.com>",
          to: "ceo@36west.org",
          subject: `New merchant application: ${body.legalBusinessName}`,
          html: `
            <h2>New merchant application submitted</h2>
            <p><strong>Business:</strong> ${body.legalBusinessName}${body.dba ? ` (DBA: ${body.dba})` : ""}</p>
            <p><strong>Type:</strong> ${body.businessType}</p>
            <p><strong>Owner:</strong> ${body.ownerFullName} &lt;${body.ownerEmail}&gt;</p>
            <p><strong>Phone:</strong> ${body.ownerPhone}</p>
            <p><strong>Address:</strong> ${body.addressStreet}, ${body.addressCity}, ${body.addressState} ${body.addressZip}</p>
            <p><strong>Monthly volume:</strong> $${body.monthlyVolume}</p>
            <p><strong>Avg ticket:</strong> $${body.averageTicket}</p>
            <p><strong>MCC:</strong> ${body.mccCode}</p>
            <hr>
            <p>Banking and EIN are stored in the MerchantApplication table. Review in master portal.</p>
            <p>User ID: ${user.id} | Email: ${user.email}</p>
          `,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error(
          "[ONBOARDING-SUBMIT] Resend rejected notification:",
          res.status,
          errBody
        );
      }
    } catch (err) {
      console.error("[ONBOARDING-SUBMIT] Notification email failed:", err);
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
