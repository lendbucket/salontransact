import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;

  if (!user?.id) {
    return NextResponse.json({ submitted: false }, { status: 200 });
  }

  const app = await prisma.merchantApplication.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true, submittedAt: true },
  });

  return NextResponse.json(
    {
      submitted: !!app,
      status: app?.status ?? null,
      submittedAt: app?.submittedAt ?? null,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
