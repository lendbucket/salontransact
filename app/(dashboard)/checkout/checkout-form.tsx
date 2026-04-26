"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, XCircle, Lock } from "lucide-react";
import Link from "next/link";

type Status = "loading" | "ready" | "loadError" | "processing" | "success" | "declined";

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

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        // 1. Get session token
        console.log("[HF] Fetching session...");
        const res = await fetch("/api/payroc/session", { cache: "no-store" });
        const data = await res.json();
        if (!data.sessionToken) {
          console.error("[HF] No session token:", data);
          setStatus("loadError");
          return;
        }
        console.log("[HF] Session OK, token length:", data.sessionToken.length);

        // 2. Load SDK
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

        // 3. Initialize hosted fields — minimal config
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
        });

        // 4. Events
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

  // ---- SUCCESS ----
  if (status === "success") {
    return (
      <div className="bg-white border border-[#E8EAED] rounded-xl p-8 text-center">
        <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
        <h2 className="text-2xl font-semibold mb-2">Payment Approved</h2>
        {last4 && <p className="text-sm text-gray-500">Card ending in {last4}</p>}
        {approvalCode && <p className="text-xs text-gray-400 font-mono mt-1">Approval: {approvalCode}</p>}
        {paymentId && <p className="text-xs text-gray-400 font-mono">ID: {paymentId}</p>}
        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full h-11 bg-[#017ea7] text-white rounded-lg font-medium hover:bg-[#0290be] transition-colors"
        >
          New Payment
        </button>
        <Link href="/transactions" className="block mt-3 text-sm text-gray-400 hover:text-gray-600">
          View Transactions
        </Link>
      </div>
    );
  }

  // ---- DECLINED ----
  if (status === "declined") {
    return (
      <div className="bg-white border border-[#E8EAED] rounded-xl p-8 text-center">
        <XCircle size={48} className="mx-auto mb-4 text-red-500" />
        <h2 className="text-xl font-semibold mb-2">Payment Declined</h2>
        <p className="text-sm text-gray-500 mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="w-full h-11 bg-[#017ea7] text-white rounded-lg font-medium hover:bg-[#0290be] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ---- MAIN FORM ----
  return (
    <div className="space-y-5">
      {/* Processing overlay */}
      {status === "processing" && (
        <div className="fixed inset-0 z-50 bg-white/80 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-[#017ea7] mx-auto mb-3" />
            <p className="text-sm font-medium">Processing payment...</p>
          </div>
        </div>
      )}

      {/* Amount + Description */}
      <div className="bg-white border border-[#E8EAED] rounded-xl p-6">
        <h3 className="text-base font-semibold mb-4">Payment Details</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full h-11 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg px-3 text-lg font-semibold outline-none focus:border-[#017ea7]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="No-show fee, deposit, etc."
              className="w-full h-10 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg px-3 text-sm outline-none focus:border-[#017ea7]"
            />
          </div>
        </div>
      </div>

      {/* Card Fields */}
      <div className="bg-white border border-[#E8EAED] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-[#017ea7]" />
          <h3 className="text-base font-semibold">Card Information</h3>
          <span className="text-xs text-gray-400 ml-auto">Secured by Payroc</span>
        </div>

        {status === "loadError" && (
          <div className="text-center py-8">
            <p className="text-sm text-red-500 mb-3">Failed to load payment fields</p>
            <button onClick={() => window.location.reload()} className="text-sm text-[#017ea7] underline">
              Refresh page
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10 rounded-xl">
            <div className="text-center">
              <Loader2 size={20} className="animate-spin text-[#017ea7] mx-auto mb-2" />
              <p className="text-xs text-gray-400">Loading payment fields...</p>
            </div>
          </div>
        )}

        {/* Hosted field containers — always in DOM */}
        <div className="space-y-3" style={{ position: "relative" }}>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name on Card</label>
            <div className="hf-cardholder" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Card Number</label>
            <div className="hf-cardnumber" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Expiry</label>
              <div className="hf-expiry" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
            </div>
            <div className="hf-cvv-wrapper flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">CVV</label>
              <div className="hf-cvv" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
            </div>
          </div>
          {/* SDK submit button — visible, SDK injects its own button here */}
          <div className="hf-submit" style={{ minHeight: 52, marginTop: 8, borderRadius: 10, overflow: "hidden" }} />
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
          <Lock size={10} /> 256-bit encrypted
        </p>
      </div>

      {/* Total + Cancel */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-gray-400">Total</span>
        <span className="text-2xl font-semibold">${(parseFloat(amount) || 0).toFixed(2)}</span>
      </div>
      <Link href="/dashboard" className="block text-center text-sm text-gray-400 hover:text-gray-600">
        Cancel
      </Link>
    </div>
  );
}
