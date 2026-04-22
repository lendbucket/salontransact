import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPayment } from "@/lib/payroc/payments";

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
      return NextResponse.json({ error: "Merchant not found" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.order || !body.payment) {
      return NextResponse.json(
        { error: "Missing required fields: order, payment" },
        { status: 400 }
      );
    }

    if (!body.payment.amount || body.payment.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (!body.payment.cardAccount?.token) {
      return NextResponse.json(
        { error: "Card token is required" },
        { status: 400 }
      );
    }

    const paymentResult = await createPayment({
      order: body.order,
      customer: body.customer,
      payment: body.payment,
    });

    if (paymentResult.status === "approved") {
      const amountInDollars = paymentResult.amount / 100;
      const tipInDollars = paymentResult.tip ? paymentResult.tip / 100 : 0;

      await prisma.transaction.create({
        data: {
          merchantId: merchant.id,
          amount: amountInDollars + tipInDollars,
          currency: paymentResult.currency?.toLowerCase() ?? "usd",
          status: "succeeded",
          description: body.order.description ?? null,
          customerEmail: body.customer?.email ?? null,
          customerName:
            [body.customer?.firstName, body.customer?.lastName]
              .filter(Boolean)
              .join(" ") || null,
          fee: 0,
          net: amountInDollars + tipInDollars,
          metadata: {
            payrocPaymentId: paymentResult.paymentId,
            orderId: body.order.orderId,
            approvalCode: paymentResult.approvalCode,
            last4: paymentResult.cardAccount?.last4,
            cardBrand: paymentResult.cardAccount?.cardBrand,
            tip: tipInDollars,
          },
        },
      });
    }

    return NextResponse.json(paymentResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
