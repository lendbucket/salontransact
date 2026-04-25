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
    const finalOrderId =
      orderId || crypto.randomUUID().slice(0, 8).toUpperCase();

    const paymentPayload = {
      channel: "web",
      processingTerminalId: terminalId,
      operator: merchant.businessName || "SalonTransact",
      order: {
        orderId: finalOrderId,
        orderDate: new Date().toISOString().split("T")[0],
        description: description || "Payment",
        amount: amountInCents,
        currency: "USD",
      },
      paymentMethod: {
        type: "singleUseToken",
        token,
      },
      customer:
        customerFirstName || customerLastName || customerEmail
          ? {
              firstName: customerFirstName || undefined,
              lastName: customerLastName || undefined,
              emailAddress: customerEmail || undefined,
            }
          : undefined,
    };

    console.log("[CHECKOUT] Payment payload:", JSON.stringify(paymentPayload));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await payrocRequest<any>("POST", "/payments", paymentPayload);

    console.log("[CHECKOUT] Payroc response:", JSON.stringify(response));

    // Check for approval — Payroc uses transactionResult.responseCode or top-level responseCode
    const responseCode =
      response.transactionResult?.responseCode ?? response.responseCode;
    const responseMessage =
      response.transactionResult?.responseMessage ?? response.responseMessage;
    const approvalCode =
      response.transactionResult?.approvalCode ?? response.approvalCode;
    const last4 =
      response.card?.cardNumber?.slice(-4) ??
      response.card?.lastFour ??
      response.card?.last4;
    const cardScheme =
      response.card?.type ?? response.card?.scheme ?? response.card?.cardBrand;
    const paymentId = response.paymentId;
    const orderAmount = response.order?.amount ?? amountInCents;

    if (responseCode === "A") {
      const amountDollars = orderAmount / 100;

      try {
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
              payrocPaymentId: paymentId,
              orderId: finalOrderId,
              approvalCode,
              last4,
              cardBrand: cardScheme,
            },
          },
        });
      } catch (dbErr) {
        console.error("[CHECKOUT] DB save failed (non-fatal):", dbErr);
      }

      return NextResponse.json({
        success: true,
        paymentId,
        approvalCode,
        last4,
        cardBrand: cardScheme,
        amount: orderAmount,
      });
    }

    return NextResponse.json({
      success: false,
      declineReason: responseMessage || "Payment declined",
      responseCode,
    });
  } catch (error) {
    console.error("[CHECKOUT] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
