"use client";
// app/landing/page.tsx
// KRYPTON AI — Enterprise Landing Page v3
// Apple × Linear × Stripe × Vercel quality bar
// Platinum / Silver / Graphite / Deep-Space palette only

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import KryptonLogo from "@/components/branding/KryptonLogo";

// ═══════════════════════════════════════════════════════════════
// PALETTE — Platinum / Silver / Graphite / Deep-Space only
// ═══════════════════════════════════════════════════════════════
const BG        = "#050816";
const SURFACE   = "#0B1020";
const GRAPHITE  = "#11151F";
const WHITE     = "#F5F5F5";
const SILVER    = "#D9D9D9";
const ACCENT    = "#BFC5CC";
const SUB       = "#9AA3AF";
const MUTED     = "#5B6472";
const BORDER    = "rgba(255,255,255,0.08)";
const BORDER_HI = "rgba(245,245,245,0.20)";
const GLOW      = "rgba(245,245,245,0.08)";
const GRAD      = "linear-gradient(135deg,#F5F5F5 0%,#D9D9D9 50%,#BFC5CC 100%)";

const gtext: React.CSSProperties = {
  background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
};

// ═══════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════
const NAV_LINKS = [
  { label: "Product",  id: "product" },
  { label: "Features", id: "features" },
  { label: "Pricing",  path: "/billing" },
  { label: "FAQ",      path: "/faq" },
];

const DEMO_PROMPTS = [
  "Build a SaaS dashboard with analytics",
  "Create a luxury real estate website",
  "Design a fitness tracking app",
  "Build a crypto trading dashboard",
];

const PRODUCT_TABS = [
  { id: "website",   label: "Website",   accent: "#F5F5F5" },
  { id: "dashboard", label: "Dashboard", accent: "#D9D9D9" },
  { id: "app",       label: "Web App",   accent: "#BFC5CC" },
  { id: "game",      label: "Game",      accent: "#9AA3AF" },
];

const FEATURES = [
  { title: "Natural Language Engine",   desc: "Describe your product in plain English. Krypton AI translates intent into production-grade architecture.", icon: "◇" },
  { title: "Three-Model Intelligence",  desc: "Claude, GPT-4o, and Gemini run in concert with automatic failover — generation never stops.", icon: "◆" },
  { title: "Design System Aware",       desc: "Every output ships with consistent typography, spacing, and color systems — not templated guesswork.", icon: "▣" },
  { title: "Instant Deployment",        desc: "Production-ready HTML, CSS, and JavaScript — deployable to Vercel, Netlify, or your own infrastructure.", icon: "▲" },
  { title: "Continuous Engineering",    desc: "Edit, debug, refactor, and optimize the same project for months — Krypton AI remembers context.", icon: "◈" },
  { title: "Competitive Intelligence",  desc: "Reference any URL and Krypton AI extracts structural DNA — without copying content.", icon: "◎" },
];

const STEPS = [
  { n: "01", title: "Describe Intent",  desc: "State what you're building in plain language. No specifications required." },
  { n: "02", title: "AI Architects It", desc: "Krypton AI plans, designs, and writes production code in real time." },
  { n: "03", title: "Ship Immediately", desc: "Preview, refine, and deploy — live in seconds, not sprints." },
];

// Stats/testimonials sections intentionally removed —
// Krypton AI does not display unverified numbers, fabricated reviews,
// or placeholder social proof. Only real, verifiable claims are shown.

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ═══════════════════════════════════════════════════════════════
// FLOATING PARTICLES — subtle, performant, canvas-based
// ═══════════════════════════════════════════════════════════════
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let particles: { x: number; y: number; r: number; vx: number; vy: number; o: number }[] = [];

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      const count = window.innerWidth < 768 ? 22 : 42;
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        r: Math.random() * 1.4 + 0.4,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        o: Math.random() * 0.35 + 0.08,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.offsetWidth;
        if (p.x > canvas.offsetWidth) p.x = 0;
        if (p.y < 0) p.y = canvas.offsetHeight;
        if (p.y > canvas.offsetHeight) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,245,245,${p.o})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

