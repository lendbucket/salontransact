import { jsPDF } from "jspdf";
import type { StatementData } from "./types";

const TEAL: [number, number, number] = [0x01, 0x7e, 0xa7];
const TEXT: [number, number, number] = [0x1a, 0x13, 0x13];
const MUTED: [number, number, number] = [0x87, 0x87, 0x87];
const SECONDARY: [number, number, number] = [0x4a, 0x4a, 0x4a];
const BORDER: [number, number, number] = [0xe8, 0xea, 0xed];
const SURFACE: [number, number, number] = [0xf9, 0xfa, 0xfb];

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function drawHeader(doc: jsPDF, data: StatementData): number {
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, PAGE_W, 4, "F");

  let y = MARGIN + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...TEAL);
  doc.text("SalonTransact", MARGIN, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const headTitle = "Processing Statement";
  const titleW = doc.getTextWidth(headTitle);
  doc.text(headTitle, PAGE_W - MARGIN - titleW, y);

  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const periodW = doc.getTextWidth(data.periodLabel);
  doc.text(data.periodLabel, PAGE_W - MARGIN - periodW, y);

  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const stamp = data.generatedAt.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
  doc.text(`Generated ${stamp}`, MARGIN, y);

  y += 18;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  return y + 16;
}

function drawMerchant(doc: jsPDF, data: StatementData, y: number): number {
  const m = data.merchant;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("MERCHANT", MARGIN, y);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...TEXT);
  doc.text(m.businessName, MARGIN, y);
  y += 16;

  if (m.dbaName && m.dbaName !== m.businessName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SECONDARY);
    doc.text(`DBA: ${m.dbaName}`, MARGIN, y);
    y += 12;
  }

  if (m.address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SECONDARY);
    doc.text(m.address, MARGIN, y);
    y += 11;
    const cityLine = [m.city, m.state, m.zip].filter(Boolean).join(", ");
    if (cityLine.length > 0) {
      doc.text(cityLine, MARGIN, y);
      y += 11;
    }
  }

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const contactParts = [m.phone, m.email].filter(Boolean);
  if (contactParts.length > 0) {
    doc.text(contactParts.join("  \u00B7  "), MARGIN, y);
    y += 12;
  }

  return y + 14;
}

function drawSummary(doc: jsPDF, data: StatementData, y: number): number {
  const s = data.summary;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("PERIOD SUMMARY", MARGIN, y);
  y += 14;

  const cardH = 96;
  doc.setFillColor(...SURFACE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 8, 8, "FD");

  const colW = CONTENT_W / 4;
  const stats = [
    { label: "Total Volume", value: fmtMoney(s.totalVolumeCents) },
    { label: "Transactions", value: fmtCount(s.transactionCount) },
    { label: "Avg Ticket", value: fmtMoney(s.averageTicketCents) },
    { label: "Net Deposited", value: fmtMoney(s.totalNetCents) },
  ];

  for (let i = 0; i < stats.length; i++) {
    const colX = MARGIN + colW * i + 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(stats[i].label.toUpperCase(), colX, y + 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...TEXT);
    doc.text(stats[i].value, colX, y + 44);
  }

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 16, y + 60, PAGE_W - MARGIN - 16, y + 60);

  const row2Stats = [
    { label: "Fees", value: fmtMoney(s.totalFeesCents) },
    { label: "Refunds", value: s.refundCount > 0 ? `${fmtMoney(s.totalRefundsCents)} (${fmtCount(s.refundCount)})` : "\u2014" },
    { label: "Disputes", value: s.disputesNote },
    { label: "Currency", value: "USD" },
  ];

  for (let i = 0; i < row2Stats.length; i++) {
    const colX = MARGIN + colW * i + 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(row2Stats[i].label.toUpperCase(), colX, y + 76);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SECONDARY);
    doc.text(row2Stats[i].value, colX, y + 90);
  }

  return y + cardH + 24;
}

function drawFooter(doc: jsPDF): void {
  const y = PAGE_H - 30;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y - 10, PAGE_W - MARGIN, y - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("SalonTransact  \u00B7  support@salontransact.com  \u00B7  Powered by Reyna Pay LLC", MARGIN, y);
}

function drawDailyTable(doc: jsPDF, data: StatementData, startY: number): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("DAILY ACTIVITY", MARGIN, startY);
  let y = startY + 14;

  const dateColX = MARGIN;
  const countColX = MARGIN + 100;
  const volumeColX = MARGIN + 180;
  const feesColX = MARGIN + 320;
  const netColX = MARGIN + 440;

  function drawTableHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("DATE", dateColX, y);
    doc.text("TXNS", countColX, y);
    doc.text("VOLUME", volumeColX, y);
    doc.text("FEES", feesColX, y);
    doc.text("NET", netColX, y);
    y += 8;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 12;
  }

  drawTableHeader();

  if (data.daily.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("No activity in this period.", MARGIN, y);
    return;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);

  for (const row of data.daily) {
    if (y > PAGE_H - MARGIN - 60) {
      drawFooter(doc);
      doc.addPage();
      y = MARGIN + 20;
      drawTableHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
    }

    doc.text(fmtDate(row.date), dateColX, y);
    doc.text(fmtCount(row.transactionCount), countColX, y);
    doc.text(fmtMoney(row.volumeCents), volumeColX, y);
    doc.text(fmtMoney(row.feesCents), feesColX, y);
    doc.text(fmtMoney(row.netCents), netColX, y);
    y += 14;
  }
}

export function buildStatementPdf(data: StatementData): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  let y = drawHeader(doc, data);
  y = drawMerchant(doc, data, y);
  y = drawSummary(doc, data, y);
  drawDailyTable(doc, data, y);
  drawFooter(doc);

  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}

export function statementFilename(data: StatementData): string {
  const safeName = data.merchant.businessName
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const periodSlug = data.periodLabel.toLowerCase().replace(/\s+/g, "-");
  return `statement-${safeName}-${periodSlug}.pdf`;
}
