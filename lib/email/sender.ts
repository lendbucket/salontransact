/**
 * Shared "from:" address for all transactional emails sent via Resend.
 *
 * salontransact.com is verified in Resend. All app-generated emails
 * (magic links, invites, digests) use this single sender for consistency
 * and DKIM/SPF reputation.
 *
 * If you ever need a different sender for a specific email type, define
 * a sibling constant in this file rather than hardcoding inline.
 */
export const RESEND_FROM = "SalonTransact <noreply@salontransact.com>";
