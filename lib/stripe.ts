import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

export const stripe = new Stripe(key ?? "sk_test_placeholder", {
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
});

export const PLATFORM_ACCOUNT_ID = "acct_1TKSd011Rgm1NBOj";
