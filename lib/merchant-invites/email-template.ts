function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface InviteEmailData {
  recipientEmail: string;
  businessName: string;
  inviterEmail: string;
  inviteUrl: string;
  note: string | null;
  expiresAt: Date;
}

export function buildInviteEmail(data: InviteEmailData): { subject: string; html: string } {
  const subject = `You've been invited to SalonTransact`;

  const noteBlock = data.note
    ? `<div style="background:#F0F9FF;border:1px solid #BFDBFE;border-radius:8px;padding:12px 16px;margin:16px 0;">
         <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#878787;font-weight:600;margin:0 0 4px;">Personal note from ${escapeHtml(data.inviterEmail)}</p>
         <p style="font-size:13px;color:#1A1313;margin:0;line-height:1.5;">${escapeHtml(data.note)}</p>
       </div>`
    : "";

  const expiresLabel = data.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FBFBFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Inter',sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="background:#FFFFFF;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="height:4px;background:linear-gradient(90deg,#017ea7 0%,#0290be 100%);border-radius:12px 12px 0 0;margin:-32px -32px 24px -32px;"></div>

      <h1 style="font-size:24px;font-weight:600;color:#1A1313;margin:0 0 8px;letter-spacing:-0.31px;">
        You're invited to SalonTransact
      </h1>
      <p style="font-size:14px;color:#878787;margin:0 0 16px;">
        ${escapeHtml(data.inviterEmail)} has invited <strong style="color:#1A1313;">${escapeHtml(data.businessName)}</strong> to join SalonTransact, the payment platform built for salon businesses.
      </p>

      ${noteBlock}

      <p style="font-size:14px;color:#4A4A4A;line-height:1.6;margin:16px 0 24px;">
        Click below to start your merchant application. We've already pre-filled your email and business name to save you time.
      </p>

      <div style="text-align:center;margin:24px 0;">
        <a href="${data.inviteUrl}" style="display:inline-block;padding:14px 28px;background:#017ea7;color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
          Start your application
        </a>
      </div>

      <p style="font-size:12px;color:#878787;margin:0;text-align:center;word-break:break-all;">
        Or copy this link: <a href="${data.inviteUrl}" style="color:#017ea7;text-decoration:none;">${data.inviteUrl}</a>
      </p>

      <p style="font-size:12px;color:#878787;margin:16px 0 0;text-align:center;">
        This invitation expires on ${expiresLabel}.
      </p>

      <p style="text-align:center;font-size:11px;color:#878787;margin-top:24px;padding-top:24px;border-top:1px solid #E8EAED;">
        SalonTransact by Reyna Pay LLC
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
