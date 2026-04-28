import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { writeAuditLog } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateBody {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  businessName?: unknown;
  password?: unknown;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body.email !== "string" ||
    body.email.trim().length === 0 ||
    body.email.trim().length > 200 ||
    !body.email.includes("@")
  ) {
    return NextResponse.json(
      { error: "email required (valid format, 1-200 chars)" },
      { status: 400 }
    );
  }
  if (
    typeof body.firstName !== "string" ||
    body.firstName.trim().length === 0 ||
    body.firstName.trim().length > 50
  ) {
    return NextResponse.json(
      { error: "firstName required (1-50 chars)" },
      { status: 400 }
    );
  }
  if (
    typeof body.lastName !== "string" ||
    body.lastName.trim().length === 0 ||
    body.lastName.trim().length > 50
  ) {
    return NextResponse.json(
      { error: "lastName required (1-50 chars)" },
      { status: 400 }
    );
  }
  if (
    typeof body.businessName !== "string" ||
    body.businessName.trim().length === 0 ||
    body.businessName.trim().length > 100
  ) {
    return NextResponse.json(
      { error: "businessName required (1-100 chars)" },
      { status: 400 }
    );
  }
  if (
    typeof body.password !== "string" ||
    body.password.length < 8 ||
    body.password.length > 100
  ) {
    return NextResponse.json(
      { error: "password required (8-100 chars)" },
      { status: 400 }
    );
  }

  const email = body.email.trim().toLowerCase();
  const firstName = body.firstName.trim();
  const lastName = body.lastName.trim();
  const businessName = body.businessName.trim();
  const password = body.password;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        name: `${firstName} ${lastName}`,
        password: passwordHash,
        emailVerified: new Date(),
        role: "merchant",
        approvalStatus: "approved",
      },
    });

    const newMerchant = await tx.merchant.create({
      data: {
        userId: newUser.id,
        businessName,
        email,
        ownerFirstName: firstName,
        ownerLastName: lastName,
        status: "active",
        chargesEnabled: true,
        payoutsEnabled: false,
        plan: "starter",
        stripeAccountStatus: "skipped",
      },
    });

    return { user: newUser, merchant: newMerchant };
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "merchant.create_test_account",
    targetType: "Merchant",
    targetId: result.merchant.id,
    merchantId: result.merchant.id,
    metadata: {
      createdUserId: result.user.id,
      createdEmail: email,
      businessName,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      merchantId: result.merchant.id,
      userId: result.user.id,
      email,
      businessName,
    },
    { status: 201 }
  );
}
