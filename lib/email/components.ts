/**
 * Shared HTML email layout helpers.
 *
 * Brand language: modern minimal payment-platform aesthetic.
 * - White background (#FFFFFF outer, light gray border around content)
 * - Teal accent (#017ea7) for CTAs and links
 * - Inter sans font (system stack fallback)
 * - Logo hosted at /logo.png (served from public/logo.png)
 * - No serif fonts
 */

const BRAND_TEAL = "#017ea7";
const BRAND_TEAL_DARK = "#015f80";
const TEXT_PRIMARY = "#1A1313";
const TEXT_SECONDARY = "#4A4A4A";
const TEXT_MUTED = "#878787";
const BORDER = "#E8EAED";
const SURFACE = "#F9FAFB";
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailLayoutOptions {
  preheader?: string;
  baseUrl: string;
  content: string;
}

export function buildEmailHtml(opts: EmailLayoutOptions): string {
  const { baseUrl, content, preheader = "" } = opts;
  const logoUrl = `${baseUrl}/logo.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>SalonTransact</title>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:${FONT_STACK};color:${TEXT_PRIMARY};-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#FFFFFF;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ""}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFFFFF;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img src="${logoUrl}" alt="SalonTransact" width="200" style="display:block;height:auto;max-width:200px;border:0;">
            </td>
          </tr>
          <tr>
            <td style="background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 16px 0;text-align:center;">
              <p style="font-size:12px;color:${TEXT_MUTED};margin:0 0 4px;line-height:1.5;">
                SalonTransact &middot; Reyna Pay LLC
              </p>
              <p style="font-size:12px;color:${TEXT_MUTED};margin:0;line-height:1.5;">
                Payment infrastructure built for salon businesses
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="font-size:22px;font-weight:600;color:${TEXT_PRIMARY};margin:0 0 12px;letter-spacing:-0.31px;line-height:1.3;">${escapeHtml(text)}</h1>`;
}

export function emailSubheading(text: string): string {
  return `<h2 style="font-size:14px;font-weight:600;color:${TEXT_PRIMARY};margin:0 0 8px;line-height:1.4;">${escapeHtml(text)}</h2>`;
}

export function emailParagraph(text: string): string {
  return `<p style="font-size:14px;color:${TEXT_SECONDARY};margin:0 0 12px;line-height:1.6;">${text}</p>`;
}

export function emailMutedParagraph(text: string): string {
  return `<p style="font-size:13px;color:${TEXT_MUTED};margin:0 0 12px;line-height:1.5;">${text}</p>`;
}

export function emailButton(href: string, label: string): string {
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 16px;">
  <tr>
    <td align="center" style="border-radius:8px;background:${BRAND_TEAL};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;border:1px solid ${BRAND_TEAL_DARK};background:${BRAND_TEAL};">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;
}

export function emailFallbackUrl(url: string): string {
  return `
<p style="font-size:12px;color:${TEXT_MUTED};margin:0 0 16px;line-height:1.5;">
  If the button doesn't work, copy and paste this link into your browser:
  <br>
  <a href="${url}" style="color:${BRAND_TEAL};word-break:break-all;text-decoration:underline;">${escapeHtml(url)}</a>
</p>`;
}

export function emailDivider(): string {
  return `<hr style="border:none;border-top:1px solid ${BORDER};margin:20px 0;">`;
}

export function emailNoteBlock(label: string, content: string): string {
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
  <tr>
    <td style="background:${SURFACE};border-left:3px solid ${BRAND_TEAL};border-radius:4px;padding:12px 16px;">
      <p style="font-size:11px;font-weight:600;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">${escapeHtml(label)}</p>
      <p style="font-size:13px;color:${TEXT_PRIMARY};margin:0;line-height:1.5;">${content}</p>
    </td>
  </tr>
</table>`;
}

export interface StepItem {
  number: number;
  title: string;
  description: string;
}

export function emailSteps(items: StepItem[]): string {
  const stepsHtml = items
    .map(
      (s) => `
    <tr>
      <td style="padding:8px 0;vertical-align:top;width:32px;">
        <div style="width:24px;height:24px;border-radius:50%;background:${BRAND_TEAL};color:#FFFFFF;font-size:12px;font-weight:600;text-align:center;line-height:24px;">
          ${s.number}
        </div>
      </td>
      <td style="padding:8px 0 8px 12px;vertical-align:top;">
        <p style="font-size:13px;font-weight:600;color:${TEXT_PRIMARY};margin:0 0 2px;">${escapeHtml(s.title)}</p>
        <p style="font-size:13px;color:${TEXT_SECONDARY};margin:0;line-height:1.5;">${escapeHtml(s.description)}</p>
      </td>
    </tr>`
    )
    .join("");

  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
  ${stepsHtml}
</table>`;
}

export type Severity = "success" | "warning" | "error" | "info";

const SEVERITY_COLORS: Record<Severity, string> = {
  success: "#15803D",
  warning: "#92400E",
  error: "#DC2626",
  info: BRAND_TEAL,
};

export function severityColor(s: string): string {
  if (s === "success" || s === "warning" || s === "error" || s === "info") {
    return SEVERITY_COLORS[s as Severity];
  }
  return BRAND_TEAL;
}

export interface NotificationRow {
  title: string;
  message: string;
  severity: string;
  link?: string | null;
  baseUrl: string;
  ageLabel: string;
}

export function emailNotificationRow(row: NotificationRow): string {
  const dotColor = severityColor(row.severity);
  const linkHtml = row.link
    ? ` &middot; <a href="${row.baseUrl}${row.link}" style="color:${BRAND_TEAL};text-decoration:none;">View</a>`
    : "";
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top:1px solid ${BORDER};">
  <tr>
    <td style="padding:12px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="padding-right:8px;vertical-align:middle;">
            <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};"></div>
          </td>
          <td style="vertical-align:middle;">
            <p style="font-size:14px;font-weight:600;color:${TEXT_PRIMARY};margin:0;line-height:1.3;">${escapeHtml(row.title)}</p>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:${TEXT_SECONDARY};margin:6px 0 4px;line-height:1.5;padding-left:16px;">${escapeHtml(row.message)}</p>
      <p style="font-size:11px;color:${TEXT_MUTED};margin:0;line-height:1.4;padding-left:16px;">
        ${escapeHtml(row.ageLabel)}${linkHtml}
      </p>
    </td>
  </tr>
</table>`;
}

export function emailSectionLabel(text: string, count: number): string {
  return `
<p style="font-size:11px;font-weight:600;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;margin:20px 0 4px;">
  ${escapeHtml(text)} <span style="color:${TEXT_MUTED};font-weight:400;">(${count})</span>
</p>`;
}
