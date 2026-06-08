"use client";

// app/project-manager/page.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280",
};

type Screen = { name: string; description: string; prompt: string; html?: string };
type ProjectPlan = {
  title: string;
  description: string;
  techStack: string[];
  screens: Screen[];
  dbSchema: string;
  apiDocs: string;
  roadmap: { phase: string; tasks: string[] }[];
};

export default function AIProjectManager() {
  const router = useRouter();
  const supabase = createClient();

  const [prompt, setPrompt]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [plan, setPlan]           = useState<ProjectPlan | null>(null);
  const [activeTab, setActiveTab] = useState<"overview"|"screens"|"schema"|"api"|"roadmap">("overview");
  const [generatingScreen, setGeneratingScreen] = useState<number | null>(null);
  const [error, setError]         = useState("");

  const generatePlan = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setPlan(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }

      const res = await fetch("/api/project-manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (data.plan) {
        setPlan(data.plan);
        setActiveTab("overview");
      } else {
        setError(data.error || "Failed to generate plan");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateScreen = async (screen: Screen, index: number) => {
    setGeneratingScreen(index);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt: screen.prompt }),
      });

      const data = await res.json();
      if (data.html) {
        setPlan(prev => prev ? {
          ...prev,
          screens: prev.screens.map((s, i) => i === index ? { ...s, html: data.html } : s),
        } : prev);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setGeneratingScreen(null);
    }
  };

  const openInCreate = (screen: Screen) => {
    router.push(`/create?prompt=${encodeURIComponent(screen.prompt)}`);
  };

  const TABS = [
    { id: "overview", label: "📋 Overview" },
    { id: "screens",  label: "📱 Screens" },
    { id: "schema",   label: "🗄 DB Schema" },
    { id: "api",      label: "🔌 API Docs" },
    { id: "roadmap",  label: "🗺 Roadmap" },
  ];

  return (
    <>
      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        pre { white-space: pre-wrap; word-break: break-word; }
      `}</style>

      <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif" }}>

        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, background: "rgba(8,8,8,0.9)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>← Home</button>
            <span style={{ color: "#333" }}>|</span>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🤖 AI Project Manager</h1>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

          {/* Hero */}
          {!plan && (
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🤖</div>
              <h2 style={{ fontSize: 28, fontWeight: 800, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 10 }}>
                AI Project Manager
              </h2>
              <p style={{ color: T.muted, fontSize: 15, maxWidth: 500, margin: "0 auto 8px", lineHeight: 1.7 }}>
                Describe your app idea. Get a complete roadmap, DB schema, API docs, and auto-generated screens!
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
                {["📋 Full Roadmap", "🗄 DB Schema", "🔌 API Docs", "📱 Auto Screens"].map(f => (
                  <span key={f} style={{ fontSize: 13, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
                    ✅ {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 24 }}>
            {!plan && (
              <p style={{ fontSize: 11, color: T.muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 10 }}>
                DESCRIBE YOUR APP
              </p>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Build a food delivery app like Swiggy with restaurants, cart, orders, and tracking..."
                rows={3}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generatePlan(); } }}
                style={{ flex: 1, minWidth: 300, background: "#161616", border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, padding: "12px 14px", fontSize: 14, resize: "none", outline: "none", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, boxSizing: "border-box" as const }}
              />
              <button onClick={generatePlan} disabled={!prompt.trim() || loading} style={{
                padding: "12px 22px", background: prompt.trim() && !loading ? G : "#1a1a1a",
                border: "none", borderRadius: 10, color: prompt.trim() && !loading ? "#000" : "#444",
                fontWeight: 700, fontSize: 14, cursor: prompt.trim() && !loading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: 8, alignSelf: "flex-start",
              }}>
                {loading ? (
                  <>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />
                    Generating...
                  </>
                ) : "🤖 Generate Plan"}
              </button>
            </div>

            {/* Example prompts */}
            {!plan && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {[
                  "Food delivery app like Swiggy",
                  "E-learning platform like Udemy",
                  "Social media app like Twitter",
                  "E-commerce store like Amazon",
                ].map(ex => (
                  <button key={ex} onClick={() => setPrompt(`Build a ${ex}`)} style={{
                    padding: "5px 12px", background: "rgba(245,197,66,0.06)",
                    border: `1px solid ${T.border}`, borderRadius: 20,
                    color: T.muted, fontSize: 11.5, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.gold; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
                    ✨ {ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#ef4444", fontSize: 13 }}>
              ⚠ {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "40px 24px", textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(245,197,66,0.2)", borderTopColor: T.gold, animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>AI is planning your project...</p>
              <p style={{ fontSize: 13, color: T.muted }}>Generating roadmap, schemas, API docs and screen prompts</p>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }}>
                {["Analyzing idea...", "Planning screens...", "Designing schema...", "Writing API docs..."].map((msg, i) => (
                  <span key={i} style={{ fontSize: 11, color: "#444", animation: `pulse 2s ${i * 0.5}s infinite` }}>{msg}</span>
                ))}
              </div>
            </div>
          )}

          {/* Plan Results */}
          {plan && !loading && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>

              {/* Project title */}
              <div style={{ background: "rgba(245,197,66,0.04)", border: `1px solid rgba(245,197,66,0.2)`, borderRadius: 14, padding: "20px 24px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {plan.title}
                  </h2>
                  <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>{plan.description}</p>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {plan.techStack?.map(tech => (
                      <span key={tech} style={{ fontSize: 11, padding: "2px 8px", background: "rgba(245,197,66,0.08)", border: `1px solid ${T.border}`, borderRadius: 20, color: T.gold }}>
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 13, color: T.muted }}>{plan.screens?.length} screens</span>
                  <span style={{ fontSize: 13, color: T.muted }}>·</span>
                  <span style={{ fontSize: 13, color: T.muted }}>{plan.roadmap?.length} phases</span>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}  
                    style={{
                     padding: "8px 16px", borderRadius: 9, whiteSpace: "nowrap",
                     background: activeTab === tab.id ? "rgba(245,197,66,0.15)" : T.card,
                     border: activeTab === tab.id ? "1px solid rgba(245,197,66,0.3)" : `1px solid ${T.border}`,
                     color: activeTab === tab.id ? T.gold : T.muted,
                     fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
                     cursor: "pointer", transition: "all 0.15s",
                    } as any}}>{tab.label}</button>
                ))}
              </div>

              {/* ── OVERVIEW ── */}
              {activeTab === "overview" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                  {[
                    { icon: "📱", label: "Screens", value: plan.screens?.length || 0, desc: "Auto-generated screens" },
                    { icon: "🗺", label: "Phases", value: plan.roadmap?.length || 0, desc: "Development phases" },
                    { icon: "🗄", label: "DB Tables", value: (plan.dbSchema?.match(/CREATE TABLE/gi) || []).length || "Ready", desc: "Database schema" },
                    { icon: "🔌", label: "API Routes", value: (plan.apiDocs?.match(/^##/gm) || []).length || "Ready", desc: "API endpoints" },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px" }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.icon}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: T.gold, marginBottom: 4 }}>{stat.value}</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{stat.label}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{stat.desc}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── SCREENS ── */}
              {activeTab === "screens" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📱 App Screens ({plan.screens?.length})</p>
                    <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>Click "Generate" to build each screen</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {plan.screens?.map((screen, i) => (
                      <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                        {/* Preview */}
                        <div style={{ height: 140, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                          {screen.html ? (
                            <iframe srcDoc={screen.html} style={{ width: "200%", height: "200%", transform: "scale(0.5)", transformOrigin: "top left", border: "none", pointerEvents: "none" }} sandbox="allow-scripts" />
                          ) : (
                            <div style={{ textAlign: "center", color: "#333" }}>
                              <div style={{ fontSize: 32, marginBottom: 6 }}>📱</div>
                              <p style={{ fontSize: 11, margin: 0 }}>Not generated yet</p>
                            </div>
                          )}
                          {generatingScreen === i && (
                            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(245,197,66,0.2)", borderTopColor: T.gold, animation: "spin 0.8s linear infinite" }} />
                            </div>
                          )}
                        </div>

                        <div style={{ padding: "14px 16px" }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{screen.name}</h3>
                          <p style={{ fontSize: 12, color: T.muted, marginBottom: 12, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                            {screen.description}
                          </p>
                          <div style={{ display: "flex", gap: 6 }}>
                            {screen.html ? (
                              <>
                                <button onClick={() => { const w = window.open("","_blank"); if(w){w.document.write(screen.html!);w.document.close();} }}
                                  style={{ flex: 1, padding: "6px", background: "rgba(0,204,68,0.08)", border: "1px solid rgba(0,204,68,0.15)", borderRadius: 7, color: T.green, fontSize: 11, cursor: "pointer" }}>
                                  👁 Preview
                                </button>
                                <button onClick={() => openInCreate(screen)}
                                  style={{ flex: 1, padding: "6px", background: G, border: "none", borderRadius: 7, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                  ✏️ Edit
                                </button>
                              </>
                            ) : (
                              <button onClick={() => generateScreen(screen, i)} disabled={generatingScreen !== null}
                                style={{ width: "100%", padding: "8px", background: generatingScreen === null ? G : "#1a1a1a", border: "none", borderRadius: 7, color: generatingScreen === null ? "#000" : "#444", fontSize: 12, fontWeight: 700, cursor: generatingScreen === null ? "pointer" : "not-allowed" }}>
                                {generatingScreen === i ? "Generating..." : "⚡ Generate Screen"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── DB SCHEMA ── */}
              {activeTab === "schema" && (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>🗄 Database Schema</p>
                    <button onClick={() => navigator.clipboard.writeText(plan.dbSchema)} style={{ padding: "6px 14px", background: "rgba(245,197,66,0.1)", border: `1px solid ${T.border}`, borderRadius: 7, color: T.gold, fontSize: 12, cursor: "pointer" }}>
                      📋 Copy SQL
                    </button>
                  </div>
                  <pre style={{ background: "#0a0a0a", border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px", fontSize: 12, color: "#e8e8e8", fontFamily: "monospace", overflowX: "auto", lineHeight: 1.7 }}>
                    {plan.dbSchema}
                  </pre>
                </div>
              )}

              {/* ── API DOCS ── */}
              {activeTab === "api" && (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>🔌 API Documentation</p>
                    <button onClick={() => navigator.clipboard.writeText(plan.apiDocs)} style={{ padding: "6px 14px", background: "rgba(245,197,66,0.1)", border: `1px solid ${T.border}`, borderRadius: 7, color: T.gold, fontSize: 12, cursor: "pointer" }}>
                      📋 Copy
                    </button>
                  </div>
                  <div style={{ background: "#0a0a0a", border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px", fontSize: 13, color: "#e8e8e8", lineHeight: 1.8, whiteSpace: "pre-wrap" as any }}>
                    {plan.apiDocs}
                  </div>
                </div>
              )}

              {/* ── ROADMAP ── */}
              {activeTab === "roadmap" && (
                <div>
                  {plan.roadmap?.map((phase, i) => (
                    <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#000", flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{phase.phase}</h3>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {phase.tasks?.map((task, j) => (
                          <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <span style={{ color: T.green, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✅</span>
                            <span style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{task}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
