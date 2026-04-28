"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  height: 40,
  background: "#F4F5F7",
  border: "1px solid #E8EAED",
  borderRadius: 8,
  padding: "0 12px",
  fontSize: 14,
  color: "#1A1313",
  outline: "none",
  boxSizing: "border-box",
};

const SECTION_STYLE: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  padding: 24,
  marginBottom: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

interface Props {
  token: string;
  email: string;
  businessName: string;
}

export function RedeemForm({ token, email, businessName }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [legalBusinessName, setLegalBusinessName] = useState(businessName);
  const [dba, setDba] = useState("");
  const [businessType, setBusinessType] = useState("hair_salon");
  const [ein, setEin] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerTitle, setOwnerTitle] = useState("Owner");
  const [bankName, setBankName] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [monthlyVolume, setMonthlyVolume] = useState("10k-50k");
  const [averageTicket, setAverageTicket] = useState("50-100");
  const [mccCode, setMccCode] = useState("7230");
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/merchant-invites/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          legalBusinessName,
          dba,
          businessType,
          ein,
          businessPhone,
          website,
          addressStreet,
          addressCity,
          addressState,
          addressZip,
          ownerFullName,
          ownerPhone,
          ownerTitle,
          bankName,
          accountHolderName,
          routingNumber,
          accountNumber,
          accountType,
          monthlyVolume,
          averageTicket,
          mccCode,
          agreementAccepted,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? `Submission failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      router.push("/onboarding/thank-you");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={SECTION_STYLE}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>Account</h2>
        <p style={{ fontSize: 12, color: "#878787", marginBottom: 16 }}>Set a password to access your dashboard after approval.</p>
        <Field label="Email"><input style={{ ...INPUT_STYLE, background: "#F9FAFB", color: "#878787" }} value={email} disabled /></Field>
        <Field label="Password (min 8 chars)"><input style={INPUT_STYLE} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></Field>
      </div>

      <div style={SECTION_STYLE}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 16 }}>Business</h2>
        <Field label="Legal business name"><input style={INPUT_STYLE} value={legalBusinessName} onChange={(e) => setLegalBusinessName(e.target.value)} required /></Field>
        <Field label="DBA (optional)"><input style={INPUT_STYLE} value={dba} onChange={(e) => setDba(e.target.value)} /></Field>
        <Field label="Business type">
          <select style={INPUT_STYLE} value={businessType} onChange={(e) => setBusinessType(e.target.value)} required>
            <option value="hair_salon">Hair Salon</option>
            <option value="barbershop">Barbershop</option>
            <option value="nail_salon">Nail Salon</option>
            <option value="spa">Spa</option>
            <option value="suite_rental">Suite Rental</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="EIN"><input style={INPUT_STYLE} value={ein} onChange={(e) => setEin(e.target.value)} placeholder="XX-XXXXXXX" required /></Field>
        <Field label="Business phone"><input style={INPUT_STYLE} value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} required /></Field>
        <Field label="Website (optional)"><input style={INPUT_STYLE} value={website} onChange={(e) => setWebsite(e.target.value)} /></Field>
      </div>

      <div style={SECTION_STYLE}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 16 }}>Address</h2>
        <Field label="Street"><input style={INPUT_STYLE} value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} required /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
          <Field label="City"><input style={INPUT_STYLE} value={addressCity} onChange={(e) => setAddressCity(e.target.value)} required /></Field>
          <Field label="State"><input style={INPUT_STYLE} value={addressState} onChange={(e) => setAddressState(e.target.value)} placeholder="TX" maxLength={2} required /></Field>
          <Field label="ZIP"><input style={INPUT_STYLE} value={addressZip} onChange={(e) => setAddressZip(e.target.value)} required /></Field>
        </div>
      </div>

      <div style={SECTION_STYLE}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 16 }}>Owner</h2>
        <Field label="Full name"><input style={INPUT_STYLE} value={ownerFullName} onChange={(e) => setOwnerFullName(e.target.value)} required /></Field>
        <Field label="Phone"><input style={INPUT_STYLE} value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} required /></Field>
        <Field label="Title"><input style={INPUT_STYLE} value={ownerTitle} onChange={(e) => setOwnerTitle(e.target.value)} /></Field>
      </div>

      <div style={SECTION_STYLE}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 16 }}>Banking</h2>
        <Field label="Bank name"><input style={INPUT_STYLE} value={bankName} onChange={(e) => setBankName(e.target.value)} required /></Field>
        <Field label="Account holder name"><input style={INPUT_STYLE} value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} required /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Routing"><input style={INPUT_STYLE} value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} required /></Field>
          <Field label="Account"><input style={INPUT_STYLE} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required /></Field>
          <Field label="Type">
            <select style={INPUT_STYLE} value={accountType} onChange={(e) => setAccountType(e.target.value)} required>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </select>
          </Field>
        </div>
      </div>

      <div style={SECTION_STYLE}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 16 }}>Volume</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Monthly volume">
            <select style={INPUT_STYLE} value={monthlyVolume} onChange={(e) => setMonthlyVolume(e.target.value)} required>
              <option value="<10k">Less than $10,000</option>
              <option value="10k-50k">$10,000 — $50,000</option>
              <option value="50k-100k">$50,000 — $100,000</option>
              <option value="100k-500k">$100,000 — $500,000</option>
              <option value="500k+">$500,000+</option>
            </select>
          </Field>
          <Field label="Average ticket">
            <select style={INPUT_STYLE} value={averageTicket} onChange={(e) => setAverageTicket(e.target.value)} required>
              <option value="<25">Less than $25</option>
              <option value="25-50">$25 — $50</option>
              <option value="50-100">$50 — $100</option>
              <option value="100-250">$100 — $250</option>
              <option value="250-500">$250 — $500</option>
              <option value="500+">$500+</option>
            </select>
          </Field>
        </div>
        <Field label="MCC Code"><input style={INPUT_STYLE} value={mccCode} onChange={(e) => setMccCode(e.target.value)} placeholder="7230" required /></Field>
      </div>

      <div style={{ ...SECTION_STYLE, marginBottom: 16 }}>
        <label style={{ display: "flex", gap: 10, fontSize: 13, color: "#1A1313", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={agreementAccepted}
            onChange={(e) => setAgreementAccepted(e.target.checked)}
            required
            style={{ marginTop: 2, accentColor: "#017ea7" }}
          />
          <span>
            I confirm I&apos;m authorized to apply on behalf of this business and agree to SalonTransact&apos;s merchant terms.
          </span>
        </label>
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !agreementAccepted}
        style={{
          width: "100%",
          height: 44,
          background: "#017ea7",
          color: "#FFFFFF",
          border: "1px solid #015f80",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: submitting ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: submitting || !agreementAccepted ? 0.6 : 1,
        }}
      >
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {!submitting && agreementAccepted && <CheckCircle2 size={16} />}
        {submitting ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
