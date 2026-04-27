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
    return NextResponse.json({ verified: false }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailVerified: true },
  });

  return NextResponse.json(
    { verified: !!dbUser?.emailVerified },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
