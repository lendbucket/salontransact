import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await prisma.merchant.updateMany({
          where: { stripeAccountId: account.id },
          data: {
            chargesEnabled: account.charges_enabled ?? false,
            payoutsEnabled: account.payouts_enabled ?? false,
            stripeAccountStatus:
              account.charges_enabled && account.payouts_enabled
                ? "active"
                : account.details_submitted
                  ? "pending_verification"
                  : "pending",
          },
        });
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const accountId = event.account;
        if (!accountId) break;

        const merchant = await prisma.merchant.findUnique({
          where: { stripeAccountId: accountId },
        });
        if (!merchant) break;

        const amount = pi.amount / 100;
        const fee = pi.application_fee_amount
          ? pi.application_fee_amount / 100
          : 0;
        const net = amount - fee;

        const charge = pi.latest_charge
          ? await stripe.charges.retrieve(
              pi.latest_charge as string,
              undefined,
              { stripeAccount: accountId }
            )
          : null;

        await prisma.transaction.upsert({
          where: { stripePaymentId: pi.id },
          create: {
            merchantId: merchant.id,
            stripePaymentId: pi.id,
            amount,
            currency: pi.currency,
            status: "succeeded",
            description: pi.description,
            customerEmail: charge?.billing_details?.email ?? null,
            customerName: charge?.billing_details?.name ?? null,
            fee,
            net,
          },
          update: {
            status: "succeeded",
            amount,
            fee,
            net,
          },
        });

        await prisma.merchant.update({
          where: { id: merchant.id },
          data: {
            totalVolume: { increment: amount },
            monthlyVolume: { increment: amount },
            totalTransactions: { increment: 1 },
          },
        });
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        const accountId = event.account;
        if (!accountId) break;

        const merchant = await prisma.merchant.findUnique({
          where: { stripeAccountId: accountId },
        });
        if (!merchant) break;

        await prisma.payout.upsert({
          where: { stripePayoutId: payout.id },
          create: {
            merchantId: merchant.id,
            stripePayoutId: payout.id,
            amount: payout.amount / 100,
            currency: payout.currency,
            status: "paid",
            arrivalDate: new Date(payout.arrival_date * 1000),
            description: payout.description,
          },
          update: {
            status: "paid",
            arrivalDate: new Date(payout.arrival_date * 1000),
          },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe/webhook]", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
