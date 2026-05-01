"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, XCircle, Lock, DollarSign, FileText, CreditCard } from "lucide-react";
import Link from "next/link";

type Status = "loading" | "ready" | "loadError" | "processing" | "success" | "declined";

interface SavedCardOption {
  id: string;
  cardScheme: string | null;
  last4: string | null;
  expiryMonth: string | null;
  expiryYear: string | null;
  cardholderName: string | null;
  label: string | null;
  lastUsedAt: string | null;
}

const CARD = "bg-white border border-[#E8EAED] rounded-xl p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_4px_4px_rgba(0,0,0,0.05),0_8px_8px_rgba(0,0,0,0.05),0_16px_16px_rgba(0,0,0,0.05)]";

export function CheckoutForm() {
  const [status, setStatus] = useState<Status>("loading");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [last4, setLast4] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [saveCard, setSaveCard] = useState(false);
  const [savedCardConfirmed, setSavedCardConfirmed] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCardOption[]>([]);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null);
  const [savedCardsLoading, setSavedCardsLoading] = useState(false);

  const initRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardFormRef = useRef<any>(null);
  const amountRef = useRef("");
  const descriptionRef = useRef("");
  const customerEmailRef = useRef("");
  const saveCardRef = useRef(false);
  amountRef.current = amount;
  descriptionRef.current = description;
  customerEmailRef.current = customerEmail;
  saveCardRef.current = saveCard;

  // Per-logical-click idempotency. Generated once per Pay attempt, reset on success/declined.
  // See: https://docs.payroc.com/api/idempotency
  const chargeIdempotencyKeyRef = useRef<string | null>(null);
  const chargeOrderIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);

  function ensureChargeIdempotencyKey(): { key: string; orderId: string } {
    if (!chargeIdempotencyKeyRef.current) {
      chargeIdempotencyKeyRef.current = crypto.randomUUID();
    }
    if (!chargeOrderIdRef.current) {
      chargeOrderIdRef.current = crypto.randomUUID().slice(0, 8).toUpperCase();
    }
    return { key: chargeIdempotencyKeyRef.current, orderId: chargeOrderIdRef.current };
  }

  function resetChargeIdempotency() {
    chargeIdempotencyKeyRef.current = null;
    chargeOrderIdRef.current = null;
    submittedRef.current = false;
  }

  // Fetch saved cards when customerEmail is set + valid format
  useEffect(() => {
    const email = customerEmail.trim().toLowerCase();
    if (!email || email.length < 5 || !email.includes("@")) {
      setSavedCards([]);
      setSelectedSavedCardId(null);
      return;
    }

    let cancelled = false;
    setSavedCardsLoading(true);

    (async () => {
      try {
        const res = await fetch(
          `/api/saved-cards?customerEmail=${encodeURIComponent(email)}`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (!res.ok) {
          setSavedCards([]);
          return;
        }
        const json = await res.json();
        const cards: SavedCardOption[] = Array.isArray(json.data)
          ? json.data.map((c: SavedCardOption) => ({
              id: c.id,
              cardScheme: c.cardScheme,
              last4: c.last4,
              expiryMonth: c.expiryMonth,
              expiryYear: c.expiryYear,
              cardholderName: c.cardholderName,
              label: c.label,
              lastUsedAt: c.lastUsedAt,
            }))
          : [];
        if (!cancelled) setSavedCards(cards);
      } catch {
        if (!cancelled) setSavedCards([]);
      } finally {
        if (!cancelled) setSavedCardsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerEmail]);

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
                target: ".card-holder-name",
                errorTarget: ".card-holder-name-error",
                placeholder: "Cardholder Name",
              },
              cardNumber: {
                target: ".card-number",
                errorTarget: ".card-number-error",
                placeholder: "Card Number",
              },
              expiryDate: {
                target: ".card-expiry",
                errorTarget: ".card-expiry-error",
                placeholder: "MM/YY",
              },
              cvv: {
                target: ".card-cvv",
                wrapperTarget: ".card-cvv-wrapper",
                errorTarget: ".card-cvv-error",
                placeholder: "CVV",
              },
              submit: {
                target: ".submit-button",
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
                "background-color": "#017ea7",
                color: "#ffffff",
                border: "none",
                "border-radius": "10px",
                width: "100%",
                height: "52px",
                "font-family": "Inter, -apple-system, sans-serif",
                "font-size": "16px",
                "font-weight": "500",
                "letter-spacing": "-0.1px",
                "text-align": "center",
                cursor: "pointer",
                padding: "14px 24px",
                margin: "0",
                "box-shadow": "0 1px 2px rgba(0,0,0,0.15)",
                transition: "all 200ms ease",
              },
              "button:hover": {
                "background-color": "#0290be",
                "box-shadow": "0 2px 4px rgba(0,0,0,0.2)",
              },
              body: { margin: "0", padding: "0" },
              form: { display: "block" },
            },
          },
        });
        cardFormRef.current = cardForm;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("submissionSuccess", async (evt: any) => {
          // GUARD: SDK can fire submissionSuccess multiple times in edge cases (network blips, race conditions).
          // Per Payroc docs, destroy() prevents duplicate event handling but cannot prevent in-flight duplicate fires.
          // First fire wins; all subsequent fires are no-ops.
          if (submittedRef.current) {
            console.warn("[HF] submissionSuccess fired again after first submission — ignoring duplicate");
            return;
          }
          submittedRef.current = true;

          // Destroy the form immediately so the SDK cannot fire submissionSuccess from this instance again.
          // https://docs.payroc.com/guides/take-payments/hosted-fields/extend-your-integration/close-a-session
          if (cardFormRef.current) {
            try {
              cardFormRef.current.destroy();
              cardFormRef.current = null;
              console.log("[HF] destroy() called after submissionSuccess");
            } catch (destroyErr) {
              console.error("[HF] destroy() after submissionSuccess failed:", destroyErr);
            }
          }

          const token = evt?.token;
          console.log("[HF] submissionSuccess, token:", token?.substring(0, 20));
          setStatus("processing");

          const amt = parseFloat(amountRef.current) || 0;
          if (amt <= 0) {
            setError("Enter an amount first");
            setStatus("ready");
            submittedRef.current = false; // allow retry after fixing amount
            return;
          }

          const { key: chargeIdempotencyKey, orderId } = ensureChargeIdempotencyKey();

          try {
            const pr = await fetch("/api/payroc/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token,
                amount: amt,
                description: descriptionRef.current || "Payment",
                orderId,
                chargeIdempotencyKey,
                ...(saveCardRef.current && customerEmailRef.current
                  ? {
                      saveCard: true,
                      customerEmail: customerEmailRef.current,
                    }
                  : {}),
              }),
            });
            const result = await pr.json();
            console.log("[HF] Payment result:", result);

            if (result.success) {
              setPaymentId(result.paymentId || "");
              setApprovalCode(result.approvalCode || "");
              setLast4(result.last4 || "");
              setSavedCardConfirmed(Boolean(result.savedCardId));
              setStatus("success");
              // Reload after 3s for fresh session token + fresh idempotency state
              setTimeout(() => window.location.reload(), 3000);
            } else {
              setError(result.declineReason || result.error || "Declined");
              setStatus("declined");
              // Decline = same logical attempt is over. Fresh UUID for the next try (if user retries via reload).
              resetChargeIdempotency();
            }
          } catch {
            setError("Network error");
            setStatus("declined");
            resetChargeIdempotency();
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
          console.error("[HF] error event:", JSON.stringify(evt));
          const errType = evt?.type;
          const errMessage = evt?.message;
          const errField = evt?.field;
          if (errType === "submission" || errType === "field") {
            const userMessage =
              errMessage && errMessage.length > 0
                ? errMessage
                : errField
                  ? `Please check the ${errField} field and try again.`
                  : "Card submission failed. Please refresh and try again.";
            setError(userMessage);
            setStatus("ready");
          } else if (errType === "init") {
            setError("Payment fields failed to load. Please refresh.");
            setStatus("loadError");
          } else if (errType === "config") {
            console.error("[HF] CONFIG ERROR — this is a code bug:", errMessage);
            setError("Payment system configuration error. Please refresh.");
            setStatus("loadError");
          }
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

    return () => {
      if (cardFormRef.current) {
        try {
          cardFormRef.current.destroy();
          console.log("[HF] destroy() called on unmount");
        } catch (err) {
          console.error("[HF] destroy() failed:", err);
        }
        cardFormRef.current = null;
      }
      initRef.current = false;
    };
  }, []);

  // Charge a selected saved card (bypasses Hosted Fields)
  async function handleSavedCardCharge() {
    // GUARD: prevent double-click double-charge.
    if (submittedRef.current) {
      console.warn("[SAVED-CARD] charge already in flight — ignoring duplicate click");
      return;
    }

    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      setError("Enter an amount first");
      return;
    }
    if (!selectedSavedCardId) {
      setError("No saved card selected");
      return;
    }

    submittedRef.current = true;
    setError("");
    setStatus("processing");

    const { key: chargeIdempotencyKey, orderId } = ensureChargeIdempotencyKey();

    try {
      const pr = await fetch("/api/payroc/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          description: description || "Payment",
          orderId,
          chargeIdempotencyKey,
          secureTokenId: selectedSavedCardId,
          customerEmail: customerEmail.trim().toLowerCase() || undefined,
        }),
      });
      const result = await pr.json();
      console.log("[SAVED-CARD] Payment result:", result);

      if (result.success) {
        setPaymentId(result.paymentId || "");
        setApprovalCode(result.approvalCode || "");
        setLast4(result.last4 || "");
        setStatus("success");
        setTimeout(() => window.location.reload(), 3000);
      } else {
        setError(result.declineReason || result.error || "Declined");
        setStatus("declined");
        resetChargeIdempotency();
      }
    } catch {
      setError("Network error");
      setStatus("declined");
      resetChargeIdempotency();
    }
  }

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
          {savedCardConfirmed && (
            <p className="text-xs text-[#22c55e] mt-1">Card saved for future payments</p>
          )}
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

          {/* Customer Email (always visible) */}
          <div className="border-t border-[#F4F5F7] pt-4 mt-2">
            <label className="block text-[13px] font-medium text-[#4A4A4A] mb-1">
              Customer Email <span className="text-[#878787] font-normal">(optional)</span>
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full h-10 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg text-[#1A1313] text-sm px-3 outline-none transition-all duration-150 focus:border-[#017ea7] focus:ring-[3px] focus:ring-[#017ea7]/10 focus:bg-white placeholder:text-[#ABABAB]"
            />
            <p className="text-[11px] text-[#878787] mt-1.5">
              Enter to see saved cards or save this card for future payments.
            </p>

            {/* Saved cards picker */}
            {savedCardsLoading && (
              <p className="mt-3 text-[12px] text-[#878787] flex items-center gap-1.5">
                <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                Looking up saved cards...
              </p>
            )}
            {!savedCardsLoading && savedCards.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[12px] font-medium text-[#4A4A4A]">
                  Saved cards for this customer:
                </p>
                {savedCards.map((c) => {
                  const isSelected = selectedSavedCardId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setSelectedSavedCardId(isSelected ? null : c.id)
                      }
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer text-left"
                      style={{
                        background: isSelected ? "#EFF8FB" : "#FFFFFF",
                        borderColor: isSelected ? "#017ea7" : "#E8EAED",
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: isSelected ? "#017ea7" : "#F4F5F7" }}
                      >
                        <CreditCard
                          size={14}
                          strokeWidth={1.5}
                          color={isSelected ? "#fff" : "#4A4A4A"}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[#1A1313]">
                            {c.cardScheme || "Card"} ····{c.last4 || "----"}
                          </span>
                          {c.expiryMonth && c.expiryYear && (
                            <span className="text-[11px] text-[#878787]">
                              {c.expiryMonth}/{c.expiryYear.slice(-2)}
                            </span>
                          )}
                        </div>
                        {c.cardholderName && (
                          <div className="text-[11px] text-[#878787]">
                            {c.cardholderName}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <CheckCircle2
                          size={16}
                          strokeWidth={1.5}
                          className="text-[#017ea7] flex-shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Save checkbox — only when no saved card is selected */}
            {!selectedSavedCardId && (
              <div className="mt-3 pt-3 border-t border-[#F4F5F7]">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveCard}
                    onChange={(e) => setSaveCard(e.target.checked)}
                    className="mt-0.5 cursor-pointer"
                    style={{ accentColor: "#017ea7" }}
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-[#1A1313]">
                      Save this card for future payments
                    </span>
                    <span className="block text-[12px] text-[#878787] mt-0.5">
                      We&apos;ll securely save the card so this customer can pay faster next time.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SAVED CARD CHARGE BUTTON (shown when saved card is selected) */}
      {selectedSavedCardId && (
        <div className={CARD}>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={16} strokeWidth={1.5} className="text-[#017ea7]" />
            <span className="text-base font-semibold text-[#1A1313]">Saved Card Selected</span>
          </div>
          <div className="h-px bg-[#F4F5F7] mb-5" />
          {(() => {
            const sel = savedCards.find((c) => c.id === selectedSavedCardId);
            if (!sel) return null;
            return (
              <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-[#F9FAFB] border border-[#E8EAED]">
                <div className="w-9 h-9 rounded-md bg-[#017ea7] flex items-center justify-center">
                  <CreditCard size={16} strokeWidth={1.5} color="#fff" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1A1313]">
                    {sel.cardScheme || "Card"} ····{sel.last4 || "----"}
                  </p>
                  {sel.cardholderName && (
                    <p className="text-xs text-[#878787]">{sel.cardholderName}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSavedCardId(null)}
                  className="text-[12px] text-[#878787] hover:text-[#1A1313] transition-colors cursor-pointer"
                >
                  Change
                </button>
              </div>
            );
          })()}
          <button
            type="button"
            onClick={handleSavedCardCharge}
            disabled={parsedAmount <= 0 || status === "processing"}
            className="w-full h-[52px] text-white text-base font-medium rounded-[10px] border border-[#015f80] cursor-pointer hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: parsedAmount > 0
                ? "linear-gradient(180deg, #0290be 0%, #017ea7 100%)"
                : "#878787",
              boxShadow: "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
          >
            {status === "processing"
              ? "Processing..."
              : `Charge $${parsedAmount.toFixed(2)}`}
          </button>
          {error && (
            <p className="text-[13px] text-[#ef4444] mt-3">{error}</p>
          )}
          <p className="flex items-center gap-1.5 text-[11px] text-[#878787] mt-4">
            <Lock size={10} strokeWidth={1.5} /> 256-bit encrypted · Powered by SalonTransact
          </p>
        </div>
      )}

      {/* CARD INFORMATION — Hidden via display:none when saved card selected, so SDK keeps DOM refs */}
      <div className={CARD} style={{ display: selectedSavedCardId ? "none" : undefined }}>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} strokeWidth={1.5} className="text-[#017ea7]" />
          <span className="text-base font-semibold text-[#1A1313]">Card Information</span>
          <span className="text-xs text-[#878787] ml-auto">Powered by SalonTransact</span>
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

          <div className="card-container payroc-form space-y-3">
            <div>
              <label className="block text-[13px] font-medium text-[#4A4A4A] mb-1">Name on Card</label>
              <div className="card-holder-name" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
              <div className="card-holder-name-error" style={{ fontSize: 12, color: "#ef4444", marginTop: 4, minHeight: 0 }} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#4A4A4A] mb-1">Card Number</label>
              <div className="card-number" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
              <div className="card-number-error" style={{ fontSize: 12, color: "#ef4444", marginTop: 4, minHeight: 0 }} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[13px] font-medium text-[#4A4A4A] mb-1">Expiry</label>
                <div className="card-expiry" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
                <div className="card-expiry-error" style={{ fontSize: 12, color: "#ef4444", marginTop: 4, minHeight: 0 }} />
              </div>
              <div className="card-cvv-wrapper flex-1">
                <label className="block text-[13px] font-medium text-[#4A4A4A] mb-1">CVV</label>
                <div className="card-cvv" style={{ minHeight: 44, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, overflow: "hidden" }} />
                <div className="card-cvv-error" style={{ fontSize: 12, color: "#ef4444", marginTop: 4, minHeight: 0 }} />
              </div>
            </div>
            {/* SDK submit button */}
            <div className="card-submit submit-button" style={{ minHeight: 52, marginTop: 8, borderRadius: 10, overflow: "hidden" }} />
          </div>
        </div>

        {error && (
          <p className="text-[13px] text-[#ef4444] mt-3">{error}</p>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-[#878787] mt-4">
          <Lock size={10} strokeWidth={1.5} /> 256-bit encrypted · Powered by SalonTransact
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