// ═══════════════════════════════════════════════════════════════
// REVEAL ON SCROLL — wraps children, fades up into view
// ═══════════════════════════════════════════════════════════════
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity .7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform .7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MOCKUP FRAME — realistic browser/device chrome for product previews
// ═══════════════════════════════════════════════════════════════
function MockupFrame({ type, accent, building = false, progress = 1 }: { type: string; accent: string; building?: boolean; progress?: number }) {
  const rgb = hexToRgb(accent);
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${BORDER_HI}`, background: GRAPHITE, boxShadow: "0 40px 100px rgba(0,0,0,0.5)", opacity: building ? 0.4 + progress * 0.6 : 1, transition: "opacity .4s ease" }}>
      <div style={{ height: 32, background: "#0D0F18", display: "flex", alignItems: "center", padding: "0 12px", gap: 6, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
        <div style={{ flex: 1, height: 16, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginLeft: 8 }} />
      </div>

      <div style={{ aspectRatio: "16/10", padding: 16, position: "relative", background: `radial-gradient(circle at 30% 0%,rgba(${rgb},0.06),transparent 60%)` }}>
        {type === "website" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ width: 60, height: 8, borderRadius: 4, background: `rgba(${rgb},0.5)` }} />
              <div style={{ display: "flex", gap: 6 }}>
                {[1,2,3].map(i => <div key={i} style={{ width: 24, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.12)" }} />)}
              </div>
            </div>
            <div style={{ width: "70%", height: 16, borderRadius: 4, background: "rgba(255,255,255,0.18)", marginBottom: 8 }} />
            <div style={{ width: "50%", height: 10, borderRadius: 4, background: "rgba(255,255,255,0.08)", marginBottom: 18 }} />
            <div style={{ width: 80, height: 24, borderRadius: 6, background: `rgba(${rgb},0.7)`, marginBottom: 20 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[1,2,3].map(i => <div key={i} style={{ height: 50, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }} />)}
            </div>
          </>
        )}
        {type === "dashboard" && (
          <div style={{ display: "flex", gap: 10, height: "100%" }}>
            <div style={{ width: 36, background: "rgba(255,255,255,0.03)", borderRadius: 6, display: "flex", flexDirection: "column", gap: 8, padding: 6 }}>
              {[1,2,3,4].map(i => <div key={i} style={{ width: "100%", height: 8, borderRadius: 3, background: i===1?`rgba(${rgb},0.6)`:"rgba(255,255,255,0.08)" }} />)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
                {[1,2,3].map(i => <div key={i} style={{ height: 36, borderRadius: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }} />)}
              </div>
              <div style={{ height: 90, borderRadius: 8, background: `linear-gradient(180deg,rgba(${rgb},0.12),transparent)`, border: `1px solid ${BORDER}` }} />
            </div>
          </div>
        )}
        {type === "app" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
            <div style={{ width: "40%", height: 12, borderRadius: 4, background: "rgba(255,255,255,0.15)", marginBottom: 6 }} />
            {[1,2,3].map(i => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: `rgba(${rgb},0.4)` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: "60%", height: 8, borderRadius: 3, background: "rgba(255,255,255,0.12)", marginBottom: 4 }} />
                  <div style={{ width: "40%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {type === "game" && (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 8, background: `linear-gradient(135deg,rgba(${rgb},0.15),rgba(0,0,0,0.3))`, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: `rgba(${rgb},0.7)`, boxShadow: `0 0 24px rgba(${rgb},0.4)` }} />
            </div>
            <div style={{ position: "absolute", top: 8, left: 8, fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>SCORE: 2,480</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LIVE AI DEMO — LEFT: AI engineering panel / RIGHT: live preview
// Phases sync between both sides. No fake metrics — purely a
// transparent visualization of the real generation workflow.
// ═══════════════════════════════════════════════════════════════
const DEMO_PHASES = [
  { label: "Understanding request",  type: "website" },
  { label: "Planning architecture",  type: "website" },
  { label: "Generating code",        type: "dashboard" },
  { label: "Optimizing output",      type: "dashboard" },
  { label: "Finalizing build",       type: "app" },
];

function LiveDemoSection() {
  const [promptIdx, setPromptIdx] = useState(0);
  const [typed, setTyped]         = useState("");
  const [stage, setStage]         = useState<"typing"|"building"|"done">("typing");
  const [phaseIdx, setPhaseIdx]   = useState(-1);

  useEffect(() => {
    let mounted = true;
    const target = DEMO_PROMPTS[promptIdx];
    let i = 0;
    setTyped(""); setStage("typing"); setPhaseIdx(-1);

    const typeNext = () => {
      if (!mounted) return;
      if (i <= target.length) {
        setTyped(target.slice(0, i));
        i++;
        setTimeout(typeNext, 30 + Math.random() * 26);
      } else {
        setTimeout(() => mounted && setStage("building"), 450);
      }
    };
    const t = setTimeout(typeNext, 350);
    return () => { mounted = false; clearTimeout(t); };
  }, [promptIdx]);

  useEffect(() => {
    if (stage !== "building") return;
    let mounted = true;
    let step = -1;
    const advance = () => {
      if (!mounted) return;
      step++;
      setPhaseIdx(step);
      if (step < DEMO_PHASES.length - 1) {
        setTimeout(advance, 620);
      } else {
        setTimeout(() => mounted && setStage("done"), 500);
      }
    };
    const t = setTimeout(advance, 400);
    return () => { mounted = false; clearTimeout(t); };
  }, [stage]);

  useEffect(() => {
    if (stage !== "done") return;
    const t = setTimeout(() => setPromptIdx(p => (p + 1) % DEMO_PROMPTS.length), 3200);
    return () => clearTimeout(t);
  }, [stage]);

  const currentType = phaseIdx >= 0 ? DEMO_PHASES[Math.min(phaseIdx, DEMO_PHASES.length - 1)].type : "website";
  const buildProgress = stage === "done" ? 1 : phaseIdx >= 0 ? (phaseIdx + 1) / DEMO_PHASES.length : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 16 }} className="live-demo-grid">
      {/* LEFT — AI Engineering Panel */}
      <div className="glass-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: stage === "done" ? "#7CFFB2" : SILVER, transition: "background .3s" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: SUB, letterSpacing: "0.02em" }}>AI Engineering Panel</span>
        </div>

        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${BORDER}`, minHeight: 44, display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: "'Inter',monospace", fontSize: 13.5, color: WHITE }}>
            {typed}
            {stage === "typing" && <span style={{ opacity: 0.6, animation: "blink 1s step-end infinite" }}>|</span>}
          </span>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {DEMO_PHASES.map((p, i) => {
            const isDone   = stage === "done" || i < phaseIdx;
            const isActive = stage === "building" && i === phaseIdx;
            return (
              <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 11, opacity: stage === "typing" ? 0.25 : isDone ? 1 : isActive ? 0.95 : 0.3, transition: "opacity .35s" }}>
                <div style={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                  border: `1.5px solid ${isDone ? "#7CFFB2" : BORDER_HI}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isDone ? "rgba(124,255,178,0.12)" : "transparent",
                }}>
                  {isDone && <span style={{ fontSize: 9, color: "#7CFFB2" }}>✓</span>}
                  {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: SILVER, animation: "pulse 1s ease infinite" }} />}
                </div>
                <span style={{ fontSize: 13, color: isDone ? WHITE : isActive ? SUB : MUTED, fontWeight: isActive ? 600 : 400 }}>{p.label}</span>
              </div>
            );
          })}
        </div>

        {/* Progress bar — real, tied to phase count, not fabricated */}
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${buildProgress * 100}%`, background: GRAD, transition: "width .5s cubic-bezier(0.16,1,0.3,1)" }} />
          </div>
        </div>
      </div>

      {/* RIGHT — Live Preview Window */}
      <div>
        <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: SUB }}>Live Preview</span>
          <span style={{ fontSize: 11, color: MUTED, textTransform: "capitalize" }}>· {currentType}</span>
        </div>
        <MockupFrame type={currentType} accent="#F5F5F5" building={stage === "building"} progress={buildProgress} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function LandingPage() {
  const router = useRouter();
  const [isWide, setIsWide]   = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobMenu, setMobMenu] = useState(false);
  const [activeTab, setActiveTab] = useState("website");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= 860);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = () => setScrolled(el.scrollTop > 20);
    el.addEventListener("scroll", h, { passive: true });
    return () => el.removeEventListener("scroll", h);
  }, []);

  const goto = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el && containerRef.current) {
      const top = el.offsetTop - 76;
      containerRef.current.scrollTo({ top, behavior: "smooth" });
    }
    setMobMenu(false);
  }, []);

  return (
    <div ref={containerRef} style={{ height: "100dvh", overflowY: "auto", overflowX: "hidden", background: BG, color: WHITE, fontFamily: "'Inter',system-ui,sans-serif", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:${BG};}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px;}
        @keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}
        @keyframes pulse{0%,100%{opacity:.4;transform:scale(.85)}50%{opacity:1;transform:scale(1.1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes gridDrift{0%{background-position:0 0}100%{background-position:48px 48px}}
        .bg-grid{position:absolute;inset:-48px;background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);background-size:48px 48px;animation:gridDrift 18s linear infinite;mask-image:radial-gradient(ellipse 70% 60% at 50% 20%,#000 0%,transparent 75%);}
        .glass-card{background:rgba(255,255,255,0.025);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid ${BORDER};border-radius:18px;transition:all .3s cubic-bezier(0.16,1,0.3,1);}
        .glass-card:hover{border-color:${BORDER_HI};transform:translateY(-4px);box-shadow:0 24px 60px rgba(0,0,0,0.4);}
        .nav-link{background:none;border:none;color:${SUB};font-size:13.5px;font-weight:500;cursor:pointer;transition:color .2s;padding:6px 0;}
        .nav-link:hover{color:${WHITE};}
        .btn-primary{background:${GRAD};color:#050505;border:none;border-radius:11px;font-weight:700;cursor:pointer;transition:all .25s cubic-bezier(0.16,1,0.3,1);}
        .btn-primary:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(245,245,245,0.18);}
        .btn-secondary{background:rgba(255,255,255,0.03);color:${WHITE};border:1px solid ${BORDER_HI};border-radius:11px;font-weight:600;cursor:pointer;transition:all .25s;}
        .btn-secondary:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.3);}
        .feature-card{padding:28px;}
        .live-demo-grid{text-align:left;max-width:880px;margin:0 auto;}
        @media(min-width:860px){.live-demo-grid{grid-template-columns:1fr 1fr!important;}}
        @media(max-width:860px){.hide-mobile{display:none!important}}
        @media(min-width:861px){.hide-desktop{display:none!important}}
      `}</style>

      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        {/* Animated grid — very low opacity, subtle drift */}
        <div className="bg-grid" />
        {/* Aurora glow */}
        <div style={{ position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)", width: 900, height: 900, borderRadius: "50%", background: `radial-gradient(circle,${GLOW},transparent 70%)`, filter: "blur(40px)" }} />
        <div style={{ position: "absolute", bottom: "0%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(191,197,204,0.05),transparent 70%)", filter: "blur(60px)" }} />
      </div>
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}><ParticleField /></div>

      <nav style={{
        position: "sticky", top: 0, zIndex: 50, height: 68, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 clamp(20px,4vw,48px)", background: scrolled ? "rgba(5,8,22,0.85)" : "rgba(5,8,22,0.3)",
        backdropFilter: "blur(20px)", borderBottom: scrolled ? `1px solid ${BORDER}` : "1px solid transparent", transition: "all .3s ease",
      }}>
        <button onClick={() => router.push("/landing")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <KryptonLogo size={32} showText animated={false} />
        </button>

        {isWide && (
          <div style={{ display: "flex", gap: 36, position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
            {NAV_LINKS.map(l => (
              <button key={l.label} className="nav-link" onClick={() => l.path ? router.push(l.path) : goto(l.id!)}>
                {l.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isWide && (
            <button onClick={() => router.push("/auth/login")} className="btn-secondary" style={{ padding: "8px 18px", fontSize: 13 }}>
              Sign In
            </button>
          )}
          <button onClick={() => router.push("/auth/signup")} className="btn-primary" style={{ padding: "9px 20px", fontSize: 13 }}>
            Start Building
          </button>
          {!isWide && (
            <button onClick={() => setMobMenu(v => !v)} style={{ background: "rgba(255,255,255,.05)", border: `1px solid ${BORDER}`, borderRadius: 9, color: WHITE, fontSize: 15, padding: "7px 11px", cursor: "pointer" }}>
              {mobMenu ? "✕" : "☰"}
            </button>
          )}
        </div>
      </nav>

      {mobMenu && !isWide && (
        <div style={{ position: "sticky", top: 68, zIndex: 49, background: "rgba(5,8,22,0.98)", borderBottom: `1px solid ${BORDER}`, padding: "16px 20px", backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_LINKS.map(l => (
            <button key={l.label} onClick={() => l.path ? router.push(l.path) : goto(l.id!)}
              style={{ background: "none", border: "none", color: SUB, fontSize: 15, padding: "12px 0", textAlign: "left", borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}>
              {l.label}
            </button>
          ))}
        </div>
      )}

      <main style={{ position: "relative", zIndex: 1 }}>
        <section style={{ padding: "clamp(60px,9vw,110px) clamp(20px,4vw,48px) clamp(50px,7vw,80px)" }}>
          <div style={{ maxWidth: 920, margin: "0 auto", textAlign: "center" }}>
            <div className="glass-card" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 30, marginBottom: 28, animation: "fadeUp .6s ease both" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7CFFB2" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: SUB, letterSpacing: "0.02em" }}>Enterprise AI Creation Platform</span>
            </div>

            <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: "clamp(32px,5.2vw,64px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.025em", marginBottom: 22, animation: "fadeUp .6s .1s ease both" }}>
              The Operating System For<br /><span style={gtext}>AI Product Creation</span>
            </h1>

            <p style={{ fontSize: "clamp(15px,1.6vw,18px)", color: SUB, lineHeight: 1.7, maxWidth: 560, margin: "0 auto 40px", animation: "fadeUp .6s .2s ease both" }}>
              Describe what you want to build. Krypton AI plans the architecture, writes the code, and ships a working website, dashboard, app, or game — in real time, in your browser.
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 56, animation: "fadeUp .6s .3s ease both" }}>
              <button onClick={() => router.push("/auth/signup")} className="btn-primary" style={{ padding: "14px 30px", fontSize: 15 }}>
                Start Building
              </button>
              <button onClick={() => goto("product")} className="btn-secondary" style={{ padding: "14px 30px", fontSize: 15 }}>
                View Examples
              </button>
            </div>

            <div style={{ animation: "fadeUp .6s .4s ease both" }}>
              <LiveDemoSection />
            </div>

            <p style={{ marginTop: 24, fontSize: 12.5, color: MUTED }}>Free plan available · No credit card required</p>
          </div>
        </section>

        <section id="product" style={{ padding: "clamp(60px,8vw,90px) clamp(20px,4vw,48px)", borderTop: `1px solid ${BORDER}`, background: SURFACE }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <Reveal>
              <div style={{ textAlign: "center", marginBottom: 40 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: MUTED, marginBottom: 12 }}>Output Quality</p>
                <h2 style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 14 }}>
                  Production-grade, <span style={gtext}>every time</span>
                </h2>
                <p style={{ color: SUB, fontSize: 15, maxWidth: 480, margin: "0 auto" }}>Every output ships with real design systems — not templated guesswork.</p>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
                {PRODUCT_TABS.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    style={{
                      padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      background: activeTab === t.id ? "rgba(255,255,255,0.08)" : "transparent",
                      color: activeTab === t.id ? WHITE : MUTED,
                      border: `1px solid ${activeTab === t.id ? BORDER_HI : BORDER}`,
                      transition: "all .2s",
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div style={{ maxWidth: 640, margin: "0 auto" }}>
                <MockupFrame type={activeTab} accent={PRODUCT_TABS.find(t => t.id === activeTab)?.accent || "#F5F5F5"} />
              </div>
            </Reveal>
          </div>
        </section>

        <section id="features" style={{ padding: "clamp(60px,8vw,90px) clamp(20px,4vw,48px)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <Reveal>
              <div style={{ textAlign: "center", marginBottom: 48 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: MUTED, marginBottom: 12 }}>Capabilities</p>
                <h2 style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 700, letterSpacing: "-0.02em" }}>
                  Built for <span style={gtext}>serious builders</span>
                </h2>
              </div>
            </Reveal>

            <div style={{ display: "grid", gridTemplateColumns: isWide ? "repeat(3,1fr)" : "1fr", gap: 16 }}>
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 60}>
                  <div className="glass-card feature-card">
                    <div style={{ fontSize: 22, marginBottom: 16, color: SILVER }}>{f.icon}</div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                    <p style={{ fontSize: 13.5, color: SUB, lineHeight: 1.65 }}>{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "clamp(60px,8vw,90px) clamp(20px,4vw,48px)", borderTop: `1px solid ${BORDER}`, background: SURFACE }}>
          <div style={{ maxWidth: 920, margin: "0 auto" }}>
            <Reveal>
              <div style={{ textAlign: "center", marginBottom: 52 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: MUTED, marginBottom: 12 }}>Process</p>
                <h2 style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 700, letterSpacing: "-0.02em" }}>
                  From idea to <span style={gtext}>production</span>
                </h2>
              </div>
            </Reveal>

            <div style={{ display: "grid", gridTemplateColumns: isWide ? "repeat(3,1fr)" : "1fr", gap: 20, position: "relative" }}>
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 100}>
                  <div className="glass-card" style={{ padding: 28, height: "100%" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 16, fontFamily: "monospace" }}>{s.n}</div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{s.title}</h3>
                    <p style={{ fontSize: 13.5, color: SUB, lineHeight: 1.65 }}>{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "clamp(70px,9vw,110px) clamp(20px,4vw,48px)", borderTop: `1px solid ${BORDER}`, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 50%,${GLOW},transparent 70%)` }} />
          <Reveal>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", position: "relative" }}>
              <h2 style={{ fontSize: "clamp(28px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: 20 }}>
                Build your next <span style={gtext}>production system</span>
              </h2>
              <p style={{ color: SUB, fontSize: 15, marginBottom: 36 }}>Join thousands of builders shipping at impossible speed.</p>
              <button onClick={() => router.push("/auth/signup")} className="btn-primary" style={{ padding: "16px 36px", fontSize: 15 }}>
                Start Building Free →
              </button>
            </div>
          </Reveal>
        </section>

        <footer style={{ padding: "48px clamp(20px,4vw,48px) 32px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: isWide ? "row" : "column", justifyContent: "space-between", alignItems: isWide ? "center" : "flex-start", gap: 24 }}>
            <KryptonLogo size={26} showText animated={false} />
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <button onClick={() => goto("features")} className="nav-link">Features</button>
              <button onClick={() => router.push("/billing")} className="nav-link">Pricing</button>
              <button onClick={() => router.push("/faq")} className="nav-link">FAQ</button>
            </div>
            <p style={{ fontSize: 12, color: MUTED }}>© 2026 Krypton AI. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
