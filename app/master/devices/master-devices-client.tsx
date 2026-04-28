"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Smartphone,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  X,
  RefreshCw,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import type {
  MasterDeviceRow,
  MasterDeviceListResponse,
} from "@/lib/devices/types";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

type InstructionStatus = "inProgress" | "completed" | "canceled" | "failure";

interface InstructionResponse {
  status: InstructionStatus;
  paymentInstructionId: string;
  errorMessage?: string;
  link?: { rel: string; method: string; href: string };
}

type ChargePhase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "polling"; paymentInstructionId: string; startedAt: number }
  | { kind: "completed"; paymentInstructionId: string }
  | { kind: "failed"; message: string }
  | { kind: "canceled" };

interface ConfirmCharge {
  device: MasterDeviceRow;
  amountCents: number;
  amountDisplay: string;
  description: string;
  promptForTip: boolean;
  promptForSignature: boolean;
}

function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function fmtRelative(iso: string | null) {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function maskSerial(serial: string): string {
  if (serial.length <= 8) return serial;
  return `${serial.slice(0, 4)}\u2026${serial.slice(-4)}`;
}

function humanizeError(rawMessage: string): {
  title: string;
  body: string;
  hint: string | null;
} {
  let title = "Charge failed";
  let body = rawMessage;
  let hint: string | null = null;

  const lower = rawMessage.toLowerCase();

  const detailMatch = rawMessage.match(/"detail":"([^"]+)"/);
  const titleMatch = rawMessage.match(/"title":"([^"]+)"/);
  const messageMatch = rawMessage.match(/"message":"([^"]+)"/);

  if (titleMatch) title = titleMatch[1];
  if (detailMatch) {
    body = detailMatch[1];
    if (messageMatch && messageMatch[1] !== detailMatch[1]) {
      body = `${detailMatch[1]} ${messageMatch[1]}`;
    }
  }

  if (
    lower.includes("capability not supported") ||
    lower.includes("does not support sales")
  ) {
    title = "Terminal not configured for sales";
    body =
      "Payroc rejected the charge because the processing terminal is not enabled to run sale transactions.";
    hint =
      "Contact your Payroc Integration Engineer to enable Sales capability on the merchant\u2019s processing terminal.";
  } else if (lower.includes("missing required field")) {
    title = "Charge rejected by Payroc";
    body =
      "Payroc returned a \u2018missing required field\u2019 error. This usually means a parameter was malformed.";
    hint =
      "Try again. If it persists, check Vercel logs for [PAYROC-REQ] to see what was sent.";
  } else if (
    lower.includes("device not found") ||
    lower.includes("device offline") ||
    lower.includes("no terminal connected")
  ) {
    title = "Terminal not reachable";
    body =
      "The Pax terminal isn\u2019t responding. It may be offline, asleep, or no longer paired.";
    hint =
      "Wake the terminal screen and confirm it shows the Payroc app. Then try again.";
  } else if (lower.includes("timed out") || lower.includes("timeout")) {
    title = "Customer didn\u2019t complete";
    body =
      "We waited 5 minutes for the customer to complete the charge at the terminal but never got a response.";
    hint = "If the customer walked away, you can send another charge.";
  } else if (lower.includes("idempotency")) {
    title = "Duplicate request blocked";
    body =
      "Payroc detected a duplicate request. This usually means you submitted the same charge twice in quick succession.";
    hint = "Wait a moment and try again with a fresh charge.";
  }

  return { title, body, hint };
}

interface Props {
  initialDevices: MasterDeviceRow[];
  allMerchants: { id: string; businessName: string }[];
  scopedMerchantId: string | null;
  scopedMerchant: {
    id: string;
    businessName: string;
    city: string | null;
    state: string | null;
  } | null;
}

