import { jsPDF } from "jspdf";

export interface AgreementPdfData {
  submittedAt: Date;
  ipAddress: string;
  userAgent: string;
  applicationId: string;

  legalBusinessName: string;
  dba: string | null;
  businessType: string;
  ein: string;
  businessPhone: string;

  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;

  ownerFullName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerTitle: string;

  bankName: string;
  accountHolderName: string;
  accountLast4: string;
  accountType: string;
  routingNumber: string;

  monthlyVolume: string;
  averageTicket: string;
  mccCode: string;
}

const TEAL: [number, number, number] = [0x01, 0x7e, 0xa7];
const TEXT: [number, number, number] = [0x1a, 0x13, 0x13];
const MUTED: [number, number, number] = [0x87, 0x87, 0x87];
const SECONDARY: [number, number, number] = [0x4a, 0x4a, 0x4a];

const PAGE_W = 612;
const MARGIN = 48;

function drawSectionLabel(doc: jsPDF, label: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), MARGIN, y);
  return y + 14;
}

function drawRow(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SECONDARY);
  doc.text(label, MARGIN, y);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT);
  const valueX = PAGE_W - MARGIN;
  doc.text(value || "\u2014", valueX, y, { align: "right" });
  return y + 14;
}

function drawDivider(doc: jsPDF, y: number): number {
  doc.setDrawColor(0xe8, 0xea, 0xed);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  return y + 12;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function maskAccount(last4: string): string {
  return `\u2022\u2022\u2022\u2022${last4}`;
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
  "<10k": "Less than $10,000/month",
  "10k-50k": "$10,000 \u2013 $50,000/month",
  "50k-100k": "$50,000 \u2013 $100,000/month",
  "100k-500k": "$100,000 \u2013 $500,000/month",
  "500k+": "$500,000+/month",
};

const TICKET_LABELS: Record<string, string> = {
  "<25": "Less than $25",
  "25-50": "$25 \u2013 $50",
  "50-100": "$50 \u2013 $100",
  "100-250": "$100 \u2013 $250",
  "250-500": "$250 \u2013 $500",
  "500+": "$500+",
};

export function buildAgreementPdf(data: AgreementPdfData): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  // Header
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, PAGE_W, 56, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0xff, 0xff, 0xff);
  doc.text("SalonTransact Merchant Services Agreement", MARGIN, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(0xff, 0xff, 0xff);
  doc.text("Reyna Pay LLC \u00B7 Payment Infrastructure for Salon Businesses", MARGIN, 48);

  let y = 80;

  // Attestation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const attestation =
    `By submitting the onboarding application, ${data.ownerFullName} (${data.ownerTitle}) of ` +
    `${data.legalBusinessName} attested to the accuracy of the following information ` +
    `and accepted SalonTransact's merchant services terms.`;
  const lines = doc.splitTextToSize(attestation, PAGE_W - MARGIN * 2);
  doc.text(lines, MARGIN, y);
  y += lines.length * 12 + 8;

  y = drawDivider(doc, y);

  // Submission metadata
  y = drawSectionLabel(doc, "Submission", y);
  y = drawRow(doc, "Submitted at", fmtDate(data.submittedAt), y);
  y = drawRow(doc, "Application ID", data.applicationId, y);
  y = drawRow(doc, "IP Address", data.ipAddress, y);
  const uaShort = data.userAgent.length > 80 ? data.userAgent.slice(0, 77) + "\u2026" : data.userAgent;
  y = drawRow(doc, "User Agent", uaShort, y);
  y = drawDivider(doc, y);

  // Business
  y = drawSectionLabel(doc, "Business", y);
  y = drawRow(doc, "Legal name", data.legalBusinessName, y);
  if (data.dba) y = drawRow(doc, "DBA", data.dba, y);
  y = drawRow(doc, "Type", BUSINESS_TYPE_LABELS[data.businessType] ?? data.businessType, y);
  y = drawRow(doc, "EIN", data.ein, y);
  y = drawRow(doc, "Phone", data.businessPhone, y);
  y = drawRow(doc, "Address", `${data.addressStreet}, ${data.addressCity}, ${data.addressState} ${data.addressZip}`, y);
  y = drawDivider(doc, y);

  // Owner
  y = drawSectionLabel(doc, "Owner", y);
  y = drawRow(doc, "Name", data.ownerFullName, y);
  y = drawRow(doc, "Title", data.ownerTitle, y);
  y = drawRow(doc, "Email", data.ownerEmail, y);
  y = drawRow(doc, "Phone", data.ownerPhone, y);
  y = drawDivider(doc, y);

  // Banking
  y = drawSectionLabel(doc, "Banking", y);
  y = drawRow(doc, "Bank", data.bankName, y);
  y = drawRow(doc, "Account holder", data.accountHolderName, y);
  y = drawRow(doc, "Account", maskAccount(data.accountLast4), y);
  y = drawRow(doc, "Type", data.accountType, y);
  y = drawRow(doc, "Routing", data.routingNumber, y);
  y = drawDivider(doc, y);

  // Volume
  y = drawSectionLabel(doc, "Processing Estimates", y);
  y = drawRow(doc, "Monthly volume", VOLUME_LABELS[data.monthlyVolume] ?? data.monthlyVolume, y);
  y = drawRow(doc, "Average ticket", TICKET_LABELS[data.averageTicket] ?? data.averageTicket, y);
  y = drawRow(doc, "MCC", data.mccCode, y);
  y = drawDivider(doc, y);

  // Footer
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const footerText =
    "This document is the merchant\u2019s record of the information submitted at " +
    "onboarding. Full terms governing the merchant relationship are " +
    "incorporated by reference at the time of approval. Banking account number " +
    "is masked here for security; the full number is stored encrypted in our " +
    "system of record.";
  const footerLines = doc.splitTextToSize(footerText, PAGE_W - MARGIN * 2);
  doc.text(footerLines, MARGIN, y);

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `SalonTransact \u00B7 Reyna Pay LLC \u00B7 ${fmtDate(data.submittedAt)}`,
    PAGE_W / 2,
    pageH - 24,
    { align: "center" }
  );

  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}
