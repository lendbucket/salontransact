"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Smartphone,
  Plus,
  RefreshCw,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  Copy,
} from "lucide-react";
import type { DevicePublic } from "@/lib/devices/types";

const INPUT: React.CSSProperties = {
  width: "100%",
  height: 40,
  background: "#F4F5F7",
  border: "1px solid #E8EAED",
  borderRadius: 8,
  padding: "0 12px",
  fontSize: 14,
  color: "#1A1313",
  outline: "none",
  boxSizing: "border-box",
};

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
  | { kind: "completed"; paymentInstructionId: string; paymentLink?: string }
  | { kind: "failed"; message: string }
  | { kind: "canceled" };

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
  return `${serial.slice(0, 4)}...${serial.slice(-4)}`;
}

export function DevicesSection() {
  const [devices, setDevices] = useState<DevicePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pairOpen, setPairOpen] = useState(false);
  const [pairSerial, setPairSerial] = useState("");
  const [pairModel, setPairModel] = useState("");
  const [pairLabel, setPairLabel] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);

  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);

  const [chargeForm, setChargeForm] = useState<{
    [deviceId: string]: {
      amount: string;
      description: string;
      promptForTip: boolean;
      promptForSignature: boolean;
      customerPhone: string;
      customerEmail: string;
    };
  }>({});

  const [chargePhase, setChargePhase] = useState<{
    [deviceId: string]: ChargePhase;
  }>({});

  const pollRef = useRef<{ [deviceId: string]: ReturnType<typeof setInterval> }>({});

  const loadDevices = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/devices");
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.error || "Failed to load devices");
        setDevices([]);
        return;
      }
      setDevices(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Network error");
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    return () => {
      Object.values(pollRef.current).forEach((t) => clearInterval(t));
      pollRef.current = {};
    };
  }, []);

  function getPhase(deviceId: string): ChargePhase {
    return chargePhase[deviceId] ?? { kind: "idle" };
  }

  function setPhase(deviceId: string, phase: ChargePhase) {
    setChargePhase((s) => ({ ...s, [deviceId]: phase }));
  }

  function getForm(deviceId: string) {
    return (
      chargeForm[deviceId] ?? {
        amount: "1.00",
        description: "Test charge",
        promptForTip: false,
        promptForSignature: false,
        customerPhone: "",
        customerEmail: "",
      }
    );
  }

  function setForm(
    deviceId: string,
    updates: Partial<{
      amount: string;
      description: string;
      promptForTip: boolean;
      promptForSignature: boolean;
      customerPhone: string;
      customerEmail: string;
    }>
  ) {
    setChargeForm((s) => ({
      ...s,
      [deviceId]: { ...getForm(deviceId), ...updates },
    }));
  }

  function clearPolling(deviceId: string) {
    const t = pollRef.current[deviceId];
    if (t) {
      clearInterval(t);
      delete pollRef.current[deviceId];
    }
  }

  async function handlePair(e: React.FormEvent) {
    e.preventDefault();
    setPairError(null);
    const serial = pairSerial.trim();
    if (!serial) {
      setPairError("Serial number required");
      return;
    }
    setPairing(true);
    try {
      const body: { serialNumber: string; model?: string; label?: string } = {
        serialNumber: serial,
      };
      if (pairModel.trim()) body.model = pairModel.trim();
      if (pairLabel.trim()) body.label = pairLabel.trim();
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setPairError(json.error || "Failed to pair device");
        return;
      }
      setPairSerial("");
      setPairModel("");
      setPairLabel("");
      setPairOpen(false);
      await loadDevices();
    } catch (e) {
      setPairError(e instanceof Error ? e.message : "Network error");
    } finally {
      setPairing(false);
    }
  }

  async function handleUnpair(deviceId: string) {
    if (
      !confirm(
        "Unpair this device? You can pair it again later by entering the serial number."
      )
    )
      return;
    try {
      const res = await fetch(`/api/devices/${deviceId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Failed to unpair");
        return;
      }
      clearPolling(deviceId);
      setPhase(deviceId, { kind: "idle" });
      if (openDeviceId === deviceId) setOpenDeviceId(null);
      await loadDevices();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Network error");
    }
  }

  async function handleCharge(deviceId: string) {
    const form = getForm(deviceId);
    const dollars = Number(form.amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setPhase(deviceId, {
        kind: "failed",
        message: "Amount must be greater than 0",
      });
      return;
    }
    const amountCents = Math.round(dollars * 100);

    setPhase(deviceId, { kind: "submitting" });
    try {
      const res = await fetch(`/api/devices/${deviceId}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountCents,
          description: form.description.trim() || undefined,
          promptForTip: form.promptForTip,
          promptForSignature: form.promptForSignature,
          customerPhone: form.customerPhone.trim() || undefined,
          customerEmail: form.customerEmail.trim() || undefined,
        }),
      });
      const json = (await res.json()) as InstructionResponse & {
        error?: string;
      };
      if (!res.ok) {
        setPhase(deviceId, {
          kind: "failed",
          message: json.error || "Failed to submit charge",
        });
        return;
      }

      if (json.status === "completed") {
        setPhase(deviceId, {
          kind: "completed",
          paymentInstructionId: json.paymentInstructionId,
          paymentLink: json.link?.href,
        });
        return;
      }
      if (json.status === "failure") {
        setPhase(deviceId, {
          kind: "failed",
          message: json.errorMessage || "Payment instruction failed",
        });
        return;
      }
      if (json.status === "canceled") {
        setPhase(deviceId, { kind: "canceled" });
        return;
      }

      const startedAt = Date.now();
      setPhase(deviceId, {
        kind: "polling",
        paymentInstructionId: json.paymentInstructionId,
        startedAt,
      });

      const intervalId = setInterval(async () => {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          clearPolling(deviceId);
          setPhase(deviceId, {
            kind: "failed",
            message: "Timed out — terminal may not be reachable.",
          });
          return;
        }
        try {
          const pollRes = await fetch(
            `/api/devices/payment-instructions/${json.paymentInstructionId}`
          );
          const pollJson = (await pollRes.json()) as InstructionResponse & {
            error?: string;
          };
          if (!pollRes.ok) {
            clearPolling(deviceId);
            setPhase(deviceId, {
              kind: "failed",
              message: pollJson.error || "Polling failed",
            });
            return;
          }
          if (pollJson.status === "completed") {
            clearPolling(deviceId);
            setPhase(deviceId, {
              kind: "completed",
              paymentInstructionId: pollJson.paymentInstructionId,
              paymentLink: pollJson.link?.href,
            });
            void loadDevices();
            return;
          }
          if (pollJson.status === "failure") {
            clearPolling(deviceId);
            setPhase(deviceId, {
              kind: "failed",
              message: pollJson.errorMessage || "Payment failed at terminal",
            });
            return;
          }
          if (pollJson.status === "canceled") {
            clearPolling(deviceId);
            setPhase(deviceId, { kind: "canceled" });
            return;
          }
        } catch (e) {
          clearPolling(deviceId);
          setPhase(deviceId, {
            kind: "failed",
            message: e instanceof Error ? e.message : "Network error",
          });
        }
      }, POLL_INTERVAL_MS);

      pollRef.current[deviceId] = intervalId;
    } catch (e) {
      setPhase(deviceId, {
        kind: "failed",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }

  async function handleCancelCharge(deviceId: string) {
    const phase = getPhase(deviceId);
    if (phase.kind !== "polling") return;
    clearPolling(deviceId);
    try {
      await fetch(
        `/api/devices/payment-instructions/${phase.paymentInstructionId}`,
        { method: "DELETE" }
      );
    } catch {
      // best-effort
    }
    setPhase(deviceId, { kind: "canceled" });
  }

  function handleResetPhase(deviceId: string) {
    setPhase(deviceId, { kind: "idle" });
  }

  function copySerial(serial: string) {
    void navigator.clipboard.writeText(serial);
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="card" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#1A1313",
              margin: 0,
            }}
          >
            Card-Present Devices
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => void loadDevices()}
              className="inline-flex items-center gap-1.5 px-3 h-8 bg-white text-[#4A4A4A] text-xs font-medium rounded-lg border border-[#E8EAED] hover:bg-[#F4F5F7] transition-all duration-150 cursor-pointer"
            >
              <RefreshCw size={12} strokeWidth={1.5} />
              Refresh
            </button>
            <button
              onClick={() => setPairOpen(!pairOpen)}
              className="inline-flex items-center gap-1.5 px-3 h-8 bg-[#017ea7] hover:bg-[#0290be] text-white text-xs font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer"
            >
              <Plus size={12} strokeWidth={1.5} />
              Pair Device
            </button>
          </div>
        </div>
        <p
          style={{
            fontSize: 13,
            color: "#878787",
            margin: 0,
            marginBottom: pairOpen ? 16 : 0,
          }}
        >
          Pair Pay-by-Cloud terminals (Pax A920, Ingenico DX 8000, etc.) to
          accept card-present payments.
        </p>

        {pairOpen && (
          <form
            onSubmit={handlePair}
            style={{
              borderTop: "1px solid #F4F5F7",
              paddingTop: 16,
            }}
          >
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
              style={{ marginBottom: 12 }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#4A4A4A",
                    marginBottom: 6,
                  }}
                >
                  Serial Number
                </label>
                <input
                  type="text"
                  value={pairSerial}
                  onChange={(e) => setPairSerial(e.target.value)}
                  placeholder="1850010868"
                  style={INPUT}
                  required
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#4A4A4A",
                    marginBottom: 6,
                  }}
                >
                  Model (optional)
                </label>
                <select
                  value={pairModel}
                  onChange={(e) => setPairModel(e.target.value)}
                  style={INPUT}
                >
                  <option value="">Select model...</option>
                  <option value="Pax A920">Pax A920</option>
                  <option value="Pax A920 Pro">Pax A920 Pro</option>
                  <option value="Ingenico DX 8000">Ingenico DX 8000</option>
                  <option value="Castles">Castles</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#4A4A4A",
                  marginBottom: 6,
                }}
              >
                Label (optional)
              </label>
              <input
                type="text"
                value={pairLabel}
                onChange={(e) => setPairLabel(e.target.value)}
                placeholder="Front desk Corpus Christi"
                style={INPUT}
                maxLength={50}
              />
            </div>
            {pairError && (
              <p style={{ fontSize: 13, color: "#DC2626", marginBottom: 12 }}>
                {pairError}
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={pairing}
                className="inline-flex items-center gap-2 px-4 h-9 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer disabled:opacity-60"
              >
                {pairing && (
                  <Loader2
                    size={14}
                    strokeWidth={1.5}
                    className="animate-spin"
                  />
                )}
                Pair Device
              </button>
              <button
                type="button"
                onClick={() => {
                  setPairOpen(false);
                  setPairSerial("");
                  setPairModel("");
                  setPairLabel("");
                  setPairError(null);
                }}
                className="inline-flex items-center gap-2 px-4 h-9 bg-white text-[#4A4A4A] text-sm font-medium rounded-lg border border-[#E8EAED] hover:bg-[#F4F5F7] transition-all duration-150 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {loadError && (
        <div
          className="card"
          style={{
            padding: 16,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#DC2626",
            fontSize: 13,
          }}
        >
          {loadError}
        </div>
      )}

      {loading ? (
        <div
          className="card"
          style={{ padding: 32, textAlign: "center", color: "#878787" }}
        >
          <Loader2
            size={20}
            strokeWidth={1.5}
            className="animate-spin"
            style={{ display: "inline-block", marginBottom: 8 }}
          />
          <p style={{ fontSize: 13 }}>Loading devices...</p>
        </div>
      ) : devices.length === 0 && !loadError ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <Smartphone
            size={32}
            strokeWidth={1}
            style={{
              color: "#E8EAED",
              display: "inline-block",
              marginBottom: 12,
            }}
          />
          <p
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#1A1313",
              marginBottom: 4,
            }}
          >
            No devices paired
          </p>
          <p style={{ fontSize: 13, color: "#878787" }}>
            Click &quot;Pair Device&quot; above to add your first terminal.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => {
            const phase = getPhase(d.id);
            const form = getForm(d.id);
            const isOpen = openDeviceId === d.id;

            return (
              <div
                key={d.id}
                className="card"
                style={{ padding: 0, overflow: "hidden" }}
              >
                {/* Device row */}
                <div
                  style={{
                    padding: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: "#F4F5F7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Smartphone
                      size={16}
                      strokeWidth={1.5}
                      color="#4A4A4A"
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#1A1313",
                        }}
                      >
                        {d.label || d.model || "Terminal"}
                      </span>
                      <span
                        className={`badge ${d.status === "active" ? "badge-success" : "badge-pending"}`}
                        style={{ fontSize: 10 }}
                      >
                        <span className="badge-dot" />
                        {d.status}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12,
                        color: "#878787",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontFamily: "monospace" }}>
                        S/N: {maskSerial(d.serialNumber)}
                      </span>
                      <button
                        type="button"
                        onClick={() => copySerial(d.serialNumber)}
                        title="Copy serial number"
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: "#878787",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        <Copy size={11} strokeWidth={1.5} />
                      </button>
                      {d.model && (
                        <>
                          <span>·</span>
                          <span>{d.model}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        Last charge: {fmtRelative(d.lastChargeAt)}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={() => {
                        if (isOpen) {
                          setOpenDeviceId(null);
                        } else {
                          setOpenDeviceId(d.id);
                          if (
                            phase.kind !== "idle" &&
                            phase.kind !== "polling" &&
                            phase.kind !== "submitting"
                          ) {
                            handleResetPhase(d.id);
                          }
                        }
                      }}
                      disabled={d.status !== "active"}
                      className="inline-flex items-center gap-1.5 px-3 h-8 bg-[#017ea7] hover:bg-[#0290be] text-white text-xs font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer disabled:opacity-60"
                    >
                      <CreditCard size={12} strokeWidth={1.5} />
                      {isOpen ? "Close" : "Send Charge"}
                    </button>
                    <button
                      onClick={() => handleUnpair(d.id)}
                      title="Unpair device"
                      className="inline-flex items-center justify-center w-8 h-8 bg-white text-[#878787] rounded-lg border border-[#E8EAED] hover:bg-[#F4F5F7] hover:text-[#DC2626] transition-all duration-150 cursor-pointer"
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                {/* Charge panel */}
                {isOpen && (
                  <div
                    style={{
                      borderTop: "1px solid #F4F5F7",
                      padding: 16,
                      background: "#FAFAFB",
                    }}
                  >
                    {phase.kind === "idle" ||
                    phase.kind === "submitting" ? (
                      <div>
                        <div
                          className="grid grid-cols-1 md:grid-cols-3 gap-3"
                          style={{ marginBottom: 12 }}
                        >
                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#4A4A4A",
                                marginBottom: 6,
                              }}
                            >
                              Amount (USD)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={form.amount}
                              onChange={(e) =>
                                setForm(d.id, { amount: e.target.value })
                              }
                              style={INPUT}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label
                              style={{
                                display: "block",
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#4A4A4A",
                                marginBottom: 6,
                              }}
                            >
                              Description
                            </label>
                            <input
                              type="text"
                              value={form.description}
                              onChange={(e) =>
                                setForm(d.id, {
                                  description: e.target.value,
                                })
                              }
                              style={INPUT}
                              maxLength={100}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#4A4A4A",
                                marginBottom: 6,
                              }}
                            >
                              Phone (SMS receipt)
                            </label>
                            <input
                              type="tel"
                              placeholder="(555) 555-5555"
                              value={form.customerPhone}
                              onChange={(e) =>
                                setForm(d.id, {
                                  customerPhone: e.target.value,
                                })
                              }
                              style={INPUT}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#4A4A4A",
                                marginBottom: 6,
                              }}
                            >
                              Email (receipt)
                            </label>
                            <input
                              type="email"
                              placeholder="customer@example.com"
                              value={form.customerEmail}
                              onChange={(e) =>
                                setForm(d.id, {
                                  customerEmail: e.target.value,
                                })
                              }
                              style={INPUT}
                            />
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 16,
                            marginBottom: 12,
                            fontSize: 13,
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              color: "#4A4A4A",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={form.promptForTip}
                              onChange={(e) =>
                                setForm(d.id, {
                                  promptForTip: e.target.checked,
                                })
                              }
                            />
                            Prompt for tip
                          </label>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              color: "#4A4A4A",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={form.promptForSignature}
                              onChange={(e) =>
                                setForm(d.id, {
                                  promptForSignature: e.target.checked,
                                })
                              }
                            />
                            Prompt for signature
                          </label>
                        </div>
                        <button
                          onClick={() => handleCharge(d.id)}
                          disabled={phase.kind === "submitting"}
                          className="inline-flex items-center gap-2 px-4 h-9 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer disabled:opacity-60"
                        >
                          {phase.kind === "submitting" && (
                            <Loader2
                              size={14}
                              strokeWidth={1.5}
                              className="animate-spin"
                            />
                          )}
                          Send to Terminal
                        </button>
                      </div>
                    ) : phase.kind === "polling" ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <Loader2
                          size={20}
                          strokeWidth={1.5}
                          className="animate-spin"
                          style={{ color: "#017ea7", flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <p
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#1A1313",
                              marginBottom: 2,
                            }}
                          >
                            Waiting for customer...
                          </p>
                          <p style={{ fontSize: 12, color: "#878787" }}>
                            Tap, insert, or swipe on the terminal.
                          </p>
                        </div>
                        <button
                          onClick={() => handleCancelCharge(d.id)}
                          className="inline-flex items-center gap-1.5 px-3 h-8 bg-white text-[#4A4A4A] text-xs font-medium rounded-lg border border-[#E8EAED] hover:bg-[#F4F5F7] transition-all duration-150 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : phase.kind === "completed" ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <CheckCircle
                          size={20}
                          strokeWidth={1.5}
                          style={{ color: "#22c55e", flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <p
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#166534",
                              marginBottom: 2,
                            }}
                          >
                            Payment captured.
                          </p>
                          <p
                            style={{
                              fontSize: 12,
                              color: "#878787",
                              fontFamily: "monospace",
                            }}
                          >
                            Instruction: {phase.paymentInstructionId}
                            {phase.kind === "completed" && (
                              <>
                                {" · "}
                                {/* TODO Phase 8: replace with /transactions/[id] detail page once built */}
                                <a
                                  href="/transactions"
                                  style={{ color: "#017ea7" }}
                                >
                                  View in Transactions
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => handleResetPhase(d.id)}
                          className="inline-flex items-center gap-1.5 px-3 h-8 bg-white text-[#4A4A4A] text-xs font-medium rounded-lg border border-[#E8EAED] hover:bg-[#F4F5F7] transition-all duration-150 cursor-pointer"
                        >
                          New Charge
                        </button>
                      </div>
                    ) : phase.kind === "failed" ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <XCircle
                          size={20}
                          strokeWidth={1.5}
                          style={{ color: "#DC2626", flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <p
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#DC2626",
                              marginBottom: 2,
                            }}
                          >
                            Charge failed.
                          </p>
                          <p style={{ fontSize: 12, color: "#878787" }}>
                            {phase.message}
                          </p>
                        </div>
                        <button
                          onClick={() => handleResetPhase(d.id)}
                          className="inline-flex items-center gap-1.5 px-3 h-8 bg-white text-[#4A4A4A] text-xs font-medium rounded-lg border border-[#E8EAED] hover:bg-[#F4F5F7] transition-all duration-150 cursor-pointer"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : phase.kind === "canceled" ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <AlertCircle
                          size={20}
                          strokeWidth={1.5}
                          style={{ color: "#f59e0b", flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <p
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#92400E",
                              marginBottom: 2,
                            }}
                          >
                            Canceled.
                          </p>
                          <p style={{ fontSize: 12, color: "#878787" }}>
                            The instruction was canceled before the customer
                            responded.
                          </p>
                        </div>
                        <button
                          onClick={() => handleResetPhase(d.id)}
                          className="inline-flex items-center gap-1.5 px-3 h-8 bg-white text-[#4A4A4A] text-xs font-medium rounded-lg border border-[#E8EAED] hover:bg-[#F4F5F7] transition-all duration-150 cursor-pointer"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
