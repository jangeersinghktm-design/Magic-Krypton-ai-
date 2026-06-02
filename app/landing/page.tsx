"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Theme ───────────────────────────────────────────────
const T = {
  gold: "#F5C542",
  green: "#00D084",
  bg: "#050505",
  card: "#101010",
  border: "rgba(245,197,66,0.12)",
  grad: "linear-gradient(135deg, #F5C542 0%, #00D084 100%)",
  text: "#FFFFFF",
  sub: "#B3B3B3",
  muted: "#6B7280",
};

// ─── Static data ─────────────────────────────────────────
const PROMPTS = [
  "Build a SaaS dashboard...",
  "Create a portfolio website...",
  "Build an invoice generator...",
  "Create a CRM system...",
  "Build a browser game...",
  "Create a fitness app...",
];

const NAV_LINKS = ["Features", "Pricing", "Examples", "Roadmap"];

const FEATURES = [
  { icon: "🌐", title: "Websites", desc: "Landing pages, portfolios, business sites — pixel-perfect and responsive." },
  { icon: "📱", title: "Web Apps", desc: "Dashboards, CRM tools, productivity apps with full interactivity." },
  { icon: "🎮", title: "Browser Games", desc: "Snake, 2048, puzzle games — fully playable in the browser." },
  { icon: "📊", title: "Business Tools", desc: "Calculators, forms, trackers — tools that actually work." },
];

const WHY_CARDS = [
  { icon: "⚡", title: "Instant Preview", desc: "See your project live as it's generated. No waiting, no setup." },
  { icon: "📱", title: "Mobile Responsive", desc: "Every output is mobile-ready out of the box." },
  { icon: "🎮", title: "Browser Games", desc: "Build fully playable games — unique to Krypton AI." },
  { icon: "💾", title: "Download HTML", desc: "Own your code. Download and deploy anywhere." },
];

const REAL_PROJECTS = [
  { icon: "🌐", title: "Business Websites" },
  { icon: "🎮", title: "Browser Games" },
  { icon: "📊", title: "Dashboards" },
  { icon: "🛠", title: "Internal Tools" },
];

const EXAMPLES = ["SaaS Dashboard", "Restaurant Site", "Portfolio", "Calculator", "Snake Game", "CRM Tool"];

const STEPS = [
  { step: "01", title: "Describe Your Idea", desc: "Type what you want to build in plain English. No technical knowledge needed." },
  { step: "02", title: "AI Generates Project", desc: "Krypton AI builds your project instantly — complete HTML, CSS, and JavaScript." },
  { step: "03", title: "Download & Launch", desc: "Preview live, download the code, or share directly. Ready to deploy." },
];

const FAQS = [
  { q: "What can Krypton build?", a: "Websites, web apps, browser games, dashboards, calculators, portfolios, and more — all as production-ready HTML files." },
  { q: "Do I need coding skills?", a: "No. Just describe what you want in plain English and Krypton AI generates it instantly." },
  { q: "Can I download the code?", a: "Yes. Every project can be downloaded as a complete HTML file, ready to deploy anywhere." },
  { q: "Does it work on mobile?", a: "Yes, Krypton AI is fully responsive and works on all devices." },
  { q: "What AI models are used?", a: "Krypton uses Claude AI as the primary model with Gemini as fallback for maximum reliability." },
];

const PLANS = [
  {
    name: "Free", monthlyPrice: "$0", yearlyPrice: "$0",
    credits: "5 credits/day",
    features: ["5 generations/day", "Basic preview", "Download HTML", "Community support"],
    highlight: false, cta: "Get Started Free",
  },
  {
    name: "Pro", monthlyPrice: "$25", yearlyPrice: "$20",
    credits: "100 credits/month",
    features: ["100 generations/month", "Priority AI model", "Save projects", "Export code", "Email support"],
    highlight: true, cta: "Start Pro",
  },
  {
    name: "Premium", monthlyPrice: "$69", yearlyPrice: "$55",
    credits: "300 credits/month",
    features: ["300 generations/month", "Fastest AI model", "Team workspace", "API access", "Priority support"],
    highlight: false, cta: "Start Premium",
  },
  {
    name: "Business", monthlyPrice: "$149", yearlyPrice: "$119",
    credits: "100 credits/day",
    features: ["100 generations/day", "All Premium features", "Custom domain", "Dedicated support", "SLA guarantee"],
    highlight: false, cta: "Contact Us",
  },
];

