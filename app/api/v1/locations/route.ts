import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { locationToV1 } from "@/lib/api/v1/locations/format";
import type { CreateLocationV1Request } from "@/lib/api/v1/locations/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATES = /^[A-Z]{2}$/;
const VALID_ZIP = /^\d{5}(-\d{4})?$/;

function validateCreateRequest(body: unknown): {
  ok: true;
  data: CreateLocationV1Request;
} | {
  ok: false;
  message: string;
} {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return { ok: false, message: "name is required and must be a non-empty string" };
  }
  if (b.name.length > 200) {
    return { ok: false, message: "name must be 200 characters or fewer" };
  }
  for (const f of ["address_line1", "address_line2", "city", "phone", "timezone"]) {
    if (b[f] !== undefined && typeof b[f] !== "string") {
      return { ok: false, message: `${f} must be a string if provided` };
    }
  }
  if (b.state !== undefined) {
    if (typeof b.state !== "string") {
      return { ok: false, message: "state must be a string if provided" };
    }
    const s = b.state.toUpperCase();
    if (!VALID_STATES.test(s)) {
      return { ok: false, message: "state must be a 2-letter US state code (e.g. TX)" };
    }
  }
  if (b.zip !== undefined) {
    if (typeof b.zip !== "string" || !VALID_ZIP.test(b.zip)) {
      return { ok: false, message: "zip must be a 5-digit or 9-digit US zip code" };
    }
  }
  if (b.is_primary !== undefined && typeof b.is_primary !== "boolean") {
    return { ok: false, message: "is_primary must be a boolean if provided" };
  }
  return {
    ok: true,
    data: {
      name: (b.name as string).trim(),
      address_line1: b.address_line1 as string | undefined,
      address_line2: b.address_line2 as string | undefined,
      city: b.city as string | undefined,
      state: b.state ? (b.state as string).toUpperCase() : undefined,
      zip: b.zip as string | undefined,
      phone: b.phone as string | undefined,
      timezone: b.timezone as string | undefined,
      is_primary: b.is_primary as boolean | undefined,
    },
  };
}

export async function POST(request: Request) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  let parsed;
  try {
    parsed = await request.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body", { requestId: auth.requestId });
  }

  const v = validateCreateRequest(parsed);
  if (!v.ok) {
    return apiError("validation_error", v.message, { requestId: auth.requestId });
  }
  const data = v.data;

  // If this location is being marked primary, unmark any existing primary
  // for this merchant. Wrap both writes in a transaction.
  const result = await prisma.$transaction(async (tx) => {
    if (data.is_primary === true) {
      await tx.location.updateMany({
        where: { merchantId: auth.merchant.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // If this is the merchant's FIRST location, force it primary regardless
    // of the request body — every merchant has exactly one primary.
    const existing = await tx.location.count({
      where: { merchantId: auth.merchant.id },
    });
    const finalIsPrimary = existing === 0 ? true : data.is_primary === true;

    return tx.location.create({
      data: {
        merchantId: auth.merchant.id,
        name: data.name,
        addressLine1: data.address_line1 ?? null,
        addressLine2: data.address_line2 ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        zip: data.zip ?? null,
        phone: data.phone ?? null,
        timezone: data.timezone ?? "America/Chicago",
        isPrimary: finalIsPrimary,
        status: "active",
      },
    });
  });

  await writeAuditLog({
    actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
    action: "location.create.v1",
    targetType: "Location",
    targetId: result.id,
    merchantId: auth.merchant.id,
    metadata: {
      name: result.name,
      isPrimary: result.isPrimary,
      requestId: auth.requestId,
    },
  }).catch(() => {});

  const response = NextResponse.json(locationToV1(result), { status: 201 });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
