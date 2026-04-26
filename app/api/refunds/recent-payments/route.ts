import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { payrocRefundRequest } from "@/lib/refunds/payroc-helper";
import type { PayrocPayment } from "@/lib/refunds/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PayrocListResponse {
  limit: number;
  count: number;
  hasMore: boolean;
  data: PayrocPayment[];
  links?: Array<{ rel: string; method: string; href: string }>;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Number.isFinite(Number(limitRaw))
    ? Math.min(Math.max(Number(limitRaw), 1), 100)
    : 25;

  const result = await payrocRefundRequest<PayrocListResponse>(
    "GET",
    `/payments?limit=${limit}`,
    undefined,
    null
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Failed to fetch payments from Payroc",
        status: result.status,
        detail: result.rawBody.slice(0, 1000),
      },
      {
        status:
          result.status >= 400 && result.status < 600 ? result.status : 502,
      }
    );
  }

  return NextResponse.json(
    result.data ?? { data: [], count: 0, hasMore: false, limit }
  );
}