// ─── Logo SVG ─────────────────────────────────────────────
function KryptonLogo({ size = 32 }: { size?: number }) {
  const id = `g${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="Krypton AI Logo">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5C542" />
          <stop offset="100%" stopColor="#00D084" />
        </linearGradient>
      </defs>
      <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="none" stroke={`url(#${id})`} strokeWidth="2" />
      <polygon points="16,7 24,11.5 24,20.5 16,25 8,20.5 8,11.5" fill="rgba(0,208,132,0.1)" stroke={`url(#${id})`} strokeWidth="1" />
      <text x="16" y="21" textAnchor="middle" fill={`url(#${id})`} fontSize="10" fontWeight="bold" fontFamily="sans-serif">Kr</text>
    </svg>
  );
}

// ─── Gradient text helper ─────────────────────────────────
function GradText({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", ...style }}>
      {children}
    </span>
  );
}

// ─── Section label ────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ textAlign: "center", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px", background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
      {children}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [promptIndex, setPromptIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Responsive
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Typing animation
  useEffect(() => {
    const target = PROMPTS[promptIndex];
    let i = 0;
    setDisplayed("");
    setIsTyping(true);
    const interval = setInterval(() => {
      if (i < target.length) {
        setDisplayed(target.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
        setTimeout(() => setPromptIndex((p) => (p + 1) % PROMPTS.length), 2500);
      }
    }, 48);
    return () => clearInterval(interval);
  }, [promptIndex]);

  // Click outside dropdown
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowDropdown(false); setMobileMenu(false); } };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleEsc); };
  }, []);

  const scrollTo = useCallback((id: string) => {
    setMobileMenu(false);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const sectionStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    scrollMarginTop: "80px",
    ...extra,
  });

  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", overflowX: "hidden" }}>

      {/* Grid bg */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: `linear-gradient(rgba(245,197,66,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,66,0.025) 1px, transparent 1px)`, backgroundSize: "48px 48px", pointerEvents: "none", zIndex: 0 }} />

      {/* ── NAVBAR ── */}
      <nav role="navigation" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, borderBottom: `1px solid ${T.border}`, background: "rgba(5,5,5,0.92)", backdropFilter: "blur(16px)", padding: "0 20px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>

        {/* Logo + dropdown */}
        <div ref={dropdownRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: "6px" }}>
          <KryptonLogo size={28} />
          <button
            aria-label="Krypton AI menu"
            aria-expanded={showDropdown}
            onClick={(e) => { e.stopPropagation(); setShowDropdown((v) => !v); }}
            style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: "8px" }}
          >
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "15px", background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Krypton AI</span>
            <span style={{ color: "#666", fontSize: "10px" }}>&#9660;</span>
          </button>

          {showDropdown && (
            <div style={{ position: "absolute", top: "44px", left: 0, background: "#111", border: `1px solid ${T.border}`, borderRadius: "12px", padding: "6px", minWidth: "180px", zIndex: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
              {["Settings ⚙", "Billing 💳", "API Keys 🔑", "Roadmap 🗺", "Changelog 📋"].map((item) => (
                <button key={item} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: T.muted, fontSize: "13px", cursor: "pointer", borderRadius: "8px" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = T.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.muted; }}
                >
                  {item}
                </button>
              ))}
              <div style={{ height: "1px", background: T.border, margin: "4px 0" }} />
              <button onClick={() => router.push("/auth/login")} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: "#ef4444", fontSize: "13px", cursor: "pointer", borderRadius: "8px" }}>
                Login →
              </button>
            </div>
          )}
        </div>

        {/* Desktop nav */}
        <div className="desktop-nav" style={{ gap: "24px", position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          {NAV_LINKS.map((item) => (
            <button key={item} onClick={() => scrollTo(item.toLowerCase())} style={{ background: "none", border: "none", color: T.muted, fontSize: "13px", cursor: "pointer", fontWeight: 500, padding: "4px 0" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.gold)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Right CTA */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {!isMobile && (
            <button onClick={() => router.push("/auth/login")} style={{ padding: "7px 16px", background: "none", border: `1px solid ${T.border}`, borderRadius: "9px", color: T.muted, fontSize: "13px", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
            >
              Login
            </button>
          )}
          <button onClick={() => router.push("/auth/signup")} style={{ padding: "7px 16px", background: T.grad, border: "none", borderRadius: "9px", color: "#050505", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Get Started
          </button>
          {/* Hamburger */}
          {isMobile && (
            <button aria-label="Toggle menu" onClick={() => setMobileMenu((v) => !v)} style={{ background: "none", border: "none", color: T.text, fontSize: "20px", cursor: "pointer", padding: "4px" }}>
              {mobileMenu ? "✕" : "☰"}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenu && (
        <div style={{ position: "fixed", top: "60px", left: 0, right: 0, background: "#0C0C0C", borderBottom: `1px solid ${T.border}`, padding: "16px 20px", zIndex: 99, display: "flex", flexDirection: "column", gap: "4px" }}>
          {NAV_LINKS.map((item) => (
            <button key={item} onClick={() => scrollTo(item.toLowerCase())} style={{ background: "none", border: "none", color: T.sub, fontSize: "15px", cursor: "pointer", padding: "10px 0", textAlign: "left", fontWeight: 500 }}>
              {item}
            </button>
          ))}
          <button onClick={() => { router.push("/auth/login"); setMobileMenu(false); }} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "9px", color: T.text, fontSize: "14px", cursor: "pointer", padding: "10px", marginTop: "8px" }}>
            Login
          </button>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: isMobile ? "80px 20px 40px" : "80px 24px 60px", position: "relative", zIndex: 1 }}>
        <div style={{ position: "absolute", top: "25%", left: "15%", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(245,197,66,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "35%", right: "15%", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(0,208,132,0.05) 0%, transparent 65%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: "1200px", margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "40px" : "60px", alignItems: "center" }}>

          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(245,197,66,0.07)", border: `1px solid ${T.border}`, borderRadius: "20px", padding: "5px 14px", marginBottom: "1.5rem", fontSize: "11px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.green, display: "inline-block" }} />
              <GradText>Powered by Claude AI · Now Live</GradText>
            </div>

            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? "clamp(28px, 8vw, 40px)" : "clamp(32px, 4vw, 56px)", fontWeight: 800, lineHeight: 1.1, marginBottom: "1.2rem" }}>
              Build production-ready<br />software with AI.
              <br />
              <GradText>in minutes, not weeks.</GradText>
            </h1>

            <p style={{ color: T.sub, fontSize: "16px", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "480px" }}>
              Describe your idea in plain English. Krypton AI generates websites, apps, dashboards, tools and games instantly.
            </p>

            {/* Prompt Box */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "14px 16px", marginBottom: "1.5rem", boxShadow: "0 0 40px rgba(245,197,66,0.04)" }}>
              <textarea
                aria-label="Describe what you want to build"
                rows={3}
                placeholder={displayed + (isTyping ? "|" : "")}
                style={{ width: "100%", background: "none", border: "none", color: T.text, fontSize: "15px", resize: "none", outline: "none", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px", borderTop: `1px solid ${T.border}`, paddingTop: "10px" }}>
                <button aria-label="Upload file" style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#1a1a1a", border: `1px solid ${T.border}`, color: T.muted, fontSize: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 300 }}>+</button>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button aria-label="Select build mode" style={{ padding: "7px 12px", background: "#1a1a1a", border: `1px solid ${T.border}`, borderRadius: "9px", color: T.muted, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                    Website <span style={{ fontSize: "9px" }}>&#9660;</span>
                  </button>
                  <button aria-label="Voice input" style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#1a1a1a", border: `1px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="2" width="6" height="11" rx="3" fill={T.muted} />
                      <path d="M5 11a7 7 0 0 0 14 0" stroke={T.muted} strokeWidth="2" strokeLinecap="round" />
                      <line x1="12" y1="18" x2="12" y2="22" stroke={T.muted} strokeWidth="2" strokeLinecap="round" />
                      <line x1="8" y1="22" x2="16" y2="22" stroke={T.muted} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button aria-label="Generate" onClick={() => router.push("/auth/signup")} style={{ width: "34px", height: "34px", borderRadius: "50%", background: T.grad, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M12 19V5M5 12l7-7 7 7" stroke="#050505" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Trust bar */}
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              {["No credit card required", "Export HTML", "Mobile responsive", "Browser games"].map((item) => (
                <span key={item} style={{ fontSize: "12px", color: T.muted, display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ color: T.green }}>✓</span> {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right demo — desktop only */}
          {!isMobile && (
            <div style={{ position: "relative" }}>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", overflow: "hidden", boxShadow: "0 0 60px rgba(245,197,66,0.07)" }}>
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "6px" }}>
                  {["#ff5f57", "#ffbd2e", "#28c940"].map((c) => <div key={c} style={{ width: "8px", height: "8px", borderRadius: "50%", background: c }} />)}
                  <span style={{ fontSize: "11px", color: T.muted, marginLeft: "6px" }}>Live Preview</span>
                </div>
                <div style={{ padding: "20px", minHeight: "260px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ height: "12px", background: `linear-gradient(90deg, rgba(245,197,66,0.4), rgba(0,208,132,0.2))`, borderRadius: "6px", width: "65%" }} />
                  <div style={{ height: "8px", background: "#1a1a1a", borderRadius: "4px", width: "88%" }} />
                  <div style={{ height: "8px", background: "#1a1a1a", borderRadius: "4px", width: "75%" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "6px" }}>
                    {[1, 2, 3, 4].map((i) => <div key={i} style={{ height: "55px", background: "#1a1a1a", borderRadius: "8px", border: `1px solid ${T.border}` }} />)}
                  </div>
                  <div style={{ height: "30px", background: T.grad, borderRadius: "8px", width: "38%", marginTop: "6px", opacity: 0.85 }} />
                </div>
              </div>
              <div style={{ position: "absolute", bottom: "-16px", left: "50%", transform: "translateX(-50%)", width: "75%", height: "36px", background: "radial-gradient(ellipse, rgba(245,197,66,0.18) 0%, transparent 70%)", filter: "blur(8px)" }} />
            </div>
          )}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ ...sectionStyle({ padding: isMobile ? "60px 20px" : "80px 24px" }) }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <SectionLabel>What You Can Build</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>Everything you need to ship fast.</h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px" }}>
            {FEATURES.map((c) => (
              <div key={c.title} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", transition: "all 0.2s", cursor: "default" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(245,197,66,0.09)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: "28px", marginBottom: "14px" }}>{c.icon}</div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "8px" }}><GradText>{c.title}</GradText></h3>
                <p style={{ color: T.sub, fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ ...sectionStyle({ padding: isMobile ? "60px 20px" : "80px 24px", background: "#0A0A0A", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }) }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <SectionLabel>Simple Process</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>How It Works</h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "16px" }}>
            {STEPS.map((s) => (
              <div key={s.step} style={{ position: "relative", padding: "24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "44px", fontWeight: 800, position: "absolute", top: "14px", right: "18px", opacity: 0.12, background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.step}</div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "10px" }}>{s.title}</h3>
                <p style={{ color: T.sub, fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY KRYPTON ── */}
      <section style={{ ...sectionStyle({ padding: isMobile ? "60px 20px" : "80px 24px" }) }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <SectionLabel>Why Krypton</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>Why Builders Choose Krypton</h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "14px" }}>
            {WHY_CARDS.map((c) => (
              <div key={c.title} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "20px 16px", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.green; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,208,132,0.07)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: "26px", marginBottom: "10px" }}>{c.icon}</div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>{c.title}</h3>
                <p style={{ color: T.sub, fontSize: "12px", lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REAL PROJECTS ── */}
      <section style={{ ...sectionStyle({ padding: isMobile ? "60px 20px" : "80px 24px", background: "#0A0A0A", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }) }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <SectionLabel>Real Use Cases</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>Built for Real Projects</h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "12px" }}>
            {REAL_PROJECTS.map((p) => (
              <div key={p.title} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "28px 16px", textAlign: "center", transition: "all 0.2s", cursor: "default" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.background = "#141414"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card; }}
              >
                <div style={{ fontSize: "26px", marginBottom: "10px" }}>{p.icon}</div>
                <p style={{ color: T.text, fontWeight: 600, fontSize: "13px", margin: 0 }}>{p.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXAMPLES ── */}
      <section id="examples" style={{ ...sectionStyle({ padding: isMobile ? "60px 20px" : "80px 24px" }) }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <SectionLabel>Built With Krypton</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>Examples Gallery</h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: "12px" }}>
            {EXAMPLES.map((item) => (
              <div key={item} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "28px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.background = "#141414"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card; e.currentTarget.style.transform = "none"; }}
              >
                <p style={{ color: T.text, fontWeight: 600, fontSize: "14px", margin: 0 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROADMAP ── */}
      <section id="roadmap" style={{ ...sectionStyle({ padding: isMobile ? "60px 20px" : "80px 24px", background: "#0A0A0A", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }) }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <SectionLabel>What's Next</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>Roadmap</h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "16px" }}>
            <div style={{ background: T.card, border: "1px solid rgba(0,208,132,0.2)", borderRadius: "16px", padding: "24px" }}>
              <p style={{ color: T.green, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>Live Now</p>
              {["Website Generator", "App Generator", "Game Generator", "Project Save & Export"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <span style={{ color: T.green }}>✅</span>
                  <span style={{ fontSize: "14px" }}>{item}</span>
                </div>
              ))}
            </div>
            <div style={{ background: T.card, border: "1px solid rgba(245,197,66,0.2)", borderRadius: "16px", padding: "24px" }}>
              <p style={{ color: T.gold, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>Coming Soon</p>
              {["AI Campaign Builder", "Team Workspaces", "Templates Marketplace", "API Access"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <span>🚀</span>
                  <span style={{ fontSize: "14px", color: T.sub }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ ...sectionStyle({ padding: isMobile ? "60px 20px" : "80px 24px" }) }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <SectionLabel>Simple Pricing</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, textAlign: "center", marginBottom: "1.5rem" }}>Pricing</h2>

          {/* Toggle */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "2.5rem" }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "4px", display: "flex" }}>
              {(["monthly", "yearly"] as const).map((c) => (
                <button key={c} onClick={() => setBilling(c)} style={{ padding: "8px 20px", borderRadius: "9px", border: "none", background: billing === c ? T.grad : "none", color: billing === c ? "#050505" : T.muted, fontSize: "13px", fontWeight: billing === c ? 700 : 400, cursor: "pointer" }}>
                  {c === "monthly" ? "Monthly" : "Yearly"}{c === "yearly" && <span style={{ fontSize: "10px", marginLeft: "5px", opacity: 0.8 }}>20% off</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
            {PLANS.map((plan) => (
              <div key={plan.name} style={{ background: plan.highlight ? "rgba(245,197,66,0.04)" : T.card, border: plan.highlight ? "1px solid rgba(245,197,66,0.35)" : `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", position: "relative", boxShadow: plan.highlight ? "0 0 40px rgba(245,197,66,0.07)" : "none", transition: "transform 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
              >
                {plan.highlight && (
                  <div style={{ position: "absolute" as "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: T.grad, color: "#050505", fontSize: "11px", fontWeight: 700, padding: "3px 14px", borderRadius: "20px", whiteSpace: "nowrap" }}>
                    Most Popular
                  </div>
                )}
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "4px" }}>{plan.name}</h3>
                <p style={{ color: T.green, fontSize: "12px", marginBottom: "12px" }}>{plan.credits}</p>
                <div style={{ marginBottom: "18px" }}>
                  <span style={{ fontSize: "34px", fontWeight: 800, background: plan.highlight ? T.grad : T.text, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                  </span>
                  <span style={{ color: T.muted, fontSize: "13px" }}>/mo</span>
                </div>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "9px" }}>
                    <span style={{ color: T.green, fontSize: "13px", flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: "13px", color: T.sub }}>{f}</span>
                  </div>
                ))}
                <button onClick={() => router.push("/auth/signup")} style={{ width: "100%", marginTop: "18px", padding: "11px", background: plan.highlight ? T.grad : "#161616", border: plan.highlight ? "none" : `1px solid ${T.border}`, borderRadius: "10px", color: plan.highlight ? "#050505" : T.text, fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ ...sectionStyle({ padding: isMobile ? "60px 20px" : "80px 24px", background: "#0A0A0A", borderTop: `1px solid ${T.border}` }) }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <SectionLabel>FAQ</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>Frequently Asked</h2>
          {FAQS.map((item, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${T.border}`, padding: "18px 0" }}>
              <p style={{ fontWeight: 600, fontSize: "15px", marginBottom: "8px" }}>{item.q}</p>
              <p style={{ color: T.sub, fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: isMobile ? "60px 20px" : "80px 24px", textAlign: "center", borderTop: `1px solid ${T.border}`, position: "relative", zIndex: 1 }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "500px", height: "280px", background: "radial-gradient(ellipse, rgba(245,197,66,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? "clamp(24px, 6vw, 36px)" : "clamp(28px, 4vw, 48px)", fontWeight: 800, marginBottom: "1.5rem" }}>
          The future of building is<br />
          <GradText>a sentence away.</GradText>
        </h2>
        <button onClick={() => router.push("/auth/signup")} style={{ padding: "15px 36px", background: T.grad, border: "none", borderRadius: "14px", color: "#050505", fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>
          Start Free — No credit card required →
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: isMobile ? "40px 20px 24px" : "60px 24px 28px", background: "#0A0A0A" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? "28px" : "40px", marginBottom: "36px" }}>
            {[
              { title: "Product", links: ["Features", "Pricing", "Roadmap"] },
              { title: "Resources", links: ["Documentation", "Changelog", "Support"] },
              { title: "Company", links: ["Contact", "About"] },
              { title: "Legal", links: ["Privacy Policy", "Terms"] },
            ].map((col) => (
              <div key={col.title}>
                <p style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px", background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{col.title}</p>
                {col.links.map((link) => (
                  <p key={link} style={{ color: T.muted, fontSize: "13px", marginBottom: "9px", cursor: "pointer", transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.gold)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
                  >
                    {link}
                  </p>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <KryptonLogo size={22} />
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "13px", background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Krypton AI</span>
            </div>
            <p style={{ color: T.muted, fontSize: "12px", margin: 0 }}>© 2026 Krypton AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
