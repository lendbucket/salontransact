import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { buildReceiptEmail } from "@/lib/receipts/builder";
import { RESEND_FROM } from "@/lib/email/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  email?: unknown;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const recipientEmail =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (recipientEmail.length === 0 || !EMAIL_REGEX.test(recipientEmail)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const txn = await prisma.transaction.findUnique({
    where: { id },
    include: {
      merchant: {
        select: {
          id: true,
          businessName: true,
          city: true,
          state: true,
          email: true,
        },
      },
    },
  });

  if (!txn) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (user.role === "merchant") {
    const callerMerchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!callerMerchant || callerMerchant.id !== txn.merchantId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const meta = (txn.metadata ?? null) as Record<string, unknown> | null;
  const cardScheme =
    meta && typeof meta.cardScheme === "string" ? meta.cardScheme : null;
  const cardLast4 =
    meta && typeof meta.last4 === "string" ? meta.last4 : null;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://portal.salontransact.com";

  const { subject, html } = buildReceiptEmail({
    baseUrl,
    recipientEmail,
    transactionId: txn.id,
    amount: txn.amount,
    currency: txn.currency,
    status: txn.status,
    description: txn.description,
    createdAt: txn.createdAt,
    cardScheme,
    cardLast4,
    refunded: txn.refunded,
    refundAmount: txn.refundAmount,
    merchantBusinessName: txn.merchant.businessName,
    merchantCity: txn.merchant.city,
    merchantState: txn.merchant.state,
    merchantContactEmail: txn.merchant.email,
  });

  let sentSuccessfully = false;
  let errorMessage: string | null = null;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    errorMessage = "Email service not configured";
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: recipientEmail,
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        errorMessage = `Resend ${res.status}: ${t.slice(0, 200)}`;
      } else {
        sentSuccessfully = true;
      }
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : "send failed";
    }
  }

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "transaction.receipt.resend",
    targetType: "Transaction",
    targetId: txn.id,
    merchantId: txn.merchantId,
    metadata: {
      recipientEmail,
      amount: txn.amount,
      currency: txn.currency,
      sent: sentSuccessfully,
      error: errorMessage,
    },
  });

  if (!sentSuccessfully) {
    return NextResponse.json(
      { ok: false, error: errorMessage ?? "Failed to send receipt" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, recipientEmail });
}
