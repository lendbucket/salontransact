import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPayrocToken } from "@/lib/payroc/client";
import { createSecureToken } from "@/lib/payroc/tokens";
import { isPayrocApiError } from "@/lib/payroc/errors";
import crypto from "crypto";

export async function POST(request: Request) {
  console.log("\n=== PAYMENT REQUEST DEBUG START ===");

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
    console.log("[PAYMENT-DEBUG] Raw request body:", JSON.stringify(body, null, 2));

    const {
      token,
      amount,
      description,
      customerFirstName,
      customerLastName,
      customerEmail,
      orderId,
      saveCard,
      secureTokenId,
    } = body;

    console.log("[PAYMENT-DEBUG] Token:", token?.substring(0, 30) + "...");
    console.log("[PAYMENT-DEBUG] Amount:", amount, "type:", typeof amount);

    if (!token && !secureTokenId) {
      return NextResponse.json(
        { error: "Either token or secureTokenId is required" },
        { status: 400 }
      );
    }
    if (token && secureTokenId) {
      return NextResponse.json(
        { error: "Provide either token or secureTokenId, not both" },
        { status: 400 }
      );
    }
    if (secureTokenId && typeof secureTokenId !== "string") {
      return NextResponse.json(
        { error: "secureTokenId must be a string" },
        { status: 400 }
      );
    }
    if (secureTokenId && saveCard === true) {
      return NextResponse.json(
        { error: "Cannot saveCard when using an existing secureTokenId" },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    const parsedAmount =
      typeof amount === "string" ? parseFloat(amount) : amount;
    const amountInCents = Math.round(parsedAmount * 100);
    const terminalId = process.env.PAYROC_TERMINAL_ID;

    // ----- OPTIONAL SAVE CARD FLOW -----
    let secureTokenIdForPayment: string | null = null;
    let savedCardRowId: string | null = null;

    if (saveCard === true) {
      const trimmedEmail =
        typeof customerEmail === "string"
          ? customerEmail.trim().toLowerCase()
          : "";
      if (!trimmedEmail || trimmedEmail.length === 0 || !trimmedEmail.includes("@")) {
        return NextResponse.json(
          { error: "customerEmail is required when saveCard is true" },
          { status: 400 }
        );
      }

      try {
        console.log("[CHECKOUT-SAVE] Exchanging single-use token for Secure Token");
        const secureToken = await createSecureToken({
          source: { type: "singleUseToken", token: token },
          mitAgreement: "unscheduled",
          operator: (merchant.businessName || "SalonTransact").slice(0, 50),
        });
        // secureTokenIdForPayment holds the 12-19 digit token used in payment paymentMethod.token,
        // NOT the MREF_ secureTokenId used for token management
        secureTokenIdForPayment = secureToken.token;
        console.log(
          "[CHECKOUT-SAVE] Secure Token created:",
          secureToken.secureTokenId
        );

        let expiryMonth: string | null = null;
        let expiryYear: string | null = null;
        if (
          typeof secureToken.source.expiryDate === "string" &&
          secureToken.source.expiryDate.length === 4
        ) {
          expiryMonth = secureToken.source.expiryDate.slice(0, 2);
          expiryYear = `20${secureToken.source.expiryDate.slice(2, 4)}`;
        }
        let extractedLast4: string | null = null;
        if (typeof secureToken.source.cardNumber === "string") {
          const m = secureToken.source.cardNumber.match(/(\d{4})$/);
          extractedLast4 = m ? m[1] : null;
        }

        try {
          const row = await prisma.savedPaymentMethod.create({
            data: {
              merchantId: merchant.id,
              customerEmail: trimmedEmail,
              payrocSecureTokenId: secureToken.secureTokenId,
              payrocToken: secureToken.token,
              cardScheme: null,
              last4: extractedLast4,
              expiryMonth,
              expiryYear,
              cardholderName: secureToken.source.cardholderName ?? null,
              label: null,
              status: "active",
              mitAgreement: "unscheduled",
            },
          });
          savedCardRowId = row.id;
          console.log(
            "[CHECKOUT-SAVE] SavedPaymentMethod row created:",
            row.id,
            "payrocToken (first 8):",
            secureToken.token?.slice(0, 8)
          );
        } catch (dbErr) {
          console.error(
            "[CHECKOUT-SAVE] SavedPaymentMethod DB save failed (non-fatal):",
            dbErr
          );
        }
      } catch (tokenErr) {
        const message =
          tokenErr instanceof Error ? tokenErr.message : "Unknown error";
        console.error(
          "[CHECKOUT-SAVE] Secure Token creation failed:",
          message
        );
        if (isPayrocApiError(tokenErr)) {
          console.error(
            "[CHECKOUT-SAVE] Payroc error body:",
            JSON.stringify(tokenErr.body, null, 2)
          );
          console.error(
            "[CHECKOUT-SAVE] Payroc error status:",
            tokenErr.status,
            "path:",
            tokenErr.path
          );
        } else {
          console.error(
            "[CHECKOUT-SAVE] Non-Payroc error:",
            tokenErr instanceof Error ? tokenErr.stack : String(tokenErr)
          );
        }
        return NextResponse.json(
          {
            success: false,
            error: `Failed to save card: ${message}`.slice(0, 500),
          },
          { status: 502 }
        );
      }
    }
    // ----- END SAVE CARD FLOW -----

    // ----- SAVED CARD CHARGE FLOW -----
    let savedCardRowForCharge: { id: string; payrocSecureTokenId: string } | null = null;

    if (secureTokenId) {
      try {
        const savedRow = await prisma.savedPaymentMethod.findFirst({
          where: {
            id: secureTokenId,
            merchantId: merchant.id,
            status: "active",
          },
          select: {
            id: true,
            payrocSecureTokenId: true,
            payrocToken: true,
          },
        });
        if (!savedRow) {
          return NextResponse.json(
            { error: "Saved card not found or not accessible" },
            { status: 404 }
          );
        }
        if (!savedRow.payrocToken) {
          return NextResponse.json(
            {
              error:
                "Saved card is missing payment token (created before payrocToken column was added). Save the card again.",
            },
            { status: 409 }
          );
        }
        savedCardRowForCharge = {
          id: savedRow.id,
          payrocSecureTokenId: savedRow.payrocSecureTokenId,
        };
        secureTokenIdForPayment = savedRow.payrocToken;
        console.log(
          "[CHECKOUT-SAVED-CARD] Resolved saved card",
          savedRow.id,
          "→ payment token (first 8):",
          savedRow.payrocToken.slice(0, 8)
        );
      } catch (lookupErr) {
        const message =
          lookupErr instanceof Error ? lookupErr.message : "Unknown error";
        console.error("[CHECKOUT-SAVED-CARD] Lookup failed:", message);
        return NextResponse.json(
          { error: "Failed to resolve saved card" },
          { status: 500 }
        );
      }
    }
    // ----- END SAVED CARD CHARGE FLOW -----

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
      paymentMethod: secureTokenIdForPayment
        ? {
            type: "secureToken",
            token: secureTokenIdForPayment,
          }
        : {
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

    // Validate all required fields before sending
    const checks: Record<string, unknown> = {
      "channel": paymentPayload.channel,
      "processingTerminalId": paymentPayload.processingTerminalId,
      "order.orderId": paymentPayload.order.orderId,
      "order.amount": paymentPayload.order.amount,
      "order.currency": paymentPayload.order.currency,
      "paymentMethod.type": paymentPayload.paymentMethod.type,
      "paymentMethod.token": paymentPayload.paymentMethod.token,
    };

    console.log("[PAYMENT-DEBUG] Required fields check:");
    for (const [field, value] of Object.entries(checks)) {
      const ok = value !== undefined && value !== null && value !== "";
      console.log(`  ${ok ? "OK" : "MISSING"}: ${field} = ${value}`);
    }

    console.log("[PAYMENT-DEBUG] Full Payroc payload:", JSON.stringify(paymentPayload, null, 2));

    // Get bearer token and send directly so we can capture raw response
    const bearerToken = await getPayrocToken();
    const apiUrl = process.env.PAYROC_API_URL;

    const payrRes = await fetch(`${apiUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
        "Idempotency-Key": crypto.randomUUID(),
        Accept: "application/json",
      },
      body: JSON.stringify(paymentPayload),
    });

    const responseText = await payrRes.text();

    console.log("[PAYMENT-DEBUG] Payroc HTTP status:", payrRes.status);
    console.log("[PAYMENT-DEBUG] Payroc response headers:");
    payrRes.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
    console.log("[PAYMENT-DEBUG] Payroc response body (raw):", responseText);

    if (!payrRes.ok) {
      let errorDetail = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorDetail = JSON.stringify(errorJson, null, 2);
        console.log("[PAYMENT-DEBUG] Error type:", errorJson.type);
        console.log("[PAYMENT-DEBUG] Error title:", errorJson.title);
        console.log("[PAYMENT-DEBUG] Error detail:", errorJson.detail);
        if (errorJson.errors) {
          console.log("[PAYMENT-DEBUG] Error fields:", JSON.stringify(errorJson.errors, null, 2));
        }
      } catch {
        // not JSON
      }
      console.log("=== PAYMENT REQUEST DEBUG END (PAYROC ERROR) ===\n");
      return NextResponse.json({
        success: false,
        error: `Payroc error: ${payrRes.status}`,
        declineReason: errorDetail,
      });
    }

    const response = JSON.parse(responseText);
    console.log("[PAYMENT-DEBUG] Payroc parsed response:", JSON.stringify(response, null, 2));

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

    console.log("[PAYMENT-DEBUG] responseCode:", responseCode);
    console.log("[PAYMENT-DEBUG] approvalCode:", approvalCode);
    console.log("[PAYMENT-DEBUG] last4:", last4);
    console.log("=== PAYMENT REQUEST DEBUG END ===\n");

    if (responseCode === "A") {
      const amountDollars = orderAmount / 100;

      let dbSaveError: string | null = null;
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
        console.log("[CHECKOUT] Transaction row created in local DB");
      } catch (dbErr) {
        dbSaveError =
          dbErr instanceof Error
            ? `${dbErr.name}: ${dbErr.message}`
            : String(dbErr);
        console.error("[CHECKOUT] DB save failed (non-fatal):", dbErr);
        console.error("[CHECKOUT] DB save failed (full):", JSON.stringify(dbErr, Object.getOwnPropertyNames(dbErr)));
      }

      // Update lastUsedAt on the saved card row when charging via secureTokenId
      if (savedCardRowForCharge) {
        try {
          await prisma.savedPaymentMethod.update({
            where: { id: savedCardRowForCharge.id },
            data: { lastUsedAt: new Date() },
          });
        } catch (touchErr) {
          console.error(
            "[CHECKOUT-SAVED-CARD] lastUsedAt update failed (non-fatal):",
            touchErr
          );
        }
      }

      return NextResponse.json({
        success: true,
        paymentId,
        approvalCode,
        last4,
        cardBrand: cardScheme,
        amount: orderAmount,
        savedCardId: savedCardRowId,
        _debug_dbSaveError: dbSaveError,
      });
    }

    return NextResponse.json({
      success: false,
      declineReason: responseMessage || "Payment declined",
      responseCode,
    });
  } catch (error) {
    console.error("[PAYMENT-DEBUG] Unhandled error:", error);
    console.log("=== PAYMENT REQUEST DEBUG END (EXCEPTION) ===\n");
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
