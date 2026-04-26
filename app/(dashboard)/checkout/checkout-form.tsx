"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, XCircle, Lock, DollarSign, FileText } from "lucide-react";
import Link from "next/link";

type Status = "loading" | "ready" | "loadError" | "processing" | "success" | "declined";

const CARD = "bg-white border border-[#E8EAED] rounded-xl p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_4px_4px_rgba(0,0,0,0.05),0_8px_8px_rgba(0,0,0,0.05),0_16px_16px_rgba(0,0,0,0.05)]";

export function CheckoutForm() {
  const [status, setStatus] = useState<Status>("loading");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [last4, setLast4] = useState("");

  const initRef = useRef(false);
  const amountRef = useRef("");
  const descriptionRef = useRef("");
  amountRef.current = amount;
  descriptionRef.current = description;

  // ---- SDK init (DO NOT MODIFY) ----
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        console.log("[HF] Fetching session...");
        const res = await fetch("/api/payroc/session", { cache: "no-store" });
        const data = await res.json();
        if (!data.sessionToken) {
          console.error("[HF] No session token:", data);
          setStatus("loadError");
          return;
        }
        console.log("[HF] Session OK, token length:", data.sessionToken.length);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(window as any).Payroc) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = data.libUrl;
            if (data.integrity) {
              s.integrity = data.integrity;
              s.crossOrigin = "anonymous";
            }
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("SDK load failed"));
            document.head.appendChild(s);
          });
        }
        console.log("[HF] SDK loaded");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Payroc = (window as any).Payroc;
        const cardForm = new Payroc.hostedFields({
          sessionToken: data.sessionToken,
          mode: "payment",
          fields: {
            card: {
              cardholderName: {
                target: ".hf-cardholder",
                placeholder: "Cardholder Name",
              },
              cardNumber: {
                target: ".hf-cardnumber",
                placeholder: "Card Number",
              },
              expiryDate: {
                target: ".hf-expiry",
                placeholder: "MM/YY",
              },
              cvv: {
                target: ".hf-cvv",
                wrapperTarget: ".hf-cvv-wrapper",
                placeholder: "CVV",
              },
              submit: {
                target: ".hf-submit",
                value: "Pay Now",
              },
            },
          },
          styles: {
            css: {
              input: {
                "background-color": "transparent",
                border: "none",
                "border-radius": "0",
                padding: "0 12px",
                "font-family": "Inter, -apple-system, sans-serif",
                "font-size": "15px",
                "font-weight": "400",
                color: "#1A1313",
                outline: "none",
                width: "100%",
                height: "100%",
                "box-sizing": "border-box",
                "letter-spacing": "-0.31px",
              },
              "input:focus": {
                outline: "none",
              },
              "input::placeholder": {
                color: "#ABABAB",
              },
              button: {
                background: "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
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
                "box-shadow": "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)",
                transition: "all 150ms ease",
              },
              "button:hover": {
                background: "linear-gradient(180deg, #03a0d1 0%, #0290be 100%)",
                "box-shadow": "0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
              },
              body: { margin: "0", padding: "0" },
              form: { display: "block" },
            },
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("submissionSuccess", async (evt: any) => {
          const token = evt?.token;
          console.log("[HF] submissionSuccess, token:", token?.substring(0, 20));
          setStatus("processing");

          const amt = parseFloat(amountRef.current) || 0;
          if (amt <= 0) {
            setError("Enter an amount first");
            setStatus("ready");
            return;
          }

          try {
            const pr = await fetch("/api/payroc/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token,
                amount: amt,
                description: descriptionRef.current || "Payment",
                orderId: crypto.randomUUID().slice(0, 8).toUpperCase(),
              }),
            });
            const result = await pr.json();
            console.log("[HF] Payment result:", result);

            if (result.success) {
              setPaymentId(result.paymentId || "");
              setApprovalCode(result.approvalCode || "");
              setLast4(result.last4 || "");
              setStatus("success");
            } else {
              setError(result.declineReason || result.error || "Declined");
              setStatus("declined");
            }
          } catch {
            setError("Network error");
            setStatus("declined");
          }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("submissionError", (evt: any) => {
          console.error("[HF] submissionError:", evt);
          setError(evt?.message || "Submission failed");
          setStatus("ready");
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("error", (evt: any) => {
          console.error("[HF] error:", evt);
        });

        cardForm.on("ready", () => console.log("[HF] Fields ready"));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("surcharge-info", (evt: any) => {
          console.log("[HF] Surcharge info:", evt);
        });

        cardForm.initialize();
        console.log("[HF] Initialized");
        setStatus("ready");
      } catch (err) {
        console.error("[HF] Init failed:", err);
        setStatus("loadError");
      }
    })();
  }, []);

  const parsedAmount = parseFloat(amount) || 0;

  // ---- SUCCESS ----
  if (status === "success") {
    return (
      <div className={CARD}>
        <div className="flex flex-col items-center text-center py-6">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(34,197,94,0.2)", animationDuration: "1.5s" }} />
            <div className="relative w-12 h-12 rounded-full flex items-center justify-center bg-green-500">
              <CheckCircle2 size={24} strokeWidth={1.5} color="#fff" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-[#1A1313] mb-2">Payment Approved</h2>
          <p className="text-[32px] font-semibold text-[#15803D] mb-1">${parsedAmount.toFixed(2)}</p>
          {last4 && <p className="text-sm text-[#878787]">Card ending in ····{last4}</p>}
          {approvalCode && <p className="text-xs text-[#878787] font-mono mt-1">Approval: {approvalCode}</p>}
          {paymentId && <p className="text-xs text-[#ABABAB] font-mono">ID: {paymentId}</p>}
          <div className="flex flex-col gap-3 w-full mt-8">
            <button
              onClick={() => window.location.reload()}
              className="w-full h-[52px] text-white text-base font-medium rounded-[10px] border border-[#015f80] cursor-pointer hover:-translate-y-px active:translate-y-0 transition-all"
              style={{ background: "linear-gradient(180deg, #0290be 0%, #017ea7 100%)", boxShadow: "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)" }}
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

  // ---- DECLINED ----
  if (status === "declined") {
    return (
      <div className={CARD}>
        <div className="flex flex-col items-center text-center py-6">
          <XCircle size={48} strokeWidth={1.5} className="text-[#ef4444] mb-4" />
          <h2 className="text-xl font-semibold text-[#1A1313] mb-2">Payment Declined</h2>
          <p className="text-sm text-[#4A4A4A] mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full max-w-[280px] h-10 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] cursor-pointer transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ---- MAIN FORM ----
  return (
    <div className="space-y-5 relative">
      {/* Processing overlay */}
      {status === "processing" && (
        <div className="fixed inset-0 z-50 bg-[#FBFBFB]/85 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={28} strokeWidth={1.5} className="animate-spin text-[#017ea7] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#1A1313]">Processing payment...</p>
          </div>
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
            <label className="block text-[13px] font-medium text-[#4A4A4A] mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878787] text-base font-medium">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-12 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg text-[#1A1313] text-xl font-semibold pl-9 pr-3 outline-none transition-all duration-150 focus:border-[#017ea7] focus:ring-[3px] focus:ring-[#017ea7]/10 focus:bg-white placeholder:text-[#ABABAB] placeholder:font-normal"
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#4A4A4A] mb-1">Description</label>
            <div className="relative">
              <FileText size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878787] pointer-events-none" />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="No-show fee, Deposit, Hair service..."
                className="w-full h-10 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg text-[#1A1313] text-sm pl-9 pr-3 outline-none transition-all duration-150 focus:border-[#017ea7] focus:ring-[3px] focus:ring-[#017ea7]/10 focus:bg-white placeholder:text-[#ABABAB]"
              />
            </div>
          </div>
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
            <p className="text-sm text-[#ef4444] mb-3">Failed to load payment fields</p>
            <button onClick={() => window.location.reload()} className="text-sm text-[#017ea7] underline cursor-pointer">
              Refresh page
            </button>
          </div>
        )}

        {/* Fields — always in DOM */}
        <div style={{ position: "relative" }}>
          {status === "loading" && (
            <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10 rounded-lg">
              <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[#017ea7] mb-2" />
              <p className="text-[13px] text-[#878787]">Loading payment fields...</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-[13px] font-medium text-[#4A4A4A] mb-1">Name on Card</label>
              <div className="hf-cardholder" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#4A4A4A] mb-1">Card Number</label>
              <div className="hf-cardnumber" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[13px] font-medium text-[#4A4A4A] mb-1">Expiry</label>
                <div className="hf-expiry" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
              </div>
              <div className="hf-cvv-wrapper flex-1">
                <label className="block text-[13px] font-medium text-[#4A4A4A] mb-1">CVV</label>
                <div className="hf-cvv" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
              </div>
            </div>
            {/* SDK submit button */}
            <div className="hf-submit" style={{ minHeight: 52, marginTop: 8, borderRadius: 10, overflow: "hidden" }} />
          </div>
        </div>

        {error && (
          <p className="text-[13px] text-[#ef4444] mt-3">{error}</p>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-[#878787] mt-4">
          <Lock size={10} strokeWidth={1.5} /> 256-bit encrypted · Secured by Payroc
        </p>
      </div>

      {/* TOTAL + CANCEL */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-sm font-medium text-[#878787]">Total</span>
          <span className="text-2xl font-semibold text-[#1A1313] tracking-tight">${parsedAmount.toFixed(2)}</span>
        </div>
        <Link href="/dashboard" className="flex items-center justify-center mt-3 text-[13px] font-medium text-[#878787] hover:text-[#1A1313] transition-colors">
          Cancel
        </Link>
      </div>
    </div>
  );
}
