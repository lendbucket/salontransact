import { prisma } from "@/lib/prisma";

export interface EvidencePack {
  dispute_id: string;
  transaction: {
    id: string;
    payroc_payment_id: string | null;
    amount_cents: number;
    currency: string;
    status: string;
    description: string | null;
    created_at: string;
    captured_at: string | null;
    risk_score: number;
    risk_factors: unknown;
    refunded: boolean;
    refund_amount_cents: number;
  };
  customer: {
    id: string | null;
    email: string | null;
    name: string | null;
    phone: string | null;
    first_seen_at: string | null;
    last_seen_at: string | null;
    total_transactions: number;
    total_spent_cents: number;
    days_active: number | null;
  } | null;
  card: { id: string; last4: string | null; brand: string | null; expiry: string | null } | null;
  customer_history: {
    successful_charges: number;
    total_spent_cents: number;
    earliest_charge_at: string | null;
    latest_charge_at: string | null;
    average_charge_cents: number;
    recent_charges: Array<{ id: string; amount_cents: number; created_at: string; status: string }>;
  } | null;
  booking: {
    id: string;
    scheduled_for: string;
    status: string;
    service_name: string | null;
    duration_minutes: number;
    stylist_id: string | null;
    auth_hold_amount_cents: number | null;
  } | null;
  audit_trail: Array<{ action: string; actor: string; at: string; metadata: unknown }>;
  generated_at: string;
}

export async function buildEvidencePack(args: {
  merchantId: string;
  disputeId: string;
  transactionId: string;
}): Promise<EvidencePack | null> {
  const txn = await prisma.transaction.findUnique({
    where: { id: args.transactionId },
    include: {
      customer: true,
      booking: { include: { savedPaymentMethod: true } },
    },
  });

  if (!txn || txn.merchantId !== args.merchantId) return null;

  const meta = (txn.metadata as Record<string, unknown> | null) ?? {};
  const payrocPaymentId = typeof meta.payrocPaymentId === "string" ? meta.payrocPaymentId : null;

  let customerHistory: EvidencePack["customer_history"] = null;
  if (txn.customerId) {
    const successful = await prisma.transaction.findMany({
      where: { customerId: txn.customerId, status: "succeeded", id: { not: txn.id } },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, amount: true, createdAt: true, status: true },
    });
    const totalCents = successful.reduce((s, t) => s + Math.round(t.amount * 100), 0);
    const dates = successful.map(s => s.createdAt).sort((a, b) => a.getTime() - b.getTime());
    customerHistory = {
      successful_charges: successful.length,
      total_spent_cents: totalCents,
      earliest_charge_at: dates[0]?.toISOString() ?? null,
      latest_charge_at: dates[dates.length - 1]?.toISOString() ?? null,
      average_charge_cents: successful.length > 0 ? Math.round(totalCents / successful.length) : 0,
      recent_charges: successful.slice(0, 10).map(s => ({
        id: `ch_${s.id}`,
        amount_cents: Math.round(s.amount * 100),
        created_at: s.createdAt.toISOString(),
        status: s.status,
      })),
    };
  }

  let card: EvidencePack["card"] = null;
  if (txn.booking?.savedPaymentMethod) {
    const c = txn.booking.savedPaymentMethod;
    card = { id: c.id, last4: c.last4, brand: c.cardScheme, expiry: c.expiryMonth && c.expiryYear ? `${c.expiryMonth}/${c.expiryYear}` : null };
  }

  const auditEntries = await prisma.auditLog.findMany({
    where: { merchantId: args.merchantId, OR: [{ targetId: txn.id }, { targetId: `ch_${txn.id}` }] },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let daysActive: number | null = null;
  if (txn.customer) {
    daysActive = Math.floor((txn.customer.lastSeenAt.getTime() - txn.customer.firstSeenAt.getTime()) / 86400000);
  }

  return {
    dispute_id: args.disputeId,
    transaction: {
      id: `ch_${txn.id}`,
      payroc_payment_id: payrocPaymentId,
      amount_cents: Math.round(txn.amount * 100),
      currency: txn.currency,
      status: txn.status,
      description: txn.description,
      created_at: txn.createdAt.toISOString(),
      captured_at: typeof meta.capturedAt === "string" ? meta.capturedAt : txn.createdAt.toISOString(),
      risk_score: txn.riskScore,
      risk_factors: txn.riskFactors,
      refunded: txn.refunded,
      refund_amount_cents: Math.round(txn.refundAmount * 100),
    },
    customer: txn.customer ? {
      id: txn.customer.id, email: txn.customer.email, name: txn.customer.name, phone: txn.customer.phone,
      first_seen_at: txn.customer.firstSeenAt.toISOString(), last_seen_at: txn.customer.lastSeenAt.toISOString(),
      total_transactions: txn.customer.totalTransactions, total_spent_cents: txn.customer.totalSpentCents,
      days_active: daysActive,
    } : null,
    card,
    customer_history: customerHistory,
    booking: txn.booking ? {
      id: txn.booking.id, scheduled_for: txn.booking.scheduledFor.toISOString(), status: txn.booking.status,
      service_name: txn.booking.serviceName, duration_minutes: txn.booking.durationMinutes,
      stylist_id: txn.booking.stylistId, auth_hold_amount_cents: txn.booking.authHoldAmountCents,
    } : null,
    audit_trail: auditEntries.map(a => ({ action: a.action, actor: a.actorId ?? "system", at: a.createdAt.toISOString(), metadata: a.metadata })),
    generated_at: new Date().toISOString(),
  };
}
