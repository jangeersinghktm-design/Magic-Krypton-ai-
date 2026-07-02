"use client";
// app/build/page.tsx — Krypton AI Multi-Generator Hub
// 8 specialized generators: Website / Landing / App / Game / Dashboard / Tool / E-Commerce / Portfolio

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Generator Config ──────────────────────────────────────────────
const GENERATORS = [
  {
    id: "website",
    icon: "🌐",
    label: "Website",
    desc: "Full multi-section business or brand website",
    gradient: "linear-gradient(135deg,#667eea,#764ba2)",
    tags: ["Hero", "Features", "Testimonials", "Pricing", "FAQ"],
    credit: 3,
    placeholder: "Build a modern SaaS website for a project management tool with dark theme...",
  },
  {
    id: "landing",
    icon: "🎯",
    label: "Landing Page",
    desc: "High-converting marketing & launch pages",
    gradient: "linear-gradient(135deg,#f093fb,#f5576c)",
    tags: ["Hero", "Social Proof", "CTA", "Waitlist"],
    credit: 2,
    placeholder: "Create a landing page for an AI writing tool with email capture and pricing...",
  },
  {
    id: "app",
    icon: "📱",
    label: "Web App",
    desc: "Full-featured interactive web applications",
    gradient: "linear-gradient(135deg,#4facfe,#00f2fe)",
    tags: ["CRUD", "Auth UI", "Dashboard", "Forms"],
    credit: 3,
    placeholder: "Build a task manager app with projects, tags, filters, and due dates...",
  },
  {
    id: "dashboard",
    icon: "📊",
    label: "Dashboard",
    desc: "Analytics panels, admin UIs & CRM systems",
    gradient: "linear-gradient(135deg,#fa709a,#fee140)",
    tags: ["Charts", "Tables", "KPIs", "Sidebar"],
    credit: 4,
    placeholder: "Build an e-commerce analytics dashboard with revenue charts and user table...",
  },
  {
    id: "tool",
    icon: "🔧",
    label: "Tool",
    desc: "Productivity tools, converters & generators",
    gradient: "linear-gradient(135deg,#a18cd1,#fbc2eb)",
    tags: ["Input", "Output", "History", "Export"],
    credit: 2,
    placeholder: "Create a JSON formatter & validator tool with syntax highlighting...",
  },
  {
    id: "ecommerce",
    icon: "🛒",
    label: "E-Commerce",
    desc: "Full online stores with cart & checkout",
    gradient: "linear-gradient(135deg,#ffecd2,#fcb69f)",
    tags: ["Products", "Cart", "Filter", "Wishlist"],
    credit: 4,
    placeholder: "Build a premium clothing store with category filters, cart and checkout...",
  },
  {
    id: "portfolio",
    icon: "💼",
    label: "Portfolio",
    desc: "Personal & agency portfolio websites",
    gradient: "linear-gradient(135deg,#a1c4fd,#c2e9fb)",
    tags: ["Projects", "Skills", "Timeline", "Contact"],
    credit: 2,
    placeholder: "Create a portfolio for a full-stack developer with dark theme and animated hero...",
  },
] as const;

type GeneratorId = typeof GENERATORS[number]["id"];

// ── Phase display ─────────────────────────────────────────────────
interface Phase {
  agent: string;
  icon: string;
  action: string;
  pct: number;
  done: boolean;
}

// ── Colors ────────────────────────────────────────────────────────
const C = {
  bg: "#050505", surface: "#0D0D0D", card: "#111",
  border: "rgba(255,255,255,0.08)", primary: "#FFD700",
  text: "#fff", text2: "#94A3B8", green: "#10B981", red: "#EF4444",
};

