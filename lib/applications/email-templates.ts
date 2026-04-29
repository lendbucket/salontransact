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

export interface ApprovalEmailData {
  recipientEmail: string;
  businessName: string;
  baseUrl: string;
}

export interface RejectionEmailData {
  recipientEmail: string;
  businessName: string;
  baseUrl: string;
  reason: string | null;
}

export function buildApprovalEmail(data: ApprovalEmailData): { subject: string; html: string } {
  const subject = `Welcome to SalonTransact, ${data.businessName}`;
  const dashboardUrl = `${data.baseUrl}/dashboard`;

  const stepsHtml = emailSteps([
    {
      number: 1,
      title: "Sign in to your dashboard",
      description: "Use the email and password you set during your application.",
    },
    {
      number: 2,
      title: "Review your account details",
      description: "Confirm your business info, banking, and processing setup.",
    },
    {
      number: 3,
      title: "We finalize processor setup",
      description: "Our team is completing your payment processor onboarding. We'll email you the moment you're cleared to take live charges.",
    },
  ]);

  const content = `
${emailHeading(`Welcome to SalonTransact, ${escapeHtml(data.businessName)}`)}
${emailParagraph(`Your merchant application is approved. You can sign in now to review your account.`)}

${emailButton(dashboardUrl, "Sign in to your dashboard")}
${emailFallbackUrl(dashboardUrl)}

${emailDivider()}

${emailSubheading("What happens next")}
${stepsHtml}

${emailDivider()}

${emailMutedParagraph(`If you have any questions, reply to this email and we'll get back to you.`)}`;

  const html = buildEmailHtml({
    baseUrl: data.baseUrl,
    preheader: `${data.businessName} is approved on SalonTransact.`,
    content,
  });

  return { subject, html };
}

export function buildRejectionEmail(data: RejectionEmailData): { subject: string; html: string } {
  const subject = `Update on your SalonTransact application`;

  const reasonBlock = data.reason
    ? emailNoteBlock("Reason", escapeHtml(data.reason))
    : "";

  const content = `
${emailHeading(`Application status update`)}
${emailParagraph(`Thank you for applying to SalonTransact for ${escapeHtml(data.businessName)}. After reviewing your submission, we are not able to approve your account at this time.`)}

${reasonBlock}

${emailDivider()}

${emailMutedParagraph(`If you believe this decision was made in error, or if you'd like to discuss further, reply to this email and a member of our team will follow up with you.`)}`;

  const html = buildEmailHtml({
    baseUrl: data.baseUrl,
    preheader: `Update on your SalonTransact application for ${data.businessName}.`,
    content,
  });

  return { subject, html };
}
