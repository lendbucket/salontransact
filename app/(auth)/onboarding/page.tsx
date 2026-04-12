"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Building2,
  MapPin,
  Landmark,
  SlidersHorizontal,
  CheckCircle2,
  Shield,
  Lock,
  BadgeCheck,
  ArrowLeft,
  ArrowRight,
  Scissors,
  Sparkles,
  Paintbrush,
  Heart,
  Sofa,
  CircleEllipsis,
  CreditCard,
  CalendarCheck,
  Repeat,
  Receipt,
  FileCheck,
  UserCheck,
  Zap,
} from "lucide-react";

const STEPS = ["Business", "Location", "Bank", "Preferences", "Complete"];
const STEP_ICONS = [Building2, MapPin, Landmark, SlidersHorizontal, CheckCircle2];

const BUSINESS_TYPES = [
  { id: "hair_salon", label: "Hair Salon", icon: Scissors },
  { id: "barbershop", label: "Barbershop", icon: Paintbrush },
  { id: "nail_salon", label: "Nail Salon", icon: Sparkles },
  { id: "spa", label: "Spa", icon: Heart },
  { id: "suite_rental", label: "Suite Rental", icon: Sofa },
  { id: "other", label: "Other", icon: CircleEllipsis },
];

const VOLUME_RANGES = [
  { id: "under_10k", label: "Under $10K" },
  { id: "10k_50k", label: "$10K - $50K" },
  { id: "50k_100k", label: "$50K - $100K" },
  { id: "over_100k", label: "$100K+" },
];

const USE_CASES = [
  { id: "in_person", label: "In-Person Payments", icon: CreditCard },
  { id: "online_booking", label: "Online Booking", icon: CalendarCheck },
  { id: "subscriptions", label: "Recurring Subscriptions", icon: Repeat },
  { id: "invoicing", label: "Invoicing & Tips", icon: Receipt },
];

