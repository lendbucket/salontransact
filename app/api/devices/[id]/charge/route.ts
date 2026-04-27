import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPaymentInstruction } from "@/lib/payroc/devices";
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

  const customizationOptions: PaymentInstructionCustomizationOptions = {};
  if (body.promptForTip === true) customizationOptions.promptForTip = true;
  if (body.promptForSignature === true)
    customizationOptions.promptForSignature = true;

  const order: PaymentInstructionOrder = {
    orderId,
    amount: body.amount,
    currency: "USD",
  };
  if (description) order.description = description;

  let result;
  try {
    result = await sendPaymentInstruction(device.serialNumber, {
      order,
      autoCapture:
        typeof body.autoCapture === "boolean" ? body.autoCapture : true,
      processAsSale:
        typeof body.processAsSale === "boolean" ? body.processAsSale : false,
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

  return NextResponse.json(result, { status: 202 });
}
