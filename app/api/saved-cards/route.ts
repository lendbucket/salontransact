import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSecureToken } from "@/lib/payroc/tokens";
import type {
  CreateSecureTokenRequest,
  TokenizationSource,
  MitAgreement,
} from "@/lib/payroc/types";
import type {
  SavedCardPublic,
  SavedCardListResponse,
} from "@/lib/saved-cards/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  customerEmail?: unknown;
  source?: unknown;
  label?: unknown;
  mitAgreement?: unknown;
  merchantId?: unknown;
}

function isTokenizationSource(value: unknown): value is TokenizationSource {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown };
  if (v.type === "singleUseToken") {
    const tok = value as { token?: unknown };
    return (
      typeof tok.token === "string" && tok.token.length > 0
    );
  }
  if (v.type === "card") {
    const card = value as {
      cardDetails?: {
        type?: unknown;
        keyedData?: {
          type?: unknown;
          cardNumber?: unknown;
          expiryDate?: unknown;
        };
      };
    };
    return (
      card.cardDetails?.type === "keyed" &&
      card.cardDetails.keyedData?.type === "plainText" &&
      typeof card.cardDetails.keyedData.cardNumber === "string" &&
      typeof card.cardDetails.keyedData.expiryDate === "string"
    );
  }
  return false;
}

function isMitAgreement(value: unknown): value is MitAgreement {
  return (
    value === "unscheduled" ||
    value === "recurring" ||
    value === "installment"
  );
}

function rowToPublic(row: {
  id: string;
  customerEmail: string;
  payrocSecureTokenId: string;
  cardScheme: string | null;
  last4: string | null;
  expiryMonth: string | null;
  expiryYear: string | null;
  cardholderName: string | null;
  label: string | null;
  status: string;
  mitAgreement: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}): SavedCardPublic {
  return {
    id: row.id,
    customerEmail: row.customerEmail,
    payrocSecureTokenId: row.payrocSecureTokenId,
    cardScheme: row.cardScheme,
    last4: row.last4,
    expiryMonth: row.expiryMonth,
    expiryYear: row.expiryYear,
    cardholderName: row.cardholderName,
    label: row.label,
    status: row.status,
    mitAgreement: row.mitAgreement,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

async function resolveMerchantId(
  user: { id: string; role?: string },
  bodyMerchantId: unknown
): Promise<{ merchantId: string } | { error: string; status: number }> {
  if (user.role === "master portal") {
    if (typeof bodyMerchantId !== "string" || bodyMerchantId.length === 0) {
      return { error: "master portal must provide merchantId", status: 400 };
    }
    const exists = await prisma.merchant.findUnique({
      where: { id: bodyMerchantId },
      select: { id: true },
    });
    if (!exists) {
      return { error: "merchant not found", status: 404 };
    }
    return { merchantId: bodyMerchantId };
  }
  if (user.role === "merchant") {
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!merchant) {
      return { error: "merchant profile not found", status: 404 };
    }
    return { merchantId: merchant.id };
  }
  return { error: "Forbidden", status: 403 };
}

export async function POST(request: Request) {
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

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body.customerEmail !== "string" ||
    body.customerEmail.length === 0 ||
    body.customerEmail.length > 200
  ) {
    return NextResponse.json(
      { error: "customerEmail required (1-200 chars)" },
      { status: 400 }
    );
  }
  const customerEmail = body.customerEmail.trim().toLowerCase();
  if (customerEmail.length === 0 || !customerEmail.includes("@")) {
    return NextResponse.json(
      { error: "customerEmail must be a valid email" },
      { status: 400 }
    );
  }

  if (!isTokenizationSource(body.source)) {
    return NextResponse.json(
      {
        error:
          'source required: { type: "singleUseToken", token: "..." } or { type: "card", cardDetails: { type: "keyed", keyedData: { type: "plainText", cardNumber, expiryDate, cvv? } } }',
      },
      { status: 400 }
    );
  }

  let mitAgreement: MitAgreement = "unscheduled";
  if (body.mitAgreement !== undefined) {
    if (!isMitAgreement(body.mitAgreement)) {
      return NextResponse.json(
        {
          error:
            "mitAgreement must be one of: unscheduled, recurring, installment",
        },
        { status: 400 }
      );
    }
    mitAgreement = body.mitAgreement;
  }

  let label: string | undefined;
  if (body.label !== undefined) {
    if (typeof body.label !== "string" || body.label.length > 50) {
      return NextResponse.json(
        { error: "label must be a string <= 50 chars" },
        { status: 400 }
      );
    }
    label = body.label.trim();
  }

  const resolved = await resolveMerchantId(
    { id: user.id, role: user.role },
    body.merchantId
  );
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  const payrocReq: CreateSecureTokenRequest = {
    source: body.source as TokenizationSource,
    mitAgreement,
    operator: user.email?.slice(0, 50),
  };

  let payrocResponse;
  try {
    payrocResponse = await createSecureToken(payrocReq);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Payroc rejected secure token creation: ${message}`.slice(
          0,
          500
        ),
      },
      { status: 502 }
    );
  }

  let expiryMonth: string | null = null;
  let expiryYear: string | null = null;
  if (
    typeof payrocResponse.source.expiryDate === "string" &&
    payrocResponse.source.expiryDate.length === 4
  ) {
    expiryMonth = payrocResponse.source.expiryDate.slice(0, 2);
    expiryYear = `20${payrocResponse.source.expiryDate.slice(2, 4)}`;
  }

  let last4: string | null = null;
  if (typeof payrocResponse.source.cardNumber === "string") {
    const last4Match = payrocResponse.source.cardNumber.match(/(\d{4})$/);
    last4 = last4Match ? last4Match[1] : null;
  }

  let row;
  try {
    row = await prisma.savedPaymentMethod.create({
      data: {
        merchantId: resolved.merchantId,
        customerEmail,
        payrocSecureTokenId: payrocResponse.secureTokenId,
        payrocToken: payrocResponse.token,
        last4,
        expiryMonth,
        expiryYear,
        cardholderName: payrocResponse.source.cardholderName ?? null,
        label: label ?? null,
        status: "active",
        mitAgreement,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        error:
          `Saved card created in Payroc but local persistence failed: ${message}. secureTokenId: ${payrocResponse.secureTokenId}`.slice(
            0,
            500
          ),
        payrocSecureTokenId: payrocResponse.secureTokenId,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(rowToPublic(row), { status: 201 });
}

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const customerEmailRaw = url.searchParams.get("customerEmail");
  if (!customerEmailRaw) {
    return NextResponse.json(
      { error: "customerEmail query param required" },
      { status: 400 }
    );
  }
  const customerEmail = customerEmailRaw.trim().toLowerCase();

  const merchantIdParam = url.searchParams.get("merchantId");
  const resolved = await resolveMerchantId(
    { id: user.id, role: user.role },
    merchantIdParam
  );
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  const rows = await prisma.savedPaymentMethod.findMany({
    where: {
      merchantId: resolved.merchantId,
      customerEmail,
      status: "active",
    },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const data = rows.map(rowToPublic);
  const response: SavedCardListResponse = {
    data,
    count: data.length,
  };
  return NextResponse.json(response);
}
