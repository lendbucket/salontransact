import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWebhookSecret } from "@/lib/webhooks/generate";
import { isValidEventId } from "@/lib/webhooks/events";
import { writeAuditLog } from "@/lib/audit/log";
import type {
  WebhookListResponse,
  WebhookPublic,
  WebhookCreatedResponse,
} from "@/lib/webhooks/subscription-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  url?: unknown;
  description?: unknown;
  events?: unknown;
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
  url: string;
  description: string | null;
  events: string[];
  active: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): WebhookPublic {
  return {
    id: row.id,
    merchantId: row.merchantId,
    url: row.url,
    description: row.description,
    events: row.events,
    active: row.active,
    lastTriggeredAt: row.lastTriggeredAt ? row.lastTriggeredAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validateUrl(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return "URL must use http or https";
    }
    if (input.length > 2048) return "URL too long";
    return null;
  } catch {
    return "Invalid URL";
  }
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

  const rows = await prisma.webhook.findMany({
    where: { merchantId: resolved.merchantId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const data = rows.map(rowToPublic);
  const response: WebhookListResponse = {
    data,
    count: data.length,
    activeCount: data.filter((w) => w.active).length,
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

  // Validate URL
  if (typeof body.url !== "string" || body.url.trim().length === 0) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  const url = body.url.trim();
  const urlError = validateUrl(url);
  if (urlError) {
    return NextResponse.json({ error: urlError }, { status: 400 });
  }

  // Validate description (optional, max 200 chars)
  let description: string | null = null;
  if (typeof body.description === "string" && body.description.trim().length > 0) {
    if (body.description.trim().length > 200) {
      return NextResponse.json({ error: "description too long (max 200 chars)" }, { status: 400 });
    }
    description = body.description.trim();
  }

  // Validate events array
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ error: "events required (at least 1)" }, { status: 400 });
  }
  const events: string[] = [];
  for (const e of body.events) {
    if (typeof e !== "string") {
      return NextResponse.json({ error: "events must be strings" }, { status: 400 });
    }
    if (!isValidEventId(e)) {
      return NextResponse.json({ error: `unknown event: ${e}` }, { status: 400 });
    }
    if (!events.includes(e)) events.push(e);
  }

  const resolved = await resolveMerchantId(
    { id: user.id, role: user.role },
    typeof body.merchantId === "string" ? body.merchantId : null
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const secret = generateWebhookSecret();

  const created = await prisma.webhook.create({
    data: {
      merchantId: resolved.merchantId,
      url,
      description,
      events,
      secret,
      active: true,
    },
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "webhook.create",
    targetType: "Webhook",
    targetId: created.id,
    merchantId: resolved.merchantId,
    metadata: {
      url,
      description,
      eventCount: events.length,
    },
  });

  const response: WebhookCreatedResponse = {
    ...rowToPublic(created),
    secret,
  };

  return NextResponse.json(response, { status: 201 });
}