export function MasterDevicesClient({
  initialDevices,
  allMerchants,
  scopedMerchantId,
  scopedMerchant,
}: Props) {
  const [devices, setDevices] = useState<MasterDeviceRow[]>(initialDevices);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [pairOpen, setPairOpen] = useState(false);
  const [pairSerial, setPairSerial] = useState("");
  const [pairModel, setPairModel] = useState("");
  const [pairLabel, setPairLabel] = useState("");
  const [pairMerchantId, setPairMerchantId] = useState<string>(
    scopedMerchantId ?? ""
  );
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);

  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  const [chargeForm, setChargeForm] = useState<{
    [deviceId: string]: {
      amount: string;
      description: string;
      promptForTip: boolean;
      promptForSignature: boolean;
    };
  }>({});
  const [chargePhase, setChargePhase] = useState<{
    [deviceId: string]: ChargePhase;
  }>({});
  const pollRef = useRef<{ [deviceId: string]: ReturnType<typeof setInterval> }>(
    {}
  );
  const [confirmCharge, setConfirmCharge] = useState<ConfirmCharge | null>(null);

  const showToast = useCallback(
    (kind: "success" | "error" | "info", message: string) => {
      setToast({ kind, message });
      setTimeout(() => setToast(null), 4000);
    },
    []
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (scopedMerchantId) params.set("merchantId", scopedMerchantId);
      const res = await fetch(`/api/master/devices?${params.toString()}`);
      if (!res.ok) {
        showToast("error", "Failed to reload devices");
        return;
      }
      const json = (await res.json()) as MasterDeviceListResponse;
      setDevices(json.data);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Reload failed");
    } finally {
      setLoading(false);
    }
  }, [scopedMerchantId, showToast]);

  useEffect(() => {
    return () => {
      Object.values(pollRef.current).forEach((t) => clearInterval(t));
    };
  }, []);

  useEffect(() => {
    function handleFocus() { reload(); }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [reload]);

  async function handlePair() {
    if (!pairSerial.trim()) {
      setPairError("Serial number required");
      return;
    }
    if (!pairMerchantId) {
      setPairError("Select a merchant");
      return;
    }
    setPairing(true);
    setPairError(null);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serialNumber: pairSerial.trim(),
          model: pairModel.trim() || undefined,
          label: pairLabel.trim() || undefined,
          merchantId: pairMerchantId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPairError(json.error ?? `Pair failed (${res.status})`);
        return;
      }
      setPairSerial("");
      setPairModel("");
      setPairLabel("");
      setPairOpen(false);
      showToast("success", "Device paired successfully");
      await reload();
    } catch (e) {
      setPairError(e instanceof Error ? e.message : "Pair failed");
    } finally {
      setPairing(false);
    }
  }

  async function handleRetire(device: MasterDeviceRow) {
    if (
      !confirm(
        `Retire device ${maskSerial(device.serialNumber)} from ${device.merchantBusinessName}?`
      )
    )
      return;
    try {
      const res = await fetch(`/api/devices/${device.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", j.error ?? `Retire failed (${res.status})`);
        return;
      }
      showToast("success", "Device retired");
      await reload();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Retire failed");
    }
  }

  function getForm(deviceId: string) {
    return (
      chargeForm[deviceId] ?? {
        amount: "",
        description: "",
        promptForTip: false,
        promptForSignature: false,
      }
    );
  }

  function setForm(
    deviceId: string,
    next: Partial<{
      amount: string;
      description: string;
      promptForTip: boolean;
      promptForSignature: boolean;
    }>
  ) {
    setChargeForm((prev) => ({
      ...prev,
      [deviceId]: { ...getForm(deviceId), ...next },
    }));
  }

  function getPhase(deviceId: string): ChargePhase {
    return chargePhase[deviceId] ?? { kind: "idle" };
  }
  function setPhase(deviceId: string, next: ChargePhase) {
    setChargePhase((prev) => ({ ...prev, [deviceId]: next }));
  }

  function requestCharge(device: MasterDeviceRow) {
    const form = getForm(device.id);
    const amountCents = Math.round(parseFloat(form.amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 1) {
      showToast("error", "Enter a valid amount");
      return;
    }
    setConfirmCharge({
      device,
      amountCents,
      amountDisplay: fmtMoney(amountCents),
      description: form.description,
      promptForTip: form.promptForTip,
      promptForSignature: form.promptForSignature,
    });
  }

  async function executeConfirmedCharge() {
    if (!confirmCharge) return;
    const {
      device,
      amountCents,
      description,
      promptForTip,
      promptForSignature,
    } = confirmCharge;
    setConfirmCharge(null);
    setPhase(device.id, { kind: "submitting" });
    try {
      const res = await fetch(`/api/devices/${device.id}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountCents,
          description: description || undefined,
          promptForTip,
          promptForSignature,
          autoCapture: true,
          processAsSale: true,
        }),
      });
      const json = (await res.json()) as InstructionResponse & {
        error?: string;
      };
      if (!res.ok) {
        setPhase(device.id, {
          kind: "failed",
          message: json.error ?? `Submit failed (${res.status})`,
        });
        return;
      }
      if (json.status === "completed") {
        setPhase(device.id, {
          kind: "completed",
          paymentInstructionId: json.paymentInstructionId,
        });
        return;
      }
      setPhase(device.id, {
        kind: "polling",
        paymentInstructionId: json.paymentInstructionId,
        startedAt: Date.now(),
      });
      startPolling(device.id, json.paymentInstructionId);
    } catch (e) {
      setPhase(device.id, {
        kind: "failed",
        message: e instanceof Error ? e.message : "Submit failed",
      });
    }
  }

  function startPolling(deviceId: string, instructionId: string) {
    if (pollRef.current[deviceId]) clearInterval(pollRef.current[deviceId]);
    const startedAt = Date.now();
    const tick = async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(pollRef.current[deviceId]);
        delete pollRef.current[deviceId];
        setPhase(deviceId, {
          kind: "failed",
          message: "Timed out waiting for terminal",
        });
        return;
      }
      try {
        const res = await fetch(
          `/api/devices/payment-instructions/${instructionId}`
        );
        const json = (await res.json()) as InstructionResponse & {
          error?: string;
        };
        if (!res.ok) return;
        if (json.status === "completed") {
          clearInterval(pollRef.current[deviceId]);
          delete pollRef.current[deviceId];
          setPhase(deviceId, {
            kind: "completed",
            paymentInstructionId: instructionId,
          });
          await reload();
          return;
        }
        if (json.status === "canceled") {
          clearInterval(pollRef.current[deviceId]);
          delete pollRef.current[deviceId];
          setPhase(deviceId, { kind: "canceled" });
          return;
        }
        if (json.status === "failure") {
          clearInterval(pollRef.current[deviceId]);
          delete pollRef.current[deviceId];
          setPhase(deviceId, {
            kind: "failed",
            message: json.errorMessage ?? "Charge failed at terminal",
          });
          return;
        }
      } catch {
        // transient
      }
    };
    pollRef.current[deviceId] = setInterval(tick, POLL_INTERVAL_MS);
    void tick();
  }

  async function handleCancel(deviceId: string) {
    const phase = getPhase(deviceId);
    if (phase.kind !== "polling") return;
    try {
      await fetch(
        `/api/devices/payment-instructions/${phase.paymentInstructionId}`,
        { method: "DELETE" }
      );
      clearInterval(pollRef.current[deviceId]);
      delete pollRef.current[deviceId];
      setPhase(deviceId, { kind: "canceled" });
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Cancel failed");
    }
  }

  function resetPhase(deviceId: string) {
    if (pollRef.current[deviceId]) {
      clearInterval(pollRef.current[deviceId]);
      delete pollRef.current[deviceId];
    }
    setPhase(deviceId, { kind: "idle" });
  }

  const groupedByMerchant = useMemo(() => {
    if (scopedMerchantId) return null;
    const groups = new Map<
      string,
      { merchantName: string; rows: MasterDeviceRow[] }
    >();
    for (const d of devices) {
      const g = groups.get(d.merchantId);
      if (g) g.rows.push(d);
      else
        groups.set(d.merchantId, {
          merchantName: d.merchantBusinessName,
          rows: [d],
        });
    }
    return Array.from(groups.entries()).map(
      ([merchantId, { merchantName, rows }]) => ({
        merchantId,
        merchantName,
        rows,
      })
    );
  }, [devices, scopedMerchantId]);

  const stats = useMemo(() => {
    const total = devices.length;
    const active = devices.filter((d) => d.status === "active").length;
    const merchants = new Set(devices.map((d) => d.merchantId)).size;
    return { total, active, merchants };
  }, [devices]);

  function renderDeviceRow(d: MasterDeviceRow) {
    const form = getForm(d.id);
    const phase = getPhase(d.id);
    const isOpen = openDeviceId === d.id;

    return (
      <div key={d.id} style={{ borderBottom: "1px solid #F4F5F7" }}>
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Smartphone size={18} style={{ color: "#017ea7" }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{ fontSize: 14, fontWeight: 600, color: "#1A1313" }}
              >
                {d.label ?? d.model ?? maskSerial(d.serialNumber)}
              </span>
              <StatusPill status={d.status} />
            </div>
            <div style={{ fontSize: 12, color: "#878787", marginTop: 2 }}>
              {d.model && <span>{d.model} &middot; </span>}
              <span style={{ fontFamily: "monospace" }}>
                {maskSerial(d.serialNumber)}
              </span>
              <span> &middot; Last charge {fmtRelative(d.lastChargeAt)}</span>
            </div>
          </div>
          <Button
            variant="secondary"
            leadingIcon={<CreditCard size={14} />}
            onClick={() =>
              setOpenDeviceId((curr) => (curr === d.id ? null : d.id))
            }
          >
            {isOpen ? "Hide" : "Send Charge"}
          </Button>
          <Button
            variant="icon"
            onClick={() => handleRetire(d)}
            aria-label="Retire device"
          >
            <Trash2 size={16} />
          </Button>
        </div>

        {isOpen && (
          <div style={{ padding: "0 20px 20px" }}>
            {phase.kind === "idle" || phase.kind === "canceled" ? (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                }}
              >
                <Input
                  label="Amount"
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm(d.id, { amount: e.target.value })}
                  containerClassName="flex-1"
                  style={{ minWidth: 120 }}
                />
                <Input
                  label="Description"
                  placeholder="Hair service..."
                  value={form.description}
                  onChange={(e) =>
                    setForm(d.id, { description: e.target.value })
                  }
                  containerClassName="flex-1"
                  style={{ minWidth: 200 }}
                />
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    color: "#4A4A4A",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.promptForTip}
                    onChange={(e) =>
                      setForm(d.id, { promptForTip: e.target.checked })
                    }
                    style={{ accentColor: "#017ea7" }}
                  />
                  Tip
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    color: "#4A4A4A",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.promptForSignature}
                    onChange={(e) =>
                      setForm(d.id, { promptForSignature: e.target.checked })
                    }
                    style={{ accentColor: "#017ea7" }}
                  />
                  Sig
                </label>
                <Button variant="primary" onClick={() => requestCharge(d)}>
                  Send Charge
                </Button>
              </div>
            ) : phase.kind === "submitting" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#4A4A4A",
                  fontSize: 14,
                }}
              >
                <Loader2 size={14} className="animate-spin" />
                Submitting to terminal...
              </div>
            ) : phase.kind === "polling" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{ color: "#017ea7" }}
                />
                <span style={{ fontSize: 14, color: "#4A4A4A" }}>
                  Waiting for customer at terminal...
                </span>
                <Button
                  variant="danger"
                  leadingIcon={<X size={14} />}
                  onClick={() => handleCancel(d.id)}
                >
                  Cancel
                </Button>
              </div>
            ) : phase.kind === "completed" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <CheckCircle2 size={16} style={{ color: "#15803D" }} />
                <span
                  style={{ fontSize: 14, fontWeight: 500, color: "#15803D" }}
                >
                  Payment captured.
                </span>
                <a
                  href="/transactions"
                  style={{ fontSize: 13, color: "#017ea7" }}
                >
                  View in Transactions
                </a>
                <Button variant="ghost" onClick={() => resetPhase(d.id)}>
                  Send another
                </Button>
              </div>
            ) : phase.kind === "failed" ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <XCircle size={16} style={{ color: "#DC2626" }} />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#DC2626",
                    }}
                  >
                    {humanizeError(phase.message).title}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "#4A4A4A",
                    marginBottom: 8,
                  }}
                >
                  {humanizeError(phase.message).body}
                </p>
                {humanizeError(phase.message).hint && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#92400E",
                      background: "#FEF3C7",
                      border: "1px solid #FDE68A",
                      borderRadius: 6,
                      padding: "8px 10px",
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                    }}
                  >
                    <AlertCircle
                      size={14}
                      style={{ marginTop: 1, flexShrink: 0 }}
                    />
                    <span>{humanizeError(phase.message).hint}</span>
                  </p>
                )}
                <Button variant="secondary" onClick={() => resetPhase(d.id)}>
                  Try again
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 80,
            right: 24,
            zIndex: 100,
            minWidth: 280,
          }}
        >
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card padding={16}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#878787",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            Total Devices
          </p>
          <p
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#1A1313",
              letterSpacing: "-0.31px",
            }}
          >
            {stats.total}
          </p>
        </Card>
        <Card padding={16}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#878787",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            Active
          </p>
          <p
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#15803D",
              letterSpacing: "-0.31px",
            }}
          >
            {stats.active}
          </p>
        </Card>
        <Card padding={16}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#878787",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            Merchants
          </p>
          <p
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#1A1313",
              letterSpacing: "-0.31px",
            }}
          >
            {stats.merchants}
          </p>
        </Card>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <Button
          variant="primary"
          leadingIcon={<Plus size={14} />}
          onClick={() => setPairOpen((v) => !v)}
        >
          {pairOpen ? "Cancel" : "Pair Device"}
        </Button>
        <Button
          variant="secondary"
          leadingIcon={<RefreshCw size={14} />}
          onClick={reload}
          loading={loading}
        >
          Refresh
        </Button>
        {scopedMerchantId && (
          <Button
            variant="ghost"
            leadingIcon={<X size={14} />}
            onClick={() => (window.location.href = "/master/devices")}
          >
            Clear merchant filter
          </Button>
        )}
      </div>

      {/* Pair form */}
      {pairOpen && (
        <Card style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Plus size={16} style={{ color: "#017ea7" }} />
            <span
              style={{ fontSize: 16, fontWeight: 600, color: "#1A1313" }}
            >
              Pair a new device
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Merchant"
                placeholder="Select merchant..."
                value={pairMerchantId}
                onChange={(e) => setPairMerchantId(e.target.value)}
                list="merchant-list"
                helperText="Type the merchant ID or pick from dropdown"
              />
              <datalist id="merchant-list">
                {allMerchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.businessName}
                  </option>
                ))}
              </datalist>
            </div>
            <Input
              label="Serial Number"
              placeholder="Pax serial number"
              value={pairSerial}
              onChange={(e) => setPairSerial(e.target.value)}
            />
            <Input
              label="Model (optional)"
              placeholder="A920 Pro"
              value={pairModel}
              onChange={(e) => setPairModel(e.target.value)}
            />
            <Input
              label="Label (optional)"
              placeholder="Front desk, Station 2..."
              value={pairLabel}
              onChange={(e) => setPairLabel(e.target.value)}
            />
          </div>
          {pairError && (
            <div style={{ marginTop: 16 }}>
              <Toast kind="error" message={pairError} />
            </div>
          )}
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={handlePair} loading={pairing}>
              Pair Device
            </Button>
            <Button variant="ghost" onClick={() => setPairOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Devices */}
      {devices.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Smartphone
              size={48}
              strokeWidth={1.5}
              color="#878787"
              style={{ margin: "0 auto 16px" }}
            />
            <p
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#1A1313",
                marginBottom: 4,
              }}
            >
              No devices paired
            </p>
            <p style={{ fontSize: 14, color: "#878787" }}>
              {scopedMerchant
                ? `${scopedMerchant.businessName} hasn\u2019t paired any terminals yet.`
                : "No paired terminals across the platform yet."}
            </p>
          </div>
        </Card>
      ) : groupedByMerchant ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {groupedByMerchant.map((g) => (
            <Card key={g.merchantId} noPadding>
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #F4F5F7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Building2 size={16} style={{ color: "#017ea7" }} />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#1A1313",
                    }}
                  >
                    {g.merchantName}
                  </span>
                  <span style={{ fontSize: 12, color: "#878787" }}>
                    &middot; {g.rows.length}{" "}
                    {g.rows.length === 1 ? "device" : "devices"}
                  </span>
                </div>
                <a
                  href={`/master/devices?merchantId=${g.merchantId}`}
                  style={{ fontSize: 12, color: "#017ea7" }}
                >
                  Filter &rarr;
                </a>
              </div>
              <div>{g.rows.map((d) => renderDeviceRow(d))}</div>
            </Card>
          ))}
        </div>
      ) : (
        <Card noPadding>
          {devices.map((d) => renderDeviceRow(d))}
        </Card>
      )}

      {/* Confirmation dialog */}
      {confirmCharge && (
        <ConfirmDialog
          confirm={confirmCharge}
          onCancel={() => setConfirmCharge(null)}
          onConfirm={executeConfirmedCharge}
        />
      )}
    </>
  );
}

function ConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
}: {
  confirm: ConfirmCharge;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { device, amountDisplay, description } = confirm;
  const location = [device.merchantCity, device.merchantState]
    .filter(Boolean)
    .join(", ");
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,19,19,0.5)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480 }}
      >
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <AlertCircle size={20} style={{ color: "#92400E" }} />
            <span
              style={{ fontSize: 16, fontWeight: 600, color: "#1A1313" }}
            >
              Send a charge to a real terminal?
            </span>
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#4A4A4A",
              lineHeight: 1.6,
              marginBottom: 16,
            }}
          >
            This will prompt the customer at the physical terminal to insert
            or tap their card.
          </div>
          <div
            style={{
              background: "#F4F5F7",
              border: "1px solid #E8EAED",
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <FieldRow label="Merchant" value={device.merchantBusinessName} />
            {location && <FieldRow label="Location" value={location} />}
            <FieldRow
              label="Device"
              value={`${device.label ?? device.model ?? "Terminal"} \u00B7 ${maskSerial(device.serialNumber)}`}
              mono
            />
            <FieldRow label="Amount" value={amountDisplay} bold />
            {description && (
              <FieldRow label="Description" value={description} />
            )}
          </div>
          <div
            style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
          >
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConfirm}>
              Send Charge
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  mono,
  bold,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        paddingBottom: 6,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#878787",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: bold ? 600 : 400,
          color: "#1A1313",
          fontFamily: mono ? "monospace" : undefined,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}
