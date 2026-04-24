import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log(
      "[DISPUTE-RESPOND] Dispute:",
      body.disputeId,
      "Evidence:",
      body.evidence?.substring(0, 100)
    );

    // Stub — will be wired to Payroc dispute submission API
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DISPUTE-RESPOND] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit response" },
      { status: 500 }
    );
  }
}
