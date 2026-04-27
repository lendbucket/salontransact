"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

export default function VerifyEmailPage() {
  const params = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: params.token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Verification failed");
          setStatus("error");
        } else if (data.alreadyVerified) {
          setStatus("already");
        } else {
          setStatus("success");
        }
      } catch {
        setErrorMsg("Something went wrong. Please try again.");
        setStatus("error");
      }
    }
    verify();
  }, [params.token]);

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
        {status === "loading" && (
          <>
            <Loader2
              size={40}
              strokeWidth={1.5}
              className="animate-spin"
              style={{ color: "#017ea7", marginBottom: 20 }}
            />
            <h1
              style={{
                color: "#1A1313",
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.31px",
                marginBottom: 8,
              }}
            >
              Verifying your email...
            </h1>
            <p style={{ color: "#878787", fontSize: 14 }}>
              Please wait a moment.
            </p>
          </>
        )}

        {(status === "success" || status === "already") && (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(34,197,94,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <CheckCircle size={28} strokeWidth={1.5} color="#22c55e" />
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
              {status === "already"
                ? "Email already verified"
                : "Email verified!"}
            </h1>
            <p style={{ color: "#878787", fontSize: 14, marginBottom: 28 }}>
              {status === "already"
                ? "Your email was already verified. You can continue to your account."
                : "Your email has been confirmed. Continue to set up your account."}
            </p>
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 48,
                padding: "0 32px",
                background:
                  "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
                border: "1px solid #015f80",
                borderRadius: 8,
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign in to your account
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(239,68,68,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <XCircle size={28} strokeWidth={1.5} color="#DC2626" />
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
              Verification failed
            </h1>
            <p style={{ color: "#878787", fontSize: 14, marginBottom: 28 }}>
              {errorMsg}
            </p>
            <Link
              href="/verify-email/sent"
              style={{
                color: "#017ea7",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Request a new verification link
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
