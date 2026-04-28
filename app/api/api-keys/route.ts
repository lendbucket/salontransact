import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-keys/generate";
import { writeAuditLog } from "@/lib/audit/log";
import type {
  ApiKeyListResponse,
  ApiKeyPublic,
  ApiKeyCreatedResponse,
} from "@/lib/api-keys/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  name?: unknown;
  merchantId?: unknown;
}

async function resolveMerchantId(
  user: { id: string; role?: string },
  merchantIdParam: string | null
): Promise<{ merchantId: string } | { error: string; status: number }> {
  if (user.role === "master portal") {
    if (!merchantIdParam || merchantIdParam.length === 0) {
      return { error: "master portal must provide merchantId", status: 400 };
    }
    const exists = await prisma.merchant.findUnique({
      where: { id: merchantIdParam },
      select: { id: true },
    });
    if (!exists) return { error: "merchant not found", status: 404 };
    return { merchantId: merchantIdParam };
  }
  if (user.role === "merchant") {
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!merchant) return { error: "merchant profile not found", status: 404 };
    return { merchantId: merchant.id };
  }
  return { error: "Forbidden", status: 403 };
}

function rowToPublic(row: {
  id: string;
  merchantId: string;
  name: string;
  keyPrefix: string | null;
  active: boolean;
  lastUsed: Date | null;
  createdAt: Date;
}): ApiKeyPublic {
  return {
    id: row.id,
    merchantId: row.merchantId,
    name: row.name,
    keyPrefix: row.keyPrefix ?? "",
    active: row.active,
    lastUsed: row.lastUsed ? row.lastUsed.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal" && user.role !== "merchant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const merchantIdParam = url.searchParams.get("merchantId");

  const resolved = await resolveMerchantId(
    { id: user.id, role: user.role },
    merchantIdParam
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const rows = await prisma.apiKey.findMany({
    where: { merchantId: resolved.merchantId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const data = rows.map(rowToPublic);
  const response: ApiKeyListResponse = {
    data,
    count: data.length,
    activeCount: data.filter((k) => k.active).length,
  };
  return NextResponse.json(response);
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
    typeof body.name !== "string" ||
    body.name.trim().length === 0 ||
    body.name.trim().length > 100
  ) {
    return NextResponse.json(
      { error: "name required (1-100 chars)" },
      { status: 400 }
    );
  }
  const name = body.name.trim();

  const resolved = await resolveMerchantId(
    { id: user.id, role: user.role },
    typeof body.merchantId === "string" ? body.merchantId : null
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { fullKey, keyPrefix, keyHash } = await generateApiKey();

  const created = await prisma.apiKey.create({
    data: {
      merchantId: resolved.merchantId,
      name,
      key: fullKey, // legacy column — keep populated until deprecated
      keyPrefix,
      keyHash,
      active: true,
    },
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "api_key.create",
    targetType: "ApiKey",
    targetId: created.id,
    merchantId: resolved.merchantId,
    metadata: {
      name,
      keyPrefix,
    },
  });

  const response: ApiKeyCreatedResponse = {
    ...rowToPublic(created),
    fullKey,
  };

  return NextResponse.json(response, { status: 201 });
}