const SECURITY_BADGES = [
  { icon: Lock, title: "256-bit Encryption", desc: "AES-256 on all data at rest and in transit" },
  { icon: Shield, title: "PCI DSS Level 1", desc: "Highest level of payment card compliance" },
  { icon: BadgeCheck, title: "SOC 2 Type II", desc: "Audited security controls and processes" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    businessType: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    monthlyVolume: "",
    useCases: [] as string[],
  });

  function update(key: string, value: string | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleUseCase(val: string) {
    setForm((prev) => ({
      ...prev,
      useCases: prev.useCases.includes(val)
        ? prev.useCases.filter((v) => v !== val)
        : [...prev.useCases, val],
    }));
  }

  async function handleStripeConnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      // fall through
    }
    setLoading(false);
    setStep(3);
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-8"
      style={{ background: "#0a0f1a" }}
    >
      {/* Top bar: logo + step indicators */}
      <div className="w-full max-w-[600px] mb-8">
        <div className="flex items-center justify-between mb-6">
          <span className="text-white font-semibold text-lg">
            <span style={{ color: "#635bff" }}>Salon</span>Transact
          </span>

          {/* Step dots */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => {
              const Icon = STEP_ICONS[i];
              const done = i < step;
              const active = i === step;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: done
                        ? "#22c55e"
                        : active
                          ? "#635bff"
                          : "#1f2937",
                      color: done || active ? "#fff" : "#4b5563",
                    }}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className="hidden sm:block w-8 h-0.5 rounded"
                      style={{
                        background: done ? "#22c55e" : "#1f2937",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: "#1f2937" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: "#635bff",
              width: `${((step + 1) / STEPS.length) * 100}%`,
              transition: "width 400ms ease-out",
            }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-[600px] rounded-2xl p-10 sm:p-12"
        style={{
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.25), 0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Step 1: Business Info */}
        {step === 0 && (
          <div className="step-enter">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
              style={{ background: "rgba(99,91,255,0.12)" }}
            >
              <Building2 className="w-5 h-5" style={{ color: "#635bff" }} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">
              What kind of business do you run?
            </h2>
            <p className="text-sm text-secondary mb-8">
              This helps us tailor your payment experience
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Business name
                </label>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                  className="st-input"
                  placeholder="Your salon name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-3">
                  Business type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {BUSINESS_TYPES.map((bt) => {
                    const Icon = bt.icon;
                    const selected = form.businessType === bt.id;
                    return (
                      <button
                        key={bt.id}
                        type="button"
                        onClick={() => update("businessType", bt.id)}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer"
                        style={{
                          background: selected
                            ? "rgba(99,91,255,0.12)"
                            : "rgba(255,255,255,0.03)",
                          border: `1px solid ${selected ? "#635bff" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <Icon
                          className="w-5 h-5"
                          style={{
                            color: selected ? "#635bff" : "#6b7280",
                          }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{
                            color: selected ? "#635bff" : "#9ca3af",
                          }}
                        >
                          {bt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Phone number
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    className="st-input"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Website (optional)
                  </label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => update("website", e.target.value)}
                    className="st-input"
                    placeholder="yoursalon.com"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 1 && (
          <div className="step-enter">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
              style={{ background: "rgba(99,91,255,0.12)" }}
            >
              <MapPin className="w-5 h-5" style={{ color: "#635bff" }} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Your business location
            </h2>
            <p className="text-sm text-secondary mb-8">
              Used for payment verification and compliance
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Street address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  className="st-input"
                  placeholder="123 Main Street"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  className="st-input"
                  placeholder="City"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => update("state", e.target.value)}
                    className="st-input"
                    placeholder="State"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    ZIP code
                  </label>
                  <input
                    type="text"
                    value={form.zip}
                    onChange={(e) => update("zip", e.target.value)}
                    className="st-input"
                    placeholder="12345"
                  />
                </div>
              </div>
            </div>

            {/* Location verification note */}
            <div
              className="mt-6 flex items-center gap-3 p-3 rounded-lg"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Shield className="w-4 h-4 flex-shrink-0" style={{ color: "#635bff" }} />
              <span className="text-xs text-muted">
                Your location will be verified for payment processing compliance
              </span>
            </div>
          </div>
        )}

        {/* Step 3: Connect Bank */}
        {step === 2 && (
          <div className="step-enter">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
              style={{ background: "rgba(99,91,255,0.12)" }}
            >
              <Landmark className="w-5 h-5" style={{ color: "#635bff" }} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Secure bank connection
            </h2>
            <p className="text-sm text-secondary mb-8">
              We use Stripe to securely connect your bank. We never store your
              banking credentials.
            </p>

            {/* Security badges */}
            <div className="space-y-3 mb-8">
              {SECURITY_BADGES.map((badge) => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.title}
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(34,197,94,0.1)" }}
                    >
                      <Icon className="w-4 h-4" style={{ color: "#22c55e" }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {badge.title}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {badge.desc}
                      </p>
                    </div>
                    <CheckCircle2
                      className="w-4 h-4 ml-auto flex-shrink-0"
                      style={{ color: "#22c55e" }}
                    />
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleStripeConnect}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 font-semibold text-sm rounded-xl cursor-pointer"
              style={{
                background: "#635bff",
                color: "#fff",
                height: 52,
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Landmark className="w-4 h-4" />
              )}
              Connect with Stripe
            </button>

            <p className="text-xs text-center text-muted mt-4">
              Your information is encrypted and secure. Powered by Stripe
              Connect.
            </p>
          </div>
        )}

        {/* Step 4: Preferences */}
        {step === 3 && (
          <div className="step-enter">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
              style={{ background: "rgba(99,91,255,0.12)" }}
            >
              <SlidersHorizontal
                className="w-5 h-5"
                style={{ color: "#635bff" }}
              />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">
              How will you use SalonTransact?
            </h2>
            <p className="text-sm text-secondary mb-8">
              This helps us optimize your dashboard
            </p>

            <div className="space-y-6">
              {/* Volume */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-3">
                  Estimated monthly volume
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {VOLUME_RANGES.map((v) => {
                    const selected = form.monthlyVolume === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => update("monthlyVolume", v.id)}
                        className="p-4 rounded-xl text-center cursor-pointer"
                        style={{
                          background: selected
                            ? "rgba(99,91,255,0.12)"
                            : "rgba(255,255,255,0.03)",
                          border: `1px solid ${selected ? "#635bff" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <span
                          className="text-sm font-medium"
                          style={{
                            color: selected ? "#635bff" : "#9ca3af",
                          }}
                        >
                          {v.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Use cases */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-3">
                  Primary use cases
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {USE_CASES.map((uc) => {
                    const Icon = uc.icon;
                    const selected = form.useCases.includes(uc.id);
                    return (
                      <button
                        key={uc.id}
                        type="button"
                        onClick={() => toggleUseCase(uc.id)}
                        className="flex items-center gap-3 p-4 rounded-xl cursor-pointer"
                        style={{
                          background: selected
                            ? "rgba(99,91,255,0.12)"
                            : "rgba(255,255,255,0.03)",
                          border: `1px solid ${selected ? "#635bff" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <Icon
                          className="w-4 h-4 flex-shrink-0"
                          style={{
                            color: selected ? "#635bff" : "#6b7280",
                          }}
                        />
                        <span
                          className="text-sm font-medium text-left"
                          style={{
                            color: selected ? "#635bff" : "#9ca3af",
                          }}
                        >
                          {uc.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 4 && (
          <div className="step-enter text-center py-6">
            {/* Celebration rings */}
            <div className="relative inline-flex items-center justify-center mb-8">
              <div className="celebration-ring" />
              <div className="celebration-ring" />
              <div className="celebration-ring" />
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center celebration-pulse relative z-10"
                style={{ background: "rgba(34,197,94,0.15)" }}
              >
                <CheckCircle2
                  className="w-8 h-8"
                  style={{ color: "#22c55e" }}
                />
              </div>
            </div>

            <h2 className="text-[32px] font-bold text-white mb-2">
              Welcome to SalonTransact!
            </h2>
            {form.businessName && (
              <p className="text-base mb-2" style={{ color: "#635bff" }}>
                {form.businessName}
              </p>
            )}
            <p className="text-sm text-secondary mb-10 max-w-sm mx-auto">
              Your account is being reviewed. This usually takes 1-2 business
              days.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 flex items-center justify-center gap-2 font-semibold text-sm rounded-xl cursor-pointer"
                style={{
                  background: "#635bff",
                  color: "#fff",
                  height: 48,
                }}
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleStripeConnect}
                className="flex-1 flex items-center justify-center gap-2 font-medium text-sm rounded-xl cursor-pointer"
                style={{
                  background: "transparent",
                  color: "#9ca3af",
                  border: "1px solid rgba(255,255,255,0.06)",
                  height: 48,
                }}
              >
                Complete Stripe Setup
              </button>
            </div>

            {/* Timeline */}
            <div className="text-left">
              <p className="text-xs text-muted uppercase tracking-wider font-medium mb-4">
                What happens next
              </p>
              <div className="space-y-0">
                {[
                  { icon: FileCheck, label: "Account Review", desc: "We verify your business details" },
                  { icon: UserCheck, label: "Bank Verification", desc: "Stripe confirms your bank connection" },
                  { icon: Zap, label: "Start Processing", desc: "Accept your first payment" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(99,91,255,0.12)" }}
                        >
                          <Icon
                            className="w-4 h-4"
                            style={{ color: "#635bff" }}
                          />
                        </div>
                        {i < 2 && (
                          <div
                            className="w-px flex-1 my-1"
                            style={{ background: "rgba(255,255,255,0.06)" }}
                          />
                        )}
                      </div>
                      <div className="pb-5">
                        <p className="text-sm font-medium text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        {step < 4 && (
          <div
            className="flex items-center justify-between mt-10 pt-6"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            {step > 0 ? (
              <button
                onClick={back}
                className="flex items-center gap-2 text-sm font-medium cursor-pointer px-4 py-2.5 rounded-lg"
                style={{
                  color: "#9ca3af",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}
            {step !== 2 && (
              <button
                onClick={next}
                className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-lg cursor-pointer"
                style={{ background: "#635bff", color: "#fff" }}
              >
                {step === 3 ? "Finish" : "Continue"}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
