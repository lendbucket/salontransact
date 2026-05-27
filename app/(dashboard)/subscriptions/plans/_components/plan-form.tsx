"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaxPreview } from "./tax-preview";
import { AlertTriangle } from "lucide-react";

interface PlanFormValues {
  name: string;
  description: string;
  amountCents: number;
  currency: string;
  taxable: boolean;
  interval: "WEEKLY" | "MONTHLY" | "ANNUAL";
  intervalCount: number;
  trialDays: number | null;
  publicSignupEnabled: boolean;
  publicSignupSlug: string;
}

interface PlanFormProps {
  mode: "new" | "edit";
  initialValues?: Partial<PlanFormValues>;
  immutableFieldsDisabled?: boolean;
  merchantTaxRateBasisPoints: number;
  merchantTaxEnabled: boolean;
  merchantTaxJurisdiction: string | null;
  onSubmit: (data: PlanFormValues) => Promise<void>;
  onCancel: () => void;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

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

export function PlanForm({
  mode,
  initialValues,
  immutableFieldsDisabled = false,
  merchantTaxRateBasisPoints,
  merchantTaxEnabled,
  merchantTaxJurisdiction,
  onSubmit,
  onCancel,
}: PlanFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? ""
  );
  const [amountDisplay, setAmountDisplay] = useState(
    initialValues?.amountCents ? (initialValues.amountCents / 100).toFixed(2) : ""
  );
  const [taxable, setTaxable] = useState(initialValues?.taxable ?? true);
  const [interval, setInterval] = useState<"WEEKLY" | "MONTHLY" | "ANNUAL">(
    initialValues?.interval ?? "MONTHLY"
  );
  const [intervalCount, setIntervalCount] = useState(
    initialValues?.intervalCount ?? 1
  );
  const [trialDays, setTrialDays] = useState<string>(
    initialValues?.trialDays != null ? String(initialValues.trialDays) : ""
  );
  const [publicSignupEnabled, setPublicSignupEnabled] = useState(
    initialValues?.publicSignupEnabled ?? false
  );
  const [slug, setSlug] = useState(initialValues?.publicSignupSlug ?? "");
  const [userEditedSlug, setUserEditedSlug] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-derive slug from name on new form
  useEffect(() => {
    if (mode === "new" && !userEditedSlug && name) {
      setSlug(toSlug(name));
    }
  }, [name, mode, userEditedSlug]);

  const amountCents = Math.round(parseFloat(amountDisplay || "0") * 100);

