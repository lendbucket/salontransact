"use client";

import { useState, useEffect, useRef } from "react";
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

type Status = "loading" | "ready" | "loadError" | "processing" | "success" | "declined";

interface PaymentResult {
  paymentId?: string;
  amount?: number;
  last4?: string;
  approvalCode?: string;
  cardBrand?: string;
}

const INPUT =
  "w-full h-10 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg text-[#1A1313] text-sm px-3 outline-none transition-all duration-150 focus:border-[#017ea7] focus:ring-[3px] focus:ring-[#017ea7]/10 focus:bg-white placeholder:text-[#ABABAB]";
const LABEL = "block text-[13px] font-medium text-[#4A4A4A] mb-1";
const CARD =
  "bg-white border border-[#E8EAED] rounded-xl p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_4px_4px_rgba(0,0,0,0.05),0_8px_8px_rgba(0,0,0,0.05),0_16px_16px_rgba(0,0,0,0.05)]";

export function CheckoutForm() {
  const [status, setStatus] = useState<Status>("loading");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [orderId] = useState(() =>
    crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  );
  const [error, setError] = useState("");
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [cardBrand, setCardBrand] = useState<CardBrand>("unknown");
  const [surchargeInfo, setSurchargeInfo] = useState<{
    amount: number;
    percentage: number;
    total: number;
  } | null>(null);
  const [showSurchargeConfirm, setShowSurchargeConfirm] = useState(false);

  // CRITICAL: prevent double initialization
  const initOnceRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardFormRef = useRef<any>(null);

  // Use refs to capture current form values so processPayment always reads fresh state
  const amountRef = useRef(amount);
  const descriptionRef = useRef(description);
  const firstNameRef = useRef(firstName);
  const lastNameRef = useRef(lastName);
  const emailRef = useRef(email);
  const orderIdRef = useRef(orderId);
  amountRef.current = amount;
  descriptionRef.current = description;
  firstNameRef.current = firstName;
  lastNameRef.current = lastName;
  emailRef.current = email;
  orderIdRef.current = orderId;

  // ---- processPayment — reads from refs for fresh values ----
  async function processPayment(token: string) {
    const rawAmount = amountRef.current;
    const amt = parseFloat(rawAmount) || 0;
    console.log("[CHECKOUT] Processing payment with token:", token.substring(0, 20));
    console.log("[CHECKOUT] Amount raw:", JSON.stringify(rawAmount), "parsed:", amt, "cents:", Math.round(amt * 100));
    if (amt <= 0) {
      console.error("[CHECKOUT] Amount is 0 or invalid — aborting payment");
      setError("Please enter an amount before paying");
      setStatus("ready");
      return;
    }
    setStatus("processing");
    try {
      const res = await fetch("/api/payroc/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          amount: amt,
          description: descriptionRef.current || undefined,
          customerFirstName: firstNameRef.current || undefined,
          customerLastName: lastNameRef.current || undefined,
          customerEmail: emailRef.current || undefined,
          orderId: orderIdRef.current,
        }),
      });
      const result = await res.json();
      console.log("[CHECKOUT] Payment result:", result);
      if (result.success) {
        setPaymentResult({
          paymentId: result.paymentId,
          amount: result.amount,
          last4: result.last4,
          approvalCode: result.approvalCode,
          cardBrand: result.cardBrand,
        });
        setStatus("success");
      } else {
        setError(result.declineReason || result.error || "Payment failed");
        setStatus("declined");
      }
    } catch (err) {
      console.error("[CHECKOUT] Payment error:", err);
      setError("Network error. Please try again.");
      setStatus("declined");
    }
  }

  // ---- Single init effect ----
  useEffect(() => {
    if (initOnceRef.current) {
      console.log("[CHECKOUT] Skipping duplicate init");
      return;
    }
    initOnceRef.current = true;

    let mounted = true;

    async function init() {
      try {
        console.log("[CHECKOUT] Fetching session...");
        const res = await fetch("/api/payroc/session");
        const data = await res.json();

        if (!mounted) return;
        if (!data.sessionToken) {
          console.error("[CHECKOUT] No session token:", data);
          setStatus("loadError");
          return;
        }

        const sessionCreatedAt = data._sessionCreatedAt || Date.now();
        console.log("[FIELD-DEBUG] Session token being used:", data.sessionToken?.substring(0, 20) + "...");
        console.log("[FIELD-DEBUG] Session token length:", data.sessionToken?.length);
        console.log("[FIELD-DEBUG] Session expiresAt:", data.expiresAt);
        console.log("[CHECKOUT] Loading SDK from:", data.libUrl);
        if (data._diag) {
          console.log("[PAYROC-DIAG] sessionHost:", data._diag.sessionHost);
          console.log("[PAYROC-DIAG] gatewayHost:", data._diag.gatewayHost);
          console.log("[PAYROC-DIAG] tokenLength:", data._diag.tokenLength);
        }

        // Load script (or reuse if already loaded)
        await new Promise<void>((resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (typeof (window as any).Payroc !== "undefined") {
            console.log("[CHECKOUT] Payroc SDK already loaded");
            resolve();
            return;
          }

          const script = document.createElement("script");
          script.src = data.libUrl;
          if (data.integrity?.startsWith("sha384-")) {
            script.integrity = data.integrity;
            script.crossOrigin = "anonymous";
          }
          script.async = true;
          script.onload = () => {
            console.log("[CHECKOUT] SDK script loaded");
            resolve();
          };
          script.onerror = (e) => {
            console.error("[CHECKOUT] SDK script failed to load:", e);
            reject(new Error("SDK failed to load"));
          };
          document.head.appendChild(script);
        });

        if (!mounted) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Payroc = (window as any).Payroc;
        console.log("[CHECKOUT] window.Payroc type:", typeof Payroc);

        if (!Payroc?.hostedFields) {
          console.error("[CHECKOUT] Payroc.hostedFields not found");
          setStatus("loadError");
          return;
        }

        console.log("[CHECKOUT] Initializing Payroc.hostedFields...");

        const cardForm = new Payroc.hostedFields({
          sessionToken: data.sessionToken,
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
                value: "Pay Now",
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
                "background":
                  "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
                color: "#ffffff",
                border: "1px solid #015f80",
                "border-radius": "10px",
                width: "100%",
                height: "52px",
                "font-family": "Inter, sans-serif",
                "font-size": "16px",
                "font-weight": "500",
                "letter-spacing": "-0.1px",
                "text-align": "center",
                cursor: "pointer",
                padding: "0",
                margin: "0",
                "box-shadow":
                  "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)",
                transition: "all 150ms ease",
              },
              "button:hover": {
                background:
                  "linear-gradient(180deg, #03a0d1 0%, #0290be 100%)",
                "box-shadow":
                  "0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
                cursor: "pointer",
              },
              body: { margin: "0" },
              form: { display: "block" },
            },
          },
        });

        // Register events BEFORE initialize
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("submissionSuccess", async ({ token }: any) => {
          console.log("[CHECKOUT] submissionSuccess — token:", token?.substring(0, 20));
          await processPayment(token);
          // Session token is single-use — auto-reload for fresh session
          setTimeout(() => window.location.reload(), 3000);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("error", ({ type, field, message }: any) => {
          console.error("[CHECKOUT] error event:", { type, field, message });
          if (type === "submission") {
            const isSessionError = (message ?? "").toLowerCase().includes("session") ||
              (message ?? "").toLowerCase().includes("expired") ||
              (message ?? "").toLowerCase().includes("missing required");
            if (isSessionError) {
              setError("Payment session expired. Refreshing...");
              setTimeout(() => window.location.reload(), 1500);
            } else {
              setError(message || "Payment submission failed");
            }
            setStatus("ready");
          }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("submissionError", ({ type, message }: any) => {
          console.error("[CHECKOUT] submissionError:", { type, message });
          const isSessionError = (message ?? "").toLowerCase().includes("session") ||
            (message ?? "").toLowerCase().includes("expired") ||
            (message ?? "").toLowerCase().includes("missing required");
          if (isSessionError) {
            setError("Payment session expired. Refreshing...");
            setTimeout(() => window.location.reload(), 1500);
          } else {
            setError(message || "Payment failed. Please try again.");
          }
          setStatus("ready");
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("fieldValidityChange", ({ field, validationError }: any) => {
          console.log("[CHECKOUT] field validity:", field, validationError || "valid");
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("cardBrandChange", ({ brand }: any) => {
          console.log("[CHECKOUT] cardBrandChange:", brand);
          const b = (brand ?? "").toLowerCase();
          if (b.includes("visa")) setCardBrand("visa");
          else if (b.includes("master")) setCardBrand("mastercard");
          else if (b.includes("amex") || b.includes("american")) setCardBrand("amex");
          else if (b.includes("discover")) setCardBrand("discover");
          else setCardBrand("unknown");
        });

        cardForm.on("ready", () => {
          console.log("[CHECKOUT] hosted fields ready event");
        });

        // ---- Field connection and validation debugging ----
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("field-connected", (evtData: any) => {
          console.log("[FIELD-DEBUG] Field connected:", evtData?.payload?.field ?? evtData?.field, evtData);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("field-invalid", (evtData: any) => {
          console.log("[FIELD-DEBUG] Field INVALID:", evtData?.payload?.field ?? evtData?.field, evtData?.payload?.message ?? evtData?.message, evtData);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("submit-initiated", (evtData: any) => {
          const sessionAge = Date.now() - sessionCreatedAt;
          console.log("[TIMING-DEBUG] submit-initiated at:", new Date().toISOString());
          console.log("[TIMING-DEBUG] Session age in seconds:", (sessionAge / 1000).toFixed(1));
          if (sessionAge > 10 * 60 * 1000) {
            console.error("[TIMING-DEBUG] SESSION EXPIRED — over 10 minutes old!");
          }
          console.log("[TIMING-DEBUG] submit-initiated data:", evtData);
        });

        // ---- Surcharge handling (RewardPay) ----
        // The SDK fires surcharge-info when terminal has surcharging enabled.
        // Payment hangs until we accept or decline the surcharge.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("surcharge-info", (data: any) => {
          console.log("[PAYROC-DIAG] surcharge-info event received:", JSON.stringify(data));
          const payload = data?.payload ?? data;
          const surchargeAmount = payload?.amount ?? payload?.surchargeAmount ?? 0;
          const surchargePercent = payload?.percentage ?? payload?.surchargePercentage ?? 0;
          const totalAmount = payload?.total ?? payload?.totalAmount ?? 0;

          setSurchargeInfo({
            amount: surchargeAmount,
            percentage: surchargePercent,
            total: totalAmount,
          });

          // Auto-accept surcharge — the SDK continues to submissionSuccess after this.
          // Some SDK versions require calling acceptSurcharge(), others auto-continue.
          console.log("[PAYROC-DIAG] Auto-accepting surcharge...");
          if (typeof cardForm.acceptSurcharge === "function") {
            console.log("[PAYROC-DIAG] Calling cardForm.acceptSurcharge()");
            cardForm.acceptSurcharge();
          } else if (typeof cardForm.surchargeAccepted === "function") {
            console.log("[PAYROC-DIAG] Calling cardForm.surchargeAccepted()");
            cardForm.surchargeAccepted();
          } else if (typeof cardForm.confirmSurcharge === "function") {
            console.log("[PAYROC-DIAG] Calling cardForm.confirmSurcharge()");
            cardForm.confirmSurcharge();
          } else {
            // Try posting acceptance message back to the iframe
            console.log("[PAYROC-DIAG] No surcharge method found, trying postMessage acceptance");
            const iframes = document.querySelectorAll("iframe");
            iframes.forEach((iframe) => {
              const src = iframe.src ?? "";
              if (src.includes("worldnet") || src.includes("payroc")) {
                console.log("[PAYROC-DIAG] Posting surcharge-accepted to iframe:", src.substring(0, 60));
                iframe.contentWindow?.postMessage(
                  { type: "surcharge-accepted", accepted: true },
                  "*"
                );
                iframe.contentWindow?.postMessage(
                  JSON.stringify({ type: "surcharge-accepted", accepted: true }),
                  "*"
                );
              }
            });
          }

          // Log all available methods on cardForm for debugging
          const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(cardForm))
            .filter((m) => typeof cardForm[m] === "function" && m !== "constructor");
          console.log("[PAYROC-DIAG] cardForm methods:", methods.join(", "));
        });

        // Also listen for surcharge variants the SDK might use
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("surchargeInfo", (data: any) => {
          console.log("[PAYROC-DIAG] surchargeInfo (camelCase) event:", JSON.stringify(data));
        });

        cardForm.initialize();
        cardFormRef.current = cardForm;
        console.log("[CHECKOUT] Payroc.hostedFields initialized");

        // SDK method introspection
        setTimeout(() => {
          try {
            const ownProps = Object.getOwnPropertyNames(cardForm);
            const protoProps = Object.getOwnPropertyNames(Object.getPrototypeOf(cardForm));
            console.log("[SDK-DEBUG] cardForm own properties:", ownProps.join(", "));
            console.log("[SDK-DEBUG] cardForm prototype methods:", protoProps.join(", "));
            // Check for surcharge-related methods
            const allProps = [...ownProps, ...protoProps];
            const surchargeProps = allProps.filter(p =>
              p.toLowerCase().includes("surcharge") || p.toLowerCase().includes("accept")
            );
            console.log("[SDK-DEBUG] Surcharge-related methods:", surchargeProps.length > 0 ? surchargeProps.join(", ") : "NONE FOUND");
          } catch (e) {
            console.log("[SDK-DEBUG] Could not introspect cardForm:", e);
          }
        }, 1000);

        if (mounted) setStatus("ready");
      } catch (err) {
        console.error("[CHECKOUT] Init error:", err);
        if (mounted) setStatus("loadError");
      }
    }

    // Diagnostic + surcharge auto-accept via postMessage
    function onMessage(e: MessageEvent) {
      const origin = (e.origin ?? "").toLowerCase();
      if (
        origin.includes("worldnet") ||
        origin.includes("payroc") ||
        origin.includes("worldnettps")
      ) {
        console.log("[PAYROC-DIAG] postMessage from", e.origin, "data:", e.data);

        // Auto-accept surcharge if the SDK communicates via postMessage
        const msgData = typeof e.data === "string" ? (() => { try { return JSON.parse(e.data); } catch { return null; } })() : e.data;
        if (msgData) {
          const msgType = msgData.type ?? msgData.id ?? msgData.event ?? "";
          if (
            typeof msgType === "string" &&
            msgType.toLowerCase().includes("surcharge")
          ) {
            console.log("[PAYROC-DIAG] Surcharge postMessage detected, sending acceptance back");
            if (e.source && typeof (e.source as Window).postMessage === "function") {
              (e.source as Window).postMessage(
                { type: "surcharge-accepted", accepted: true },
                e.origin || "*"
              );
              (e.source as Window).postMessage(
                JSON.stringify({ type: "surcharge-accepted", accepted: true }),
                e.origin || "*"
              );
            }
          }
        }
      }
    }
    window.addEventListener("message", onMessage);
    console.log("[PAYROC-DIAG] postMessage listener attached");

    init();

    return () => {
      mounted = false;
      window.removeEventListener("message", onMessage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // EMPTY deps — never re-run

  function resetForm() {
    console.log("[CHECKOUT] Resetting form — reloading for fresh session");
    window.location.reload();
  }

  const parsedAmount = parseFloat(amount) || 0;

  /* ================================================================ */
  /*  SUCCESS                                                          */
  /* ================================================================ */
  if (status === "success" && paymentResult) {
    const displayAmount =
      paymentResult.amount != null
        ? (paymentResult.amount / 100).toFixed(2)
        : parsedAmount.toFixed(2);

    return (
      <div className={CARD}>
        <div className="flex flex-col items-center text-center py-6">
          <div className="relative mb-6">
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "rgba(34,197,94,0.2)", animationDuration: "1.5s" }}
            />
            <div className="relative w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#22c55e" }}>
              <CheckCircle2 size={24} strokeWidth={1.5} color="#fff" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-[#1A1313] mb-2">Payment Approved</h2>
          <p className="text-[32px] font-semibold text-[#15803D] mb-1">${displayAmount}</p>
          {paymentResult.last4 && (
            <p className="text-sm text-[#878787]">
              {paymentResult.cardBrand ? `${paymentResult.cardBrand} ending in` : "Card ending in"} ····{paymentResult.last4}
            </p>
          )}
          {paymentResult.approvalCode && (
            <p className="text-xs text-[#878787] font-mono mt-1">Approval Code: {paymentResult.approvalCode}</p>
          )}
          <div className="flex flex-col gap-3 w-full mt-8">
            <button
              onClick={resetForm}
              className="w-full inline-flex items-center justify-center gap-2 h-[52px] text-white text-base font-medium rounded-[10px] border border-[#015f80] transition-all duration-150 cursor-pointer hover:-translate-y-px active:translate-y-0"
              style={{
                background: "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              Process Another Payment
            </button>
            <Link href="/transactions" className="text-[13px] font-medium text-[#878787] text-center hover:text-[#1A1313] transition-colors">
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
  if (status === "declined") {
    return (
      <div className={CARD}>
        <div className="flex flex-col items-center text-center py-6">
          <XCircle size={48} strokeWidth={1.5} className="text-[#ef4444] mb-4" />
          <h2 className="text-xl font-semibold text-[#1A1313] mb-2">Payment Declined</h2>
          <p className="text-sm text-[#4A4A4A] mb-6">{error}</p>
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
  const disabled = status === "processing";

  return (
    <div className="space-y-5 relative">
      {/* Processing overlay */}
      {status === "processing" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-[#FBFBFB]/85 backdrop-blur-sm">
          <Loader2 size={28} strokeWidth={1.5} className="animate-spin text-[#017ea7] mb-3" />
          <p className="text-sm font-medium text-[#1A1313]">Processing payment...</p>
        </div>
      )}

      {/* PAYMENT DETAILS */}
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-5">
          <DollarSign size={16} strokeWidth={1.5} className="text-[#017ea7]" />
          <span className="text-base font-semibold text-[#1A1313]">Payment Details</span>
        </div>
        <div className="space-y-4">
          <div>
            <label className={LABEL}>Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878787] text-base font-medium">$</span>
              <input
                type="number" step="0.01" min="0" value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(""); }}
                placeholder="0.00" disabled={disabled}
                className="w-full h-12 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg text-[#1A1313] text-xl font-semibold pl-9 pr-3 outline-none transition-all duration-150 focus:border-[#017ea7] focus:ring-[3px] focus:ring-[#017ea7]/10 focus:bg-white placeholder:text-[#ABABAB] placeholder:font-normal"
              />
            </div>
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <div className="relative">
              <FileText size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878787] pointer-events-none" />
              <input type="text" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="No-show fee, Deposit, Hair service..." disabled={disabled} className={`${INPUT} pl-9`} />
            </div>
          </div>
          <button type="button" onClick={() => setShowCustomer(!showCustomer)}
            className="flex items-center gap-1 text-[13px] font-medium text-[#017ea7] cursor-pointer bg-transparent border-none p-0">
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

        {status === "loadError" && (
          <div className="flex flex-col items-center py-8">
            <AlertCircle size={28} strokeWidth={1.5} className="text-[#ef4444] mb-3" />
            <p className="text-sm font-medium text-[#1A1313] mb-1">Payment fields failed to load</p>
            <p className="text-[13px] text-[#878787] mb-4">Please refresh the page</p>
            <button type="button" onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-3 h-8 bg-white hover:bg-[#F4F5F7] text-[#1A1313] text-sm font-medium rounded-lg border border-[#D1D5DB] transition-all duration-150 cursor-pointer">
              <RefreshCw size={14} strokeWidth={1.5} /> Refresh
            </button>
          </div>
        )}

        {/* Hosted fields — ALWAYS in DOM */}
        <div style={{ position: "relative" }}>
          {status === "loading" && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.9)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
              <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[#017ea7] mb-2" />
              <p className="text-[13px] text-[#878787]">Initializing secure payment fields...</p>
            </div>
          )}

          <div className="payroc-form-container" style={{ position: "relative", zIndex: 1, isolation: "isolate", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className={LABEL}>Name on Card</label>
              <div className="card-holder-name" style={{ minHeight: 44 }} />
              <div className="card-holder-name-error error-message text-xs text-[#ef4444] mt-1" />
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
              <div className="card-number-error error-message text-xs text-[#ef4444] mt-1" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={LABEL}>Expiry</label>
                <div className="card-expiry" style={{ minHeight: 44 }} />
                <div className="card-expiry-error error-message text-xs text-[#ef4444] mt-1" />
              </div>
              <div className="card-cvv-wrapper flex-1">
                <label className={LABEL}>CVV</label>
                <div className="card-cvv" style={{ minHeight: 44 }} />
                <div className="card-cvv-error error-message text-xs text-[#ef4444] mt-1" />
              </div>
            </div>
            <div className="card-submit submit-button" style={{ width: "100%", height: 52, minHeight: 52, display: "block", position: "relative", zIndex: 1, marginTop: 16, borderRadius: 10, overflow: "hidden" }} />
          </div>
        </div>

        {error && (
          <p className="text-[13px] text-[#ef4444] mt-2 flex items-center gap-1.5">
            <AlertCircle size={14} strokeWidth={1.5} /> {error}
          </p>
        )}

        <div className="flex items-center justify-between mt-4">
          <AcceptedCardsBadges />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-[#878787] mt-3">
          <Lock size={10} strokeWidth={1.5} /> 256-bit encrypted · Secured by Payroc
        </p>
      </div>

      {/* TOTAL + CANCEL */}
      <div>
        {surchargeInfo && surchargeInfo.amount > 0 && (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 mb-3">
            <p className="text-[13px] font-medium text-[#92400E] mb-1">
              Processing Fee Notice
            </p>
            <p className="text-[12px] text-[#92400E]">
              A {surchargeInfo.percentage}% surcharge of ${(surchargeInfo.amount / 100).toFixed(2)} will be added to cover processing fees.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-sm font-medium text-[#878787]">Total</span>
          <span className="text-2xl font-semibold text-[#1A1313] tracking-tight">
            ${surchargeInfo && surchargeInfo.total > 0
              ? (surchargeInfo.total / 100).toFixed(2)
              : parsedAmount.toFixed(2)}
          </span>
        </div>
        <Link href="/dashboard" className="flex items-center justify-center mt-3 text-[13px] font-medium text-[#878787] hover:text-[#1A1313] transition-colors">
          Cancel
        </Link>
      </div>
    </div>
  );
}
