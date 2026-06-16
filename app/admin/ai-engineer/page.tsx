"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280", red: "#ef4444",
};

interface SessionRow {
  id: string;
  prompt: string;
  status: string;
  summary: string | null;
  created_at: string;
}

interface StreamEvent {
  type: "phase" | "historical_context" | "thinking" | "tool_call" | "patch_proposed" | "complete" | "error";
  data: any;
}

const STATUS_COLOR: Record<string, string> = {
  analyzing: T.gold,
  analysis_complete: T.muted,
  awaiting_approval: T.gold,
  patches_proposed: T.gold,
  approved: T.green,
  rejected: T.red,
  applying: T.gold,
  deploying: T.gold,
  verifying: T.gold,
  completed: T.green,
  failed: T.red,
  rolling_back: T.gold,
  rolled_back: "#8b9bff",
};

export default function AiEngineerPage() {
  const router = useRouter();
  const supabase = createClient();
  const [prompt, setPrompt] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  async function loadSessions() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/ai-engineer/sessions", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setSessions(json.sessions || []);
    }
  }

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [events]);

  async function startInvestigation() {
    if (!prompt.trim() || running) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/auth/login"); return; }

    setRunning(true);
    setEvents([]);
    setActiveSessionId(null);

    try {
      const res = await fetch("/api/admin/ai-engineer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: AbortSignal.timeout(125000),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        setEvents((p) => [...p, { type: "error", data: { message: err.error || `HTTP ${res.status}` } }]);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const em = chunk.match(/event:\s*(\S+)/);
          const dm = chunk.match(/data:\s*([\s\S]+)/);
          if (!em || !dm) continue;
          let data: any = {};
          try { data = JSON.parse(dm[1].trim()); } catch { continue; }
          const type = em[1] as StreamEvent["type"] | "session";

          if (type === "session") {
            setActiveSessionId(data.id);
            continue;
          }
          setEvents((p) => [...p, { type: type as StreamEvent["type"], data }]);
          if (type === "complete" || type === "error") {
            if (type === "complete") setPrompt("");
          }
        }
      }
    } catch (e: any) {
      setEvents((p) => [...p, { type: "error", data: { message: e.message || "Connection lost." } }]);
    } finally {
      setRunning(false);
      loadSessions();
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Sidebar: session history ── */}
      <div style={{ width: 300, borderRight: `1px solid ${T.border}`, padding: 20, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>
          KRYPTON AI
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>AI Engineer</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 140px)", overflowY: "auto" }}>
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/admin/ai-engineer/${s.id}`)}
              style={{
                textAlign: "left", background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 8, padding: 10, cursor: "pointer", color: T.text,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.prompt}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: STATUS_COLOR[s.status] ?? T.muted }}>{s.status}</span>
                <span style={{ color: T.muted }}>{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
          {sessions.length === 0 && <div style={{ color: T.muted, fontSize: 13 }}>No sessions yet.</div>}
        </div>
      </div>

      {/* ── Main panel ── */}
      <div style={{ flex: 1, padding: 32, maxWidth: 900 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>AI Engineer Dashboard</h1>
        <p style={{ color: T.muted, fontSize: 14, margin: "0 0 24px" }}>
          Describe a bug, audit request, or improvement. The AI Engineer recalls memory of past
          audits/fixes/failures first, then investigates the codebase, logs, and schema.
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g. "Game projects are not appearing in Total Projects on the dashboard after generation — investigate and fix."'
            rows={3}
            disabled={running}
            style={{
              flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
              padding: 12, color: T.text, fontSize: 14, fontFamily: "inherit", resize: "vertical",
            }}
          />
          <button
            onClick={startInvestigation}
            disabled={running || !prompt.trim()}
            style={{
              background: running ? T.card : G, color: running ? T.muted : "#000",
              border: "none", borderRadius: 10, padding: "0 24px", fontWeight: 700,
              cursor: running ? "default" : "pointer", flexShrink: 0,
            }}
          >
            {running ? "Investigating..." : "Start Investigation"}
          </button>
        </div>

        {/* ── Live stream ── */}
        {events.length > 0 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12, maxHeight: 500, overflowY: "auto" }}>
            {events.map((e, i) => <StreamEventView key={i} event={e} />)}
            {activeSessionId && (
              <button
                onClick={() => router.push(`/admin/ai-engineer/${activeSessionId}`)}
                style={{ alignSelf: "flex-start", background: "transparent", border: `1px solid ${T.gold}`, color: T.gold, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                Open session details →
              </button>
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function StreamEventView({ event }: { event: StreamEvent }) {
  switch (event.type) {
    case "phase":
      return <div style={{ color: T.muted, fontSize: 13, fontStyle: "italic" }}>→ {event.data.action}</div>;
    case "historical_context":
      return (
        <details style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: 10 }}>
          <summary style={{ cursor: "pointer", color: T.gold, fontWeight: 600, fontSize: 13 }}>Historical Context</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#9CA3AF", marginTop: 8, fontFamily: "inherit" }}>{event.data.markdown}</pre>
        </details>
      );
    case "thinking":
      return <div style={{ fontSize: 13, color: "#9CA3AF", whiteSpace: "pre-wrap" }}>{event.data.text}</div>;
    case "tool_call":
      return <div style={{ fontSize: 12, color: "#8b9bff" }}>⚙ {event.data.tool}({JSON.stringify(event.data.input).slice(0, 100)})</div>;
    case "patch_proposed":
      return (
        <div style={{ fontSize: 13, color: T.green, border: `1px solid ${T.green}`, borderRadius: 6, padding: 8 }}>
          📝 Proposed patch — <strong>{event.data.action}</strong> {event.data.file_path}
          <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>{event.data.explanation}</div>
        </div>
      );
    case "complete":
      return (
        <div style={{ fontSize: 14, color: T.green, fontWeight: 700, border: `1px solid ${T.green}`, borderRadius: 8, padding: 10 }}>
          ✅ Investigation complete — {event.data.summary}
        </div>
      );
    case "error":
      return (
        <div style={{ fontSize: 14, color: T.red, fontWeight: 700, border: `1px solid ${T.red}`, borderRadius: 8, padding: 10 }}>
          ⚠ {event.data.message}
        </div>
      );
    default:
      return null;
  }
}

