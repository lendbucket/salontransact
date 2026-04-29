import {
  buildEmailHtml,
  escapeHtml,
} from "@/lib/email/components";

export interface ReceiptData {
  baseUrl: string;
  recipientEmail: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: Date;
  cardScheme: string | null;
  cardLast4: string | null;
  refunded: boolean;
  refundAmount: number;
  merchantBusinessName: string;
  merchantCity: string | null;
  merchantState: string | null;
  merchantContactEmail: string | null;
}

const TEXT_PRIMARY = "#1A1313";
const TEXT_SECONDARY = "#4A4A4A";
const TEXT_MUTED = "#878787";
const BORDER = "#E8EAED";
const SURFACE = "#F9FAFB";
const SUCCESS_BG = "#DCFCE7";
const SUCCESS_TEXT = "#15803D";
const TEAL = "#017ea7";

function fmtMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function statusLabel(status: string): { text: string; bg: string; color: string } {
  const s = status.toLowerCase();
  if (s === "succeeded" || s === "complete" || s === "captured" || s === "approved") {
    return { text: "PAID", bg: SUCCESS_BG, color: SUCCESS_TEXT };
  }
  if (s === "refunded") {
    return { text: "REFUNDED", bg: "#F4F5F7", color: TEXT_SECONDARY };
  }
  if (s === "failed" || s === "declined") {
    return { text: status.toUpperCase(), bg: "#FEF2F2", color: "#DC2626" };
  }
  return { text: status.toUpperCase(), bg: "#F4F5F7", color: TEXT_SECONDARY };
}

export function buildReceiptEmail(data: ReceiptData): { subject: string; html: string } {
  const moneyFormatted = fmtMoney(data.amount, data.currency);
  const status = statusLabel(data.status);
  const transactionRef = data.transactionId.slice(0, 12).toUpperCase();
  const subject = `Receipt from ${data.merchantBusinessName} · ${moneyFormatted}`;

  const cardLine =
    data.cardScheme && data.cardLast4
      ? `${escapeHtml(data.cardScheme)} \u00B7\u00B7\u00B7\u00B7${escapeHtml(data.cardLast4)}`
      : "Card payment";

  const merchantLocation =
    data.merchantCity && data.merchantState
      ? `${escapeHtml(data.merchantCity)}, ${escapeHtml(data.merchantState)}`
      : "";

  const refundRow =
    data.refunded && data.refundAmount > 0
      ? `<tr>
           <td style="padding:10px 0;color:${TEXT_SECONDARY};font-size:13px;border-top:1px solid ${BORDER};">Refunded</td>
           <td style="padding:10px 0;color:${TEXT_PRIMARY};font-size:13px;text-align:right;font-weight:500;border-top:1px solid ${BORDER};">\u2212${fmtMoney(data.refundAmount, data.currency)}</td>
         </tr>`
      : "";

  const descriptionRow = data.description
    ? `<tr>
         <td style="padding:10px 0;color:${TEXT_SECONDARY};font-size:13px;border-top:1px solid ${BORDER};">Description</td>
         <td style="padding:10px 0;color:${TEXT_PRIMARY};font-size:13px;text-align:right;border-top:1px solid ${BORDER};">${escapeHtml(data.description)}</td>
       </tr>`
    : "";

  const merchantContactLine = data.merchantContactEmail
    ? `<p style="margin:0 0 4px;color:${TEXT_SECONDARY};font-size:12px;">
         Questions? Contact <a href="mailto:${escapeHtml(data.merchantContactEmail)}" style="color:${TEAL};text-decoration:underline;">${escapeHtml(data.merchantContactEmail)}</a>
       </p>`
    : "";

  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:8px 0 16px;">
          <p style="margin:0 0 8px;color:${TEXT_MUTED};font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">Receipt</p>
          <p style="margin:0 0 12px;color:${TEXT_PRIMARY};font-size:32px;font-weight:600;letter-spacing:-0.5px;">${moneyFormatted}</p>
          <span style="display:inline-block;padding:4px 12px;background:${status.bg};color:${status.color};font-size:11px;font-weight:600;letter-spacing:0.08em;border-radius:9999px;">${status.text}</span>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="text-align:center;padding-bottom:16px;border-bottom:1px solid ${BORDER};">
          <p style="margin:0 0 4px;color:${TEXT_PRIMARY};font-size:16px;font-weight:600;">${escapeHtml(data.merchantBusinessName)}</p>
          ${merchantLocation ? `<p style="margin:0;color:${TEXT_MUTED};font-size:12px;">${merchantLocation}</p>` : ""}
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr><td>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding:10px 0;color:${TEXT_SECONDARY};font-size:13px;">Date</td>
            <td style="padding:10px 0;color:${TEXT_PRIMARY};font-size:13px;text-align:right;">${fmtDateTime(data.createdAt)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:${TEXT_SECONDARY};font-size:13px;border-top:1px solid ${BORDER};">Reference</td>
            <td style="padding:10px 0;color:${TEXT_PRIMARY};font-size:13px;text-align:right;font-family:monospace;border-top:1px solid ${BORDER};">${escapeHtml(transactionRef)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:${TEXT_SECONDARY};font-size:13px;border-top:1px solid ${BORDER};">Payment method</td>
            <td style="padding:10px 0;color:${TEXT_PRIMARY};font-size:13px;text-align:right;border-top:1px solid ${BORDER};">${cardLine}</td>
          </tr>
          ${descriptionRow}
          ${refundRow}
        </table>
      </td></tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;background:${SURFACE};border:1px solid ${BORDER};border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;color:${TEXT_PRIMARY};font-size:14px;font-weight:600;">Total</td>
        <td style="padding:16px 20px;color:${TEXT_PRIMARY};font-size:18px;font-weight:600;text-align:right;letter-spacing:-0.31px;">${moneyFormatted}</td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:0 0 16px;">
          <p style="margin:0 0 8px;color:${TEXT_PRIMARY};font-size:14px;font-weight:500;">Thank you for your purchase.</p>
          ${merchantContactLine}
        </td>
      </tr>
    </table>
  `;

  const html = buildEmailHtml({
    baseUrl: data.baseUrl,
    preheader: `Receipt for ${moneyFormatted} from ${data.merchantBusinessName}`,
    content,
  });

  return { subject, html };
}
