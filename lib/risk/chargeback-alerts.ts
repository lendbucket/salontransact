import { prisma } from "@/lib/prisma";
import { RESEND_FROM } from "@/lib/email/sender";
import { sendSms } from "@/lib/sms/sender";
import {
  SAFE_THRESHOLD,
  WARNING_THRESHOLD,
  statusForRatio,
} from "./types";
import { listDisputes } from "@/lib/payroc/disputes";

const WINDOW_DAYS = 90;

interface AlertResult {
  merchantId: string;
  businessName: string;
  threshold: string;
  ratioPercent: number;
  chargebackCount: number;
  totalCharges: number;
  emailSent: boolean;
  smsSent: boolean;
}

/**
 * Runs daily chargeback ratio check across all active merchants.
 * Creates ChargebackAlert records and sends email/SMS for warning+ thresholds.
 */
export async function checkAndAlertMerchants(): Promise<{
  checked: number;
  alerts: AlertResult[];
  errors: string[];
}> {
  const merchants = await prisma.merchant.findMany({
    where: { status: "active" },
    select: { id: true, businessName: true, email: true, phone: true },
  });

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const alerts: AlertResult[] = [];
  const errors: string[] = [];

  for (const m of merchants) {
    try {
      const totalCharges = await prisma.transaction.count({
        where: { merchantId: m.id, status: "succeeded", createdAt: { gte: cutoff } },
      });

      if (totalCharges < 10) continue; // skip low-volume merchants

      // Local count: transactions we've marked status="disputed" via webhook/manual ops
      const localDisputedCount = await prisma.transaction.count({
        where: { merchantId: m.id, status: "disputed", createdAt: { gte: cutoff } },
      });

      // Authoritative count: pull from Payroc disputes API for the same window.
      // Payroc is the source of truth; if our local count is lower (webhook lag,
      // failed sync, etc.) we use Payroc's count to avoid under-reporting risk.
      let payrocDisputeCount = 0;
      try {
        const startDate = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD
        const endDate = new Date().toISOString().slice(0, 10);
        const payrocResp = await listDisputes({ startDate, endDate });
        // Note: Payroc /disputes returns disputes across all merchants on this
        // House Account config. Until Reyna Pay has per-merchant Payroc MIDs
        // (post Phase 9.4 cutover), filter by merchant identifiers we tag at
        // charge time. For UAT/single-merchant operation we accept the full count.
        payrocDisputeCount = payrocResp.disputes.length;
      } catch (e) {
        // Don't block the alert run on a Payroc API hiccup.
        // Fall back to local count, but log so we know.
        console.warn(
          `[CB-ALERT] Payroc /disputes fetch failed for ${m.id} — using local count only:`,
          e instanceof Error ? e.message : e
        );
      }

      // Use MAX as authoritative. If they disagree, log so the data team
      // can investigate webhook drift.
      const chargebackCount = Math.max(localDisputedCount, payrocDisputeCount);
      if (localDisputedCount !== payrocDisputeCount) {
        console.warn(
          `[CB-ALERT] Count drift for ${m.id}: local=${localDisputedCount}, payroc=${payrocDisputeCount}, using=${chargebackCount}`
        );
      }

      const ratio = (chargebackCount / totalCharges) * 100;
      const riskStatus = statusForRatio(ratio);

      if (riskStatus === "safe") continue; // no alert needed

      const threshold = riskStatus === "critical" ? "excessive" : "warning";

      // Check if we already sent an alert for this threshold today
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const existing = await prisma.chargebackAlert.findFirst({
        where: { merchantId: m.id, threshold, createdAt: { gte: todayStart } },
      });
      if (existing) continue;

      let emailSent = false;
      let smsSent = false;
      let emailSentTo: string | null = null;
      let smsSentTo: string | null = null;

      // Send email alert
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey && m.email) {
        try {
          const bandLabel = threshold === "excessive" ? "EXCESSIVE" : "WARNING";
          const subject = `[${bandLabel}] Chargeback ratio alert — ${m.businessName}`;
          const html = [
            `<h2>Chargeback Ratio Alert: ${bandLabel}</h2>`,
            `<p>Your merchant account <strong>${m.businessName}</strong> has a chargeback ratio of <strong>${ratio.toFixed(2)}%</strong> over the last ${WINDOW_DAYS} days.</p>`,
            `<ul>`,
            `<li>Total charges: ${totalCharges}</li>`,
            `<li>Chargebacks: ${chargebackCount}</li>`,
            `<li>Ratio: ${ratio.toFixed(2)}%</li>`,
            `<li>Threshold: ${threshold === "excessive" ? `Excessive (≥${WARNING_THRESHOLD}%)` : `Warning (≥${SAFE_THRESHOLD}%)`}</li>`,
            `</ul>`,
            threshold === "excessive"
              ? `<p style="color: #dc2626; font-weight: bold;">Your account is at risk of being placed in a card brand monitoring program. Immediate action is required.</p>`
              : `<p style="color: #d97706; font-weight: bold;">Please review your recent disputes and take corrective action to avoid further escalation.</p>`,
            `<p>— SalonTransact Risk Monitoring</p>`,
          ].join("\n");

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: RESEND_FROM,
              to: m.email,
              subject,
              html,
            }),
          });
          if (res.ok) {
            emailSent = true;
            emailSentTo = m.email;
          } else {
            const body = await res.text().catch(() => "");
            console.error(`[CB-ALERT] Email failed for ${m.id}: ${res.status} ${body}`);
          }
        } catch (e) {
          console.error(`[CB-ALERT] Email exception for ${m.id}:`, e);
        }
      }

      // Send SMS alert
      if (m.phone) {
        try {
          const bandLabel = threshold === "excessive" ? "EXCESSIVE" : "WARNING";
          const smsBody = `[SalonTransact] ${bandLabel}: Your chargeback ratio is ${ratio.toFixed(2)}% (${chargebackCount}/${totalCharges}) over ${WINDOW_DAYS} days. Log in to review.`;
          const result = await sendSms({ to: m.phone, body: smsBody });
          if (result.ok) {
            smsSent = true;
            smsSentTo = m.phone;
          }
        } catch (e) {
          console.error(`[CB-ALERT] SMS exception for ${m.id}:`, e);
        }
      }

      // Persist the alert
      await prisma.chargebackAlert.create({
        data: {
          merchantId: m.id,
          threshold,
          ratioPercent: ratio,
          chargebackCount,
          totalCharges,
          windowDays: WINDOW_DAYS,
          emailSentTo,
          smsSentTo,
          emailSentAt: emailSent ? new Date() : null,
          smsSentAt: smsSent ? new Date() : null,
        },
      });

      alerts.push({
        merchantId: m.id,
        businessName: m.businessName,
        threshold,
        ratioPercent: ratio,
        chargebackCount,
        totalCharges,
        emailSent,
        smsSent,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${m.id}: ${msg}`);
      console.error(`[CB-ALERT] Error processing merchant ${m.id}:`, e);
    }
  }

  return { checked: merchants.length, alerts, errors };
}
