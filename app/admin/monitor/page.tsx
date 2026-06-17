"use client";
// app/admin/monitor/page.tsx
// Real-time generation error monitor — shows all website/app/game generation logs

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const T = {
  bg: "#050505", card: "#0D0D0D", border: "rgba(245,216,0,0.12)",
  gold: "#F5D800", green: "#00CC44", red: "#EF4444",
  orange: "#FF7A00", text: "#fff", muted: "#6B7280", blue: "#3B82F6",
};

interface GenLog {
  id: string;
  user_id: string;
  type: string;
  prompt: string;
  status: string;
  provider: string;
  error_message: string | null;
  error_code: string | null;
  credits_used: number;
  duration_ms: number | null;
  html_length: number | null;
  metadata: any;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  started:   T.gold,
  completed: T.green,
  failed:    T.red,
  timeout:   T.orange,
};

const STATUS_ICON: Record<string, string> = {
  started:   "⏳",
  completed: "✅",
  failed:    "❌",
  timeout:   "⏰",
};

export default function MonitorPage() {
  const supabase = createClient();
  const [logs, setLogs]         = useState<GenLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all"); // all | failed | completed | started
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    let q = supabase
      .from("generation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter !== "all") q = q.eq("status", filter);

    const { data, error } = await q;
    if (!error && data) setLogs(data as GenLog[]);
    setLoading(false);
  }, [filter, supabase]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto refresh every 10s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // Stats
  const total     = logs.length;
  const failed    = logs.filter(l => l.status === "failed").length;
  const completed = logs.filter(l => l.status === "completed").length;
  const timeouts  = logs.filter(l => l.status === "timeout").length;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const filtered = filter === "all" ? logs : logs.filter(l => l.status === filter);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "system-ui" }}>

      {/* ── Left Sidebar ── */}
      <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: 1, marginBottom: 8 }}>ADMIN TOOLS</div>

        {/* Debug Test Card */}
        <a href="/debug-test" style={{ textDecoration: "none" }}>
          <div style={{
            background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: 14, cursor: "pointer", transition: "all 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(245,216,0,0.4)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>🔬</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 4 }}>Debug Test</div>
            <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.4 }}>System health check — DB, APIs, Credits</div>
          </div>
        </a>

        {/* AI Engineer Card */}
        <a href="/admin/ai-engineer" style={{ textDecoration: "none" }}>
          <div style={{
            background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: 14, cursor: "pointer", transition: "all 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,204,68,0.4)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>🤖</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 4 }}>AI Engineer</div>
            <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.4 }}>Investigate bugs & fix codebase</div>
          </div>
        </a>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🔍 Generation Monitor</h1>
          <p style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>Real-time logs — website / app / game generation errors</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ color: T.muted, fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            Auto refresh (10s)
          </label>
          <button
            onClick={fetchLogs}
            style={{ background: T.card, border: `1px solid ${T.border}`, color: T.gold, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            🔄 Refresh
          </button>
          <a href="/admin/ai-engineer" style={{ background: "linear-gradient(135deg,#F5D800,#00CC44)", color: "#000", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            AI Engineer →
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total", value: total, color: T.gold, icon: "📊" },
          { label: "Completed", value: completed, color: T.green, icon: "✅" },
          { label: "Failed", value: failed, color: T.red, icon: "❌" },
          { label: "Timeouts", value: timeouts, color: T.orange, icon: "⏰" },
          { label: "Success Rate", value: `${successRate}%`, color: successRate > 80 ? T.green : T.red, icon: "📈" },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: T.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "failed", "timeout", "completed", "started"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? T.gold : T.card,
              color: filter === f ? "#000" : T.muted,
              border: `1px solid ${filter === f ? T.gold : T.border}`,
              borderRadius: 8, padding: "6px 14px", cursor: "pointer",
              fontSize: 12, fontWeight: 600, textTransform: "capitalize",
            }}
          >
            {f === "all" ? `All (${total})` : f === "failed" ? `Failed (${failed})` : f === "timeout" ? `Timeout (${timeouts})` : f === "completed" ? `OK (${completed})` : "Running"}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      {loading ? (
        <div style={{ color: T.muted, padding: 40, textAlign: "center" }}>Loading logs...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: T.muted, padding: 40, textAlign: "center" }}>
          {filter === "all" ? "No logs yet. Generation logs will appear here automatically." : `No ${filter} logs found.`}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(log => (
            <div
              key={log.id}
              style={{
                background: T.card,
                border: `1px solid ${log.status === "failed" || log.status === "timeout" ? "rgba(239,68,68,0.3)" : T.border}`,
                borderRadius: 12, padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                {/* Left */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16 }}>{STATUS_ICON[log.status] || "🔵"}</span>
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700,
                      background: `${STATUS_COLOR[log.status] || T.muted}22`,
                      color: STATUS_COLOR[log.status] || T.muted,
                      border: `1px solid ${STATUS_COLOR[log.status] || T.muted}44`,
                    }}>
                      {log.status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: T.muted }}>
                      {log.type || "unknown"}
                    </span>
                    {log.provider && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(59,130,246,0.1)", color: T.blue }}>
                        {log.provider}
                      </span>
                    )}
                  </div>

                  {/* Prompt */}
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                    {log.prompt || "No prompt"}
                  </div>

                  {/* Error */}
                  {log.error_message && (
                    <div style={{
                      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#FCA5A5",
                      marginTop: 6, fontFamily: "monospace",
                    }}>
                      ⚠️ {log.error_message}
                      {log.error_code && <span style={{ color: T.muted, marginLeft: 8 }}>[{log.error_code}]</span>}
                    </div>
                  )}
                </div>

                {/* Right - stats */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                  {log.duration_ms && (
                    <div style={{ fontSize: 11, color: log.duration_ms > 25000 ? T.orange : T.muted }}>
                      ⏱ {(log.duration_ms / 1000).toFixed(1)}s
                    </div>
                  )}
                  {log.credits_used > 0 && (
                    <div style={{ fontSize: 11, color: T.gold }}>⚡ {log.credits_used} cr</div>
                  )}
                  {log.html_length && (
                    <div style={{ fontSize: 11, color: T.muted }}>📄 {(log.html_length / 1000).toFixed(1)}k chars</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
      </div>
  );
}
