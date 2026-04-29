import {
  buildEmailHtml,
  emailHeading,
  emailParagraph,
  emailButton,
  emailFallbackUrl,
  emailDivider,
  emailMutedParagraph,
  emailNoteBlock,
  emailSubheading,
  emailSteps,
  escapeHtml,
} from "@/lib/email/components";

export interface InviteEmailData {
  recipientEmail: string;
  businessName: string;
  inviterEmail: string;
  inviteUrl: string;
  baseUrl: string;
  note: string | null;
  expiresAt: Date;
}

export function buildInviteEmail(data: InviteEmailData): { subject: string; html: string } {
  const subject = `Your SalonTransact application is ready, ${data.businessName}`;

  const expiresLabel = data.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const noteHtml = data.note
    ? emailNoteBlock(`Note from ${data.inviterEmail}`, escapeHtml(data.note))
    : "";

  const stepsHtml = emailSteps([
    {
      number: 1,
      title: "Click the button above",
      description: "It opens your pre-filled merchant application — no signup needed.",
    },
    {
      number: 2,
      title: "Review and complete",
      description: `We've already pre-filled your email and ${data.businessName} business name to save you time.`,
    },
    {
      number: 3,
      title: "We review within 1–2 business days",
      description: "You'll get an email when your account is approved and you can start accepting payments.",
    },
  ]);

  const content = `
${emailHeading(`Welcome to SalonTransact, ${escapeHtml(data.businessName)}`)}
${emailParagraph(`<strong style="color:#1A1313;">${escapeHtml(data.inviterEmail)}</strong> has invited you to join SalonTransact, the payment platform built for salon businesses.`)}

${noteHtml}

${emailButton(data.inviteUrl, "Start your application")}
${emailFallbackUrl(data.inviteUrl)}

${emailDivider()}

${emailSubheading("What to expect")}
${stepsHtml}

${emailDivider()}

${emailMutedParagraph(`This invitation expires on <strong>${escapeHtml(expiresLabel)}</strong>. If you weren't expecting this, you can ignore the email.`)}`;

  const html = buildEmailHtml({
    baseUrl: data.baseUrl,
    preheader: `${data.inviterEmail} invited ${data.businessName} to apply on SalonTransact.`,
    content,
  });

  return { subject, html };
}
