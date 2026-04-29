"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, User, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { Toast } from "@/components/ui/toast";
import type { StylistSummary, StylistListResponse } from "@/lib/stylists/types";

export function StylistsClient() {
  const [stylists, setStylists] = useState<StylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "stylist", commissionRate: "" });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message }); setTimeout(() => setToast(null), 4000);
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stylists?includeInactive=true");
      if (!res.ok) { showToast("error", "Load failed"); return; }
      const data = (await res.json()) as StylistListResponse;
      setStylists(data.data);
    } catch (e) { showToast("error", e instanceof Error ? e.message : "Load failed"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { refetch(); }, [refetch]);

  async function handleCreate() {
    if (!form.name.trim()) { showToast("error", "Name required"); return; }
    setCreating(true);
    try {
      const body: Record<string, unknown> = { name: form.name.trim(), role: form.role };
      if (form.email.trim()) body.email = form.email.trim();
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.commissionRate) body.commissionRate = parseFloat(form.commissionRate) / 100;
      const res = await fetch("/api/stylists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); showToast("error", (j as { error?: string }).error ?? "Create failed"); return; }
      showToast("success", "Stylist added");
      setShowModal(false);
      setForm({ name: "", email: "", phone: "", role: "stylist", commissionRate: "" });
      await refetch();
    } catch (e) { showToast("error", e instanceof Error ? e.message : "Failed"); }
    finally { setCreating(false); }
  }

  async function handleDeactivate(s: StylistSummary) {
    if (!confirm(`Deactivate ${s.name}?`)) return;
    try {
      const res = await fetch(`/api/stylists/${s.id}`, { method: "DELETE" });
      if (!res.ok) { showToast("error", "Deactivate failed"); return; }
      showToast("success", `${s.name} deactivated`);
      await refetch();
    } catch (e) { showToast("error", e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <>
      {toast && <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}><Toast kind={toast.kind} message={toast.message} /></div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Button variant="secondary" leadingIcon={<RefreshCw size={14} />} onClick={refetch} loading={loading}>Refresh</Button>
        <Button variant="primary" leadingIcon={<Plus size={14} />} onClick={() => setShowModal(true)}>Add Stylist</Button>
      </div>
      {loading ? (
        <Card padding={32}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#878787", gap: 8 }}><Loader2 size={16} className="animate-spin" /><span style={{ fontSize: 13 }}>Loading…</span></div></Card>
      ) : stylists.length === 0 ? (
        <Card padding={48}><div style={{ textAlign: "center" }}><div style={{ width: 80, height: 80, margin: "0 auto 16px", borderRadius: 9999, background: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}><User size={32} strokeWidth={1.5} color="#878787" /></div><p style={{ fontSize: 15, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>No stylists yet</p><p style={{ fontSize: 13, color: "#878787" }}>Add stylists manually or wait for Kasse to sync them.</p></div></Card>
      ) : (
        <Card noPadding>
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead style={{ background: "#F9FAFB" }}><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Commission</Th><Th>Status</Th><th style={{ padding: "10px 16px" }} /></tr></thead>
              <tbody>{stylists.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid #F4F5F7" }}>
                  <Td><span style={{ fontWeight: 600 }}>{s.name}</span></Td>
                  <Td muted>{s.email ?? "—"}</Td>
                  <Td muted>{s.role}</Td>
                  <Td muted>{s.commissionRate != null ? `${(s.commissionRate * 100).toFixed(0)}%` : "—"}</Td>
                  <Td><StatusPill status={s.status} /></Td>
                  <td style={{ padding: "12px 16px" }}>{s.status === "active" && <Button variant="icon" onClick={() => handleDeactivate(s)} aria-label="Deactivate"><Trash2 size={14} /></Button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="md:hidden">{stylists.map((s) => (
            <div key={s.id} style={{ padding: "14px 16px", borderTop: "1px solid #F4F5F7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 14, fontWeight: 600, color: "#1A1313" }}>{s.name}</span><StatusPill status={s.status} /></div>
              <div style={{ fontSize: 12, color: "#878787" }}>{s.role}{s.commissionRate != null ? ` · ${(s.commissionRate * 100).toFixed(0)}%` : ""}</div>
              {s.email && <div style={{ fontSize: 12, color: "#878787" }}>{s.email}</div>}
            </div>
          ))}</div>
        </Card>
      )}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 12 }} onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 480, width: "100%", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}><h3 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", margin: 0 }}>Add Stylist</h3><button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "#878787", cursor: "pointer" }}><X size={18} /></button></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Email (optional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <div><label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>Role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ width: "100%", height: 44, padding: "0 12px", borderRadius: 8, border: "1px solid #E8EAED", fontSize: 14, background: "#F4F5F7", color: "#1A1313" }}><option value="stylist">Stylist</option><option value="manager">Manager</option><option value="owner">Owner</option></select></div>
              <Input label="Commission % (optional)" type="number" placeholder="e.g. 50" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} />
            </div>
            <div className="flex flex-col-reverse sm:flex-row" style={{ gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreate} loading={creating}>Add Stylist</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</th>; }
function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) { return <td style={{ padding: "12px 16px", fontSize: 13, color: muted ? "#4A4A4A" : "#1A1313" }}>{children}</td>; }
