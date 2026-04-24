import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subject, category, priority, description } =
      await request.json();

    if (!subject || !description) {
      return NextResponse.json(
        { error: "Subject and description are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: "SalonTransact <onboarding@resend.dev>",
          to: "ceo@36west.org",
          subject: `[Support Ticket] [${priority?.toUpperCase() || "MEDIUM"}] - ${subject}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2>Support Ticket</h2>
            <p><strong>From:</strong> ${session.user.email}</p>
            <p><strong>Category:</strong> ${category || "General"}</p>
            <p><strong>Priority:</strong> ${priority || "medium"}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <hr/>
            <p>${description.replace(/\n/g, "<br/>")}</p>
          </div>`,
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SUPPORT] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit ticket" },
      { status: 500 }
    );
  }
}
