import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDigestFrequency,
  setDigestFrequency,
  isValidDigestFrequency,
} from "@/lib/notifications/preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  frequency?: unknown;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const frequency = await getDigestFrequency(user.id);
  return NextResponse.json({ frequency });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.frequency !== "string" || !isValidDigestFrequency(body.frequency)) {
    return NextResponse.json(
      { error: "frequency must be 'off' | 'daily' | 'weekly'" },
      { status: 400 }
    );
  }

  await setDigestFrequency(user.id, body.frequency);
  return NextResponse.json({ ok: true, frequency: body.frequency });
}
