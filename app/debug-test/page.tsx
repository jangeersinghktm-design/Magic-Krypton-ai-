"use client";
// app/debug-test/page.tsx — Pro System Health Check

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const T = {
  bg: "#050505", card: "#0D0D0D", border: "rgba(255,255,255,0.08)",
  gold: "#F5D800", green: "#10B981", red: "#EF4444",
  orange: "#FF7A00", text: "#fff", muted: "#6B7280",
};

interface CheckResult {
  name: string;
  status: "idle" | "running" | "pass" | "fail";
  message: string;
  latency?: number;
}

const INITIAL: CheckResult[] = [
  { name: "Supabase DB", status: "idle", message: "Not tested" },
  { name: "Auth System", status: "idle", message: "Not tested" },
  { name: "Project Save", status: "idle", message: "Not tested" },
  { name: "Claude API", status: "idle", message: "Not tested" },
  { name: "OpenAI API", status: "idle", message: "Not tested" },
  { name: "Gemini API", status: "idle", message: "Not tested" },
  { name: "Credits System", status: "idle", message: "Not tested" },
];

export default function DebugTestPage() {
  const supabase = createClient();
  const [checks, setChecks] = useState<CheckResult[]>(INITIAL);
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);

  const update = (name: string, patch: Partial<CheckResult>) =>
    setChecks(prev => prev.map(c => c.name === name ? { ...c, ...patch } : c));

  async function runAllChecks() {
    setRunning(true);
    setDone(false);
    setChecks(INITIAL.map(c => ({ ...c, status: "idle", message: "Waiting..." })));

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const userId = session?.user?.id;

    // ── 1. Auth System ───────────────────────────────────────────
    update("Auth System", { status: "running", message: "Checking session..." });
    await delay(300);
    if (!session || !token) {
      update("Auth System", { status: "fail", message: "Not logged in — login karo pehle" });
      setRunning(false); return;
    }
    update("Auth System", { status: "pass", message: `Logged in as ${session.user.email}` });

    // ── 2. Supabase DB ───────────────────────────────────────────
    update("Supabase DB", { status: "running", message: "Connecting..." });
    const t1 = Date.now();
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      if (error) throw error;
      update("Supabase DB", { status: "pass", message: "Connected", latency: Date.now() - t1 });
    } catch (e: any) {
      update("Supabase DB", { status: "fail", message: e.message });
    }

    // ── 3. Project Save ──────────────────────────────────────────
    update("Project Save", { status: "running", message: "Testing insert..." });
    const t2 = Date.now();
    try {
      const res = await fetch("/api/debug-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });
      const json = await res.json();
      if (json.step === "SUCCESS") {
        update("Project Save", { status: "pass", message: `Saved — ID: ${json.projectId?.slice(0,8)}...`, latency: Date.now() - t2 });
      } else {
        update("Project Save", { status: "fail", message: json.error || "Insert failed" });
      }
    } catch (e: any) {
      update("Project Save", { status: "fail", message: e.message });
    }

    // ── 4. Claude API ────────────────────────────────────────────
    update("Claude API", { status: "running", message: "Pinging Claude..." });
    const t3 = Date.now();
    try {
      const res = await fetch("/api/test-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "claude", accessToken: token }),
      });
      const json = await res.json();
      if (json.ok) {
        update("Claude API", { status: "pass", message: json.message || "Responding", latency: Date.now() - t3 });
      } else {
        update("Claude API", { status: "fail", message: json.error || "Failed" });
      }
    } catch (e: any) {
      update("Claude API", { status: "fail", message: e.message });
    }

    // ── 5. OpenAI API ────────────────────────────────────────────
    update("OpenAI API", { status: "running", message: "Pinging OpenAI..." });
    const t4 = Date.now();
    try {
      const res = await fetch("/api/test-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", accessToken: token }),
      });
      const json = await res.json();
      if (json.ok) {
        update("OpenAI API", { status: "pass", message: json.message || "Responding", latency: Date.now() - t4 });
      } else {
        update("OpenAI API", { status: "fail", message: json.error || "Failed" });
      }
    } catch (e: any) {
      update("OpenAI API", { status: "fail", message: e.message });
    }

    // ── 6. Gemini API ────────────────────────────────────────────
    update("Gemini API", { status: "running", message: "Pinging Gemini..." });
    const t5 = Date.now();
    try {
      const res = await fetch("/api/test-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "gemini", accessToken: token }),
      });
      const json = await res.json();
      if (json.ok) {
        update("Gemini API", { status: "pass", message: json.message || "Responding", latency: Date.now() - t5 });
      } else {
        update("Gemini API", { status: "fail", message: json.error || "Failed" });
      }
    } catch (e: any) {
      update("Gemini API", { status: "fail", message: e.message });
    }

    // ── 7. Credits System ────────────────────────────────────────
    update("Credits System", { status: "running", message: "Checking credits..." });
    try {
      const { data: profile } = await supabase
        .from("profiles").select("total_credits, used_credits, plan, daily_reset_date")
        .eq("id", userId).single();
      if (profile) {
        const rem = (profile.total_credits || 5) - (profile.used_credits || 0);
        update("Credits System", { status: rem > 0 ? "pass" : "fail", message: `${rem} remaining | Plan: ${profile.plan} | Reset: ${profile.daily_reset_date}` });
      } else {
        update("Credits System", { status: "fail", message: "Profile not found" });
      }
    } catch (e: any) {
      update("Credits System", { status: "fail", message: e.message });
    }

    setRunning(false);
    setDone(true);
  }

  const passed = checks.filter(c => c.status === "pass").length;
  const failed = checks.filter(c => c.status === "fail").length;
  const total  = checks.filter(c => c.status !== "idle").length;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "system-ui", padding: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🔬 System Health Check</h1>
          <p style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>Krypton AI — All systems diagnostic</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="/admin/monitor" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "8px 16px", fontSize: 13, textDecoration: "none" }}>
            ← Monitor
          </a>
          <button
            onClick={runAllChecks}
            disabled={running}
            style={{
              background: running ? T.card : "linear-gradient(135deg,#F5D800,#00CC44)",
              color: running ? T.muted : "#000",
              border: "none", borderRadius: 8, padding: "8px 20px",
              fontWeight: 700, fontSize: 13, cursor: running ? "default" : "pointer",
            }}
          >
            {running ? "Running..." : "▶ Run All Checks"}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {done && (
        <div style={{
          background: failed === 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${failed === 0 ? T.green : T.red}44`,
          borderRadius: 12, padding: "14px 20px", marginBottom: 24,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>{failed === 0 ? "✅" : "⚠️"}</span>
          <div>
            <div style={{ fontWeight: 700, color: failed === 0 ? T.green : T.red }}>
              {failed === 0 ? "All systems operational!" : `${failed} system(s) need attention`}
            </div>
            <div style={{ fontSize: 12, color: T.muted }}>{passed}/{total} checks passed</div>
          </div>
        </div>
      )}

      {/* Checks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {checks.map(c => (
          <div key={c.name} style={{
            background: T.card,
            border: `1px solid ${c.status === "pass" ? "rgba(16,185,129,0.25)" : c.status === "fail" ? "rgba(239,68,68,0.25)" : T.border}`,
            borderRadius: 12, padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            {/* Icon */}
            <div style={{ flexShrink: 0 }}>
              {c.status === "idle"    && <span style={{ fontSize: 18, color: T.muted }}>○</span>}
              {c.status === "running" && <div style={{ width: 18, height: 18, border: `2px solid ${T.gold}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
              {c.status === "pass"    && <span style={{ fontSize: 18 }}>✅</span>}
              {c.status === "fail"    && <span style={{ fontSize: 18 }}>❌</span>}
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{c.name}</div>
              <div style={{
                fontSize: 12,
                color: c.status === "pass" ? T.green : c.status === "fail" ? "#FCA5A5" : T.muted,
                animation: c.status === "running" ? "pulse 1.5s ease infinite" : "none",
              }}>
                {c.message}
              </div>
            </div>

            {/* Latency */}
            {c.latency && (
              <div style={{ fontSize: 11, color: c.latency > 2000 ? T.orange : T.muted, flexShrink: 0 }}>
                {c.latency}ms
              </div>
            )}
          </div>
        ))}
      </div>

      {!done && !running && (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔬</div>
          <p>Run All Checks button dabao — sab systems test honge</p>
        </div>
      )}
    </div>
  );
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
