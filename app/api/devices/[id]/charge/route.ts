import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPaymentInstruction } from "@/lib/payroc/devices";
import { persistDeviceCharge } from "@/lib/devices/persistence";
import type {
  PaymentInstructionOrder,
  PaymentInstructionCustomizationOptions,
} from "@/lib/payroc/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChargeBody {
  amount?: unknown;
  description?: unknown;
  orderId?: unknown;
  promptForTip?: unknown;
  promptForSignature?: unknown;
  autoCapture?: unknown;
  processAsSale?: unknown;
}

function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ST${ts}-${rand}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal" && user.role !== "merchant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const device = await prisma.device.findUnique({
    where: { id },
    select: {
      id: true,
      serialNumber: true,
      merchantId: true,
      status: true,
    },
  });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }
  if (device.status !== "active") {
    return NextResponse.json(
      { error: "Device is not active. Activate it first via PATCH." },
      { status: 409 }
    );
  }

  if (user.role === "merchant") {
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!merchant || merchant.id !== device.merchantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let body: ChargeBody;
  try {
    body = (await request.json()) as ChargeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body.amount !== "number" ||
    !Number.isInteger(body.amount) ||
    body.amount <= 0
  ) {
    return NextResponse.json(
      { error: "amount must be a positive integer in cents" },
      { status: 400 }
    );
  }

  let description: string | undefined;
  if (body.description !== undefined) {
    if (
      typeof body.description !== "string" ||
      body.description.length > 100
    ) {
      return NextResponse.json(
        { error: "description must be a string <= 100 chars" },
        { status: 400 }
      );
    }
    description = body.description.trim();
  }

  let orderId: string;
  if (body.orderId !== undefined) {
    if (
      typeof body.orderId !== "string" ||
      body.orderId.length === 0 ||
      body.orderId.length > 50
    ) {
      return NextResponse.json(
        { error: "orderId must be a string 1-50 chars" },
        { status: 400 }
      );
    }
    orderId = body.orderId;
  } else {
    orderId = generateOrderId();
  }

  // NOTE Phase 8: Payroc Pay-by-Cloud customizationOptions only documents
  // entryMethod. Sending promptForTip or promptForSignature causes a 400.
  // Tip + signature prompts are configured per-terminal in Self-Care Portal.
  // Question in flight to Matt/Chris (Payroc) — email 2026-04-27.
  // Until then, accept from UI but DO NOT forward to Payroc.
  const customizationOptions: PaymentInstructionCustomizationOptions = {};
  // Future: if (body.promptForTip === true) customizationOptions.promptForTip = true;
  // Future: if (body.promptForSignature === true) customizationOptions.promptForSignature = true;

  const order: PaymentInstructionOrder = {
    orderId,
    amount: body.amount,
    currency: "USD",
  };
  if (description) order.description = description;

  // NOTE: Payroc Cloud does not accept processAsSale on payment instructions.
  // Per Chris Boutwell at Payroc (email 2026-04-28): "Remove processAsSale,
  // or set it to false. It's not compatible with Payroc Cloud."
  let result;
  try {
    result = await sendPaymentInstruction(device.serialNumber, {
      order,
      autoCapture:
        typeof body.autoCapture === "boolean" ? body.autoCapture : true,
      operator: user.email?.slice(0, 50),
      customizationOptions:
        Object.keys(customizationOptions).length > 0
          ? customizationOptions
          : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Payroc rejected payment instruction: ${message}`.slice(0, 500),
      },
      { status: 502 }
    );
  }

  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastChargeAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  // Write instruction→merchant mapping so the polling route can find the merchant
  try {
    await prisma.payrocPaymentRecord.create({
      data: {
        payrocPaymentId: result.paymentInstructionId,
        merchantId: device.merchantId,
        amountCents: body.amount as number,
        status: "pending",
        source: "device-instruction",
      },
    });
  } catch (mapErr) {
    // Non-fatal — unique constraint means we already mapped this instruction
    console.log("[DEVICE-CHARGE] Mapping write skipped (likely duplicate):", mapErr instanceof Error ? mapErr.message : "");
  }

  // Synchronous completion: rare but possible
  if (result.status === "completed" && result.paymentInstructionId) {
    try {
      // Extract paymentId from the link if available
      const paymentIdFromLink = result.link?.href?.match(/\/payments\/([^/]+)/)?.[1];
      if (paymentIdFromLink) {
        await persistDeviceCharge({
          merchantId: device.merchantId,
          paymentInstructionId: result.paymentInstructionId,
          paymentId: paymentIdFromLink,
          amountCents: body.amount as number,
          description,
          operatorEmail: user.email ?? undefined,
        });
      }
    } catch (e) {
      console.error("[DEVICE-CHARGE-PERSIST] sync path failed:", e);
    }
  }

  return NextResponse.json(result, { status: 202 });
}
