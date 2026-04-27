"use client";

import type { PayrocAuthorization } from "@/lib/authorizations/types";

function fmtMoney(cents: number | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "\u2014";
  return `$${(cents / 100).toFixed(2)}`;
}

function statusPill(status: string | undefined): {
  bg: string;
  text: string;
} {
  const s = (status ?? "").toLowerCase();
  if (["approved", "authorized", "complete", "settled"].includes(s))
    return { bg: "#DCFCE7", text: "#15803D" };
  if (["pending", "processing", "open"].includes(s))
    return { bg: "#FEF3C7", text: "#92400E" };
  if (["declined", "voided", "expired", "reversed", "failed"].includes(s))
    return { bg: "#FEF2F2", text: "#DC2626" };
  return { bg: "#F4F5F7", text: "#4A4A4A" };
}

export default function AuthorizationCard({
  authorization: a,
  onClick,
}: {
  authorization: PayrocAuthorization;
  onClick?: () => void;
}) {
  const pill = statusPill(a.status);
  const cardLine =
    a.cardScheme && a.last4
      ? `${a.cardScheme} \u00B7\u00B7\u00B7\u00B7${a.last4}`
      : a.responseCode ?? a.approvalCode ?? "\u2014";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
      style={{ background: "none", border: "none" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p
            className="font-semibold tabular-nums"
            style={{ fontSize: 15, color: "#1A1313" }}
          >
            {fmtMoney(a.amount)}
          </p>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: pill.bg, color: pill.text }}
          >
            {a.status ?? "unknown"}
          </span>
        </div>
        <p className="truncate" style={{ fontSize: 13, color: "#4A4A4A" }}>
          {cardLine}
        </p>
        <p className="truncate mt-0.5" style={{ fontSize: 12, color: "#878787" }}>
          {a.date ?? "\u2014"}
        </p>
      </div>
    </button>
  );
}
