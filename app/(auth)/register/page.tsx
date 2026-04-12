"use client";

import { useState, useMemo } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, EyeOff, Shield, Lock, Check } from "lucide-react";

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

const STRENGTH_COLORS = ["#ef4444", "#f59e0b", "#635bff", "#22c55e"];
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

function passwordStrength(pw: string): number {
  if (pw.length === 0) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{ background: "#0a0f1a" }}
    >
      {/* Animated orbs */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: "#635bff",
              filter: "drop-shadow(0 0 20px rgba(99,91,255,0.4))",
            }}
          >
            <span className="text-white font-bold text-lg">ST</span>
          </div>
          <span className="text-white font-semibold text-xl">
            SalonTransact
          </span>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1
            className="text-[32px] font-bold text-white mb-2"
            style={{ letterSpacing: "-0.5px" }}
          >
            Create your account
          </h1>
          <p className="text-[15px]" style={{ color: "#6b7280" }}>
            Start accepting payments in minutes
          </p>
        </div>

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

        {/* Divider */}
        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "#9ca3af" }}
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
              style={{ color: "#9ca3af" }}
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
              style={{ color: "#9ca3af" }}
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
                style={{ paddingRight: 44 }}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                style={{ color: "#6b7280" }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {/* Strength bar: 4 segments */}
            {password.length > 0 && (
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="strength-segment"
                      style={{
                        background:
                          i < strength
                            ? STRENGTH_COLORS[strength - 1]
                            : "rgba(255,255,255,0.06)",
                      }}
                    />
                  ))}
                </div>
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color:
                      strength > 0
                        ? STRENGTH_COLORS[strength - 1]
                        : "#4b5563",
                  }}
                >
                  {STRENGTH_LABELS[strength]}
                </span>
              </div>
            )}
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "#9ca3af" }}
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
              className="text-sm rounded-xl px-3 py-2.5"
              style={{
                color: "#ef4444",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.15)",
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

        {/* Footer link */}
        <p
          className="text-sm text-center mt-8"
          style={{ color: "#6b7280" }}
        >
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#635bff", fontWeight: 500 }}>
            Sign in
          </Link>
        </p>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-3 mt-10">
          {[
            { icon: Shield, label: "PCI DSS" },
            { icon: Lock, label: "256-bit SSL" },
            { icon: Check, label: "Stripe Verified" },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.label}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Icon className="w-3 h-3" style={{ color: "#635bff" }} />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: "#4b5563" }}
                >
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
