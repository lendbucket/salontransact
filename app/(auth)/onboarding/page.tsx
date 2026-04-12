"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Building2,
  MapPin,
  Link2,
  SlidersHorizontal,
  CheckCircle2,
  Shield,
  Lock,
  BadgeCheck,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

const STEPS = [
  "Business Info",
  "Location",
  "Bank Account",
  "Preferences",
  "Complete",
];

const BUSINESS_TYPES = [
  "Hair Salon",
  "Barbershop",
  "Nail Salon",
  "Spa",
  "Suite Rental",
  "Other",
];

const VOLUME_RANGES = [
  "Less than $5,000",
  "$5,000 - $15,000",
  "$15,000 - $50,000",
  "$50,000 - $100,000",
  "$100,000+",
];

const USE_CASES = [
  "In-person payments",
  "Online booking",
  "Subscriptions",
  "Invoicing",
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

  const stepIcons = [Building2, MapPin, Link2, SlidersHorizontal, CheckCircle2];

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "#0a0f1a" }}
    >
      <div className="w-full max-w-[560px]">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((s, i) => {
              const Icon = stepIcons[i];
              const done = i < step;
              const active = i === step;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                    style={{
                      background:
                        done || active
                          ? "#635bff"
                          : "rgba(255,255,255,0.06)",
                      color: done || active ? "#fff" : "#6b7280",
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
                      className="hidden sm:block w-12 h-0.5 rounded"
                      style={{
                        background: done ? "#635bff" : "rgba(255,255,255,0.06)",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-secondary text-center">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-8"
          style={{
            background: "#ffffff",
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.12), 0 16px 32px rgba(0,0,0,0.16)",
          }}
        >
          {/* Step 1: Business Info */}
          {step === 0 && (
            <div>
              <h2
                className="text-xl font-semibold mb-1"
                style={{ color: "#111827" }}
              >
                Tell us about your business
              </h2>
              <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
                We use this to customize your experience
              </p>
              <div className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "#374151" }}
                  >
                    Business name
                  </label>
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={(e) => update("businessName", e.target.value)}
                    className="auth-input"
                    placeholder="Your salon name"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "#374151" }}
                  >
                    Business type
                  </label>
                  <select
                    value={form.businessType}
                    onChange={(e) => update("businessType", e.target.value)}
                    className="auth-input"
                    style={{ color: form.businessType ? "#111827" : "#9ca3af" }}
                  >
                    <option value="">Select type</option>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "#374151" }}
                  >
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    className="auth-input"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "#374151" }}
                  >
                    Website
                  </label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => update("website", e.target.value)}
                    className="auth-input"
                    placeholder="https://yoursalon.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 1 && (
            <div>
              <h2
                className="text-xl font-semibold mb-1"
                style={{ color: "#111827" }}
              >
                Where are you located?
              </h2>
              <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
                Your business address for payment verification
              </p>
              <div className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "#374151" }}
                  >
                    Street address
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    className="auth-input"
                    placeholder="123 Main St"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "#374151" }}
                  >
                    City
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    className="auth-input"
                    placeholder="City"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: "#374151" }}
                    >
                      State
                    </label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={(e) => update("state", e.target.value)}
                      className="auth-input"
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: "#374151" }}
                    >
                      ZIP code
                    </label>
                    <input
                      type="text"
                      value={form.zip}
                      onChange={(e) => update("zip", e.target.value)}
                      className="auth-input"
                      placeholder="12345"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Connect Bank */}
          {step === 2 && (
            <div>
              <h2
                className="text-xl font-semibold mb-1"
                style={{ color: "#111827" }}
              >
                Connect your bank account
              </h2>
              <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
                Securely link your bank through Stripe Connect
              </p>

              <div
                className="rounded-lg p-4 mb-6"
                style={{
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Lock
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "#635bff" }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: "#374151" }}
                    >
                      256-bit AES encryption
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "#635bff" }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: "#374151" }}
                    >
                      PCI DSS Level 1 compliant
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <BadgeCheck
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "#635bff" }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: "#374151" }}
                    >
                      Stripe Verified partner
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStripeConnect}
                disabled={loading}
                className="auth-btn-primary"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                Connect with Stripe
              </button>

              <p
                className="text-xs text-center mt-4"
                style={{ color: "#9ca3af" }}
              >
                You can also connect later from Settings
              </p>
            </div>
          )}

          {/* Step 4: Preferences */}
          {step === 3 && (
            <div>
              <h2
                className="text-xl font-semibold mb-1"
                style={{ color: "#111827" }}
              >
                Set your processing preferences
              </h2>
              <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
                Help us tailor your dashboard experience
              </p>
              <div className="space-y-5">
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "#374151" }}
                  >
                    Estimated monthly volume
                  </label>
                  <select
                    value={form.monthlyVolume}
                    onChange={(e) => update("monthlyVolume", e.target.value)}
                    className="auth-input"
                    style={{
                      color: form.monthlyVolume ? "#111827" : "#9ca3af",
                    }}
                  >
                    <option value="">Select range</option>
                    {VOLUME_RANGES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "#374151" }}
                  >
                    Primary use case
                  </label>
                  <div className="space-y-2">
                    {USE_CASES.map((uc) => (
                      <label
                        key={uc}
                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer"
                        style={{
                          background: form.useCases.includes(uc)
                            ? "rgba(99,91,255,0.06)"
                            : "#f9fafb",
                          border: `1px solid ${
                            form.useCases.includes(uc)
                              ? "#635bff"
                              : "#e5e7eb"
                          }`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.useCases.includes(uc)}
                          onChange={() => toggleUseCase(uc)}
                          className="w-4 h-4 rounded accent-[#635bff]"
                        />
                        <span
                          className="text-sm"
                          style={{ color: "#374151" }}
                        >
                          {uc}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 4 && (
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(34,197,94,0.1)" }}
              >
                <CheckCircle2
                  className="w-8 h-8"
                  style={{ color: "#22c55e" }}
                />
              </div>
              <h2
                className="text-xl font-semibold mb-2"
                style={{ color: "#111827" }}
              >
                You&apos;re all set!
              </h2>
              {form.businessName && (
                <p
                  className="text-sm mb-2"
                  style={{ color: "#374151" }}
                >
                  {form.businessName} is ready to go
                </p>
              )}
              <p
                className="text-sm mb-8 max-w-xs mx-auto"
                style={{ color: "#6b7280" }}
              >
                Your account is under review. You&apos;ll receive an email once
                everything is verified.
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="auth-btn-primary"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {/* Navigation buttons */}
          {step < 4 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              {step > 0 ? (
                <button
                  onClick={back}
                  className="flex items-center gap-2 text-sm font-medium cursor-pointer"
                  style={{ color: "#6b7280" }}
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
                  className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg cursor-pointer"
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
    </div>
  );
}
