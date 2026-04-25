"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lock,
  Loader2,
  CheckCircle,
  XCircle,
  DollarSign,
  User,
  Mail,
  FileText,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { AcceptedCardsBadges } from "./card-brand-icons";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FormState =
  | "loading"
  | "ready"
  | "loadError"
  | "processing"
  | "success"
  | "declined";

interface PaymentResult {
  paymentId?: string;
  amount?: number;
  last4?: string;
  approvalCode?: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E8EAED",
  boxShadow:
    "0 0 0 1px rgba(0,0,0,0.05), 0 4px 8px rgba(0,0,0,0.08)",
  borderRadius: 12,
  padding: 24,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  background: "#F4F5F7",
  border: "1px solid #E8EAED",
  borderRadius: 8,
  color: "#1A1313",
  fontSize: 15,
  padding: "0 14px",
  outline: "none",
  boxSizing: "border-box",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CheckoutForm() {
  const [formState, setFormState] = useState<FormState>("loading");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [orderId] = useState(
    () => crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(
    null
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cardFormRef, setCardFormRef] = useState<any>(null);

  /* ---- Load Payroc SDK ---- */
  const loadPayroc = useCallback(async () => {
    setFormState("loading");

    try {
      // 1. Get session token from our API
      const res = await fetch("/api/payroc/session");
      if (!res.ok) {
        const data = await res.json();
        console.error("[CHECKOUT] Session error:", data.error);
        setFormState("loadError");
        return;
      }

      const { sessionToken, libUrl, integrity } = await res.json();

      // 2. Remove old script if any
      const existing = document.getElementById("payroc-hf-script");
      if (existing) existing.remove();

      // 3. Load Payroc hosted fields script
      const script = document.createElement("script");
      script.id = "payroc-hf-script";
      script.src = libUrl;
      script.integrity = integrity;
      script.crossOrigin = "anonymous";

      script.onload = () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Payroc = (window as any).Payroc;
          if (!Payroc?.hostedFields) {
            console.error("[CHECKOUT] Payroc.hostedFields not found");
            setFormState("loadError");
            return;
          }

          const cardForm = new Payroc.hostedFields({
            sessionToken,
            mode: "payment",
            fields: {
              card: {
                cardholderName: {
                  target: ".payroc-cardholder-name",
                  errorTarget: ".payroc-cardholder-name-error",
                  placeholder: "Cardholder Name",
                },
                cardNumber: {
                  target: ".payroc-card-number",
                  errorTarget: ".payroc-card-number-error",
                  placeholder: "1234 5678 1234 1211",
                },
                cvv: {
                  wrapperTarget: ".payroc-cvv-wrapper",
                  target: ".payroc-card-cvv",
                  errorTarget: ".payroc-card-cvv-error",
                  placeholder: "CVV",
                },
                expiryDate: {
                  target: ".payroc-card-expiry",
                  errorTarget: ".payroc-card-expiry-error",
                  placeholder: "MM/YY",
                },
                submit: {
                  target: ".payroc-submit-button",
                  value: "Pay",
                },
              },
            },
          });

          cardForm.initialize();
          setCardFormRef(cardForm);

          cardForm.on(
            "submissionSuccess",
            async (data: { token: string }) => {
              await processPayment(data.token);
            }
          );

          cardForm.on(
            "error",
            (data: { type: string; field?: string; message: string }) => {
              console.error("[CHECKOUT] Card error:", data);
              setErrors((prev) => ({
                ...prev,
                card: data.message || "Card validation failed",
              }));
              setFormState("ready");
            }
          );

          setFormState("ready");
        } catch (err) {
          console.error("[CHECKOUT] Init error:", err);
          setFormState("loadError");
        }
      };

      script.onerror = () => {
        console.error("[CHECKOUT] Script load failed");
        setFormState("loadError");
      };

      document.head.appendChild(script);
    } catch (err) {
      console.error("[CHECKOUT] Load error:", err);
      setFormState("loadError");
    }
  // processPayment is stable — defined once via function declaration below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPayroc();
    return () => {
      const s = document.getElementById("payroc-hf-script");
      if (s) s.remove();
    };
  }, [loadPayroc]);

  /* ---- Process payment after token received ---- */
  async function processPayment(token: string) {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setErrors({ amount: "Please enter a valid amount" });
      setFormState("ready");
      return;
    }

    setFormState("processing");

