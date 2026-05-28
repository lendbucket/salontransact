"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Search,
  ChevronLeft,
  CreditCard,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { TaxPreview } from "../../plans/_components/tax-preview";
import { fmtMoney } from "@/lib/subscriptions/format";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface PlanOption {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  taxable: boolean;
  interval: "WEEKLY" | "MONTHLY" | "ANNUAL";
  intervalCount: number;
  trialDays: number | null;
  status: string;
}

interface CustomerOption {
  id: string;
  email: string;
  name: string | null;
  savedCardCount: number;
}

interface SavedCardOption {
  id: string;
  last4: string | null;
  cardScheme: string | null;
  expiryMonth: string | null;
  expiryYear: string | null;
  label: string | null;
  status: string;
}

interface Props {
  merchantTaxRateBasisPoints: number;
  merchantTaxEnabled: boolean;
  merchantTaxJurisdiction: string | null;
  merchantBusinessName: string;
}

// ─────────────────────────────────────────────────────────────────
// Styles (mirror plan-form.tsx)
// ─────────────────────────────────────────────────────────────────

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#878787",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 32,
  marginBottom: 12,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  paddingLeft: 12,
  paddingRight: 12,
  background: "#F4F5F7",
  border: "1px solid #E8EAED",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 400,
  color: "#1A1313",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "#1A1313",
  marginBottom: 6,
  letterSpacing: "-0.31px",
};

// ─────────────────────────────────────────────────────────────────
// Day-of-year helpers for ANNUAL anchor
// ─────────────────────────────────────────────────────────────────

// Month options with their day counts in a NON-leap reference year.
// We deliberately use a non-leap year (2025) for day-of-year conversion
// so the stored anchorDay is stable. The billing engine's dayOfYearToDate
// will render day 60 as Feb 29 in leap years and Mar 1 in non-leap years
// — see the leap-year footnote shown in the UI.
const MONTHS = [
  { value: 1, label: "January", days: 31 },
  { value: 2, label: "February", days: 28 },
  { value: 3, label: "March", days: 31 },
  { value: 4, label: "April", days: 30 },
  { value: 5, label: "May", days: 31 },
  { value: 6, label: "June", days: 30 },
  { value: 7, label: "July", days: 31 },
  { value: 8, label: "August", days: 31 },
  { value: 9, label: "September", days: 30 },
  { value: 10, label: "October", days: 31 },
  { value: 11, label: "November", days: 30 },
  { value: 12, label: "December", days: 31 },
];

// Convert month (1-12) + day (1-31) to day-of-year using non-leap
// reference. Jan 1 = 1. Dec 31 = 365.
function monthDayToDayOfYear(month: number, day: number): number {
  let doy = 0;
  for (let m = 0; m < month - 1; m++) {
    doy += MONTHS[m].days;
  }
  return doy + day;
}

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

