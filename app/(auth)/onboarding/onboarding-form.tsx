/**
 * TODO COMPLIANCE — REVIEW BEFORE PRODUCTION
 *
 * This form collects sensitive financial data (banking, EIN). Before accepting
 * real merchant applications:
 *
 * 1. PRIVACY POLICY — must disclose collection of EIN, banking, contact info,
 *    purpose, retention period, sharing with Payroc
 * 2. TERMS OF SERVICE — must explicitly cover application review process
 * 3. ENCRYPTION AT REST — verify Supabase is encrypting MerchantApplication.accountNumber
 *    and routingNumber columns. Consider column-level encryption.
 * 4. ACCESS CONTROLS — restrict who can read full account/routing numbers
 *    (currently: anyone with database access)
 * 5. AUDIT LOGGING — log every read/write of banking fields with timestamp + user
 * 6. RETENTION POLICY — define how long applications stay; auto-delete rejected
 *    applications after N days
 * 7. BREACH NOTIFICATION PLAN — required by state law if banking is breached
 * 8. STATE COMPLIANCE — review TX, CA, NY, IL specific requirements
 * 9. GLBA COMPLIANCE — financial services data handling rules
 * 10. PCI ALIGNMENT — even though card data is in Payroc, banking data still
 *     needs comparable rigor
 *
 * Status: NOT PRODUCTION READY — collect data with eyes open about gaps above.
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import {
  validateEIN,
  validateUSPhone,
  validateZIP,
  validateStateCode,
  validateRoutingNumber,
  validateAccountNumber,
  validateEmail,
  validateWebsite,
  US_STATES,
} from "@/lib/onboarding/validation";
import { MCC_CODES } from "@/lib/onboarding/mcc-codes";

const TOTAL_STEPS = 5;

const SHADOW =
  "0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 16px 16px rgba(0,0,0,0.05)";

const INPUT: React.CSSProperties = {
  width: "100%",
  height: 44,
  background: "#FFFFFF",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  color: "#1A1313",
  fontSize: 14,
  padding: "0 12px",
  outline: "none",
  boxSizing: "border-box",
};

const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance: "none" as const,
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23878787' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 32,
};

const BUSINESS_TYPES = [
  { id: "hair_salon", label: "Hair Salon" },
  { id: "barbershop", label: "Barbershop" },
  { id: "nail_salon", label: "Nail Salon" },
  { id: "spa", label: "Spa" },
  { id: "suite_rental", label: "Suite Rental" },
  { id: "other", label: "Other" },
];

const VOLUME_OPTIONS = [
  { id: "<10k", label: "Under $10k" },
  { id: "10k-50k", label: "$10k - $50k" },
  { id: "50k-100k", label: "$50k - $100k" },
  { id: "100k-500k", label: "$100k - $500k" },
  { id: "500k+", label: "$500k+" },
];

const TICKET_OPTIONS = [
  { id: "<25", label: "Under $25" },
  { id: "25-50", label: "$25 - $50" },
  { id: "50-100", label: "$50 - $100" },
  { id: "100-250", label: "$100 - $250" },
  { id: "250-500", label: "$250 - $500" },
  { id: "500+", label: "$500+" },
];

function formatEIN(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + "-" + digits.slice(2);
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#017ea7";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(1,126,167,0.1)";
}

function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#D1D5DB";
  e.currentTarget.style.boxShadow = "none";
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      style={{
        display: "block",
        color: "#4A4A4A",
        fontSize: 13,
        fontWeight: 500,
        marginBottom: 6,
      }}
    >
      {children}
      {required && <span style={{ color: "#DC2626", marginLeft: 2 }}>*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p style={{ color: "#DC2626", fontSize: 12, marginTop: 4 }}>{msg}</p>
  );
}

function RadioCard({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 12px",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 500,
        background: selected ? "rgba(1,126,167,0.08)" : "#FFFFFF",
        border: `1px solid ${selected ? "#017ea7" : "#D1D5DB"}`,
        color: selected ? "#017ea7" : "#4A4A4A",
      }}
    >
      {label}
    </button>
  );
}

interface Props {
  userEmail: string;
  userName: string;
}

export default function OnboardingForm({ userEmail, userName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const [form, setForm] = useState<OnboardingFormData>({
    legalBusinessName: "",
    dba: "",
    businessType: "",
    ein: "",
    businessPhone: "",
    website: "",
    addressStreet: "",
    addressSuite: "",
    addressCity: "",
    addressState: "",
    addressZip: "",
    ownerFullName: userName,
    ownerEmail: userEmail,
    ownerPhone: "",
    ownerTitle: "Owner",
    bankName: "",
    accountHolderName: "",
    routingNumber: "",
    accountNumber: "",
    confirmAccountNumber: "",
    accountType: "checking",
    monthlyVolume: "",
    averageTicket: "",
    mccCode: "7230",
    agreementAccepted: false,
  });

  function set(key: keyof OnboardingFormData, value: string | boolean) {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (step === 0) {
      if (!form.legalBusinessName.trim()) e.legalBusinessName = "Required";
      if (!form.businessType) e.businessType = "Select a business type";
      if (!validateEIN(form.ein)) e.ein = "Must be XX-XXXXXXX format";
      if (!validateUSPhone(form.businessPhone)) e.businessPhone = "Enter a valid 10-digit phone";
      if (form.website && !validateWebsite(form.website)) e.website = "Enter a valid URL";
    }

    if (step === 1) {
      if (!form.addressStreet.trim()) e.addressStreet = "Required";
      if (!form.addressCity.trim()) e.addressCity = "Required";
      if (!validateStateCode(form.addressState)) e.addressState = "Select a state";
      if (!validateZIP(form.addressZip)) e.addressZip = "Enter a valid ZIP code";
    }

    if (step === 2) {
      if (!form.ownerFullName.trim()) e.ownerFullName = "Required";
      if (!validateEmail(form.ownerEmail)) e.ownerEmail = "Enter a valid email";
      if (!validateUSPhone(form.ownerPhone)) e.ownerPhone = "Enter a valid 10-digit phone";
    }

    if (step === 3) {
      if (!form.bankName.trim()) e.bankName = "Required";
      if (!form.accountHolderName.trim()) e.accountHolderName = "Required";
      if (!validateRoutingNumber(form.routingNumber)) e.routingNumber = "Invalid routing number";
      if (!validateAccountNumber(form.accountNumber)) e.accountNumber = "4-17 digits required";
      if (form.accountNumber !== form.confirmAccountNumber)
        e.confirmAccountNumber = "Account numbers don't match";
    }

    if (step === 4) {
      if (!form.monthlyVolume) e.monthlyVolume = "Select a volume range";
      if (!form.averageTicket) e.averageTicket = "Select a ticket size";
      if (!form.agreementAccepted) e.agreementAccepted = "You must agree to continue";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validate()) return;
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setServerError("");
    try {
      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setServerError(data.error || "Submission failed");
        }
        setSubmitting(false);
        return;
      }
      router.push("/onboarding/thank-you");
    } catch {
      setServerError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-8 md:py-16"
      style={{ background: "#FBFBFB" }}
    >
      {/* Header */}
      <div style={{ width: "100%", maxWidth: 720, marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Image
            src="/salontransact-logo.png"
            alt="SalonTransact"
            width={180}
            height={32}
            priority
            style={{ height: 32, width: "auto", objectFit: "contain" }}
          />
          <span style={{ fontSize: 13, color: "#878787", fontWeight: 500 }}>
            Step {step + 1} of {TOTAL_STEPS}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i <= step ? "#017ea7" : "#E8EAED",
                transition: "background 200ms",
              }}
            />
          ))}
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-2xl rounded-lg md:rounded-xl p-5 md:p-8"
        style={{
          background: "#FFFFFF",
          boxShadow: SHADOW,
        }}
      >
        {/* Step 1 — Business */}
        {step === 0 && (
          <div>
            <h2
              style={{
                color: "#1A1313",
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-0.31px",
                marginBottom: 4,
              }}
            >
              Tell us about your business
            </h2>
            <p style={{ color: "#878787", fontSize: 13, marginBottom: 24 }}>
              We need this information to set up payment processing
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Label required>Legal business name</Label>
                <input
                  type="text"
                  value={form.legalBusinessName}
                  onChange={(e) => set("legalBusinessName", e.target.value)}
                  placeholder="Your Salon LLC"
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <FieldError msg={errors.legalBusinessName} />
              </div>
              <div>
                <Label>DBA / Doing Business As</Label>
                <input
                  type="text"
                  value={form.dba}
                  onChange={(e) => set("dba", e.target.value)}
                  placeholder="Leave blank if same as legal name"
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
              </div>
              <div>
                <Label required>Business type</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {BUSINESS_TYPES.map((bt) => (
                    <RadioCard
                      key={bt.id}
                      selected={form.businessType === bt.id}
                      onClick={() => set("businessType", bt.id)}
                      label={bt.label}
                    />
                  ))}
                </div>
                <FieldError msg={errors.businessType} />
              </div>
              <div>
                <Label required>EIN / Tax ID</Label>
                <input
                  type="text"
                  value={form.ein}
                  onChange={(e) => set("ein", formatEIN(e.target.value))}
                  placeholder="12-3456789"
                  maxLength={10}
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <FieldError msg={errors.ein} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label required>Business phone</Label>
                  <input
                    type="tel"
                    value={form.businessPhone}
                    onChange={(e) =>
                      set("businessPhone", formatPhone(e.target.value))
                    }
                    placeholder="(555) 123-4567"
                    style={INPUT}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                  <FieldError msg={errors.businessPhone} />
                </div>
                <div>
                  <Label>Website</Label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://yoursalon.com"
                    style={INPUT}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                  <FieldError msg={errors.website} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Address */}
        {step === 1 && (
          <div>
            <h2
              style={{
                color: "#1A1313",
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-0.31px",
                marginBottom: 4,
              }}
            >
              Where is your business located?
            </h2>
            <p style={{ color: "#878787", fontSize: 13, marginBottom: 24 }}>
              Your business address for payment processing compliance
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Label required>Street address</Label>
                <input
                  type="text"
                  value={form.addressStreet}
                  onChange={(e) => set("addressStreet", e.target.value)}
                  placeholder="123 Main St"
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <FieldError msg={errors.addressStreet} />
              </div>
              <div>
                <Label>Suite / Apt</Label>
                <input
                  type="text"
                  value={form.addressSuite}
                  onChange={(e) => set("addressSuite", e.target.value)}
                  placeholder="Suite 100"
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
              </div>
              <div>
                <Label required>City</Label>
                <input
                  type="text"
                  value={form.addressCity}
                  onChange={(e) => set("addressCity", e.target.value)}
                  placeholder="City"
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <FieldError msg={errors.addressCity} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label required>State</Label>
                  <select
                    value={form.addressState}
                    onChange={(e) => set("addressState", e.target.value)}
                    style={SELECT}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  >
                    <option value="">Select state</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <FieldError msg={errors.addressState} />
                </div>
                <div>
                  <Label required>ZIP code</Label>
                  <input
                    type="text"
                    value={form.addressZip}
                    onChange={(e) =>
                      set(
                        "addressZip",
                        e.target.value.replace(/[^\d-]/g, "").slice(0, 10)
                      )
                    }
                    placeholder="12345"
                    maxLength={10}
                    style={INPUT}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                  <FieldError msg={errors.addressZip} />
                </div>
              </div>
              <div>
                <Label>Country</Label>
                <input
                  type="text"
                  value="United States"
                  disabled
                  style={{ ...INPUT, background: "#F4F5F7", color: "#878787" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Owner */}
        {step === 2 && (
          <div>
            <h2
              style={{
                color: "#1A1313",
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-0.31px",
                marginBottom: 4,
              }}
            >
              Who&apos;s the primary owner?
            </h2>
            <p style={{ color: "#878787", fontSize: 13, marginBottom: 24 }}>
              We&apos;ll send important account communications to this person
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Label required>Full name</Label>
                <input
                  type="text"
                  value={form.ownerFullName}
                  onChange={(e) => set("ownerFullName", e.target.value)}
                  placeholder="Jane Doe"
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <FieldError msg={errors.ownerFullName} />
              </div>
              <div>
                <Label required>Email</Label>
                <input
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => set("ownerEmail", e.target.value)}
                  placeholder="you@example.com"
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <FieldError msg={errors.ownerEmail} />
              </div>
              <div>
                <Label required>Phone</Label>
                <input
                  type="tel"
                  value={form.ownerPhone}
                  onChange={(e) =>
                    set("ownerPhone", formatPhone(e.target.value))
                  }
                  placeholder="(555) 123-4567"
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <FieldError msg={errors.ownerPhone} />
              </div>
              <div>
                <Label>Title</Label>
                <input
                  type="text"
                  value={form.ownerTitle}
                  onChange={(e) => set("ownerTitle", e.target.value)}
                  placeholder="Owner"
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Banking */}
        {step === 3 && (
          <div>
            <h2
              style={{
                color: "#1A1313",
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-0.31px",
                marginBottom: 4,
              }}
            >
              Where should we send your money?
            </h2>
            <p style={{ color: "#878787", fontSize: 13, marginBottom: 16 }}>
              Your payouts will land in this account. This information is
              encrypted and only used to set up your merchant account.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(1,126,167,0.06)",
                border: "1px solid rgba(1,126,167,0.15)",
                marginBottom: 24,
              }}
            >
              <Lock
                size={14}
                strokeWidth={1.5}
                color="#017ea7"
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <span style={{ color: "#4A4A4A", fontSize: 12 }}>
                Your banking information is sensitive. We share it only with our
                payment processor for identity verification.
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Label required>Bank name</Label>
                <input
                  type="text"
                  value={form.bankName}
                  onChange={(e) => set("bankName", e.target.value)}
                  placeholder="Chase, Wells Fargo, etc."
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <FieldError msg={errors.bankName} />
              </div>
              <div>
                <Label required>Account holder name</Label>
                <input
                  type="text"
                  value={form.accountHolderName}
                  onChange={(e) => set("accountHolderName", e.target.value)}
                  placeholder={form.legalBusinessName || "Business or personal name"}
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <FieldError msg={errors.accountHolderName} />
              </div>
              <div>
                <Label required>Routing number</Label>
                <input
                  type="text"
                  value={form.routingNumber}
                  onChange={(e) =>
                    set(
                      "routingNumber",
                      e.target.value.replace(/\D/g, "").slice(0, 9)
                    )
                  }
                  placeholder="9 digits"
                  maxLength={9}
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <FieldError msg={errors.routingNumber} />
              </div>
              <div>
                <Label required>Account number</Label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showAccount ? "text" : "password"}
                    value={form.accountNumber}
                    onChange={(e) =>
                      set(
                        "accountNumber",
                        e.target.value.replace(/\D/g, "").slice(0, 17)
                      )
                    }
                    placeholder="Account number"
                    style={{ ...INPUT, paddingRight: 44 }}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccount(!showAccount)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label={
                      showAccount ? "Hide account number" : "Show account number"
                    }
                  >
                    {showAccount ? (
                      <EyeOff size={16} strokeWidth={1.5} color="#878787" />
                    ) : (
                      <Eye size={16} strokeWidth={1.5} color="#878787" />
                    )}
                  </button>
                </div>
                <FieldError msg={errors.accountNumber} />
              </div>
              <div>
                <Label required>Confirm account number</Label>
                <input
                  type="password"
                  value={form.confirmAccountNumber}
                  onChange={(e) =>
                    set(
                      "confirmAccountNumber",
                      e.target.value.replace(/\D/g, "").slice(0, 17)
                    )
                  }
                  placeholder="Re-enter account number"
                  style={INPUT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <FieldError msg={errors.confirmAccountNumber} />
              </div>
              <div>
                <Label required>Account type</Label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <RadioCard
                    selected={form.accountType === "checking"}
                    onClick={() => set("accountType", "checking")}
                    label="Checking"
                  />
                  <RadioCard
                    selected={form.accountType === "savings"}
                    onClick={() => set("accountType", "savings")}
                    label="Savings"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5 — Volume + Agreement */}
        {step === 4 && (
          <div>
            <h2
              style={{
                color: "#1A1313",
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-0.31px",
                marginBottom: 4,
              }}
            >
              Almost done
            </h2>
            <p style={{ color: "#878787", fontSize: 13, marginBottom: 24 }}>
              A few more details to complete your application
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <Label required>Monthly processing volume</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {VOLUME_OPTIONS.map((v) => (
                    <RadioCard
                      key={v.id}
                      selected={form.monthlyVolume === v.id}
                      onClick={() => set("monthlyVolume", v.id)}
                      label={v.label}
                    />
                  ))}
                </div>
                <FieldError msg={errors.monthlyVolume} />
              </div>
              <div>
                <Label required>Average ticket size</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {TICKET_OPTIONS.map((t) => (
                    <RadioCard
                      key={t.id}
                      selected={form.averageTicket === t.id}
                      onClick={() => set("averageTicket", t.id)}
                      label={t.label}
                    />
                  ))}
                </div>
                <FieldError msg={errors.averageTicket} />
              </div>
              <div>
                <Label required>Business category (MCC)</Label>
                <select
                  value={form.mccCode}
                  onChange={(e) => set("mccCode", e.target.value)}
                  style={SELECT}
                  onFocus={focusInput}
                  onBlur={blurInput}
                >
                  {MCC_CODES.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.code} — {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Agreement */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  border: "1px solid #E8EAED",
                  background: "#F9FAFB",
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: "#4A4A4A",
                    lineHeight: 1.6,
                    marginBottom: 0,
                  }}
                >
                  By submitting this application, you agree that:
                </p>
                <ul
                  style={{
                    fontSize: 13,
                    color: "#4A4A4A",
                    lineHeight: 1.8,
                    paddingLeft: 20,
                    margin: "8px 0 0 0",
                  }}
                >
                  <li>
                    Your information will be reviewed and may be shared with
                    our payment processor for identity verification
                  </li>
                  <li>
                    Approval is not guaranteed and may take 1-3 business days
                  </li>
                  <li>
                    You will need to complete a separate merchant agreement
                    before processing payments
                  </li>
                  <li>
                    All information provided is accurate to the best of your
                    knowledge
                  </li>
                </ul>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.agreementAccepted}
                  onChange={(e) =>
                    set("agreementAccepted", e.target.checked)
                  }
                  style={{
                    marginTop: 3,
                    accentColor: "#017ea7",
                    width: 16,
                    height: 16,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{ color: "#4A4A4A", fontSize: 13, lineHeight: 1.5 }}
                >
                  I agree to the terms above
                </span>
              </label>
              <FieldError msg={errors.agreementAccepted} />
            </div>
          </div>
        )}

        {/* Server error */}
        {serverError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              padding: "10px 14px",
              marginTop: 20,
            }}
          >
            <AlertCircle
              size={16}
              strokeWidth={1.5}
              color="#DC2626"
              style={{ flexShrink: 0 }}
            />
            <span style={{ color: "#DC2626", fontSize: 13 }}>
              {serverError}
            </span>
          </div>
        )}

        {/* Navigation */}
        <div
          className="flex flex-col-reverse gap-3 md:flex-row md:justify-between md:gap-0"
          style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: "1px solid #E8EAED",
          }}
        >
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              className="w-full md:w-auto"
              style={{
                height: 44,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid #E8EAED",
                background: "#FFFFFF",
                color: "#4A4A4A",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          ) : (
            <div className="hidden md:block" />
          )}

          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={next}
              className="w-full md:w-auto"
              style={{
                height: 44,
                padding: "0 20px",
                borderRadius: 8,
                border: "1px solid #015f80",
                background:
                  "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full md:w-auto"
              style={{
                height: 44,
                padding: "0 20px",
                borderRadius: 8,
                border: "1px solid #015f80",
                background: submitting
                  ? "#015f80"
                  : "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 500,
                cursor: submitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting && (
                <Loader2
                  size={14}
                  strokeWidth={1.5}
                  className="animate-spin"
                />
              )}
              {submitting ? "Submitting..." : "Submit application"}
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24 }}>
        <p style={{ fontSize: 12, color: "#878787" }}>
          &copy; 2026 SalonTransact. All rights reserved.
        </p>
      </div>
    </div>
  );
}
