"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface Props {
  signedToken: string;
  merchantName: string;
  customerName: string | null;
}

type Status = "loading" | "ready" | "submitting" | "success" | "error" | "loadError";

export function CardEntryClient({ signedToken, merchantName, customerName }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formRef = useRef<any>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/card-entry-tokens/${encodeURIComponent(signedToken)}/session`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.sessionToken) {
          setErrorMsg(data.error ?? "Failed to load card form");
          setStatus("loadError");
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(window as any).Payroc) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = data.libUrl;
            if (data.integrity) { s.integrity = data.integrity; s.crossOrigin = "anonymous"; }
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Card form failed to load"));
            document.head.appendChild(s);
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Payroc = (window as any).Payroc;
        const cardForm = new Payroc.hostedFields({
          sessionToken: data.sessionToken,
          mode: "tokenization",
          fields: {
            card: {
              cardholderName: { target: ".ce-cardholder", placeholder: "Name on card" },
              cardNumber: { target: ".ce-cardnumber", placeholder: "Card number" },
              expiryDate: { target: ".ce-expiry", placeholder: "MM/YY" },
              cvv: { target: ".ce-cvv", placeholder: "CVV" },
            },
          },
        });

        await cardForm.init();
        formRef.current = cardForm;
        setStatus("ready");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Failed to load");
        setStatus("loadError");
      }
    })();
  }, [signedToken]);

  async function handleSubmit() {
    if (!formRef.current || status !== "ready") return;
    setStatus("submitting");
    setErrorMsg(null);

    try {
      const result = await formRef.current.getPaymentToken();
      if (!result?.token) {
        setErrorMsg("Card could not be processed. Please try again.");
        setStatus("ready");
        return;
      }

      const res = await fetch(`/api/card-entry-tokens/${encodeURIComponent(signedToken)}/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostedFieldsToken: result.token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to save card");
        setStatus("ready");
        return;
      }
      setStatus("success");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed");
      setStatus("ready");
    }
  }

  const greeting = customerName ? `Hi ${customerName}` : "Hi there";

  return (
    <main style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ maxWidth: 440, width: "100%" }}>
        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#E6F4F8", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <CreditCard size={24} color="#017ea7" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1A1313", marginBottom: 4, letterSpacing: "-0.31px" }}>{merchantName}</h1>
          <p style={{ fontSize: 14, color: "#878787", margin: 0 }}>Secure card on file</p>
        </div>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: "#D1FAE5", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <CheckCircle2 size={32} color="#15803D" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", marginBottom: 8 }}>Card saved!</h2>
            <p style={{ fontSize: 14, color: "#878787" }}>{merchantName} will be in touch about your appointment. You can close this page.</p>
          </div>
        ) : status === "loadError" ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <AlertCircle size={32} color="#DC2626" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: "#DC2626" }}>{errorMsg ?? "Failed to load card form"}</p>
          </div>
        ) : (
          <div style={{ background: "#FFFFFF", border: "1px solid #E8EAED", borderRadius: 12, padding: 24 }}>
            <p style={{ fontSize: 14, color: "#4A4A4A", marginBottom: 20, lineHeight: 1.5 }}>
              {greeting}, please enter your card details below. Your card will be securely saved for your appointment with {merchantName}.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>Name on card</label>
                <div className="ce-cardholder" style={{ minHeight: 44, border: "1px solid #E8EAED", borderRadius: 8, background: "#F4F5F7", overflow: "hidden" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>Card number</label>
                <div className="ce-cardnumber" style={{ minHeight: 44, border: "1px solid #E8EAED", borderRadius: 8, background: "#F4F5F7", overflow: "hidden" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>Expiry</label>
                  <div className="ce-expiry" style={{ minHeight: 44, border: "1px solid #E8EAED", borderRadius: 8, background: "#F4F5F7", overflow: "hidden" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>CVV</label>
                  <div className="ce-cvv" style={{ minHeight: 44, border: "1px solid #E8EAED", borderRadius: 8, background: "#F4F5F7", overflow: "hidden" }} />
                </div>
              </div>
            </div>

            {errorMsg && <p style={{ fontSize: 13, color: "#DC2626", marginBottom: 12 }}>{errorMsg}</p>}

            <button
              onClick={handleSubmit}
              disabled={status !== "ready"}
              style={{
                width: "100%", height: 48, background: "#017ea7", color: "#FFFFFF", border: "1px solid #015f80", borderRadius: 8,
                fontSize: 15, fontWeight: 600, cursor: status === "ready" ? "pointer" : "wait",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: status === "ready" ? 1 : 0.6,
              }}
            >
              {status === "loading" || status === "submitting" ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
              {status === "loading" ? "Loading…" : status === "submitting" ? "Saving…" : "Save Card"}
            </button>

            <p style={{ fontSize: 11, color: "#878787", textAlign: "center", marginTop: 12 }}>
              Your card details are encrypted and securely processed. They never touch {merchantName}&apos;s servers.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
