"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Lock,
  CheckCircle,
  Mail,
  Zap,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Inline styles                                                      */
/* ------------------------------------------------------------------ */

const bg = "#0a1628";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  background: "#0d1f3c",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#f9fafb",
  fontSize: 15,
  fontFamily: "Inter, sans-serif",
  letterSpacing: "-0.31px",
  outline: "none",
  padding: "0 14px",
};

const inputFocus: React.CSSProperties = {
  border: "1px solid #635bff",
  boxShadow: "0 0 0 3px rgba(99,91,255,0.12)",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function LoginSkeleton() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: bg }}
    >
      <div className="w-full max-w-[420px] px-6 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-11 h-11 rounded-lg animate-pulse"
            style={{ background: "rgba(99,91,255,0.3)" }}
          />
          <div
            className="h-5 w-40 rounded animate-pulse"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
        </div>
        <div
          className="h-px w-full"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
        <div className="space-y-4">
          <div
            className="h-6 w-36 rounded animate-pulse"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 w-full rounded-lg animate-pulse"
              style={{ background: "rgba(255,255,255,0.04)" }}
            />
          ))}
          <div
            className="h-12 w-full rounded-lg animate-pulse"
            style={{ background: "rgba(99,91,255,0.15)" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main content                                                       */
/* ------------------------------------------------------------------ */

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordUpdated = searchParams.get("message") === "password-updated";
  const callbackUrl = searchParams.get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  function getStyle(name: string, extra?: React.CSSProperties) {
    return {
      ...inputStyle,
      ...(focusedField === name ? inputFocus : {}),
      ...extra,
    };
  }

  function getRedirect(role?: string) {
    if (callbackUrl) return callbackUrl;
    return role === "admin" ? "/admin" : "/dashboard";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      // Fetch the session to determine the user role for redirect
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const role = (session?.user as { role?: string } | undefined)?.role;

      router.push(getRedirect(role));
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email) {
      setMagicError("Enter your email first");
      return;
    }
    setMagicError(null);
    setMagicLoading(true);

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMagicLoading(false);

      if (!res.ok) {
        setMagicError(data.error || "Failed to send magic link");
        return;
      }

      setMagicSent(true);
    } catch {
      setMagicLoading(false);
      setMagicError("Failed to send magic link");
    }
  }

  /* ---- Magic link sent state ---- */
  if (magicSent) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center py-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
            style={{
              background: "rgba(99,91,255,0.1)",
              boxShadow: "0 0 40px rgba(99,91,255,0.15)",
            }}
          >
            <Mail size={24} strokeWidth={1.5} style={{ color: "#635bff" }} />
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: "#f9fafb", letterSpacing: "-0.8px" }}
          >
            Check your email
          </h2>
          <p className="text-sm mb-6" style={{ color: "#9ca3af" }}>
            We sent a sign-in link to{" "}
            <span className="text-white font-medium">{email}</span>
          </p>
          <button
            onClick={() => {
              setMagicSent(false);
              handleMagicLink();
            }}
            className="text-sm font-medium mb-3 cursor-pointer"
            style={{
              color: "#635bff",
              background: "none",
              border: "none",
            }}
          >
            Didn&apos;t receive it? Resend
          </button>
          <button
            onClick={() => setMagicSent(false)}
            className="flex items-center gap-1.5 text-sm cursor-pointer"
            style={{
              color: "#6b7280",
              background: "none",
              border: "none",
            }}
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back to sign in
          </button>
        </div>
      </Shell>
    );
  }

  /* ---- Main form ---- */
  return (
    <Shell>
      {/* Password updated banner */}
      {passwordUpdated && (
        <div
          className="text-sm rounded-lg px-3 py-2.5 mb-5 text-center"
          style={{
            color: "#22c55e",
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.15)",
          }}
        >
          Password updated. Sign in with your new password.
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 mb-5"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <AlertCircle
            size={16}
            strokeWidth={1.5}
            style={{ color: "#ef4444", flexShrink: 0 }}
          />
          <span className="text-sm" style={{ color: "#ef4444" }}>
            {error}
          </span>
        </div>
      )}

      {/* Heading */}
      <h2
        className="text-[28px] font-bold mb-1"
        style={{ color: "#f9fafb", letterSpacing: "-0.8px" }}
      >
        Welcome back
      </h2>
      <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
        Sign in to your account
      </p>

      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label
            className="block text-xs font-medium mb-1.5"
            style={{ color: "#9ca3af" }}
          >
            Email address
          </label>
          <div className="relative">
            <Mail
              size={16}
              strokeWidth={1.5}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "#4b5563" }}
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              placeholder="you@example.com"
              style={getStyle("email", { paddingLeft: 40 })}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              className="block text-xs font-medium"
              style={{ color: "#9ca3af" }}
            >
              Password
            </label>
            <a
              href="/forgot-password"
              className="text-xs font-medium"
              style={{ color: "#635bff" }}
            >
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <Lock
              size={16}
              strokeWidth={1.5}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "#4b5563" }}
            />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter your password"
              style={getStyle("password", {
                paddingLeft: 40,
                paddingRight: 44,
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
              style={{
                color: "#6b7280",
                background: "none",
                border: "none",
                padding: 4,
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff size={16} strokeWidth={1.5} />
              ) : (
                <Eye size={16} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>

        {/* Sign in button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 font-semibold text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            height: 48,
            background: "#635bff",
            color: "#fff",
            borderRadius: 8,
            border: "none",
            letterSpacing: "-0.31px",
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.background = "#4f46e5";
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.background = "#635bff";
          }}
        >
          {loading ? (
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
          ) : null}
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div
          className="flex-1 h-px"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
        <span className="text-xs" style={{ color: "#4b5563" }}>
          or
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
      </div>

      {/* Magic link button */}
      <button
        type="button"
        onClick={handleMagicLink}
        disabled={magicLoading}
        className="w-full flex items-center justify-center gap-2 font-semibold text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          height: 48,
          background: "rgba(255,255,255,0.08)",
          color: "#f9fafb",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          letterSpacing: "-0.31px",
        }}
        onMouseEnter={(e) => {
          if (!magicLoading)
            e.currentTarget.style.background = "rgba(255,255,255,0.12)";
        }}
        onMouseLeave={(e) => {
          if (!magicLoading)
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
        }}
      >
        {magicLoading ? (
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <Zap size={16} strokeWidth={1.5} style={{ color: "#635bff" }} />
        )}
        Send magic link
      </button>

      {magicError && (
        <p className="text-xs text-center mt-2" style={{ color: "#ef4444" }}>
          {magicError}
        </p>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell wrapper — logo, grid bg, trust badges                        */
/* ------------------------------------------------------------------ */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative"
      style={{ background: bg }}
    >
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #635bff, #4f46e5)",
              }}
            >
              <span className="text-white font-bold text-lg">ST</span>
            </div>
            <span
              className="text-white font-semibold text-[22px]"
              style={{ letterSpacing: "-0.5px" }}
            >
              SalonTransact
            </span>
          </div>
          <span className="text-[13px]" style={{ color: "#6b7280" }}>
            Payment Infrastructure for Salons
          </span>
        </div>

        {/* Divider */}
        <div
          className="h-px mb-8"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />

        {/* Form area */}
        {children}

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {[
            { icon: Shield, label: "PCI DSS Level 1" },
            { icon: Lock, label: "256-bit Encryption" },
            { icon: CheckCircle, label: "Stripe Verified" },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.label}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Icon
                  size={11}
                  strokeWidth={1.5}
                  style={{ color: "#6b7280" }}
                />
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "#6b7280" }}
                >
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Invitation notice */}
        <p
          className="text-xs text-center mt-5"
          style={{ color: "#4b5563" }}
        >
          Access by invitation only
        </p>

        {/* Copyright */}
        <p
          className="text-[11px] text-center mt-6"
          style={{ color: "#374151" }}
        >
          &copy; 2026 Reyna Pay LLC. All rights reserved.
        </p>
      </div>
    </div>
  );
}
