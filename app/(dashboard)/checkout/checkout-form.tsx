"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CreditCard,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  DollarSign,
  User,
  Mail,
  FileText,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { CardBrandIcon, AcceptedCardsBadges } from "./card-brand-icons";
import type { CardBrand } from "./card-brand-icons";

/* ------------------------------------------------------------------ */
/*  Types for Payroc Hosted Fields global                              */
/* ------------------------------------------------------------------ */

interface PayrocFieldEvents {
  on(event: string, callback: (data: Record<string, unknown>) => void): void;
}

interface PayrocHostedFieldsInstance {
  tokenize(): Promise<{ token: string }>;
  getState(): Record<
    string,
    { isValid: boolean; isEmpty: boolean; isFocused: boolean }
  >;
  on(event: string, callback: (data: Record<string, unknown>) => void): void;
  fields: Record<string, PayrocFieldEvents>;
}

interface PayrocHostedFieldsStatic {
  create(config: {
    processingTerminalId: string;
    fields: Record<
      string,
      { container: string; placeholder?: string }
    >;
    styles?: Record<string, Record<string, string>>;
  }): PayrocHostedFieldsInstance;
}

declare global {
  interface Window {
    PayrocHostedFields?: PayrocHostedFieldsStatic;
  }
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const card = {
  background: "#111827",
  border: "1px solid rgba(255,255,255,0.06)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.4)",
  borderRadius: "12px",
  padding: "24px",
} as const;

const inputBase = {
  width: "100%",
  height: "48px",
  background: "#111827",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  color: "#f9fafb",
  fontSize: "15px",
  fontFamily: "Inter, sans-serif",
  letterSpacing: "-0.31px",
  outline: "none",
  padding: "0 14px",
} as const;

const inputFocusStyle = {
  border: "1px solid #635bff",
  boxShadow: "0 0 0 3px rgba(99,91,255,0.15)",
} as const;

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

type FormState =
  | "idle"
  | "loading"
  | "ready"
  | "loadError"
  | "processing"
  | "success"
  | "declined";

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof CreditCard;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <Icon size={16} strokeWidth={1.5} style={{ color: "#635bff" }} />
      <span
        className="font-semibold text-sm"
        style={{ color: "#f9fafb", letterSpacing: "-0.31px" }}
      >
        {title}
      </span>
      {subtitle && (
        <span className="text-xs ml-auto" style={{ color: "#6b7280" }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}

function InputField({
  label,
  icon: Icon,
  prefix,
  error,
  children,
}: {
  label: string;
  icon?: typeof DollarSign;
  prefix?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-xs font-medium mb-1.5"
        style={{ color: "#9ca3af", letterSpacing: "-0.31px" }}
      >
        {label}
      </label>
      <div className="relative">
        {Icon && !prefix && (
          <Icon
            size={16}
            strokeWidth={1.5}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "#6b7280" }}
          />
        )}
        {prefix && (
          <span
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
            style={{ color: "#6b7280" }}
          >
            {prefix}
          </span>
        )}
        {children}
      </div>
      {error && (
        <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeletons                                                          */
/* ------------------------------------------------------------------ */

function FieldSkeleton() {
  return (
    <div
      className="animate-pulse rounded-xl"
      style={{
        height: "48px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main form                                                          */
/* ------------------------------------------------------------------ */

export function CheckoutForm({
  hostedFieldsUrl,
  hostedFieldsIntegrity,
  terminalId,
}: {
  hostedFieldsUrl: string;
  hostedFieldsIntegrity: string;
  terminalId: string;
}) {
  const [formState, setFormState] = useState<FormState>("loading");
  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState("");
  const [description, setDescription] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [orderId] = useState(
    () => crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  );
  const [cardBrand, setCardBrand] = useState<CardBrand>("unknown");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentResult, setPaymentResult] = useState<{
    paymentId?: string;
    amount?: number;
    last4?: string;
    approvalCode?: string;
    responseMessage?: string;
  } | null>(null);

  const hostedFieldsRef = useRef<PayrocHostedFieldsInstance | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  /* ---- focus tracker for our own inputs ---- */
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const getInputStyle = useCallback(
    (name: string, hasPrefix?: boolean) => ({
      ...inputBase,
      paddingLeft: hasPrefix ? "28px" : "14px",
      ...(focusedInput === name ? inputFocusStyle : {}),
    }),
    [focusedInput]
  );

  /* ---- load Payroc script ---- */
  const loadHostedFields = useCallback(() => {
    setFormState("loading");

    const existing = document.getElementById("payroc-hf-script");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = "payroc-hf-script";
    script.src = hostedFieldsUrl;
    script.integrity = hostedFieldsIntegrity;
    script.crossOrigin = "anonymous";

    script.onload = () => {
      if (!window.PayrocHostedFields) {
        setFormState("loadError");
        return;
      }

      try {
        const instance = window.PayrocHostedFields.create({
          processingTerminalId: terminalId,
          fields: {
            cardNumber: {
              container: "#payroc-card-number",
              placeholder: "1234 5678 9012 3456",
            },
            expiryDate: {
              container: "#payroc-expiry",
              placeholder: "MM / YY",
            },
            cvv: {
              container: "#payroc-cvv",
              placeholder: "CVV",
            },
          },
          styles: {
            input: {
              color: "#f9fafb",
              fontSize: "15px",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "-0.31px",
              backgroundColor: "transparent",
            },
            placeholder: {
              color: "#4b5563",
            },
          },
        });

        hostedFieldsRef.current = instance;

        instance.on("cardBrandChanged", (data) => {
          const brand = (data.brand as string)?.toLowerCase() ?? "";
          if (brand.includes("visa")) setCardBrand("visa");
          else if (brand.includes("master")) setCardBrand("mastercard");
          else if (brand.includes("amex") || brand.includes("american"))
            setCardBrand("amex");
          else if (brand.includes("discover")) setCardBrand("discover");
          else setCardBrand("unknown");
        });

        instance.on("focus", (data) => {
          setFocusedField(data.field as string);
        });

        instance.on("blur", () => {
          setFocusedField(null);
        });

        setFormState("ready");
      } catch {
        setFormState("loadError");
      }
    };

    script.onerror = () => {
      setFormState("loadError");
    };

    document.body.appendChild(script);
  }, [hostedFieldsUrl, hostedFieldsIntegrity, terminalId]);

  useEffect(() => {
    loadHostedFields();
    return () => {
      const s = document.getElementById("payroc-hf-script");
      if (s) s.remove();
    };
  }, [loadHostedFields]);

  /* ---- computed total ---- */
  const parsedAmount = parseFloat(amount) || 0;
  const parsedTip = parseFloat(tip) || 0;
  const total = parsedAmount + parsedTip;

  /* ---- validation ---- */
  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!amount || parsedAmount <= 0) {
      next.amount = "Please enter an amount greater than $0";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /* ---- submit ---- */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !hostedFieldsRef.current) return;

    setFormState("processing");
    setErrors({});

    try {
      const tokenResult = await hostedFieldsRef.current.tokenize();

      const response = await fetch("/api/payroc/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: {
            orderId,
            orderDate: new Date().toISOString().split("T")[0],
            description: description || undefined,
          },
          customer: {
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            email: email || undefined,
          },
          payment: {
            type: "sale" as const,
            currency: "USD" as const,
            country: "USA" as const,
            amount: Math.round(parsedAmount * 100),
            tip: parsedTip > 0 ? Math.round(parsedTip * 100) : undefined,
            cardAccount: {
              token: tokenResult.token,
            },
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPaymentResult({ responseMessage: data.error ?? "Payment failed" });
        setFormState("declined");
        return;
      }

      if (data.status === "approved") {
        setPaymentResult({
          paymentId: data.paymentId,
          amount: data.amount,
          last4: data.cardAccount?.last4,
          approvalCode: data.approvalCode,
        });
        setFormState("success");
      } else {
        setPaymentResult({
          responseMessage: data.responseMessage ?? "Payment declined",
        });
        setFormState("declined");
      }
    } catch {
      setPaymentResult({ responseMessage: "Network error. Please try again." });
      setFormState("declined");
    }
  }

  /* ---- reset ---- */
  function resetForm() {
    setAmount("");
    setTip("");
    setDescription("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setCardBrand("unknown");
    setErrors({});
    setPaymentResult(null);
    setFormState("loading");
    setTimeout(() => loadHostedFields(), 50);
  }

  function retryCard() {
    setPaymentResult(null);
    setFormState("loading");
    setTimeout(() => loadHostedFields(), 50);
  }

  /* ---- hosted field container style ---- */
  function hfContainerStyle(name: string) {
    return {
      height: "48px",
      background: "#111827",
      border:
        focusedField === name
          ? "1px solid #635bff"
          : "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px",
      boxShadow:
        focusedField === name
          ? "0 0 0 3px rgba(99,91,255,0.15)"
          : "none",
      padding: "0 14px",
      display: "flex",
      alignItems: "center",
      transition: "border 0.15s, box-shadow 0.15s",
    };
  }

  /* ================================================================ */
  /*  SUCCESS STATE                                                    */
  /* ================================================================ */
  if (formState === "success" && paymentResult) {
    const displayAmount =
      paymentResult.amount != null
        ? (paymentResult.amount / 100).toFixed(2)
        : total.toFixed(2);

    return (
      <div style={card}>
        <div className="flex flex-col items-center text-center py-6">
          <div className="relative mb-5">
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                background: "rgba(34,197,94,0.15)",
                animationDuration: "1.5s",
              }}
            />
            <CheckCircle
              size={48}
              strokeWidth={1.5}
              style={{ color: "#22c55e" }}
              className="relative"
            />
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: "#f9fafb", letterSpacing: "-0.31px" }}
          >
            Payment Approved
          </h2>
          <div className="space-y-1 mb-6">
            <p className="text-lg font-semibold" style={{ color: "#22c55e" }}>
              ${displayAmount}
            </p>
            {paymentResult.last4 && (
              <p className="text-sm" style={{ color: "#9ca3af" }}>
                Card ending in {paymentResult.last4}
              </p>
            )}
            {paymentResult.approvalCode && (
              <p className="text-xs" style={{ color: "#6b7280" }}>
                Approval code: {paymentResult.approvalCode}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={resetForm}
              className="w-full flex items-center justify-center gap-2 font-semibold text-sm cursor-pointer"
              style={{
                height: "44px",
                background: "#635bff",
                color: "#fff",
                borderRadius: "12px",
                border: "none",
              }}
            >
              New Payment
            </button>
            <Link
              href="/transactions"
              className="text-sm font-medium text-center"
              style={{ color: "#6b7280" }}
            >
              View Transactions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  DECLINED STATE                                                   */
  /* ================================================================ */
  if (formState === "declined" && paymentResult) {
    return (
      <div style={card}>
        <div className="flex flex-col items-center text-center py-6">
          <XCircle
            size={48}
            strokeWidth={1.5}
            style={{ color: "#ef4444" }}
            className="mb-4"
          />
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: "#f9fafb", letterSpacing: "-0.31px" }}
          >
            Payment Declined
          </h2>
          <p className="text-sm mb-6" style={{ color: "#9ca3af" }}>
            {paymentResult.responseMessage}
          </p>
          <button
            onClick={retryCard}
            className="w-full max-w-xs flex items-center justify-center gap-2 font-semibold text-sm cursor-pointer"
            style={{
              height: "44px",
              background: "#635bff",
              color: "#fff",
              borderRadius: "12px",
              border: "none",
            }}
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
      {/* --- Processing overlay --- */}
      {formState === "processing" && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl"
          style={{ background: "rgba(10,15,26,0.8)", backdropFilter: "blur(4px)" }}
        >
          <Loader2
            size={32}
            strokeWidth={1.5}
            className="animate-spin mb-3"
            style={{ color: "#635bff" }}
          />
          <p className="text-sm font-medium" style={{ color: "#f9fafb" }}>
            Processing your payment...
          </p>
        </div>
      )}

      {/* ============================================================ */}
      {/* PAYMENT DETAILS                                               */}
      {/* ============================================================ */}
      <div style={card}>
        <SectionHeader icon={CreditCard} title="Payment Details" />

        <div className="space-y-4">
          {/* Amount */}
          <InputField label="Amount" prefix="$" error={errors.amount}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (errors.amount) setErrors((p) => ({ ...p, amount: "" }));
              }}
              onFocus={() => setFocusedInput("amount")}
              onBlur={() => setFocusedInput(null)}
              placeholder="0.00"
              disabled={disabled}
              style={{
                ...getInputStyle("amount", true),
                fontSize: "18px",
                fontWeight: 600,
              }}
            />
          </InputField>

          {/* Tip */}
          <InputField label="Tip (optional)" prefix="$">
            <input
              type="number"
              step="0.01"
              min="0"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              onFocus={() => setFocusedInput("tip")}
              onBlur={() => setFocusedInput(null)}
              placeholder="0.00"
              disabled={disabled}
              style={getInputStyle("tip", true)}
            />
          </InputField>

          {/* Description */}
          <InputField label="Description (optional)" icon={FileText}>
            <input
              type="text"
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onFocus={() => setFocusedInput("desc")}
              onBlur={() => setFocusedInput(null)}
              placeholder="No-show fee, Deposit, etc."
              disabled={disabled}
              style={{ ...getInputStyle("desc"), paddingLeft: "36px" }}
            />
          </InputField>
          {description.length > 0 && (
            <p className="text-xs text-right -mt-2" style={{ color: "#4b5563" }}>
              {description.length}/200
            </p>
          )}
        </div>

        {/* --- Customer --- */}
        <div
          className="mt-5 pt-5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p
            className="text-xs font-medium mb-3"
            style={{ color: "#6b7280", letterSpacing: "-0.31px" }}
          >
            Customer (optional)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="First Name" icon={User}>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onFocus={() => setFocusedInput("fn")}
                onBlur={() => setFocusedInput(null)}
                placeholder="Jane"
                disabled={disabled}
                style={{ ...getInputStyle("fn"), paddingLeft: "36px" }}
              />
            </InputField>
            <InputField label="Last Name" icon={User}>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onFocus={() => setFocusedInput("ln")}
                onBlur={() => setFocusedInput(null)}
                placeholder="Doe"
                disabled={disabled}
                style={{ ...getInputStyle("ln"), paddingLeft: "36px" }}
              />
            </InputField>
          </div>
          <div className="mt-3">
            <InputField label="Email" icon={Mail}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedInput("email")}
                onBlur={() => setFocusedInput(null)}
                placeholder="jane@example.com"
                disabled={disabled}
                style={{ ...getInputStyle("email"), paddingLeft: "36px" }}
              />
            </InputField>
          </div>
        </div>

        {/* Order ID */}
        <p className="mt-4 text-xs" style={{ color: "#4b5563" }}>
          Order #{orderId}
        </p>
      </div>

      {/* ============================================================ */}
      {/* CARD INFORMATION                                              */}
      {/* ============================================================ */}
      <div style={card}>
        <SectionHeader
          icon={Lock}
          title="Card Information"
          subtitle="Secured by Payroc"
        />

        {/* Load error state */}
        {formState === "loadError" && (
          <div className="flex flex-col items-center py-8">
            <AlertCircle
              size={32}
              strokeWidth={1.5}
              style={{ color: "#ef4444" }}
              className="mb-3"
            />
            <p
              className="text-sm font-medium mb-1"
              style={{ color: "#f9fafb" }}
            >
              Payment fields failed to load
            </p>
            <p className="text-xs mb-4" style={{ color: "#6b7280" }}>
              Please refresh or try again.
            </p>
            <button
              type="button"
              onClick={loadHostedFields}
              className="flex items-center gap-2 text-sm font-medium cursor-pointer"
              style={{
                height: "40px",
                padding: "0 16px",
                background: "rgba(99,91,255,0.1)",
                color: "#635bff",
                borderRadius: "10px",
                border: "1px solid rgba(99,91,255,0.2)",
              }}
            >
              <RefreshCw size={14} strokeWidth={1.5} />
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {formState === "loading" && (
          <div className="space-y-3">
            <FieldSkeleton />
            <div className="grid grid-cols-2 gap-3">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
            <p className="text-xs text-center" style={{ color: "#6b7280" }}>
              Loading secure payment fields...
            </p>
          </div>
        )}

        {/* Hosted fields */}
        <div
          className="space-y-3"
          style={{
            display:
              formState === "ready" || formState === "processing"
                ? "block"
                : "none",
          }}
        >
          {/* Card number */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "#9ca3af", letterSpacing: "-0.31px" }}
            >
              Card Number
            </label>
            <div className="relative">
              <div
                id="payroc-card-number"
                style={hfContainerStyle("cardNumber")}
              />
              {cardBrand !== "unknown" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <CardBrandIcon brand={cardBrand} size={24} />
                </div>
              )}
            </div>
          </div>

          {/* Expiry + CVV */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "#9ca3af", letterSpacing: "-0.31px" }}
              >
                Expiry Date
              </label>
              <div
                id="payroc-expiry"
                style={hfContainerStyle("expiryDate")}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "#9ca3af", letterSpacing: "-0.31px" }}
              >
                CVV
              </label>
              <div id="payroc-cvv" style={hfContainerStyle("cvv")} />
            </div>
          </div>
        </div>

        {/* Accepted cards row */}
        <div className="flex items-center justify-between mt-4">
          <AcceptedCardsBadges />
        </div>
        <p className="text-xs mt-3" style={{ color: "#4b5563" }}>
          Your card details are encrypted and never stored on our servers.
        </p>
      </div>

      {/* ============================================================ */}
      {/* ACTION                                                        */}
      {/* ============================================================ */}
      <div>
        {/* Total */}
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-sm" style={{ color: "#9ca3af" }}>
            Total
          </span>
          <span
            className="text-xl font-bold"
            style={{ color: "#f9fafb", letterSpacing: "-0.31px" }}
          >
            ${total.toFixed(2)}
          </span>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={disabled || formState !== "ready"}
          className="w-full flex items-center justify-center gap-2 font-semibold text-sm transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            height: "52px",
            background: "#635bff",
            color: "#fff",
            borderRadius: "12px",
            border: "none",
            letterSpacing: "-0.31px",
          }}
          onMouseEnter={(e) => {
            if (!disabled) e.currentTarget.style.background = "#4f46e5";
          }}
          onMouseLeave={(e) => {
            if (!disabled) e.currentTarget.style.background = "#635bff";
          }}
          onMouseDown={(e) => {
            if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
          }}
          onMouseUp={(e) => {
            if (!disabled) e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {formState === "processing" ? (
            <>
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              Processing...
            </>
          ) : (
            "Charge Card"
          )}
        </button>

        {/* Cancel */}
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-1.5 mt-3 text-sm font-medium"
          style={{ color: "#6b7280" }}
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Cancel
        </Link>
      </div>
    </form>
  );
}