export default function BuildPage() {
  const router = useRouter();
  const supabase = createClient();

  const [selected, setSelected] = useState<GeneratorId | null>(null);
  const [prompt, setPrompt]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [phases, setPhases]     = useState<Phase[]>([]);
  const [error, setError]       = useState("");
  const [result, setResult]     = useState("");
  const [session, setSession]   = useState<any>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, [supabase]);

  const gen = GENERATORS.find(g => g.id === selected);

  const handleGenerate = async () => {
    if (!prompt.trim() || !selected) return;
    if (!session) { router.push("/auth"); return; }

    setLoading(true);
    setPhases([]);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/generate-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          type: selected,
          userId: session.user.id,
          accessToken: session.access_token,
        }),
      });

      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() || "";

        for (const chunk of chunks) {
          const em = chunk.match(/event:\s*(\S+)/);
          const dm = chunk.match(/data:\s*([\s\S]+)/);
          if (!em || !dm) continue;
          let data: any = {};
          try { data = JSON.parse(dm[1].trim()); } catch { continue; }

          if (em[1] === "phase") {
            setPhases(prev => {
              const idx = prev.findIndex(p => p.agent === data.agent);
              const p: Phase = { agent: data.agent, icon: data.icon, action: data.action, pct: data.pct, done: data.done };
              if (idx >= 0) { const n = [...prev]; n[idx] = p; return n; }
              return [...prev, p];
            });
          }
          if (em[1] === "complete") {
            setResult(data.html || "");
            // Redirect to create page with the project
            if (data.projectId) {
              router.push(`/create?id=${data.projectId}`);
            }
          }
          if (em[1] === "error") {
            setError(data.message || "Generation failed");
          }
        }
      }
    } catch (e: any) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentPct = phases.length > 0 ? Math.max(...phases.map(p => p.pct)) : 0;
  const lastPhase  = phases[phases.length - 1];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .gen-card { 
          background: ${C.card}; border: 1px solid ${C.border};
          border-radius: 16px; padding: 20px; cursor: pointer;
          transition: all 0.25s ease; position: relative; overflow: hidden;
        }
        .gen-card:hover { transform: translateY(-4px); border-color: rgba(255,215,0,0.3); box-shadow: 0 16px 40px rgba(0,0,0,0.4); }
        .gen-card.active { border-color: #FFD700; box-shadow: 0 0 0 1px #FFD700, 0 16px 40px rgba(255,215,0,0.15); }
        .gen-card .glow { position: absolute; inset: 0; opacity: 0; transition: 0.25s ease; }
        .gen-card:hover .glow, .gen-card.active .glow { opacity: 0.06; }
        .tag { font-size: 10px; padding: 2px 8px; border-radius: 20px; background: rgba(255,255,255,0.06); color: ${C.text2}; }
        textarea { resize: none; width: 100%; outline: none; }
        textarea:focus { border-color: rgba(255,215,0,0.5) !important; }
        .btn-primary {
          background: linear-gradient(135deg,#FFD700,#FF7A00); color: #050505;
          border: none; border-radius: 12px; padding: 14px 32px;
          font-weight: 700; font-size: 15px; cursor: pointer;
          transition: all 0.25s ease; white-space: nowrap;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,215,0,0.3); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .phase-item { 
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-radius: 8px;
          background: rgba(255,255,255,0.03); margin-bottom: 6px;
          transition: all 0.3s ease;
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .pulsing { animation: pulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "16px clamp(20px,4vw,64px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: C.text2, cursor: "pointer", fontSize: 14 }}>← Back</button>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, background: "linear-gradient(135deg,#FFD700,#FF7A00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Krypton AI Build Studio
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px clamp(20px,4vw,64px)" }}>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(28px,5vw,52px)", marginBottom: 12 }}>
            What are you <span style={{ background: "linear-gradient(135deg,#FFD700,#FF7A00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>building?</span>
          </h1>
          <p style={{ color: C.text2, fontSize: 16 }}>Choose your generator, describe your vision, and watch Krypton AI bring it to life.</p>
        </div>

        {/* Generator Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16, marginBottom: 48 }}>
          {GENERATORS.map(g => (
            <div
              key={g.id}
              className={`gen-card${selected === g.id ? " active" : ""}`}
              onClick={() => { setSelected(g.id); setPrompt(""); textareaRef.current?.focus(); }}
            >
              <div className="glow" style={{ background: g.gradient }} />
              <div style={{ fontSize: 32, marginBottom: 10 }}>{g.icon}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>{g.label}</span>
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "rgba(255,215,0,0.1)", color: "#FFD700", fontWeight: 600 }}>{g.credit}cr</span>
              </div>
              <p style={{ color: C.text2, fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>{g.desc}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {g.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          ))}
        </div>

        {/* Prompt Box */}
        {selected && gen && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24, marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>{gen.icon}</span>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>{gen.label} Generator</span>
              <span style={{ marginLeft: "auto", color: C.text2, fontSize: 13 }}>{gen.credit} credits</span>
            </div>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={gen.placeholder}
              rows={4}
              style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: 16, color: C.text, fontSize: 15, lineHeight: 1.6,
                fontFamily: "'DM Sans',sans-serif", transition: "border-color 0.25s ease",
                marginBottom: 16,
              }}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleGenerate(); }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <span style={{ color: C.text2, fontSize: 12 }}>Ctrl+Enter to generate • {prompt.length} chars</span>
              <button
                className="btn-primary"
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
              >
                {loading ? "Building..." : `Generate ${gen.label} ✦`}
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 16, marginBottom: 24, color: C.red }}>
            ⚠️ {error}
          </div>
        )}

        {/* Generation Progress */}
        {loading && phases.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>Building your project...</span>
              <span style={{ color: C.primary, fontWeight: 700 }}>{currentPct}%</span>
            </div>

            {/* Progress bar */}
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 20, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: "linear-gradient(90deg,#FFD700,#FF7A00)",
                width: `${currentPct}%`, transition: "width 0.5s ease",
              }} />
            </div>

            {/* Phase list */}
            <div>
              {phases.map((p, i) => (
                <div key={i} className="phase-item" style={{ opacity: p.done ? 0.6 : 1 }}>
                  <span style={{ fontSize: 16 }}>{p.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, color: p.done ? C.text2 : C.text }} className={!p.done && i === phases.length - 1 ? "pulsing" : ""}>
                    {p.action}
                  </span>
                  {p.done && <span style={{ color: C.green, fontSize: 12 }}>✓</span>}
                  {!p.done && i === phases.length - 1 && (
                    <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #FFD700", borderTopColor: "transparent", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No generator selected state */}
        {!selected && (
          <div style={{ textAlign: "center", padding: "48px 0", color: C.text2 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>☝️</div>
            <p>Select a generator above to get started</p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

        
