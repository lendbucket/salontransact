import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  label?: unknown;
  status?: unknown;
  model?: unknown;
}

async function findRowForUser(
  user: { id: string; role?: string },
  rowId: string
): Promise<
  | {
      id: string;
      merchantId: string;
      serialNumber: string;
      status: string;
    }
  | { notFound: true }
  | { forbidden: true }
> {
  const row = await prisma.device.findUnique({
    where: { id: rowId },
    select: {
      id: true,
      merchantId: true,
      serialNumber: true,
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
  if (row.status === "retired") {
    return NextResponse.json({ error: "Already retired" }, { status: 410 });
  }

  await prisma.device.update({
    where: { id: row.id },
    data: { status: "retired" },
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

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: { label?: string; status?: string; model?: string } = {};

  if (body.label !== undefined) {
    if (typeof body.label !== "string" || body.label.length > 50) {
      return NextResponse.json(
        { error: "label must be a string <= 50 chars" },
        { status: 400 }
      );
    }
    updates.label = body.label.trim();
  }

  if (body.status !== undefined) {
    if (
      body.status !== "active" &&
      body.status !== "inactive" &&
      body.status !== "retired"
    ) {
      return NextResponse.json(
        { error: "status must be one of: active, inactive, retired" },
        { status: 400 }
      );
    }
    updates.status = body.status;
  }

  if (body.model !== undefined) {
    if (typeof body.model !== "string" || body.model.length > 64) {
      return NextResponse.json(
        { error: "model must be a string <= 64 chars" },
        { status: 400 }
      );
    }
    updates.model = body.model.trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No editable fields. Supported: label, status, model" },
      { status: 400 }
    );
  }

  const updated = await prisma.device.update({
    where: { id: row.id },
    data: updates,
  });

  return NextResponse.json({
    id: updated.id,
    label: updated.label,
    status: updated.status,
    model: updated.model,
  });
}
