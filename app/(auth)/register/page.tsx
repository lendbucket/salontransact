"use client";

import { useState, useMemo } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  DollarSign,
  Users,
  Activity,
  Shield,
  Lock,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";

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

function MiniBarChart() {
  return (
    <div className="flex items-end gap-0.5 h-6 mt-2">
      {[40, 65, 50, 80, 60, 90, 75, 95].map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-sm"
          style={{
            height: `${h}%`,
            background: `rgba(99,91,255,${0.3 + i * 0.08})`,
          }}
        />
      ))}
    </div>
  );
}

const STATS = [
  {
    icon: DollarSign,
    value: "$2.4M+",
    label: "Processed this month",
    extra: "mini-chart",
  },
  {
    icon: Users,
    value: "500+",
    label: "Salon businesses trust SalonTransact",
    extra: null,
  },
  {
    icon: Activity,
    value: "99.9%",
    label: "Uptime SLA guaranteed",
    extra: null,
  },
];

function passwordStrength(pw: string): { score: number; color: string; label: string } {
  if (pw.length === 0) return { score: 0, color: "#e5e7eb", label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 25, color: "#ef4444", label: "Weak" };
  if (score === 2) return { score: 50, color: "#f59e0b", label: "Fair" };
  if (score === 3) return { score: 75, color: "#635bff", label: "Good" };
  return { score: 100, color: "#22c55e", label: "Strong" };
}

export default function RegisterPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (signInRes?.error) {
      setError("Account created. Please sign in.");
      router.push("/login");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function handleGoogleSignUp() {
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

        <div className="relative z-10 p-12 flex flex-col justify-between h-full">
          {/* Top: Logo */}
          <div>
            <span className="text-white font-semibold text-2xl">
              SalonTransact
            </span>
            <p className="text-xs mt-1" style={{ color: "#635bff" }}>
              by Reyna Pay
            </p>
          </div>

          {/* Center: Hero */}
          <div className="max-w-lg">
            <h1 className="text-5xl font-bold text-white leading-tight">
              Start processing payments
            </h1>
            <h1
              className="text-5xl font-bold leading-tight mt-1"
              style={{ color: "#635bff" }}
            >
              in minutes.
            </h1>

            {/* Stat cards */}
            <div className="mt-10 space-y-4">
              {STATS.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className="p-5 rounded-xl"
                    style={{
                      background: "#111827",
                      border: "1px solid rgba(255,255,255,0.06)",
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.4)",
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(99,91,255,0.12)" }}
                      >
                        <Icon
                          className="w-4 h-4"
                          style={{ color: "#635bff" }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xl font-bold text-white">
                          {s.value}
                        </p>
                        <p className="text-xs text-muted mt-0.5">{s.label}</p>
                      </div>
                      {s.extra === "mini-chart" && <MiniBarChart />}
                    </div>
                  </div>
                );
              })}
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
          <div className="flex items-center gap-3 mb-10 lg:hidden">
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
            Create your account
          </h2>
          <p className="text-sm mb-8" style={{ color: "#6b7280" }}>
            Start your free merchant account today
          </p>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
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
                Business name
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="auth-input"
                placeholder="Your salon name"
              />
            </div>

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
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "#374151" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  style={{ paddingRight: 40 }}
                  placeholder="At least 8 characters"
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
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="flex-1 h-[3px] rounded-full overflow-hidden"
                    style={{ background: "#e5e7eb" }}
                  >
                    <div
                      className="strength-bar"
                      style={{
                        width: `${strength.score}%`,
                        background: strength.color,
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: strength.color }}
                  >
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "#374151" }}
              >
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="auth-input"
                placeholder="Confirm your password"
              />
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
              Create Account
            </button>
          </form>

          <p
            className="text-sm text-center mt-8"
            style={{ color: "#6b7280" }}
          >
            Already have an account?{" "}
            <Link
              href="/login"
              style={{ color: "#635bff", fontWeight: 500 }}
            >
              Sign in
            </Link>
          </p>

          <p
            className="text-[11px] text-center mt-6 leading-relaxed"
            style={{ color: "#9ca3af" }}
          >
            By creating an account you agree to our Terms of Service and Privacy
            Policy
          </p>
        </div>
      </div>
    </div>
  );
}
