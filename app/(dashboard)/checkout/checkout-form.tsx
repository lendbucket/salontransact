"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Lock,
  Loader2,
  CheckCircle2,
  XCircle,
  DollarSign,
  User,
  Mail,
  FileText,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { AcceptedCardsBadges, CardBrandIcon } from "./card-brand-icons";
import type { CardBrand } from "./card-brand-icons";

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
  cardBrand?: string;
  error?: string;
}

const INPUT =
  "w-full h-10 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg text-[#1A1313] text-sm px-3 outline-none transition-all duration-150 focus:border-[#017ea7] focus:ring-[3px] focus:ring-[#017ea7]/10 focus:bg-white placeholder:text-[#ABABAB]";

const LABEL = "block text-[13px] font-medium text-[#4A4A4A] mb-1";

const CARD =
  "bg-white border border-[#E8EAED] rounded-xl p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_4px_4px_rgba(0,0,0,0.05),0_8px_8px_rgba(0,0,0,0.05),0_16px_16px_rgba(0,0,0,0.05)]";

export function CheckoutForm() {
  const [formState, setFormState] = useState<FormState>("loading");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [orderId] = useState(
    () => crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [cardBrand, setCardBrand] = useState<CardBrand>("unknown");
  const parsedAmountRef = useRef(0);

  /* ---- Load Payroc SDK ---- */
  const loadPayroc = useCallback(async () => {
    setFormState("loading");
    try {
      const res = await fetch("/api/payroc/session");
      if (!res.ok) {
        console.error("[CHECKOUT] Session error:", await res.text());
        setFormState("loadError");
        return;
      }
      const data = await res.json();
      console.log("[CHECKOUT] Session response:", JSON.stringify(data));
      console.log("[CHECKOUT] Session token:", data.sessionToken?.substring(0, 20));
      console.log("[CHECKOUT] Lib URL:", data.libUrl);
      if (data._diag) {
        console.log("[PAYROC-DIAG] sessionHost:", data._diag.sessionHost);
        console.log("[PAYROC-DIAG] gatewayHost:", data._diag.gatewayHost);
      }

      const { sessionToken, libUrl, integrity } = data;
      if (!sessionToken) {
        console.error("[CHECKOUT] No session token returned");
        setFormState("loadError");
        return;
      }

      const existing = document.getElementById("payroc-hf-script");
      if (existing) existing.remove();

      const script = document.createElement("script");
      script.id = "payroc-hf-script";
      script.src = libUrl;
      // Only add integrity if it's a valid sha hash — invalid hashes block loading
      if (integrity && integrity.startsWith("sha")) {
        script.integrity = integrity;
        script.crossOrigin = "anonymous";
      }
      script.async = true;

      script.onload = () => {
        console.log("[CHECKOUT] Script loaded");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log("[CHECKOUT] window.Payroc:", typeof (window as any).Payroc);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Payroc = (window as any).Payroc;
          if (!Payroc?.hostedFields) {
            console.error("[CHECKOUT] Payroc.hostedFields not found on window");
            setFormState("loadError");
            return;
          }

          const chargeLabel = parsedAmountRef.current > 0
            ? `Charge $${parsedAmountRef.current.toFixed(2)}`
            : "Charge Card";

          const cardForm = new Payroc.hostedFields({
            sessionToken,
            mode: "payment",
            fields: {
              card: {
                cardholderName: {
                  target: ".card-holder-name",
                  errorTarget: ".card-holder-name-error",
                  placeholder: "Cardholder Name",
                },
                cardNumber: {
                  target: ".card-number",
                  errorTarget: ".card-number-error",
                  placeholder: "1234 5678 1234 1211",
                },
                cvv: {
                  wrapperTarget: ".card-cvv-wrapper",
                  target: ".card-cvv",
                  errorTarget: ".card-cvv-error",
                  placeholder: "CVV",
                },
                expiryDate: {
                  target: ".card-expiry",
                  errorTarget: ".card-expiry-error",
                  placeholder: "MM/YY",
                },
                submit: {
                  target: ".submit-button",
                  value: chargeLabel,
                },
              },
            },
            styles: {
              input: {
                color: "#1A1313",
                fontSize: "15px",
                fontFamily: "Inter, -apple-system, sans-serif",
                letterSpacing: "-0.31px",
                backgroundColor: "transparent",
                border: "none",
                outline: "none",
                width: "100%",
                height: "100%",
              },
              placeholder: { color: "#ABABAB" },
              css: {
                button: {
                  "background-color": "#017ea7",
                  "background": "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
                  "color": "#ffffff",
                  "border": "1px solid #015f80",
                  "border-radius": "10px",
                  "width": "100%",
                  "height": "52px",
                  "font-family": "Inter, sans-serif",
                  "font-size": "16px",
                  "font-weight": "500",
                  "letter-spacing": "-0.1px",
                  "text-align": "center",
                  "cursor": "pointer",
                  "padding": "0",
                  "margin": "0",
                  "box-shadow": "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)",
                  "transition": "all 150ms ease",
                },
                "button:hover": {
                  "background": "linear-gradient(180deg, #03a0d1 0%, #0290be 100%)",
                  "box-shadow": "0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
                  "cursor": "pointer",
                },
                body: { margin: "0" },
                form: { display: "block" },
              },
            },
          });

          cardForm.initialize();
          console.log("[CHECKOUT] cardForm initialized");

          // Register ALL events with logging
          cardForm.on(
            "submissionSuccess",
            async (evtData: { token: string }) => {
              console.log("[CHECKOUT] submissionSuccess:", evtData);

              await processPayment(evtData.token);
            }
          );

          cardForm.on(
            "submissionError",
            (evtData: { type: string; message: string }) => {
              console.log("[CHECKOUT] submissionError:", evtData);

              setErrors((p) => ({ ...p, card: evtData.message || "Payment failed. Please try again." }));
              setFormState("ready");
            }
          );

          cardForm.on(
            "error",
            (evtData: { type: string; field?: string; message: string }) => {
              console.log("[CHECKOUT] error event:", evtData);

              setErrors((p) => ({ ...p, card: evtData.message }));
              setFormState("ready");
            }
          );

          cardForm.on(
            "validationError",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (evtData: any) => {
              console.log("[CHECKOUT] validationError:", evtData);
            }
          );

          cardForm.on("ready", () => {
            console.log("[CHECKOUT] hosted fields ready");
          });

          cardForm.on(
            "cardBrandChange",
            (evtData: { brand: string }) => {
              console.log("[CHECKOUT] cardBrandChange:", evtData);
              const b = evtData.brand?.toLowerCase() ?? "";
              if (b.includes("visa")) setCardBrand("visa");
              else if (b.includes("master")) setCardBrand("mastercard");
              else if (b.includes("amex") || b.includes("american")) setCardBrand("amex");
              else if (b.includes("discover")) setCardBrand("discover");
              else setCardBrand("unknown");
            }
          );

          setFormState("ready");
        } catch (err) {
          console.error("[CHECKOUT] Init error:", err);
          setFormState("loadError");
        }
      };

      script.onerror = (err) => {
        console.error("[CHECKOUT] Script failed to load:", err);
        setFormState("loadError");
      };
      document.head.appendChild(script);
    } catch {
      setFormState("loadError");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Diagnostic: capture postMessage traffic from Payroc/Worldnet iframes
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const origin = (e.origin ?? "").toLowerCase();
      if (origin.includes("worldnet") || origin.includes("payroc") || origin.includes("worldnettps")) {
        console.log("[PAYROC-DIAG] postMessage from", e.origin, "data:", e.data);
      }
    }
    window.addEventListener("message", onMessage);
    console.log("[PAYROC-DIAG] postMessage listener attached");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    loadPayroc();
    return () => {
      const s = document.getElementById("payroc-hf-script");
      if (s) s.remove();
    };
  }, [loadPayroc]);

  async function processPayment(token: string) {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setErrors({ amount: "Enter a valid amount" });
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
          cardBrand: data.cardBrand,
        });
        setFormState("success");
      } else {
        setPaymentResult({
          error: data.declineReason || data.error || "Payment declined",
        });
        setFormState("declined");
      }
    } catch {
      setPaymentResult({ error: "Network error. Please try again." });
      setFormState("declined");
    }
  }

  function resetForm() {
    setAmount("");
    setDescription("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setErrors({});
    setPaymentResult(null);
    setCardBrand("unknown");
    setFormState("loading");
    setTimeout(() => loadPayroc(), 50);
  }

  const parsedAmount = parseFloat(amount) || 0;
  parsedAmountRef.current = parsedAmount;

  /* ================================================================ */
  /*  SUCCESS                                                          */
  /* ================================================================ */
  if (formState === "success" && paymentResult) {
    const displayAmount =
      paymentResult.amount != null
        ? (paymentResult.amount / 100).toFixed(2)
        : parsedAmount.toFixed(2);

    return (
      <div className={CARD}>
        <div className="flex flex-col items-center text-center py-6">
          {/* Animated checkmark */}
          <div className="relative mb-6">
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "rgba(34,197,94,0.2)", animationDuration: "1.5s" }}
            />
            <div
              className="relative w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: "#22c55e" }}
            >
              <CheckCircle2 size={24} strokeWidth={1.5} color="#fff" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-[#1A1313] mb-2">
            Payment Approved
          </h2>
          <p className="text-[32px] font-semibold text-[#15803D] mb-1">
            ${displayAmount}
          </p>
          {paymentResult.last4 && (
            <p className="text-sm text-[#878787]">
              {paymentResult.cardBrand ? `${paymentResult.cardBrand} ending in` : "Card ending in"} ····{paymentResult.last4}
            </p>
          )}
          {paymentResult.approvalCode && (
            <p className="text-xs text-[#878787] font-mono mt-1">
              Approval Code: {paymentResult.approvalCode}
            </p>
          )}
          <div className="flex flex-col gap-3 w-full max-w-[280px] mt-6">
            <button
              onClick={resetForm}
              className="w-full inline-flex items-center justify-center gap-2 h-10 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer"
            >
              New Payment
            </button>
            <Link
              href="/transactions"
              className="text-[13px] font-medium text-[#878787] text-center hover:text-[#1A1313] transition-colors"
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
      <div className={CARD}>
        <div className="flex flex-col items-center text-center py-6">
          <XCircle size={48} strokeWidth={1.5} className="text-[#ef4444] mb-4" />
          <h2 className="text-xl font-semibold text-[#1A1313] mb-2">
            Payment Declined
          </h2>
          <p className="text-sm text-[#4A4A4A] mb-6">
            {paymentResult.error}
          </p>
          <button
            onClick={resetForm}
            className="w-full max-w-[280px] inline-flex items-center justify-center gap-2 h-10 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer"
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
    <div className="space-y-5 relative">
      {/* Processing overlay */}
      {formState === "processing" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-[#FBFBFB]/85 backdrop-blur-sm">
          <Loader2 size={28} strokeWidth={1.5} className="animate-spin text-[#017ea7] mb-3" />
          <p className="text-sm font-medium text-[#1A1313]">Processing payment...</p>
          <p className="text-xs text-[#878787] mt-2 max-w-[280px] text-center">
            Please ensure all card fields are filled in — Name, Card Number, Expiry, and CVV are all required.
          </p>
          <button
            type="button"
            onClick={() => {

              setFormState("ready");
              setErrors({});
            }}
            className="text-[13px] text-[#878787] hover:text-[#1A1313] mt-4 cursor-pointer bg-transparent border-none transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* PAYMENT DETAILS */}
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-5">
          <DollarSign size={16} strokeWidth={1.5} className="text-[#017ea7]" />
          <span className="text-base font-semibold text-[#1A1313]">Payment Details</span>
        </div>

        <div className="space-y-4">
          {/* Amount */}
          <div>
            <label className={LABEL}>Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878787] text-base font-medium">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: "" })); }}
                placeholder="0.00"
                disabled={disabled}
                className="w-full h-12 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg text-[#1A1313] text-xl font-semibold pl-9 pr-3 outline-none transition-all duration-150 focus:border-[#017ea7] focus:ring-[3px] focus:ring-[#017ea7]/10 focus:bg-white placeholder:text-[#ABABAB] placeholder:font-normal"
              />
            </div>
            {errors.amount && <p className="text-xs text-[#ef4444] mt-1">{errors.amount}</p>}
          </div>

          {/* Description */}
          <div>
            <label className={LABEL}>Description</label>
            <div className="relative">
              <FileText size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878787] pointer-events-none" />
              <input
                type="text"
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="No-show fee, Deposit, Hair service..."
                disabled={disabled}
                className={`${INPUT} pl-9`}
              />
            </div>
          </div>

          {/* Customer toggle */}
          <button
            type="button"
            onClick={() => setShowCustomer(!showCustomer)}
            className="flex items-center gap-1 text-[13px] font-medium text-[#017ea7] cursor-pointer bg-transparent border-none p-0"
          >
            {showCustomer ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
            {showCustomer ? "Hide customer info" : "Add customer info"}
          </button>

          {showCustomer && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>First Name</label>
                  <div className="relative">
                    <User size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878787] pointer-events-none" />
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" disabled={disabled} className={`${INPUT} pl-9`} />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Last Name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" disabled={disabled} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Email</label>
                <div className="relative">
                  <Mail size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878787] pointer-events-none" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" disabled={disabled} className={`${INPUT} pl-9`} />
                </div>
              </div>
            </div>
          )}

          <p className="text-[11px] text-[#878787]">Order #{orderId}</p>
        </div>
      </div>

      {/* CARD INFORMATION */}
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} strokeWidth={1.5} className="text-[#017ea7]" />
          <span className="text-base font-semibold text-[#1A1313]">Card Information</span>
          <span className="text-xs text-[#878787] ml-auto">Secured by Payroc</span>
        </div>
        <div className="h-px bg-[#F4F5F7] mb-5" />

        {/* Load error */}
        {formState === "loadError" && (
          <div className="flex flex-col items-center py-8">
            <AlertCircle size={28} strokeWidth={1.5} className="text-[#ef4444] mb-3" />
            <p className="text-sm font-medium text-[#1A1313] mb-1">Payment fields failed to load</p>
            <p className="text-[13px] text-[#878787] mb-4">Please try again</p>
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

        {/* Hosted fields — always in DOM so Payroc can inject iframes */}
        <div style={{ position: "relative" }}>
          {/* Loading overlay */}
          {formState === "loading" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.9)",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
              }}
            >
              <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[#017ea7] mb-2" />
              <p className="text-[13px] text-[#878787]">Initializing secure payment fields...</p>
            </div>
          )}

          {/* Field containers — always rendered */}
          <div
            className="payroc-form-container"
            style={{ position: "relative", zIndex: 1, isolation: "isolate", display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div>
              <label className={LABEL}>Name on Card</label>
              <div className="card-holder-name" style={{ minHeight: 44 }} />
              <div className="card-holder-name-error text-xs text-[#ef4444] mt-1" />
            </div>
            <div>
              <label className={LABEL}>Card Number</label>
              <div style={{ position: "relative" }}>
                <div className="card-number" style={{ minHeight: 44 }} />
                {cardBrand !== "unknown" && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 2 }}>
                    <CardBrandIcon brand={cardBrand} size={24} />
                  </div>
                )}
              </div>
              <div className="card-number-error text-xs text-[#ef4444] mt-1" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={LABEL}>Expiry</label>
                <div className="card-expiry" style={{ minHeight: 44 }} />
                <div className="card-expiry-error text-xs text-[#ef4444] mt-1" />
              </div>
              <div className="card-cvv-wrapper flex-1">
                <label className={LABEL}>CVV</label>
                <div className="card-cvv" style={{ minHeight: 44 }} />
                <div className="card-cvv-error text-xs text-[#ef4444] mt-1" />
              </div>
            </div>
            {/* Payroc-injected submit button */}
            <div
              className="card-submit submit-button"
              style={{
                width: "100%",
                height: 52,
                minHeight: 52,
                display: "block",
                marginTop: 16,
                borderRadius: 10,
                overflow: "hidden",
              }}
            />
          </div>
        </div>

        {errors.card && (
          <p className="text-[13px] text-[#ef4444] mt-2 flex items-center gap-1.5">
            <AlertCircle size={14} strokeWidth={1.5} />
            {errors.card}
          </p>
        )}

        <div className="flex items-center justify-between mt-4">
          <AcceptedCardsBadges />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-[#878787] mt-3">
          <Lock size={10} strokeWidth={1.5} />
          256-bit encrypted · Secured by Payroc
        </p>
      </div>

      {/* TOTAL + CANCEL */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-sm font-medium text-[#878787]">Total</span>
          <span className="text-2xl font-semibold text-[#1A1313] tracking-tight">
            ${parsedAmount.toFixed(2)}
          </span>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center justify-center mt-3 text-[13px] font-medium text-[#878787] hover:text-[#1A1313] transition-colors"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
