import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payrocRequest } from "@/lib/payroc/client";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!session?.user || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { userId },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: "Merchant not found" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      token,
      amount,
      description,
      customerFirstName,
      customerLastName,
      customerEmail,
      orderId,
    } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Payment token is required" },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(amount * 100);
    const terminalId = process.env.PAYROC_TERMINAL_ID;

    const paymentPayload = {
      channel: "web",
      processingTerminalId: terminalId,
      order: {
        amount: amountInCents,
        currency: "USD",
        orderId: orderId || crypto.randomUUID().slice(0, 8).toUpperCase(),
        description: description || undefined,
      },
      paymentMethod: {
        type: "singleUseToken",
        token,
      },
      customer: {
        firstName: customerFirstName || undefined,
        lastName: customerLastName || undefined,
        emailAddress: customerEmail || undefined,
      },
    };

    console.log("[CHECKOUT] Sending payment to Payroc:", JSON.stringify(paymentPayload, null, 2));

    const result = await payrocRequest<{
      paymentId?: string;
      responseCode?: string;
      responseMessage?: string;
      approvalCode?: string;
      order?: { amount?: number };
      card?: { lastFour?: string; scheme?: string };
      status?: string;
    }>("POST", "/payments", paymentPayload);

    console.log("[CHECKOUT] Payroc response:", JSON.stringify(result, null, 2));

    // Check for approval
    const approved = result.responseCode === "A";

    if (approved) {
      const amountDollars = (result.order?.amount ?? amountInCents) / 100;

      await prisma.transaction.create({
        data: {
          merchantId: merchant.id,
          amount: amountDollars,
          currency: "usd",
          status: "succeeded",
          description: description ?? null,
          customerEmail: customerEmail ?? null,
          customerName:
            [customerFirstName, customerLastName]
              .filter(Boolean)
              .join(" ") || null,
          fee: 0,
          net: amountDollars,
          metadata: {
            payrocPaymentId: result.paymentId,
            orderId,
            approvalCode: result.approvalCode,
            last4: result.card?.lastFour,
            cardBrand: result.card?.scheme,
          },
        },
      });

      return NextResponse.json({
        success: true,
        paymentId: result.paymentId,
        approvalCode: result.approvalCode,
        last4: result.card?.lastFour,
        amount: result.order?.amount ?? amountInCents,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.responseMessage || "Payment declined",
        responseCode: result.responseCode,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("[CHECKOUT] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
