"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Check, Eye, EyeOff, Shield, Lock } from "lucide-react";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

const FEATURES = [
  "Stripe-powered security & compliance",
  "Real-time transaction monitoring",
  "Next-day payouts to your bank",
];

const TICKER_ITEMS = [
  { name: "Luxe Hair Studio", amount: "$127.00", time: "2s ago" },
  { name: "The Barber Collective", amount: "$45.00", time: "8s ago" },
  { name: "Zen Nail Spa", amount: "$89.50", time: "15s ago" },
  { name: "Crown & Glory Salon", amount: "$210.00", time: "22s ago" },
  { name: "Fresh Cuts NYC", amount: "$67.00", time: "31s ago" },
  { name: "Glow Up Beauty", amount: "$155.00", time: "45s ago" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function handleGoogleSignIn() {
    setGoogleLoading(true);
    signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex">
      {/* ── LEFT PANEL (60%) ── */}
      <div
        className="hidden lg:flex lg:w-[60%] flex-col justify-between relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #0a0f1a 0%, #0d1117 40%, #1a0533 100%)",
        }}
      >
        {/* Animated orbs */}
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />

        {/* Content */}
        <div className="relative z-10 p-12 flex flex-col justify-between h-full">
          {/* Top: Logo */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-2xl">
                SalonTransact
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: "#635bff" }}>
              by Reyna Pay
            </p>
          </div>

          {/* Center: Hero text */}
          <div className="max-w-lg">
            <h1 className="text-5xl font-bold text-white leading-tight">
              The payment infrastructure
            </h1>
            <h1
              className="text-5xl font-bold italic leading-tight mt-1"
              style={{ color: "#635bff" }}
            >
              built for salons.
            </h1>
            <p
              className="mt-6 text-base leading-relaxed max-w-md"
              style={{ color: "#9ca3af" }}
            >
              Process payments, manage payouts, and grow your salon business
              &mdash; all in one place.
            </p>

            {/* Feature checklist */}
            <div className="mt-8 space-y-3">
              {FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(99,91,255,0.2)" }}
                  >
                    <Check className="w-3 h-3" style={{ color: "#635bff" }} />
                  </div>
                  <span className="text-sm text-white">{f}</span>
                </div>
              ))}
            </div>

            {/* Live transaction ticker */}
            <div
              className="mt-10 rounded-xl overflow-hidden"
              style={{
                background: "rgba(17,24,39,0.6)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(12px)",
                height: 140,
              }}
            >
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-[10px] uppercase tracking-wider text-muted font-medium">
                  Live transactions
                </span>
              </div>
              <div className="overflow-hidden" style={{ height: 104 }}>
                <div className="ticker-scroll">
                  {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        <span className="text-xs text-white">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-white">
                          {item.amount}
                        </span>
                        <span className="text-[10px] text-muted">
                          {item.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: Trust badges */}
          <div className="flex items-center gap-3">
            {[
              { icon: Shield, label: "PCI DSS Compliant" },
              { icon: Lock, label: "256-bit SSL" },
              { icon: Check, label: "Stripe Verified Partner" },
            ].map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.label}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Icon className="w-3 h-3" style={{ color: "#635bff" }} />
                  <span className="text-[10px] text-muted font-medium">
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL (40%) ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-12"
        style={{ background: "#ffffff" }}
      >
        <div className="w-full max-w-[400px]">
          {/* Logo mark */}
          <div className="flex items-center gap-3 mb-10">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#635bff" }}
            >
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span
              className="font-semibold text-base"
              style={{ color: "#111827" }}
            >
              SalonTransact
            </span>
          </div>

          <h2
            className="text-[28px] font-bold mb-1"
            style={{ color: "#111827" }}
          >
            Welcome back
          </h2>
          <p className="text-sm mb-8" style={{ color: "#6b7280" }}>
            Sign in to your merchant portal
          </p>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="auth-btn-google"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "#374151" }}
              >
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className="block text-sm font-medium"
                  style={{ color: "#374151" }}
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium"
                  style={{ color: "#635bff" }}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  style={{ paddingRight: 40 }}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: "#9ca3af" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="text-sm rounded-lg px-3 py-2"
                style={{
                  color: "#ef4444",
                  background: "rgba(239,68,68,0.08)",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="auth-btn-primary"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <p
            className="text-sm text-center mt-8"
            style={{ color: "#6b7280" }}
          >
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              style={{ color: "#635bff", fontWeight: 500 }}
            >
              Create one
            </Link>
          </p>

          <p
            className="text-[11px] text-center mt-6 leading-relaxed"
            style={{ color: "#9ca3af" }}
          >
            By signing in you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