    try {
      const res = await fetch("/api/payroc/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          amount: parsedAmount,
          description: description || undefined,
          customerFirstName: firstName || undefined,
          customerLastName: lastName || undefined,
          customerEmail: email || undefined,
          orderId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setPaymentResult({
          paymentId: data.paymentId,
          amount: data.amount,
          last4: data.last4,
          approvalCode: data.approvalCode,
        });
        setFormState("success");
      } else {
        setPaymentResult({ error: data.error || "Payment declined" });
        setFormState("declined");
      }
    } catch {
      setPaymentResult({ error: "Network error. Please try again." });
      setFormState("declined");
    }
  }

  /* ---- Submit ---- */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setErrors({ amount: "Please enter a valid amount" });
      return;
    }
    setErrors({});
    setFormState("processing");

    // Trigger Payroc's hosted fields submit
    if (cardFormRef) {
      cardFormRef.submit();
    }
  }

  /* ---- Reset ---- */
  function resetForm() {
    setAmount("");
    setDescription("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setErrors({});
    setPaymentResult(null);
    setFormState("loading");
    setTimeout(() => loadPayroc(), 50);
  }

  const parsedAmount = parseFloat(amount) || 0;

  /* ================================================================ */
  /*  SUCCESS                                                          */
  /* ================================================================ */
  if (formState === "success" && paymentResult) {
    const displayAmount =
      paymentResult.amount != null
        ? (paymentResult.amount / 100).toFixed(2)
        : parsedAmount.toFixed(2);

    return (
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "24px 0",
          }}
        >
          <CheckCircle
            size={48}
            strokeWidth={1.5}
            style={{ color: "#22c55e", marginBottom: 16 }}
          />
          <h2 style={{ marginBottom: 8 }}>Payment Approved</h2>
          <p
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#166534",
              marginBottom: 4,
            }}
          >
            ${displayAmount}
          </p>
          {paymentResult.last4 && (
            <p style={{ fontSize: 14, color: "#878787" }}>
              Card ending in {paymentResult.last4}
            </p>
          )}
          {paymentResult.approvalCode && (
            <p style={{ fontSize: 12, color: "#878787", marginTop: 4 }}>
              Approval: {paymentResult.approvalCode}
            </p>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
              maxWidth: 280,
              marginTop: 24,
            }}
          >
            <button
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 px-4 h-10 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer"
            >
              New Payment
            </button>
            <Link
              href="/transactions"
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#878787",
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              View Transactions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  DECLINED                                                         */
  /* ================================================================ */
  if (formState === "declined" && paymentResult) {
    return (
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "24px 0",
          }}
        >
          <XCircle
            size={48}
            strokeWidth={1.5}
            style={{ color: "#ef4444", marginBottom: 16 }}
          />
          <h2 style={{ marginBottom: 8 }}>Payment Declined</h2>
          <p style={{ fontSize: 14, color: "#878787", marginBottom: 24 }}>
            {paymentResult.error}
          </p>
          <button
            onClick={resetForm}
            className="inline-flex items-center justify-center gap-2 px-4 h-10 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  MAIN FORM                                                        */
  /* ================================================================ */
  const disabled = formState === "processing";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 relative">
      {/* Processing overlay */}
      {formState === "processing" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            background: "rgba(251,251,251,0.85)",
            backdropFilter: "blur(4px)",
          }}
        >
          <Loader2
            size={32}
            strokeWidth={1.5}
            className="animate-spin"
            style={{ color: "#017ea7", marginBottom: 12 }}
          />
          <p style={{ fontSize: 14, fontWeight: 500, color: "#1A1313" }}>
            Processing your payment...
          </p>
        </div>
      )}

      {/* ORDER DETAILS */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <DollarSign size={16} strokeWidth={1.5} color="#017ea7" />
          <span
            style={{ fontSize: 15, fontWeight: 600, color: "#1A1313" }}
          >
            Payment Details
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Amount */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "#878787",
                marginBottom: 6,
              }}
            >
              Amount *
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#878787",
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors((p) => ({ ...p, amount: "" }));
                }}
                placeholder="0.00"
                disabled={disabled}
                style={{
                  ...inputStyle,
                  paddingLeft: 28,
                  fontSize: 18,
                  fontWeight: 600,
                }}
              />
            </div>
            {errors.amount && (
              <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>
                {errors.amount}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "#878787",
                marginBottom: 6,
              }}
            >
              Description
            </label>
            <div style={{ position: "relative" }}>
              <FileText
                size={16}
                strokeWidth={1.5}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#878787",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="No-show fee, Deposit, etc."
                disabled={disabled}
                style={{ ...inputStyle, paddingLeft: 40 }}
              />
            </div>
          </div>

          {/* Customer */}
          <div
            style={{
              borderTop: "1px solid #E8EAED",
              paddingTop: 16,
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#878787",
                marginBottom: 12,
              }}
            >
              Customer (optional)
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <div style={{ position: "relative" }}>
                  <User
                    size={16}
                    strokeWidth={1.5}
                    style={{
                      position: "absolute",
                      left: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#878787",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    disabled={disabled}
                    style={{ ...inputStyle, paddingLeft: 40, height: 40 }}
                  />
                </div>
              </div>
              <div>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  disabled={disabled}
                  style={{ ...inputStyle, height: 40 }}
                />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ position: "relative" }}>
                <Mail
                  size={16}
                  strokeWidth={1.5}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#878787",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  disabled={disabled}
                  style={{ ...inputStyle, paddingLeft: 40, height: 40 }}
                />
              </div>
            </div>
          </div>

          <p style={{ fontSize: 12, color: "#ABABAB" }}>
            Order #{orderId}
          </p>
        </div>
      </div>

      {/* CARD INFORMATION */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <Lock size={16} strokeWidth={1.5} color="#017ea7" />
          <span
            style={{ fontSize: 15, fontWeight: 600, color: "#1A1313" }}
          >
            Card Information
          </span>
          <span
            style={{ fontSize: 12, color: "#878787", marginLeft: "auto" }}
          >
            Secured by Payroc
          </span>
        </div>

        {/* Load error */}
        {formState === "loadError" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "32px 0",
            }}
          >
            <AlertCircle
              size={32}
              strokeWidth={1.5}
              style={{ color: "#ef4444", marginBottom: 12 }}
            />
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#1A1313",
                marginBottom: 4,
              }}
            >
              Payment fields failed to load
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#878787",
                marginBottom: 16,
              }}
            >
              Please refresh or try again.
            </p>
            <button
              type="button"
              onClick={loadPayroc}
              className="inline-flex items-center gap-2 px-3 h-8 bg-white hover:bg-[#F4F5F7] text-[#1A1313] text-sm font-medium rounded-lg border border-[#D1D5DB] transition-all duration-150 cursor-pointer"
            >
              <RefreshCw size={14} strokeWidth={1.5} />
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {formState === "loading" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2].map((i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  height: 48,
                  borderRadius: 8,
                  background: "#E8EAED",
                }}
              />
            ))}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    height: 48,
                    borderRadius: 8,
                    background: "#E8EAED",
                  }}
                />
              ))}
            </div>
            <p
              style={{
                fontSize: 13,
                color: "#878787",
                textAlign: "center",
              }}
            >
              Loading secure payment fields...
            </p>
          </div>
        )}

        {/* Payroc hosted field containers */}
        <div
          style={{
            display:
              formState === "ready" || formState === "processing"
                ? "flex"
                : "none",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Cardholder Name */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "#878787",
                marginBottom: 6,
              }}
            >
              Cardholder Name
            </label>
            <div
              className="payroc-cardholder-name"
              style={{
                height: 48,
                background: "#F4F5F7",
                border: "1px solid #E8EAED",
                borderRadius: 8,
                overflow: "hidden",
              }}
            />
            <div
              className="payroc-cardholder-name-error"
              style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}
            />
          </div>

          {/* Card Number */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "#878787",
                marginBottom: 6,
              }}
            >
              Card Number
            </label>
            <div
              className="payroc-card-number"
              style={{
                height: 48,
                background: "#F4F5F7",
                border: "1px solid #E8EAED",
                borderRadius: 8,
                overflow: "hidden",
              }}
            />
            <div
              className="payroc-card-number-error"
              style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}
            />
          </div>

          {/* Expiry + CVV side by side */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#878787",
                  marginBottom: 6,
                }}
              >
                Expiry Date
              </label>
              <div
                className="payroc-card-expiry"
                style={{
                  height: 48,
                  background: "#F4F5F7",
                  border: "1px solid #E8EAED",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              />
              <div
                className="payroc-card-expiry-error"
                style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}
              />
            </div>
            <div className="payroc-cvv-wrapper">
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#878787",
                  marginBottom: 6,
                }}
              >
                CVV
              </label>
              <div
                className="payroc-card-cvv"
                style={{
                  height: 48,
                  background: "#F4F5F7",
                  border: "1px solid #E8EAED",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              />
              <div
                className="payroc-card-cvv-error"
                style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}
              />
            </div>
          </div>

          {/* Hidden Payroc submit button */}
          <div className="payroc-submit-button" style={{ display: "none" }} />
        </div>

        {/* Card error */}
        {errors.card && (
          <p
            style={{
              fontSize: 13,
              color: "#ef4444",
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <AlertCircle size={14} strokeWidth={1.5} />
            {errors.card}
          </p>
        )}

        {/* Accepted cards */}
        <div style={{ marginTop: 16 }}>
          <AcceptedCardsBadges />
        </div>
        <p style={{ fontSize: 12, color: "#ABABAB", marginTop: 12 }}>
          Your card details are encrypted and never stored on our servers.
        </p>
      </div>

      {/* ACTION */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            padding: "0 4px",
          }}
        >
          <span style={{ fontSize: 14, color: "#878787" }}>Total</span>
          <span
            style={{ fontSize: 20, fontWeight: 600, color: "#1A1313" }}
          >
            ${parsedAmount.toFixed(2)}
          </span>
        </div>

        <button
          type="submit"
          disabled={disabled || formState !== "ready"}
          className="w-full inline-flex items-center justify-center gap-2 h-12 bg-[#017ea7] hover:bg-[#0290be] text-white text-[15px] font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {formState === "processing" ? (
            <>
              <Loader2
                size={16}
                strokeWidth={1.5}
                className="animate-spin"
              />
              Processing...
            </>
          ) : (
            "Charge Card"
          )}
        </button>

        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 12,
            fontSize: 14,
            fontWeight: 500,
            color: "#878787",
            textDecoration: "none",
          }}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
