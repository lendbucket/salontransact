import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { binLookup } from "@/lib/payroc/cards";
import type { BinLookupSource } from "@/lib/payroc/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  card?: unknown;
  amount?: unknown;
  currency?: unknown;
}

function isBinLookupSource(value: unknown): value is BinLookupSource {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown };

  if (v.type === "cardBin") {
    const tok = value as { cardBin?: unknown };
    return (
      typeof tok.cardBin === "string" &&
      tok.cardBin.length >= 6 &&
      tok.cardBin.length <= 8 &&
      /^\d+$/.test(tok.cardBin)
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

  if (v.type === "secureToken") {
    const tok = value as { secureToken?: unknown };
    return typeof tok.secureToken === "string" && tok.secureToken.length > 0;
  }

  if (v.type === "digitalWallet") {
    const dw = value as {
      digitalWallet?: { type?: unknown; token?: unknown };
    };
    return (
      typeof dw.digitalWallet?.type === "string" &&
      typeof dw.digitalWallet?.token === "string"
    );
  }

  return false;
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

  if (!isBinLookupSource(body.card)) {
    return NextResponse.json(
      {
        error:
          'card required (polymorphic): { type: "cardBin", cardBin: "6-8 digits" } OR { type: "card", cardDetails: ... } OR { type: "secureToken", secureToken: "..." } OR { type: "digitalWallet", digitalWallet: { type, token } }',
      },
      { status: 400 }
    );
  }

  if (
    body.amount !== undefined &&
    (typeof body.amount !== "number" ||
      !Number.isFinite(body.amount) ||
      body.amount < 0)
  ) {
    return NextResponse.json(
      { error: "amount must be a non-negative number (cents)" },
      { status: 400 }
    );
  }

  if (
    body.currency !== undefined &&
    (typeof body.currency !== "string" || body.currency.length !== 3)
  ) {
    return NextResponse.json(
      { error: "currency must be a 3-letter ISO 4217 code" },
      { status: 400 }
    );
  }

  try {
    const result = await binLookup({
      card: body.card,
      amount: typeof body.amount === "number" ? body.amount : undefined,
      currency: typeof body.currency === "string" ? body.currency : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Payroc BIN lookup failed: ${message}`.slice(0, 500) },
      { status: 502 }
    );
  }
}