export function NewSubscriptionClient({
  merchantTaxRateBasisPoints,
  merchantTaxEnabled,
  merchantTaxJurisdiction,
  merchantBusinessName,
}: Props) {
  const router = useRouter();

  // Plans
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  // Customer search
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  // Saved cards
  const [cards, setCards] = useState<SavedCardOption[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState("");

  // Schedule
  const [trialDays, setTrialDays] = useState<string>("");
  const [monthlyAnchor, setMonthlyAnchor] = useState(1);
  const [weeklyAnchor, setWeeklyAnchor] = useState(1);
  const [annualMonth, setAnnualMonth] = useState(1);
  const [annualDay, setAnnualDay] = useState(1);

  // Mandate
  const [mandateAgreed, setMandateAgreed] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = useCallback(
    (kind: "success" | "error", message: string) => {
      setToast({ kind, message });
      setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  // ─── Load plans on mount ──────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPlansLoading(true);
      try {
        const res = await fetch("/api/subscription-plans");
        if (!res.ok) {
          if (!cancelled)
            showToast("error", `Failed to load plans (${res.status})`);
          return;
        }
        const json = (await res.json()) as { plans?: PlanOption[] };
        if (!cancelled) {
          // Only active plans can take new subscriptions
          setPlans(
            (json.plans ?? []).filter((p) => p.status === "active"),
          );
        }
      } catch (e) {
        if (!cancelled)
          showToast(
            "error",
            e instanceof Error ? e.message : "Failed to load plans",
          );
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // ─── Debounce customer search ─────────────────────────────────

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(customerSearch.trim()),
      300,
    );
    return () => clearTimeout(t);
  }, [customerSearch]);

  // ─── Run customer search ──────────────────────────────────────

  useEffect(() => {
    // Don't search if a customer is already selected and the search box
    // matches their display (avoids re-searching after selection).
    if (selectedCustomer) return;
    if (debouncedSearch.length === 0) {
      setCustomerResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setCustomerSearching(true);
      try {
        const params = new URLSearchParams({ search: debouncedSearch });
        const res = await fetch(`/api/customers?${params.toString()}`);
        if (!res.ok) {
          if (!cancelled)
            showToast(
              "error",
              `Customer search failed (${res.status})`,
            );
          return;
        }
        const json = (await res.json()) as {
          data?: Array<{
            id: string;
            email: string;
            name: string | null;
            savedCardCount: number;
          }>;
        };
        if (!cancelled) {
          setCustomerResults(
            (json.data ?? []).map((c) => ({
              id: c.id,
              email: c.email,
              name: c.name,
              savedCardCount: c.savedCardCount,
            })),
          );
        }
      } catch (e) {
        if (!cancelled)
          showToast(
            "error",
            e instanceof Error ? e.message : "Search failed",
          );
      } finally {
        if (!cancelled) setCustomerSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, selectedCustomer, showToast]);

  // ─── Load saved cards when customer selected ──────────────────

  useEffect(() => {
    if (!selectedCustomer) {
      setCards([]);
      setSelectedCardId("");
      return;
    }
    let cancelled = false;
    (async () => {
      setCardsLoading(true);
      try {
        const params = new URLSearchParams({
          customerEmail: selectedCustomer.email,
        });
        const res = await fetch(`/api/saved-cards?${params.toString()}`);
        if (!res.ok) {
          if (!cancelled)
            showToast(
              "error",
              `Failed to load cards (${res.status})`,
            );
          return;
        }
        const json = (await res.json()) as {
          data?: Array<{
            id: string;
            last4: string | null;
            cardScheme: string | null;
            expiryMonth: string | null;
            expiryYear: string | null;
            label: string | null;
            status: string;
          }>;
        };
        if (!cancelled) {
          const activeCards = (json.data ?? []).filter(
            (c) => c.status === "active",
          );
          setCards(activeCards);
          // Auto-select if exactly one card
          if (activeCards.length === 1)
            setSelectedCardId(activeCards[0].id);
        }
      } catch (e) {
        if (!cancelled)
          showToast(
            "error",
            e instanceof Error ? e.message : "Failed to load cards",
          );
      } finally {
        if (!cancelled) setCardsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCustomer, showToast]);

  // ─── Default trial days from selected plan ────────────────────

  useEffect(() => {
    if (selectedPlan && selectedPlan.trialDays != null) {
      setTrialDays(String(selectedPlan.trialDays));
    } else {
      setTrialDays("");
    }
  }, [selectedPlan]);

  // ─── Compute anchorDay based on plan interval ─────────────────

  const computedAnchorDay = useMemo(() => {
    if (!selectedPlan) return 1;
    if (selectedPlan.interval === "MONTHLY") return monthlyAnchor;
    if (selectedPlan.interval === "WEEKLY") return weeklyAnchor;
    // ANNUAL
    return monthDayToDayOfYear(annualMonth, annualDay);
  }, [selectedPlan, monthlyAnchor, weeklyAnchor, annualMonth, annualDay]);

  // ─── Auto-generated mandate text ──────────────────────────────

  const mandateText = useMemo(() => {
    if (!selectedPlan) return "";
    const amount = fmtMoney(
      selectedPlan.amountCents * selectedPlan.intervalCount,
    );
    const cardDesc = (() => {
      const c = cards.find((card) => card.id === selectedCardId);
      if (!c) return "the selected card";
      return `card ending in ${c.last4 ?? "????"}`;
    })();
    const cadence = (() => {
      const unit =
        selectedPlan.interval === "MONTHLY"
          ? "month"
          : selectedPlan.interval === "WEEKLY"
            ? "week"
            : "year";
      return selectedPlan.intervalCount === 1
        ? `every ${unit}`
        : `every ${selectedPlan.intervalCount} ${unit}s`;
    })();
    const trialClause =
      trialDays && parseInt(trialDays, 10) > 0
        ? ` After a ${parseInt(trialDays, 10)}-day free trial,`
        : "";
    return (
      `I authorize ${merchantBusinessName} to charge ${amount} to my ${cardDesc} ` +
      `${cadence} for the "${selectedPlan.name}" subscription, plus applicable tax.` +
      `${trialClause}` +
      ` Charges will continue until I cancel. I understand I can cancel at any time.`
    );
  }, [
    selectedPlan,
    cards,
    selectedCardId,
    trialDays,
    merchantBusinessName,
  ]);

  // ─── Validation ───────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!selectedPlanId) errs.plan = "Select a plan";
    if (!selectedCustomer) errs.customer = "Select a customer";
    if (!selectedCardId) errs.card = "Select a payment method";
    if (trialDays !== "") {
      const td = parseInt(trialDays, 10);
      if (!Number.isFinite(td) || td < 1 || td > 365) {
        errs.trialDays = "Trial days must be between 1 and 365";
      }
    }
    if (selectedPlan) {
      if (
        selectedPlan.interval === "MONTHLY" &&
        (computedAnchorDay < 1 || computedAnchorDay > 28)
      ) {
        errs.anchor = "Monthly anchor day must be 1-28";
      }
      if (
        selectedPlan.interval === "WEEKLY" &&
        (computedAnchorDay < 0 || computedAnchorDay > 6)
      ) {
        errs.anchor = "Invalid weekday";
      }
      if (
        selectedPlan.interval === "ANNUAL" &&
        (computedAnchorDay < 1 || computedAnchorDay > 365)
      ) {
        errs.anchor = "Invalid date";
      }
    }
    if (!mandateAgreed)
      errs.mandate =
        "Customer must agree to the recurring charge authorization";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── Submit ───────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validate()) {
      showToast("error", "Please fix the errors before submitting");
      return;
    }
    if (!selectedPlan || !selectedCustomer) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        planId: selectedPlanId,
        customerId: selectedCustomer.id,
        savedCardId: selectedCardId,
        source: "master_portal",
        mandateText,
        anchorDay: computedAnchorDay,
        mandateUserAgent:
          typeof navigator !== "undefined"
            ? navigator.userAgent.slice(0, 500)
            : undefined,
      };
      const td = trialDays ? parseInt(trialDays, 10) : 0;
      if (td > 0) body.trialDays = td;

      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 201) {
        const json = (await res.json()) as {
          subscription: { id: string };
        };
        showToast("success", "Subscription created");
        router.push(`/subscriptions/all/${json.subscription.id}`);
        return;
      }

      const json = await res.json().catch(() => null);
      showToast(
        "error",
        (json as { error?: string } | null)?.error ??
          `Failed to create subscription (${res.status})`,
      );
    } catch (e) {
      showToast(
        "error",
        e instanceof Error ? e.message : "Failed to create subscription",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────

  const daysInSelectedMonth = MONTHS[annualMonth - 1]?.days ?? 31;

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Back link */}
      <Link
        href="/subscriptions/all"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 13,
          color: "#878787",
          textDecoration: "none",
          marginBottom: 12,
        }}
      >
        <ChevronLeft size={14} />
        All subscriptions
      </Link>

      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#1A1313",
          letterSpacing: "-0.31px",
          margin: "0 0 8px",
        }}
      >
        New Subscription
      </h2>
      <p style={{ fontSize: 13, color: "#878787", marginBottom: 8 }}>
        Create a recurring subscription for an existing customer with a
        saved card.
      </p>

      {/* ── Plan ── */}
      <p style={sectionLabelStyle}>Plan</p>
      {plansLoading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#878787",
            fontSize: 13,
          }}
        >
          <Loader2 size={14} className="animate-spin" /> Loading plans…
        </div>
      ) : plans.length === 0 ? (
        <div
          style={{
            padding: 12,
            background: "#FEF7E0",
            borderRadius: 8,
            fontSize: 13,
            color: "#B06000",
          }}
        >
          No active plans.{" "}
          <Link
            href="/subscriptions/plans/new"
            style={{ color: "#017ea7" }}
          >
            Create a plan
          </Link>{" "}
          first.
        </div>
      ) : (
        <>
          <select
            style={selectStyle}
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
          >
            <option value="">Select a plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {fmtMoney(p.amountCents)} /{" "}
                {p.intervalCount > 1 ? `${p.intervalCount} ` : ""}
                {p.interval === "MONTHLY"
                  ? "mo"
                  : p.interval === "WEEKLY"
                    ? "wk"
                    : "yr"}
              </option>
            ))}
          </select>
          {errors.plan && (
            <p
              style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}
            >
              {errors.plan}
            </p>
          )}
        </>
      )}

      {/* ── Customer ── */}
      <p style={sectionLabelStyle}>Customer</p>
      {selectedCustomer ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 12,
            background: "#E8F4F8",
            border: "1px solid #017ea7",
            borderRadius: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#1A1313",
              }}
            >
              {selectedCustomer.name ?? selectedCustomer.email}
            </div>
            {selectedCustomer.name && (
              <div style={{ fontSize: 12, color: "#878787" }}>
                {selectedCustomer.email}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setCustomerSearch("");
              setCustomerResults([]);
              setSelectedCardId("");
            }}
            style={{
              fontSize: 13,
              color: "#017ea7",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <Input
            leadingIcon={<Search size={14} />}
            placeholder="Search by email or name"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            autoComplete="off"
          />
          {errors.customer && (
            <p
              style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}
            >
              {errors.customer}
            </p>
          )}
          {customerSearching && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#878787",
                fontSize: 12,
                marginTop: 8,
              }}
            >
              <Loader2 size={12} className="animate-spin" /> Searching…
            </div>
          )}
          {!customerSearching &&
            debouncedSearch.length > 0 &&
            customerResults.length === 0 && (
              <div
                style={{
                  padding: 12,
                  marginTop: 8,
                  background: "#F9FAFB",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#878787",
                }}
              >
                No customers match. The customer must already exist with
                a saved card. Use the{" "}
                <Link href="/checkout" style={{ color: "#017ea7" }}>
                  checkout flow
                </Link>{" "}
                to charge them once and save a card first.
              </div>
            )}
          {customerResults.length > 0 && (
            <div
              style={{
                marginTop: 8,
                border: "1px solid #E8EAED",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {customerResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomer(c);
                    setCustomerResults([]);
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    padding: "10px 12px",
                    background: "white",
                    border: "none",
                    borderBottom: "1px solid #F4F5F7",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#1A1313",
                      }}
                    >
                      {c.name ?? c.email}
                    </div>
                    {c.name && (
                      <div style={{ fontSize: 11, color: "#878787" }}>
                        {c.email}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color:
                        c.savedCardCount > 0 ? "#1E8E3E" : "#B06000",
                    }}
                  >
                    {c.savedCardCount} card
                    {c.savedCardCount === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Payment method (shown once customer selected) ── */}
      {selectedCustomer && (
        <>
          <p style={sectionLabelStyle}>Payment Method</p>
          {cardsLoading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#878787",
                fontSize: 13,
              }}
            >
              <Loader2 size={14} className="animate-spin" /> Loading
              cards…
            </div>
          ) : cards.length === 0 ? (
            <div
              style={{
                padding: 12,
                background: "#FEF7E0",
                borderRadius: 8,
                fontSize: 13,
                color: "#B06000",
              }}
            >
              <AlertCircle
                size={14}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                  marginRight: 6,
                }}
              />
              This customer has no saved cards. Use the{" "}
              <Link href="/checkout" style={{ color: "#017ea7" }}>
                checkout flow
              </Link>{" "}
              to charge them once with &quot;save card&quot; enabled,
              then return here.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {cards.map((c) => {
                  const selected = selectedCardId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCardId(c.id)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: 12,
                        background: selected ? "#E8F4F8" : "white",
                        border: selected
                          ? "2px solid #017ea7"
                          : "1px solid #E8EAED",
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <CreditCard
                          size={18}
                          color={selected ? "#017ea7" : "#878787"}
                        />
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#1A1313",
                            }}
                          >
                            {c.cardScheme ?? "Card"} ····{" "}
                            {c.last4 ?? "????"}
                          </div>
                          <div
                            style={{ fontSize: 12, color: "#878787" }}
                          >
                            {c.label ? `${c.label} · ` : ""}
                            {c.expiryMonth && c.expiryYear
                              ? `Expires ${c.expiryMonth}/${c.expiryYear.slice(-2)}`
                              : "No expiry on file"}
                          </div>
                        </div>
                      </div>
                      {selected && (
                        <Check size={18} color="#017ea7" />
                      )}
                    </button>
                  );
                })}
              </div>
              {errors.card && (
                <p
                  style={{
                    fontSize: 12,
                    color: "#DC2626",
                    marginTop: 4,
                  }}
                >
                  {errors.card}
                </p>
              )}
            </>
          )}
        </>
      )}

      {/* ── Schedule (shown once plan selected) ── */}
      {selectedPlan && (
        <>
          <p style={sectionLabelStyle}>Schedule</p>

          {/* Trial days */}
          <Input
            label="Trial days"
            type="number"
            min={1}
            max={365}
            placeholder=""
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
            errorText={errors.trialDays}
            helperText={
              selectedPlan.trialDays != null
                ? `Plan default: ${selectedPlan.trialDays} days. Free days before first charge. Leave blank for no trial.`
                : "Free days before first charge. Leave blank for no trial."
            }
          />

          {/* Anchor — interval-aware */}
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Billing anchor</label>

            {selectedPlan.interval === "MONTHLY" && (
              <>
                <select
                  style={selectStyle}
                  value={monthlyAnchor}
                  onChange={(e) =>
                    setMonthlyAnchor(parseInt(e.target.value, 10))
                  }
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(
                    (d) => (
                      <option key={d} value={d}>
                        Day {d} of each month
                      </option>
                    ),
                  )}
                </select>
                <p
                  style={{
                    fontSize: 12,
                    color: "#878787",
                    marginTop: 4,
                  }}
                >
                  Billing recurs on this day each month. Limited to
                  1–28 so every month has the day.
                </p>
              </>
            )}

            {selectedPlan.interval === "WEEKLY" && (
              <>
                <select
                  style={selectStyle}
                  value={weeklyAnchor}
                  onChange={(e) =>
                    setWeeklyAnchor(parseInt(e.target.value, 10))
                  }
                >
                  {WEEKDAYS.map((w) => (
                    <option key={w.value} value={w.value}>
                      Every {w.label}
                    </option>
                  ))}
                </select>
                <p
                  style={{
                    fontSize: 12,
                    color: "#878787",
                    marginTop: 4,
                  }}
                >
                  Billing recurs on this weekday.
                </p>
              </>
            )}

            {selectedPlan.interval === "ANNUAL" && (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    style={{ ...selectStyle, flex: 2 }}
                    value={annualMonth}
                    onChange={(e) => {
                      const m = parseInt(e.target.value, 10);
                      setAnnualMonth(m);
                      // Clamp day if it exceeds the new month's day count
                      const maxDay = MONTHS[m - 1].days;
                      if (annualDay > maxDay) setAnnualDay(maxDay);
                    }}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <select
                    style={{ ...selectStyle, flex: 1 }}
                    value={annualDay}
                    onChange={(e) =>
                      setAnnualDay(parseInt(e.target.value, 10))
                    }
                  >
                    {Array.from(
                      { length: daysInSelectedMonth },
                      (_, i) => i + 1,
                    ).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "#878787",
                    marginTop: 4,
                  }}
                >
                  Billing recurs on this calendar day each year. In
                  leap years, dates on or after Feb 29 may shift by one
                  day.
                </p>
              </>
            )}
            {errors.anchor && (
              <p
                style={{
                  fontSize: 12,
                  color: "#DC2626",
                  marginTop: 4,
                }}
              >
                {errors.anchor}
              </p>
            )}
          </div>

          {/* Tax preview */}
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Amount per billing period</label>
            <TaxPreview
              amountCents={
                selectedPlan.amountCents * selectedPlan.intervalCount
              }
              taxable={selectedPlan.taxable}
              merchantTaxEnabled={merchantTaxEnabled}
              merchantTaxRateBasisPoints={merchantTaxRateBasisPoints}
              merchantTaxJurisdiction={merchantTaxJurisdiction}
            />
            {trialDays && parseInt(trialDays, 10) > 0 && (
              <p
                style={{
                  fontSize: 12,
                  color: "#878787",
                  marginTop: 8,
                }}
              >
                First charge occurs after the{" "}
                {parseInt(trialDays, 10)}-day trial.
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Mandate (shown once plan + customer + card selected) ── */}
      {selectedPlan && selectedCustomer && selectedCardId && (
        <>
          <p style={sectionLabelStyle}>Authorization</p>
          <div
            style={{
              padding: 12,
              background: "#F9FAFB",
              border: "1px solid #E8EAED",
              borderRadius: 8,
              fontSize: 13,
              color: "#4A4A4A",
              lineHeight: 1.5,
            }}
          >
            {mandateText}
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginTop: 12,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={mandateAgreed}
              onChange={(e) => setMandateAgreed(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: "#017ea7",
                marginTop: 2,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, color: "#1A1313" }}>
              The customer has read and agreed to this recurring charge
              authorization.
            </span>
          </label>
          {errors.mandate && (
            <p
              style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}
            >
              {errors.mandate}
            </p>
          )}
        </>
      )}

      {/* ── Submit ── */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 32,
          justifyContent: "flex-end",
        }}
      >
        <Button
          variant="secondary"
          onClick={() => router.push("/subscriptions/all")}
        >
          Cancel
        </Button>
        <Button
          loading={submitting}
          onClick={handleSubmit}
          disabled={
            !selectedPlan ||
            !selectedCustomer ||
            !selectedCardId ||
            !mandateAgreed
          }
        >
          Create Subscription
        </Button>
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            maxWidth: 400,
          }}
        >
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}
    </div>
  );
}
