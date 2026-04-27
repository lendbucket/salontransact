"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Mail, Loader2, CheckCircle, LogOut } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

export default function VerifyEmailSentClient({ email }: { email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Poll for verification status (e.g. user verified in another tab)
  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkStatus = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/auth/verification-status", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.verified && !cancelled) {
          router.push("/onboarding");
          router.refresh();
        }
      } catch {
        // Silently ignore — next poll will retry
      }
    };

    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(checkStatus, 5000);
    };

    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkStatus();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to resend verification email");
      } else {
        setSent(true);
        setCooldown(30);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "16px 0",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(1,126,167,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Mail size={24} strokeWidth={1.5} color="#017ea7" />
        </div>

        <h1
          style={{
            color: "#1A1313",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.31px",
            marginBottom: 8,
          }}
        >
          Check your inbox
        </h1>
        <p
          style={{
            color: "#878787",
            fontSize: 14,
            marginBottom: 8,
            maxWidth: 360,
          }}
        >
          We sent a verification link to
        </p>
        <p
          style={{
            color: "#1A1313",
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {email}
        </p>
        <p
          style={{
            color: "#878787",
            fontSize: 13,
            marginBottom: 28,
            maxWidth: 360,
          }}
        >
          Click the link in the email to verify your account. Check your spam
          folder if you don&apos;t see it.
        </p>

        {sent && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#22c55e",
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            <CheckCircle size={16} strokeWidth={1.5} />
            Email sent! Check your inbox.
          </div>
        )}

        {error && (
          <p
            style={{
              color: "#DC2626",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={loading || cooldown > 0}
          style={{
            width: "100%",
            maxWidth: 320,
            height: 48,
            background:
              loading || cooldown > 0
                ? "#015f80"
                : "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
            border: "1px solid #015f80",
            borderRadius: 8,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading || cooldown > 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: loading || cooldown > 0 ? 0.7 : 1,
          }}
        >
          {loading && (
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
          )}
          {loading
            ? "Sending..."
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Resend verification email"}
        </button>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "#878787",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            marginTop: 20,
          }}
        >
          <LogOut size={14} strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </AuthLayout>
  );
}
