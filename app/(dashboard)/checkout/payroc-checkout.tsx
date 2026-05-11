"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Lock } from "lucide-react";

export type PayrocSuccessResult = {
  paymentId: string;
  approvalCode: string;
  last4: string;
  savedCardConfirmed: boolean;
};

type Props = {
  id: string;
  amount: string;
  description: string;
  customerEmail: string;
  saveCard: boolean;
  onProcessing: () => void;
  onSubmissionSuccess: (result: PayrocSuccessResult) => void;
  onSubmissionDeclined: (errorMessage: string) => void;
  onLoadError: (errorMessage: string) => void;
  onSurchargingAllowed: (message: string) => void;
  onSurchargingNotAllowed: () => void;
};

type SdkStatus = "loading" | "ready" | "loadError";

export function PayrocCheckOut({
  id,
  amount,
  description,
  customerEmail,
  saveCard,
  onProcessing,
  onSubmissionSuccess,
  onSubmissionDeclined,
  onLoadError,
  onSurchargingAllowed,
  onSurchargingNotAllowed,
}: Props) {
  const [status, setStatus] = useState<SdkStatus>("loading");
  const [error, setError] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardFormRef = useRef<any>(null);
  const initRef = useRef(false);
  const submittedRef = useRef(false);

  const chargeIdempotencyKeyRef = useRef<string | null>(null);
  const chargeOrderIdRef = useRef<string | null>(null);

  // Mirror props to refs so SDK event closures always read current values
  const amountRef = useRef(amount);
  const descriptionRef = useRef(description);
  const customerEmailRef = useRef(customerEmail);
  const saveCardRef = useRef(saveCard);
  amountRef.current = amount;
  descriptionRef.current = description;
  customerEmailRef.current = customerEmail;
  saveCardRef.current = saveCard;

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        console.log("[HF] Fetching session...");
        const res = await fetch("/api/payroc/session", { cache: "no-store" });
        const data = await res.json();
        if (!data.sessionToken) {
          console.error("[HF] No session token:", data);
          if (!cancelled) {
            setStatus("loadError");
            setError("No session token received");
            onLoadError("No session token received");
          }
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
        if (cancelled) return;
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
          if (submittedRef.current) {
            console.warn("[HF] submissionSuccess fired again — ignoring duplicate");
            return;
          }
          submittedRef.current = true;

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

          onProcessing();

          if (!chargeIdempotencyKeyRef.current) {
            chargeIdempotencyKeyRef.current = crypto.randomUUID();
          }
          if (!chargeOrderIdRef.current) {
            chargeOrderIdRef.current = crypto.randomUUID().slice(0, 8).toUpperCase();
          }

          const amt = parseFloat(amountRef.current) || 0;
          if (amt <= 0) {
            onSubmissionDeclined("Enter an amount first");
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
                orderId: chargeOrderIdRef.current,
                chargeIdempotencyKey: chargeIdempotencyKeyRef.current,
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
              onSubmissionSuccess({
                paymentId: result.paymentId || "",
                approvalCode: result.approvalCode || "",
                last4: result.last4 || "",
                savedCardConfirmed: Boolean(result.savedCardId),
              });
            } else {
              onSubmissionDeclined(result.declineReason || result.error || "Declined");
            }
          } catch {
            onSubmissionDeclined("Network error");
          }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("submissionError", (evt: any) => {
          console.error("[HF] submissionError:", evt);
          onSubmissionDeclined(evt?.message || "Payment submission failed. Please try again.");
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
                  : "Card submission failed. Please try again.";
            onSubmissionDeclined(userMessage);
          } else if (errType === "init") {
            setStatus("loadError");
            setError("Payment fields failed to load. Please refresh.");
            onLoadError("Payment fields failed to load. Please refresh.");
          } else if (errType === "config") {
            console.error("[HF] CONFIG ERROR — this is a code bug:", errMessage);
            setStatus("loadError");
            setError("Payment system configuration error. Please refresh.");
            onLoadError("Payment system configuration error. Please refresh.");
          }
        });

        cardForm.on("ready", () => {
          console.log("[HF] Fields ready");
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardForm.on("surcharge-info", (evt: any) => {
          console.log("[HF] Surcharge info:", evt);
        });

        cardForm.on("surchargingAllowed", (evt: { percentage: number; disclosure: string }) => {
          console.log("[HF] Surcharging allowed:", evt);
          onSurchargingAllowed(evt.disclosure);
        });

        cardForm.on("surchargingNotAllowed", () => {
          console.log("[HF] Surcharging not allowed");
          onSurchargingNotAllowed();
        });

        cardForm.initialize();
        console.log("[HF] Initialized");
        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("[HF] Init failed:", err);
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load payment form";
          setStatus("loadError");
          setError(msg);
          onLoadError(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
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

  return (
    <div id={id}>
      {status === "loadError" && (
        <div className="flex flex-col items-center py-8">
          <p className="text-sm text-[#ef4444] mb-3">{error || "Failed to load payment fields"}</p>
          <button onClick={() => window.location.reload()} className="text-sm text-[#017ea7] underline cursor-pointer">
            Refresh page
          </button>
        </div>
      )}

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

      <p className="flex items-center gap-1.5 text-[11px] text-[#878787] mt-4">
        <Lock size={10} strokeWidth={1.5} /> 256-bit encrypted · Powered by SalonTransact
      </p>
    </div>
  );
}
