import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const merchant = await prisma.merchant.findUnique({ where: { userId } });
  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  try {
    let accountId = merchant.stripeAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: merchant.email,
        country: "US",
        business_type: "company",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: merchant.businessName,
        },
        metadata: {
          merchantId: merchant.id,
          userId,
        },
      });

      accountId = account.id;

      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { stripeAccountId: accountId },
      });
    }

    const origin =
      request.headers.get("origin") ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/settings?stripe=refresh`,
      return_url: `${origin}/settings?stripe=return`,
      type: "account_onboarding",
    });

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { stripeOnboardingUrl: link.url },
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error("[stripe/connect]", err);
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
