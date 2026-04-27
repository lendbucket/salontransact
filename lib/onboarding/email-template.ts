import type { MerchantApplication } from "@prisma/client";

interface EmailData {
  application: MerchantApplication;
  applicantEmail: string;
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  hair_salon: "Hair Salon",
  barbershop: "Barbershop",
  nail_salon: "Nail Salon",
  spa: "Spa",
  suite_rental: "Suite Rental",
  other: "Other",
};

const VOLUME_LABELS: Record<string, string> = {
  "<10k": "Less than $10,000",
  "10k-50k": "$10,000 – $50,000",
  "50k-100k": "$50,000 – $100,000",
  "100k-500k": "$100,000 – $500,000",
  "500k+": "$500,000+",
};

const TICKET_LABELS: Record<string, string> = {
  "<25": "Less than $25",
  "25-50": "$25 – $50",
  "50-100": "$50 – $100",
  "100-250": "$100 – $250",
  "250-500": "$250 – $500",
  "500+": "$500+",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildApplicationNotificationEmail(data: EmailData): string {
  const a = data.application;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FBFBFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Inter',sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="background:#FFFFFF;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="height:4px;background:linear-gradient(90deg,#017ea7 0%,#0290be 100%);border-radius:12px 12px 0 0;margin:-32px -32px 24px -32px;"></div>

      <h1 style="font-size:24px;font-weight:600;color:#1A1313;margin:0 0 8px;letter-spacing:-0.31px;">New merchant application</h1>
      <p style="font-size:14px;color:#878787;margin:0 0 24px;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;background:#FEF3C7;color:#92400E;">Pending Review</span></p>

      <div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #E8EAED;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#878787;font-weight:600;margin:0 0 12px;">Business</p>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Legal name</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.legalBusinessName)}</span></div>
        ${a.dba ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">DBA</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.dba)}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Type</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(BUSINESS_TYPE_LABELS[a.businessType] ?? a.businessType)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">EIN</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.ein)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Phone</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.businessPhone)}</span></div>
        ${a.website ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Website</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.website)}</span></div>` : ""}
      </div>

      <div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #E8EAED;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#878787;font-weight:600;margin:0 0 12px;">Address</p>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Street</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.addressStreet)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">City, State ZIP</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.addressCity)}, ${escapeHtml(a.addressState)} ${escapeHtml(a.addressZip)}</span></div>
      </div>

      <div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #E8EAED;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#878787;font-weight:600;margin:0 0 12px;">Owner</p>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Name</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.ownerFullName)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Title</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.ownerTitle)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Email</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.ownerEmail)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Phone</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.ownerPhone)}</span></div>
      </div>

      <div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #E8EAED;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#878787;font-weight:600;margin:0 0 12px;">Banking</p>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Bank</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.bankName)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Account holder</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.accountHolderName)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Routing</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.routingNumber)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Account</span><span style="color:#1A1313;font-weight:500;">····${escapeHtml(a.accountNumber.slice(-4))}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Type</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.accountType)}</span></div>
      </div>

      <div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #E8EAED;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#878787;font-weight:600;margin:0 0 12px;">Volume &amp; Category</p>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Monthly volume</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(VOLUME_LABELS[a.monthlyVolume] ?? a.monthlyVolume)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Avg ticket</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(TICKET_LABELS[a.averageTicket] ?? a.averageTicket)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">MCC</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.mccCode)}</span></div>
      </div>

      <div>
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#878787;font-weight:600;margin:0 0 12px;">Account Info</p>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Applicant email</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(data.applicantEmail)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Application ID</span><span style="color:#1A1313;font-weight:500;">${escapeHtml(a.id)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span style="color:#4A4A4A;">Submitted</span><span style="color:#1A1313;font-weight:500;">${a.submittedAt.toISOString().split("T")[0]}</span></div>
      </div>

      <p style="text-align:center;font-size:12px;color:#878787;margin-top:24px;padding-top:24px;border-top:1px solid #E8EAED;">
        Full banking details are in the database. Account number masked here for security.<br>
        Review in the master portal to approve or reject.
      </p>
    </div>
  </div>
</body>
</html>`;
}
