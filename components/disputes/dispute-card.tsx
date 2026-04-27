"use client";

import type { PayrocDispute } from "@/lib/disputes/types";

function fmtMoney(cents: number | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "\u2014";
  return `$${(cents / 100).toFixed(2)}`;
}

function statusPill(status: string | undefined): {
  bg: string;
  text: string;
} {
  const s = (status ?? "").toLowerCase();
  if (["won", "closed", "resolved", "accepted"].includes(s))
    return { bg: "#DCFCE7", text: "#15803D" };
  if (["open", "inquiry", "pending", "reviewing"].includes(s))
    return { bg: "#FEF3C7", text: "#92400E" };
  if (["lost", "expired", "declined"].includes(s))
    return { bg: "#FEF2F2", text: "#DC2626" };
  return { bg: "#F4F5F7", text: "#4A4A4A" };
}

export default function DisputeCard({
  dispute: d,
  onClick,
}: {
  dispute: PayrocDispute;
  onClick?: () => void;
}) {
  const pill = statusPill(d.status);

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
            {fmtMoney(d.amount)}
          </p>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: pill.bg, color: pill.text }}
          >
            {d.status ?? "unknown"}
          </span>
        </div>
        <p className="truncate" style={{ fontSize: 13, color: "#4A4A4A" }}>
          {d.reasonDescription ?? d.reasonCode ?? "\u2014"}
        </p>
        <p className="truncate mt-0.5" style={{ fontSize: 12, color: "#878787" }}>
          {d.date ?? "\u2014"}
        </p>
      </div>
    </button>
  );
}
