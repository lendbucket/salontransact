import { notFound } from "next/navigation";
import { verifyCardEntryToken } from "@/lib/card-entry/token";
import { prisma } from "@/lib/prisma";
import { CardEntryClient } from "./card-entry-client";

export const dynamic = "force-dynamic";

export default async function CardEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);

  const payload = verifyCardEntryToken(decoded);
  if (!payload) notFound();

  const row = await prisma.cardEntryToken.findUnique({
    where: { id: payload.tid },
    include: { merchant: { select: { businessName: true } } },
  });

  if (!row || row.merchantId !== payload.mid) notFound();

  if (row.status !== "active") {
    return (
      <main style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1A1313", marginBottom: 8 }}>This link is no longer valid</h1>
          <p style={{ fontSize: 14, color: "#878787" }}>The link you used has already been used, expired, or was cancelled. Please contact {row.merchant.businessName} to receive a new link.</p>
        </div>
      </main>
    );
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    return (
      <main style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1A1313", marginBottom: 8 }}>This link has expired</h1>
          <p style={{ fontSize: 14, color: "#878787" }}>Please contact {row.merchant.businessName} to receive a new link.</p>
        </div>
      </main>
    );
  }

  return <CardEntryClient signedToken={decoded} merchantName={row.merchant.businessName} customerName={row.customerName} />;
}
