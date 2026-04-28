import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPaymentInstruction,
  cancelPaymentInstruction,
} from "@/lib/payroc/devices";
import { persistDeviceCharge } from "@/lib/devices/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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
  if (!id || id.length < 1 || id.length > 64) {
    return NextResponse.json(
      { error: "invalid paymentInstructionId" },
      { status: 400 }
    );
  }

  try {
    const result = await getPaymentInstruction(id);

    // Persist on completion: write Transaction + bump merchant counters.
    // Idempotent — repeated polls no-op via unique paymentId check in helper.
    if (result.status === "completed") {
      const paymentIdFromLink =
        result.link?.href?.match(/\/payments\/([^/]+)/)?.[1];

      if (paymentIdFromLink) {
        // Look up the instruction→merchant mapping written by the charge route
        const mapping = await prisma.payrocPaymentRecord.findUnique({
          where: { payrocPaymentId: id },
          select: { merchantId: true, amountCents: true },
        });

        if (mapping) {
          try {
            const persistResult = await persistDeviceCharge({
              merchantId: mapping.merchantId,
              paymentInstructionId: id,
              paymentId: paymentIdFromLink,
              amountCents: mapping.amountCents,
            });
            if (!persistResult.alreadyExisted) {
              console.log(
                `[DEVICE-POLL-PERSIST] Transaction ${persistResult.transactionId} created for instruction ${id}`
              );
            }
          } catch (e) {
            console.error("[DEVICE-POLL-PERSIST] failed:", e);
          }
        } else {
          console.warn(
            `[DEVICE-POLL-PERSIST] No mapping for instruction ${id}`
          );
        }
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch instruction: ${message}`.slice(0, 500) },
      { status: 502 }
    );
  }
}

export async function DELETE(
  _request: Request,
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
  if (!id || id.length < 1 || id.length > 64) {
    return NextResponse.json(
      { error: "invalid paymentInstructionId" },
      { status: 400 }
    );
  }

  try {
    await cancelPaymentInstruction(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to cancel: ${message}`.slice(0, 500) },
      { status: 502 }
    );
  }
}
