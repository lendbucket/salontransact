import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyCard } from "@/lib/payroc/cards";
import type {
  VerifyCardSource,
  VerifyCardCustomer,
} from "@/lib/payroc/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  card?: unknown;
  operator?: unknown;
  customer?: unknown;
}

function isVerifyCardSource(value: unknown): value is VerifyCardSource {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown };
  if (v.type !== "card") return false;
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

function isVerifyCardCustomer(value: unknown): value is VerifyCardCustomer {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.firstName !== undefined && typeof v.firstName !== "string")
    return false;
  if (v.lastName !== undefined && typeof v.lastName !== "string") return false;
  if (v.emailAddress !== undefined && typeof v.emailAddress !== "string")
    return false;
  if (v.phoneNumber !== undefined && typeof v.phoneNumber !== "string")
    return false;
  return true;
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

  if (!isVerifyCardSource(body.card)) {
    return NextResponse.json(
      {
        error:
          'card required: { type: "card", cardDetails: { type: "keyed", keyedData: { type: "plainText", cardNumber, expiryDate, cvv? }, cardholderName? } }',
      },
      { status: 400 }
    );
  }

  if (
    body.operator !== undefined &&
    (typeof body.operator !== "string" || body.operator.length > 50)
  ) {
    return NextResponse.json(
      { error: "operator must be a string <= 50 chars" },
      { status: 400 }
    );
  }

  if (body.customer !== undefined && !isVerifyCardCustomer(body.customer)) {
    return NextResponse.json(
      {
        error:
          "customer must contain only firstName, lastName, emailAddress, phoneNumber as strings",
      },
      { status: 400 }
    );
  }

  try {
    const result = await verifyCard({
      card: body.card,
      operator:
        typeof body.operator === "string"
          ? body.operator
          : user.email?.slice(0, 50),
      customer: body.customer as VerifyCardCustomer | undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Payroc rejected card verification: ${message}`.slice(0, 500),
      },
      { status: 502 }
    );
  }
}