  const intervalLabel = interval.toLowerCase();
  const intervalSuffix = intervalCount > 1 ? "s" : "";

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Plan name is required";
    if (!amountDisplay || amountCents < 1)
      errs.amount = "Amount must be at least $0.01";
    if (amountCents > 100_000_000)
      errs.amount = "Amount cannot exceed $1,000,000.00";
    if (intervalCount < 1 || intervalCount > 365)
      errs.intervalCount = "Must be between 1 and 365";
    if (trialDays !== "") {
      const td = parseInt(trialDays, 10);
      if (!Number.isFinite(td) || td < 1 || td > 365)
        errs.trialDays = "Must be between 1 and 365";
    }
    if (description.length > 1000) errs.description = "Max 1000 characters";
    if (publicSignupEnabled && slug.length > 100)
      errs.slug = "Max 100 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        amountCents,
        currency: "usd",
        taxable,
        interval,
        intervalCount,
        trialDays: trialDays ? parseInt(trialDays, 10) : null,
        publicSignupEnabled,
        publicSignupSlug: publicSignupEnabled ? slug : "",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {immutableFieldsDisabled && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: 12,
            background: "#FEF3C7",
            border: "1px solid #F59E0B",
            borderRadius: 8,
            marginBottom: 24,
            fontSize: 13,
            color: "#92400E",
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            This plan has active subscribers. Pricing and interval cannot be
            changed. Archive this plan and create a new one to change these
            values.
          </span>
        </div>
      )}

      {/* Plan name */}
      <Input
        label="Plan name"
        placeholder="e.g., Gold Membership"
        value={name}
        onChange={(e) => setName(e.target.value)}
        errorText={errors.name}
        required
      />

      {/* Description */}
      <div style={{ marginTop: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: "#1A1313",
            marginBottom: 6,
            letterSpacing: "-0.31px",
          }}
        >
          Description
        </label>
        <textarea
          placeholder="Optional description shown to customers"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={3}
          className="st-input st-input-mobile"
          style={{
            width: "100%",
            padding: 12,
            background: "#F4F5F7",
            border: `1px solid ${errors.description ? "#FCA5A5" : "#E8EAED"}`,
            borderRadius: 8,
            fontSize: 14,
            color: "#1A1313",
            outline: "none",
            resize: "vertical",
          }}
        />
        {errors.description && (
          <p style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>
            {errors.description}
          </p>
        )}
        <p style={{ fontSize: 12, color: "#878787", marginTop: 4 }}>
          {description.length}/1000
        </p>
      </div>

      {/* ── Pricing ── */}
      <p style={sectionLabelStyle}>Pricing</p>

      <Input
        label="Amount"
        placeholder="25.00"
        type="number"
        step="0.01"
        min="0.01"
        value={amountDisplay}
        onChange={(e) => setAmountDisplay(e.target.value)}
        errorText={errors.amount}
        helperText="What the customer pays per billing period"
        disabled={immutableFieldsDisabled}
        leadingIcon={<span style={{ fontSize: 14, color: "#878787" }}>$</span>}
        required
      />

      <div style={{ marginTop: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: "#1A1313",
            marginBottom: 6,
            letterSpacing: "-0.31px",
          }}
        >
          Currency
        </label>
        <select style={{ ...selectStyle, opacity: 0.55, cursor: "not-allowed" }} disabled value="usd">
          <option value="usd">USD</option>
        </select>
      </div>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          id="taxable"
          checked={taxable}
          onChange={(e) => setTaxable(e.target.checked)}
          disabled={immutableFieldsDisabled}
          style={{ width: 16, height: 16, accentColor: "#017ea7" }}
        />
        <label htmlFor="taxable" style={{ fontSize: 14, color: "#1A1313" }}>
          Apply merchant tax rate to this plan
        </label>
      </div>
      <p style={{ fontSize: 12, color: "#878787", marginTop: 4, marginLeft: 24 }}>
        {merchantTaxEnabled
          ? `Current rate: ${merchantTaxRateBasisPoints / 100}%${merchantTaxJurisdiction ? ` (${merchantTaxJurisdiction})` : ""}`
          : "Merchant has no tax configured (set in Settings)"}
      </p>

      {amountCents > 0 && (
        <div style={{ marginTop: 16 }}>
          <TaxPreview
            amountCents={amountCents}
            taxable={taxable}
            merchantTaxEnabled={merchantTaxEnabled}
            merchantTaxRateBasisPoints={merchantTaxRateBasisPoints}
            merchantTaxJurisdiction={merchantTaxJurisdiction}
          />
        </div>
      )}

      {/* ── Schedule ── */}
      <p style={sectionLabelStyle}>Schedule</p>

      <div style={{ marginTop: 0 }}>
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: "#1A1313",
            marginBottom: 6,
            letterSpacing: "-0.31px",
          }}
        >
          Interval
        </label>
        <select
          style={{
            ...selectStyle,
            ...(immutableFieldsDisabled
              ? { opacity: 0.55, cursor: "not-allowed" }
              : {}),
          }}
          disabled={immutableFieldsDisabled}
          value={interval}
          onChange={(e) =>
            setInterval(e.target.value as "WEEKLY" | "MONTHLY" | "ANNUAL")
          }
        >
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="ANNUAL">Annual</option>
        </select>
      </div>

      <div style={{ marginTop: 16 }}>
        <Input
          label="Every"
          type="number"
          min={1}
          max={365}
          value={String(intervalCount)}
          onChange={(e) => setIntervalCount(parseInt(e.target.value, 10) || 1)}
          errorText={errors.intervalCount}
          helperText={`${intervalCount} ${intervalLabel}${intervalSuffix}`}
          disabled={immutableFieldsDisabled}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <Input
          label="Trial days"
          type="number"
          min={1}
          max={365}
          placeholder=""
          value={trialDays}
          onChange={(e) => setTrialDays(e.target.value)}
          errorText={errors.trialDays}
          helperText="Free days before first charge. Leave blank for no trial."
        />
      </div>

      {/* ── Public signup ── */}
      <p style={sectionLabelStyle}>Public Signup</p>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          id="publicSignupEnabled"
          checked={publicSignupEnabled}
          onChange={(e) => setPublicSignupEnabled(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "#017ea7" }}
        />
        <label
          htmlFor="publicSignupEnabled"
          style={{ fontSize: 14, color: "#1A1313" }}
        >
          Enable public signup URL
        </label>
      </div>
      <p style={{ fontSize: 12, color: "#878787", marginTop: 4, marginLeft: 24 }}>
        Customers can subscribe via a public URL
      </p>

      {publicSignupEnabled && (
        <div style={{ marginTop: 16 }}>
          <Input
            label="Public URL slug"
            placeholder="gold-membership"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              if (mode === "new") setUserEditedSlug(true);
            }}
            errorText={errors.slug}
            helperText={`Subscribe URL: portal.salontransact.com/subscribe/${slug || "..."}`}
            maxLength={100}
          />
        </div>
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
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button loading={submitting} onClick={handleSubmit}>
          {mode === "new" ? "Create Plan" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
