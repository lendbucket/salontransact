"use client";

import { useState } from "react";
import { Loader2, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

type Props = {
  stripeAccountId: string | null;
  status: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingUrl: string | null;
};

export function StripeConnectCard({
  stripeAccountId,
  status,
  chargesEnabled,
  payoutsEnabled,
  onboardingUrl,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullyEnabled = chargesEnabled && payoutsEnabled;

  async function startOnboarding() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/stripe/connect", { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.url) {
      setError(data.error || "Failed to start onboarding");
      setLoading(false);
      return;
    }

    window.location.href = data.url;
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-white mb-1">
        Stripe Connect
      </h2>
      <p className="text-sm text-muted mb-6">
        Accept payments and receive payouts via Stripe
      </p>

      {stripeAccountId && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {chargesEnabled ? (
              <CheckCircle2 className="w-4 h-4" style={{ color: "#22c55e" }} />
            ) : (
              <AlertCircle className="w-4 h-4" style={{ color: "#f59e0b" }} />
            )}
            <span className="text-white">Charges</span>
            <span className="text-muted">
              {chargesEnabled ? "enabled" : "pending"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {payoutsEnabled ? (
              <CheckCircle2 className="w-4 h-4" style={{ color: "#22c55e" }} />
            ) : (
              <AlertCircle className="w-4 h-4" style={{ color: "#f59e0b" }} />
            )}
            <span className="text-white">Payouts</span>
            <span className="text-muted">
              {payoutsEnabled ? "enabled" : "pending"}
            </span>
          </div>
          <p className="text-xs text-muted pt-1">
            Account: <span className="font-mono">{stripeAccountId}</span> ·
            Status: {status}
          </p>
        </div>
      )}

      {error && (
        <div
          className="mb-4 text-sm rounded-md px-3 py-2"
          style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}
        >
          {error}
        </div>
      )}

      {!fullyEnabled && (
        <button
          onClick={startOnboarding}
          disabled={loading}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4" />
          )}
          {stripeAccountId ? "Continue onboarding" : "Connect Stripe Account"}
        </button>
      )}

      {fullyEnabled && (
        <p className="text-sm" style={{ color: "#22c55e" }}>
          Your Stripe account is fully connected and ready to accept payments.
        </p>
      )}

      {onboardingUrl && !stripeAccountId && (
        <p className="text-xs text-muted mt-2">
          Resume URL stored from a previous onboarding session.
        </p>
      )}
    </div>
  );
}
