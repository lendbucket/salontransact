import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteSecureToken } from "@/lib/payroc/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  label?: unknown;
}

async function findRowForUser(
  user: { id: string; role?: string },
  rowId: string
): Promise<
  | {
      id: string;
      merchantId: string;
      payrocSecureTokenId: string;
      status: string;
    }
  | { notFound: true }
  | { forbidden: true }
> {
  const row = await prisma.savedPaymentMethod.findUnique({
    where: { id: rowId },
    select: {
      id: true,
      merchantId: true,
      payrocSecureTokenId: true,
      status: true,
    },
  });
  if (!row) return { notFound: true };
  if (user.role === "master portal") return row;
  if (user.role === "merchant") {
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!merchant) return { forbidden: true };
    if (merchant.id !== row.merchantId) return { forbidden: true };
    return row;
  }
  return { forbidden: true };
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

  const row = await findRowForUser({ id: user.id, role: user.role }, id);
  if ("notFound" in row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ("forbidden" in row) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (row.status === "deleted") {
    return NextResponse.json({ error: "Already deleted" }, { status: 410 });
  }

  try {
    await deleteSecureToken(row.payrocSecureTokenId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Payroc rejected deletion: ${message}`.slice(0, 500),
      },
      { status: 502 }
    );
  }

  await prisma.savedPaymentMethod.update({
    where: { id: row.id },
    data: { status: "deleted" },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
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

  const row = await findRowForUser({ id: user.id, role: user.role }, id);
  if ("notFound" in row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ("forbidden" in row) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (row.status !== "active") {
    return NextResponse.json(
      { error: "Cannot edit non-active saved card" },
      { status: 409 }
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.label === undefined) {
    return NextResponse.json(
      { error: "No editable fields provided. Supported: label" },
      { status: 400 }
    );
  }
  if (typeof body.label !== "string" || body.label.length > 50) {
    return NextResponse.json(
      { error: "label must be a string <= 50 chars" },
      { status: 400 }
    );
  }

  const updated = await prisma.savedPaymentMethod.update({
    where: { id: row.id },
    data: { label: body.label.trim() },
  });

  return NextResponse.json({
    id: updated.id,
    label: updated.label,
  });
}
