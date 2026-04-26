"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Building2,
  User,
  MapPin,
  Landmark,
  SlidersHorizontal,
  ClipboardCheck,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Lock,
  Scissors,
  Sparkles,
  Heart,
  Sofa,
  CircleEllipsis,
  CreditCard,
  Globe,
  AlertCircle,
  RefreshCw,
  FileText,
  DollarSign,
  Eye,
  EyeOff,
  Zap,
  FileCheck,
  UserCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: Record<string, unknown>
          ) => {
            addListener: (event: string, cb: () => void) => void;
            getPlace: () => {
              address_components?: Array<{
                long_name: string;
                short_name: string;
                types: string[];
              }>;
              formatted_address?: string;
            };
          };
        };
      };
    };
  }
}

interface FormData {
  businessName: string;
  dbaName: string;
  businessType: string;
  ein: string;
  phone: string;
  website: string;
  ownerFirstName: string;
  ownerLastName: string;
  dobMonth: string;
  dobDay: string;
  dobYear: string;
  ssnLast4: string;
  ownerTitle: string;
  ownershipPercentage: string;
  ownerAddress: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bankAccountHolder: string;
  bankRouting: string;
  bankAccount: string;
  bankAccountConfirm: string;
  bankAccountType: string;
  fundingSpeed: string;
  monthlyVolume: string;
  paymentMethods: string[];
  avgTransaction: string;
  agreedToTerms: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STEPS = [
  "Business",
  "Owner",
  "Location",
  "Banking",
  "Preferences",
  "Review",
  "Complete",
];
const STEP_ICONS = [
  Building2,
  User,
  MapPin,
  Landmark,
  SlidersHorizontal,
  ClipboardCheck,
  CheckCircle,
];

const BUSINESS_TYPES = [
  { id: "hair_salon", label: "Hair Salon", Icon: Scissors },
  { id: "barbershop", label: "Barbershop", Icon: Scissors },
  { id: "nail_salon", label: "Nail Salon", Icon: Sparkles },
  { id: "spa", label: "Spa", Icon: Heart },
  { id: "suite_rental", label: "Suite Rental", Icon: Sofa },
  { id: "other", label: "Other", Icon: CircleEllipsis },
];

const OWNER_TITLES = [
  "Owner",
  "Co-Owner",
  "President",
  "CEO",
  "Managing Partner",
  "Other",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const VOLUME_OPTIONS = [
  { id: "under_10k", label: "Under $10,000" },
  { id: "10k_50k", label: "$10,000 - $50,000" },
  { id: "50k_100k", label: "$50,000 - $100,000" },
  { id: "over_100k", label: "Over $100,000" },
];

const PAYMENT_METHOD_OPTIONS = [
  { id: "in_person", label: "In-Person Payments", Icon: CreditCard },
  { id: "online_booking", label: "Online Booking Deposits", Icon: Globe },
  { id: "no_show", label: "No-Show Fees", Icon: AlertCircle },
  { id: "recurring", label: "Recurring Subscriptions", Icon: RefreshCw },
  { id: "invoicing", label: "Invoicing", Icon: FileText },
  { id: "tips", label: "Tips", Icon: DollarSign },
];

const AVG_TRANSACTION_OPTIONS = [
  "Under $50",
  "$50 - $100",
  "$100 - $200",
  "$200 - $500",
  "Over $500",
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const INPUT: React.CSSProperties = {
  width: "100%",
  height: 48,
  background: "#0d1f3c",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#f9fafb",
  fontSize: 15,
  padding: "0 14px",
  outline: "none",
  boxSizing: "border-box",
};

const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance: "none" as const,
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 36,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

function StepIcon({
  icon: Icon,
  color,
}: {
  icon: typeof Building2;
  color: string;
}) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: `${color}15`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24,
      }}
    >
      <Icon size={20} strokeWidth={1.5} color={color} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        color: "#9ca3af",
        fontSize: 13,
        fontWeight: 500,
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

function Helper({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: "#4b5563", fontSize: 12, marginTop: 4 }}>{children}</p>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{msg}</p>;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showBankAccount, setShowBankAccount] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>({
    businessName: "",
    dbaName: "",
    businessType: "",
    ein: "",
    phone: "",
    website: "",
    ownerFirstName: "",
    ownerLastName: "",
    dobMonth: "",
    dobDay: "",
    dobYear: "",
    ssnLast4: "",
    ownerTitle: "",
    ownershipPercentage: "",
    ownerAddress: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    bankAccountHolder: "",
    bankRouting: "",
    bankAccount: "",
    bankAccountConfirm: "",
    bankAccountType: "checking",
    fundingSpeed: "next_day",
    monthlyVolume: "",
    paymentMethods: [],
    avgTransaction: "",
    agreedToTerms: false,
  });

  function set(key: keyof FormData, value: string | string[] | boolean) {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: "" }));
  }

  function togglePaymentMethod(id: string) {
    setForm((p) => ({
      ...p,
      paymentMethods: p.paymentMethods.includes(id)
        ? p.paymentMethods.filter((m) => m !== id)
        : [...p.paymentMethods, id],
    }));
  }

  /* ---- Google Places ---- */
  const initAutocomplete = useCallback(() => {
    if (!addressInputRef.current || !window.google) return;
    const autocomplete = new window.google.maps.places.Autocomplete(
      addressInputRef.current,
      { types: ["address"], componentRestrictions: { country: "us" } }
    );
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.address_components) return;
      let street = "";
      let city = "";
      let state = "";
      let zip = "";
      for (const c of place.address_components) {
        if (c.types.includes("street_number")) street = c.long_name;
        if (c.types.includes("route")) street += " " + c.long_name;
        if (c.types.includes("locality")) city = c.long_name;
        if (c.types.includes("administrative_area_level_1"))
          state = c.short_name;
        if (c.types.includes("postal_code")) zip = c.long_name;
      }
      setForm((p) => ({
        ...p,
        address: street.trim(),
        city,
        state,
        zip,
      }));
    });
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;
    if (window.google) {
      initAutocomplete();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = initAutocomplete;
    document.head.appendChild(script);
  }, [step, initAutocomplete]);

  /* ---- Validation ---- */
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!form.businessName.trim()) e.businessName = "Required";
      if (!form.businessType) e.businessType = "Select a business type";
      const einDigits = form.ein.replace(/\D/g, "");
      if (einDigits.length !== 9) e.ein = "Must be 9 digits";
      const phoneDigits = form.phone.replace(/\D/g, "");
      if (phoneDigits.length !== 10) e.phone = "Must be 10 digits";
    }
    if (step === 1) {
      if (!form.ownerFirstName.trim()) e.ownerFirstName = "Required";
      if (!form.ownerLastName.trim()) e.ownerLastName = "Required";
      if (!form.dobMonth || !form.dobDay || !form.dobYear) e.dob = "Required";
      else {
        const dob = new Date(
          parseInt(form.dobYear),
          parseInt(form.dobMonth) - 1,
          parseInt(form.dobDay)
        );
        const age =
          (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (age < 18) e.dob = "Must be at least 18 years old";
      }
      if (form.ssnLast4.length !== 4) e.ssnLast4 = "Must be exactly 4 digits";
      if (!form.ownerTitle) e.ownerTitle = "Required";
      const pct = parseInt(form.ownershipPercentage);
      if (!pct || pct < 1 || pct > 100)
        e.ownershipPercentage = "Must be 1-100";
      if (!form.ownerAddress.trim()) e.ownerAddress = "Required";
    }
    if (step === 2) {
      if (!form.address.trim()) e.address = "Required";
      if (!form.city.trim()) e.city = "Required";
      if (!form.state) e.state = "Required";
      if (form.zip.replace(/\D/g, "").length !== 5)
        e.zip = "Must be 5 digits";
    }
    if (step === 3) {
      if (!form.bankAccountHolder.trim()) e.bankAccountHolder = "Required";
      if (form.bankRouting.replace(/\D/g, "").length !== 9)
        e.bankRouting = "Must be 9 digits";
      if (!form.bankAccount.trim()) e.bankAccount = "Required";
      if (form.bankAccount !== form.bankAccountConfirm)
        e.bankAccountConfirm = "Account numbers must match";
    }
    if (step === 4) {
      if (!form.monthlyVolume) e.monthlyVolume = "Select a volume range";
      if (form.paymentMethods.length === 0)
        e.paymentMethods = "Select at least one";
      if (!form.avgTransaction) e.avgTransaction = "Required";
    }
    if (step === 5) {
      if (!form.agreedToTerms) e.agreedToTerms = "You must agree to continue";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validate()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  function goToStep(s: number) {
    setStep(s);
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const dob = `${form.dobYear}-${form.dobMonth.padStart(2, "0")}-${form.dobDay.padStart(2, "0")}`;
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          dbaName: form.dbaName,
          businessType: form.businessType,
          ein: form.ein,
          phone: form.phone,
          ownerFirstName: form.ownerFirstName,
          ownerLastName: form.ownerLastName,
          ownerDob: dob,
          ownerSsnLast4: form.ssnLast4,
          ownerTitle: form.ownerTitle,
          ownershipPercentage: form.ownershipPercentage,
          ownerAddress: form.ownerAddress,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          bankAccountHolder: form.bankAccountHolder,
          bankRoutingNumber: form.bankRouting,
          bankAccountNumber: form.bankAccount,
          bankAccountType: form.bankAccountType,
          fundingSpeed: form.fundingSpeed,
          monthlyVolume: form.monthlyVolume,
          avgTransaction: form.avgTransaction,
          paymentMethods: form.paymentMethods,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErrors({ submit: data.error || "Submission failed" });
        setLoading(false);
        return;
      }
      setStep(6);
    } catch {
      setErrors({ submit: "Something went wrong. Please try again." });
    }
    setLoading(false);
  }

  /* ---- Render helpers ---- */

  function renderCard(
    selected: boolean,
    onClick: () => void,
    children: React.ReactNode
  ) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: 16,
          borderRadius: 12,
          cursor: "pointer",
          background: selected ? "rgba(99,91,255,0.1)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${selected ? "#635bff" : "rgba(255,255,255,0.06)"}`,
        }}
      >
        {children}
      </button>
    );
  }

  function ReviewSection({
    title,
    editStep,
    children,
  }: {
    title: string;
    editStep: number;
    children: React.ReactNode;
  }) {
    return (
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {title}
          </span>
          <button
            type="button"
            onClick={() => goToStep(editStep)}
            style={{ color: "#635bff", fontSize: 13, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}
          >
            Edit
          </button>
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  function ReviewRow({ label, value }: { label: string; value: string }) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "6px 0",
        }}
      >
        <span style={{ color: "#6b7280", fontSize: 13 }}>{label}</span>
        <span style={{ color: "#f9fafb", fontSize: 13 }}>{value || "N/A"}</span>
      </div>
    );
  }

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px",
      }}
    >
      {/* Top bar */}
      <div style={{ width: "100%", maxWidth: 600, marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <span style={{ color: "#f9fafb", fontWeight: 600, fontSize: 18 }}>
            <span style={{ color: "#635bff" }}>Salon</span>Transact
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {STEPS.map((s, i) => {
              const Icon = STEP_ICONS[i];
              const done = i < step;
              const active = i === step;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: done ? "#22c55e" : active ? "#635bff" : "#1f2937",
                      color: done || active ? "#fff" : "#4b5563",
                    }}
                  >
                    {done ? (
                      <CheckCircle size={14} strokeWidth={1.5} />
                    ) : (
                      <Icon size={14} strokeWidth={1.5} />
                    )}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      style={{
                        width: 16,
                        height: 2,
                        borderRadius: 1,
                        background: done ? "#22c55e" : "#1f2937",
                        display: "none",
                      }}
                      className="hidden sm:block"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: "#1f2937",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 2,
              background: "#635bff",
              width: `${((step + 1) / STEPS.length) * 100}%`,
              transition: "width 400ms ease-out",
            }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
          padding: "40px 36px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.25), 0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* ============================================================ */}
        {/* STEP 1 — Business                                             */}
        {/* ============================================================ */}
        {step === 0 && (
          <div>
            <StepIcon icon={Building2} color="#635bff" />
            <h2 style={{ color: "#f9fafb", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              Tell us about your business
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 28 }}>
              Required for payment processing setup
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Label>Legal Business Name *</Label>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={(e) => set("businessName", e.target.value)}
                  placeholder="Your legal business name"
                  style={INPUT}
                />
                <FieldError msg={errors.businessName} />
              </div>
              <div>
                <Label>DBA / Doing Business As</Label>
                <input
                  type="text"
                  value={form.dbaName}
                  onChange={(e) => set("dbaName", e.target.value)}
                  placeholder="Leave blank if same as legal name"
                  style={INPUT}
                />
              </div>
              <div>
                <Label>Business Type *</Label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {BUSINESS_TYPES.map((bt) => {
                    const sel = form.businessType === bt.id;
                    return renderCard(sel, () => set("businessType", bt.id),
                      <>
                        <bt.Icon size={18} strokeWidth={1.5} color={sel ? "#635bff" : "#6b7280"} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: sel ? "#635bff" : "#9ca3af" }}>
                          {bt.label}
                        </span>
                      </>
                    );
                  })}
                </div>
                <FieldError msg={errors.businessType} />
              </div>
              <div>
                <Label>EIN / Tax ID *</Label>
                <input
                  type="text"
                  value={form.ein}
                  onChange={(e) => set("ein", formatEIN(e.target.value))}
                  placeholder="XX-XXXXXXX"
                  maxLength={10}
                  style={INPUT}
                />
                <Helper>Your 9-digit federal tax ID</Helper>
                <FieldError msg={errors.ein} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Label>Business Phone *</Label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", formatPhone(e.target.value))}
                    placeholder="(XXX) XXX-XXXX"
                    style={INPUT}
                  />
                  <FieldError msg={errors.phone} />
                </div>
                <div>
                  <Label>Website</Label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://yoursalon.com"
                    style={INPUT}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2 — Owner                                                */}
        {/* ============================================================ */}
        {step === 1 && (
          <div>
            <StepIcon icon={User} color="#635bff" />
            <h2 style={{ color: "#f9fafb", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              About the owner
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 28 }}>
              Required for payment processing compliance and identity verification
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Label>First Name *</Label>
                  <input type="text" value={form.ownerFirstName} onChange={(e) => set("ownerFirstName", e.target.value)} placeholder="Jane" style={INPUT} />
                  <FieldError msg={errors.ownerFirstName} />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <input type="text" value={form.ownerLastName} onChange={(e) => set("ownerLastName", e.target.value)} placeholder="Doe" style={INPUT} />
                  <FieldError msg={errors.ownerLastName} />
                </div>
              </div>
              <div>
                <Label>Date of Birth *</Label>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr", gap: 10 }}>
                  <select value={form.dobMonth} onChange={(e) => set("dobMonth", e.target.value)} style={SELECT}>
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                  </select>
                  <select value={form.dobDay} onChange={(e) => set("dobDay", e.target.value)} style={SELECT}>
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                  </select>
                  <select value={form.dobYear} onChange={(e) => set("dobYear", e.target.value)} style={SELECT}>
                    <option value="">Year</option>
                    {Array.from({ length: 80 }, (_, i) => {
                      const y = new Date().getFullYear() - 18 - i;
                      return <option key={y} value={String(y)}>{y}</option>;
                    })}
                  </select>
                </div>
                <FieldError msg={errors.dob} />
              </div>
              <div>
                <Label>SSN Last 4 *</Label>
                <input
                  type="password"
                  value={form.ssnLast4}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); set("ssnLast4", v); }}
                  placeholder="****"
                  maxLength={4}
                  style={INPUT}
                />
                <Helper>Last 4 digits of your Social Security Number. Used for identity verification only.</Helper>
                <FieldError msg={errors.ssnLast4} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Label>Job Title *</Label>
                  <select value={form.ownerTitle} onChange={(e) => set("ownerTitle", e.target.value)} style={SELECT}>
                    <option value="">Select title</option>
                    {OWNER_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <FieldError msg={errors.ownerTitle} />
                </div>
                <div>
                  <Label>Ownership % *</Label>
                  <input type="number" min={1} max={100} value={form.ownershipPercentage} onChange={(e) => set("ownershipPercentage", e.target.value)} placeholder="100" style={INPUT} />
                  <FieldError msg={errors.ownershipPercentage} />
                </div>
              </div>
              <div>
                <Label>Home Address *</Label>
                <input type="text" value={form.ownerAddress} onChange={(e) => set("ownerAddress", e.target.value)} placeholder="Your personal address (for KYC verification)" style={INPUT} />
                <FieldError msg={errors.ownerAddress} />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3 — Location                                             */}
        {/* ============================================================ */}
        {step === 2 && (
          <div>
            <StepIcon icon={MapPin} color="#635bff" />
            <h2 style={{ color: "#f9fafb", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              Where is your business located?
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 28 }}>
              Used for payment processing compliance
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Label>Street Address *</Label>
                <input ref={addressInputRef} type="text" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Start typing your address..." style={INPUT} />
                <FieldError msg={errors.address} />
              </div>
              <div>
                <Label>City *</Label>
                <input type="text" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="City" style={INPUT} />
                <FieldError msg={errors.city} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Label>State *</Label>
                  <select value={form.state} onChange={(e) => set("state", e.target.value)} style={SELECT}>
                    <option value="">Select</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <FieldError msg={errors.state} />
                </div>
                <div>
                  <Label>ZIP Code *</Label>
                  <input type="text" value={form.zip} onChange={(e) => set("zip", e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="12345" maxLength={5} style={INPUT} />
                  <FieldError msg={errors.zip} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4 — Banking                                              */}
        {/* ============================================================ */}
        {step === 3 && (
          <div>
            <StepIcon icon={Landmark} color="#635bff" />
            <h2 style={{ color: "#f9fafb", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              Where should we send your payouts?
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 28 }}>
              Your bank account for receiving daily settlements
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Label>Account Holder Name *</Label>
                <input type="text" value={form.bankAccountHolder} onChange={(e) => set("bankAccountHolder", e.target.value)} placeholder="Name exactly as it appears on your bank account" style={INPUT} />
                <FieldError msg={errors.bankAccountHolder} />
              </div>
              <div>
                <Label>Routing Number *</Label>
                <input type="text" value={form.bankRouting} onChange={(e) => set("bankRouting", e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9 digits" maxLength={9} style={INPUT} />
                <FieldError msg={errors.bankRouting} />
              </div>
              <div>
                <Label>Account Number *</Label>
                <div style={{ position: "relative" }}>
                  <input type={showBankAccount ? "text" : "password"} value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} placeholder="Account number" style={{ ...INPUT, paddingRight: 48 }} />
                  <button type="button" onClick={() => setShowBankAccount(!showBankAccount)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    {showBankAccount ? <EyeOff size={16} strokeWidth={1.5} color="#4b5563" /> : <Eye size={16} strokeWidth={1.5} color="#4b5563" />}
                  </button>
                </div>
                <FieldError msg={errors.bankAccount} />
              </div>
              <div>
                <Label>Confirm Account Number *</Label>
                <input type="password" value={form.bankAccountConfirm} onChange={(e) => set("bankAccountConfirm", e.target.value)} placeholder="Re-enter account number" style={INPUT} />
                <FieldError msg={errors.bankAccountConfirm} />
              </div>
              <div>
                <Label>Account Type *</Label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {["checking", "savings"].map((t) => {
                    const sel = form.bankAccountType === t;
                    return renderCard(sel, () => set("bankAccountType", t),
                      <span style={{ fontSize: 14, fontWeight: 500, color: sel ? "#635bff" : "#9ca3af", textTransform: "capitalize" }}>{t}</span>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Funding Speed *</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { id: "next_day", label: "Next Day", desc: "Funds arrive next business day", badge: "Recommended" },
                    { id: "same_day", label: "Same Day", desc: "Funds arrive same business day" },
                    { id: "standard", label: "Standard", desc: "Funds arrive in 2-3 business days" },
                  ].map((opt) => {
                    const sel = form.fundingSpeed === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => set("fundingSpeed", opt.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 16px",
                          borderRadius: 10,
                          cursor: "pointer",
                          background: sel ? "rgba(99,91,255,0.1)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${sel ? "#635bff" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <div style={{ textAlign: "left" }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: sel ? "#f9fafb" : "#9ca3af" }}>{opt.label}</span>
                          <span style={{ fontSize: 12, color: "#4b5563", marginLeft: 8 }}>{opt.desc}</span>
                        </div>
                        {"badge" in opt && opt.badge && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#635bff", background: "rgba(99,91,255,0.15)", padding: "2px 8px", borderRadius: 100 }}>{opt.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Lock size={14} strokeWidth={1.5} color="#635bff" style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ color: "#4b5563", fontSize: 12 }}>
                  Your banking information is encrypted with 256-bit AES encryption and transmitted securely for payment processing setup.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 5 — Preferences                                          */}
        {/* ============================================================ */}
        {step === 4 && (
          <div>
            <StepIcon icon={SlidersHorizontal} color="#635bff" />
            <h2 style={{ color: "#f9fafb", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              How will you use SalonTransact?
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 28 }}>
              Helps us optimize your account setup
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <Label>Monthly Processing Volume *</Label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {VOLUME_OPTIONS.map((v) => {
                    const sel = form.monthlyVolume === v.id;
                    return renderCard(sel, () => set("monthlyVolume", v.id),
                      <span style={{ fontSize: 13, fontWeight: 500, color: sel ? "#635bff" : "#9ca3af" }}>{v.label}</span>
                    );
                  })}
                </div>
                <FieldError msg={errors.monthlyVolume} />
              </div>
              <div>
                <Label>Payment Methods *</Label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {PAYMENT_METHOD_OPTIONS.map((pm) => {
                    const sel = form.paymentMethods.includes(pm.id);
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => togglePaymentMethod(pm.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "14px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          background: sel ? "rgba(99,91,255,0.1)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${sel ? "#635bff" : "rgba(255,255,255,0.06)"}`,
                          textAlign: "left",
                        }}
                      >
                        <pm.Icon size={16} strokeWidth={1.5} color={sel ? "#635bff" : "#6b7280"} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: sel ? "#635bff" : "#9ca3af" }}>{pm.label}</span>
                      </button>
                    );
                  })}
                </div>
                <FieldError msg={errors.paymentMethods} />
              </div>
              <div>
                <Label>Average Transaction Amount *</Label>
                <select value={form.avgTransaction} onChange={(e) => set("avgTransaction", e.target.value)} style={SELECT}>
                  <option value="">Select range</option>
                  {AVG_TRANSACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <FieldError msg={errors.avgTransaction} />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 6 — Review                                               */}
        {/* ============================================================ */}
        {step === 5 && (
          <div>
            <StepIcon icon={ClipboardCheck} color="#635bff" />
            <h2 style={{ color: "#f9fafb", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              Review your application
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 28 }}>
              Please review all information before submitting
            </p>
            <ReviewSection title="Business Information" editStep={0}>
              <ReviewRow label="Legal Name" value={form.businessName} />
              <ReviewRow label="DBA" value={form.dbaName} />
              <ReviewRow label="Type" value={BUSINESS_TYPES.find((b) => b.id === form.businessType)?.label || ""} />
              <ReviewRow label="EIN" value={form.ein} />
              <ReviewRow label="Phone" value={form.phone} />
            </ReviewSection>
            <ReviewSection title="Owner Information" editStep={1}>
              <ReviewRow label="Name" value={`${form.ownerFirstName} ${form.ownerLastName}`} />
              <ReviewRow label="DOB" value={form.dobMonth && form.dobDay && form.dobYear ? `${form.dobMonth}/${form.dobDay}/${form.dobYear}` : ""} />
              <ReviewRow label="SSN Last 4" value={form.ssnLast4 ? `••••` : ""} />
              <ReviewRow label="Title" value={form.ownerTitle} />
              <ReviewRow label="Ownership" value={form.ownershipPercentage ? `${form.ownershipPercentage}%` : ""} />
            </ReviewSection>
            <ReviewSection title="Business Location" editStep={2}>
              <ReviewRow label="Address" value={`${form.address}, ${form.city}, ${form.state} ${form.zip}`} />
            </ReviewSection>
            <ReviewSection title="Banking" editStep={3}>
              <ReviewRow label="Account Holder" value={form.bankAccountHolder} />
              <ReviewRow label="Routing" value={form.bankRouting} />
              <ReviewRow label="Account" value={form.bankAccount ? `••••••${form.bankAccount.slice(-4)}` : ""} />
              <ReviewRow label="Type" value={form.bankAccountType} />
              <ReviewRow label="Funding" value={form.fundingSpeed.replace(/_/g, " ")} />
            </ReviewSection>
            <ReviewSection title="Processing Preferences" editStep={4}>
              <ReviewRow label="Volume" value={VOLUME_OPTIONS.find((v) => v.id === form.monthlyVolume)?.label || ""} />
              <ReviewRow label="Methods" value={form.paymentMethods.map((id) => PAYMENT_METHOD_OPTIONS.find((p) => p.id === id)?.label).filter(Boolean).join(", ")} />
              <ReviewRow label="Avg Transaction" value={form.avgTransaction} />
            </ReviewSection>
            <div style={{ marginTop: 20 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.agreedToTerms}
                  onChange={(e) => set("agreedToTerms", e.target.checked)}
                  style={{ marginTop: 3, accentColor: "#635bff", width: 16, height: 16 }}
                />
                <span style={{ color: "#9ca3af", fontSize: 13, lineHeight: 1.5 }}>
                  I certify that all information provided is accurate and complete. I authorize Reyna Pay LLC and SalonTransact to verify this information and process my merchant application.
                </span>
              </label>
              <FieldError msg={errors.agreedToTerms} />
            </div>
            {errors.submit && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={16} strokeWidth={1.5} color="#ef4444" />
                <span style={{ color: "#ef4444", fontSize: 13 }}>{errors.submit}</span>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 7 — Complete                                              */}
        {/* ============================================================ */}
        {step === 6 && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
              <div className="celebration-ring" />
              <div className="celebration-ring" />
              <div className="celebration-ring" />
              <div className="celebration-pulse" style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
                <CheckCircle size={32} strokeWidth={1.5} color="#22c55e" />
              </div>
            </div>
            <h2 style={{ color: "#f9fafb", fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
              Application Submitted!
            </h2>
            <p style={{ color: "#635bff", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {form.businessName}
            </p>
            <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 36, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
              Your application has been submitted to our payment processing team. We&apos;ll review your information within 1-2 business days and reach out to complete your setup.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
              <button
                type="button"
                onClick={() => { window.location.href = "/dashboard"; }}
                style={{ width: "100%", height: 48, background: "#635bff", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                Go to Dashboard
                <ArrowRight size={16} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = "/settings"; }}
                style={{ width: "100%", height: 48, background: "transparent", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: "#9ca3af", fontSize: 15, fontWeight: 500, cursor: "pointer" }}
              >
                Add Team Members
              </button>
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 16 }}>
                What happens next
              </p>
              {[
                { Icon: FileCheck, label: "Application Review", desc: "Our team reviews your business information", time: "1-2 business days" },
                { Icon: UserCheck, label: "Underwriting Review", desc: "Your business and banking information is verified", time: "2-3 business days" },
                { Icon: Zap, label: "Start Processing", desc: "Receive your merchant ID and begin accepting payments", time: "After approval" },
              ].map((item, i) => (
                <div key={item.label} style={{ display: "flex", gap: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(99,91,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <item.Icon size={14} strokeWidth={1.5} color="#635bff" />
                    </div>
                    {i < 2 && <div style={{ width: 1, flex: 1, margin: "4px 0", background: "rgba(255,255,255,0.06)" }} />}
                  </div>
                  <div style={{ paddingBottom: 18 }}>
                    <p style={{ color: "#f9fafb", fontSize: 14, fontWeight: 500 }}>{item.label}</p>
                    <p style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{item.desc}</p>
                    <p style={{ color: "#4b5563", fontSize: 11, marginTop: 2 }}>{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* Navigation                                                     */}
        {/* ============================================================ */}
        {step < 6 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 36,
              paddingTop: 24,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {step > 0 ? (
              <button
                type="button"
                onClick={back}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "transparent",
                  color: "#9ca3af",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <ArrowLeft size={16} strokeWidth={1.5} />
                Back
              </button>
            ) : (
              <div />
            )}
            {step === 5 ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "#635bff",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
                Submit Application
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "#635bff",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Continue
                <ArrowRight size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
