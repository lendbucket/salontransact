"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, DollarSign, Users, Activity } from "lucide-react";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

const stats = [
  {
    icon: DollarSign,
    value: "$2.4M+",
    label: "Processed",
  },
  {
    icon: Users,
    value: "500+",
    label: "Merchants",
  },
  {
    icon: Activity,
    value: "99.9%",
    label: "Uptime",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
      {/* Left branding panel -- desktop only */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: "#0d1117" }}
      >
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ color: "#635bff" }}
          >
            SalonTransact
          </h1>
          <p className="text-foreground text-3xl font-semibold mt-16 leading-tight max-w-md">
            Join 500+ salon businesses
          </p>
          <p className="text-secondary mt-3 max-w-sm">
            Get started in minutes. No setup fees, no hidden costs.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="p-5 rounded-xl text-center"
                  style={{
                    background: "#111827",
                    border: "1px solid rgba(255,255,255,0.06)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.25), 0 2px 2px rgba(0,0,0,0.1), 0 4px 4px rgba(0,0,0,0.1), 0 8px 8px rgba(0,0,0,0.1)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
                    style={{ background: "rgba(99,91,255,0.12)" }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: "#635bff" }}
                    />
                  </div>
                  <p className="text-foreground text-xl font-semibold">
                    {s.value}
                  </p>
                  <p className="text-secondary text-xs mt-1">{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-muted text-xs">
          Powered by Reyna Pay LLC &middot; Stripe Connect Certified
        </p>
      </div>

      {/* Right form panel */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12"
        style={{ background: "#ffffff" }}
      >
        <div className="w-full max-w-[400px]">
          <h2
            className="text-2xl font-semibold mb-1"
            style={{ color: "#111827" }}
          >
            Create your account
          </h2>
          <p className="text-sm mb-8" style={{ color: "#6b7280" }}>
            Start accepting payments in minutes
          </p>

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
            Sign up with Google
          </button>

          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

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
                Email
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
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                placeholder="At least 8 characters"
              />
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
                className="text-sm rounded-md px-3 py-2"
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
              Create account
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
        </div>
      </div>
    </div>
  );
}
