import { prisma } from "@/lib/prisma";
import { RedeemForm } from "./redeem-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function MasterInvitePage({ params }: PageProps) {
  const { token } = await params;

  const invite = await prisma.merchantInvite.findUnique({
    where: { token },
  });

  let invalidReason: string | null = null;
  if (!invite) invalidReason = "Invitation not found.";
  else if (invite.status === "accepted") invalidReason = "This invitation has already been used.";
  else if (invite.status === "revoked") invalidReason = "This invitation was revoked.";
  else if (invite.expiresAt < new Date()) invalidReason = "This invitation has expired.";

  if (invalidReason || !invite) {
    return (
      <main style={{ minHeight: "100vh", background: "#FBFBFB", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div
          style={{
            maxWidth: 480,
            background: "#FFFFFF",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1A1313", marginBottom: 8, letterSpacing: "-0.31px" }}>
            Invitation unavailable
          </h1>
          <p style={{ fontSize: 14, color: "#878787", marginBottom: 16 }}>
            {invalidReason}
          </p>
          <Link
            href="/login"
            style={{ fontSize: 13, color: "#017ea7", textDecoration: "none" }}
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#FBFBFB", padding: "32px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px", marginBottom: 8 }}>
            Welcome to SalonTransact
          </h1>
          <p style={{ fontSize: 14, color: "#878787" }}>
            {invite.invitedByEmail} invited <strong style={{ color: "#1A1313" }}>{invite.businessName}</strong> to apply.
          </p>
        </div>

        {invite.note && (
          <div
            style={{
              background: "#F0F9FF",
              border: "1px solid #BFDBFE",
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
              maxWidth: 720,
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Personal note from {invite.invitedByEmail}
            </p>
            <p style={{ fontSize: 13, color: "#1A1313", lineHeight: 1.5, margin: 0 }}>
              {invite.note}
            </p>
          </div>
        )}

        <RedeemForm
          token={invite.token}
          email={invite.email}
          businessName={invite.businessName}
        />
      </div>
    </main>
  );
}
