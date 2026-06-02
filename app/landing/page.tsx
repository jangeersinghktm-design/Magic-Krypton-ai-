"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

const T = {
  gold: "#F5C542",
  orange: "#FF8A00",
  green: "#00D084",
  bg: "#050505",
  card: "#0D0D0D",
  border: "rgba(245,197,66,0.1)",
  grad: "linear-gradient(135deg, #F5C542 0%, #FF8A00 50%, #00D084 100%)",
  text: "#FFFFFF",
  sub: "#B3B3B3",
  muted: "#6B7280",
};

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
  {
    title: "Websites",
    desc: "Landing pages, portfolios, business sites — pixel-perfect and responsive.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#fg)" strokeWidth="1.5" strokeLinecap="round">
        <defs><linearGradient id="fg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#F5C542"/><stop offset="100%" stopColor="#00D084"/></linearGradient></defs>
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  },
  {
    title: "Web Apps",
    desc: "Dashboards, CRM tools, productivity apps with full interactivity.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#fg2)" strokeWidth="1.5" strokeLinecap="round">
        <defs><linearGradient id="fg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#F5C542"/><stop offset="100%" stopColor="#00D084"/></linearGradient></defs>
        <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
      </svg>
    ),
  },
  {
    title: "Browser Games",
    desc: "Snake, 2048, puzzle games — fully playable in the browser.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#fg3)" strokeWidth="1.5" strokeLinecap="round">
        <defs><linearGradient id="fg3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#F5C542"/><stop offset="100%" stopColor="#00D084"/></linearGradient></defs>
        <line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1" fill="url(#fg3)"/><circle cx="17" cy="13" r="1" fill="url(#fg3)"/><path d="M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/>
      </svg>
    ),
  },
  {
    title: "Business Tools",
    desc: "Calculators, forms, trackers — tools that actually work.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#fg4)" strokeWidth="1.5" strokeLinecap="round">
        <defs><linearGradient id="fg4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#F5C542"/><stop offset="100%" stopColor="#00D084"/></linearGradient></defs>
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
];

const PLANS = [
  {
    name: "Free", emoji: "🟢", monthlyPrice: "$0", yearlyPrice: "$0",
    credits: "5 Generations / Day",
    highlight: false, cta: "Get Started Free",
    included: ["Website Generator", "App Generator", "Game Generator", "Live Preview", "Mobile Responsive Output", "Download HTML", "Community Support"],
    locked: ["Save Projects", "Project History", "Advanced AI Model", "Unlimited Generations", "Team Workspace", "API Access", "Priority Support"],
  },
  {
    name: "Pro", emoji: "🔥", monthlyPrice: "$25", yearlyPrice: "$20",
    credits: "100 Generations / Month",
    highlight: true, cta: "Start Pro",
    included: ["Everything in Free", "Save Projects", "Project History", "Faster Generation Speed", "Better AI Quality", "Export Full Source Code", "Private Projects", "Premium Templates", "Priority Queue", "Email Support"],
    locked: ["Team Workspace", "API Access", "Unlimited Usage"],
  },
  {
    name: "Premium", emoji: "💎", monthlyPrice: "$69", yearlyPrice: "$55",
    credits: "300 Generations / Month",
    highlight: false, cta: "Start Premium",
    included: ["Everything in Pro", "Fastest AI Model", "Unlimited Project Saves", "Advanced App Generation", "Advanced Game Generation", "Custom Branding Removal", "Version History", "Project Duplication", "Team Collaboration (5 Users)", "Early Access Features", "Priority Support"],
    locked: ["API Access"],
  },
  {
    name: "Business", emoji: "🏢", monthlyPrice: "$149", yearlyPrice: "$119",
    credits: "100 Generations / Day",
    highlight: false, cta: "Contact Us",
    included: ["Everything in Premium", "API Access", "Unlimited Team Members", "Team Workspace", "Shared Projects", "Admin Dashboard", "Usage Analytics", "White Label Support", "Custom Integrations", "Dedicated Priority Queue", "Business Support SLA"],
    locked: [],
  },
];

const TESTIMONIALS = [
  { stars: 5, text: "Generated my startup landing page in 2 minutes. Absolutely incredible.", name: "Alex", role: "Founder" },
  { stars: 5, text: "Much faster than hiring freelancers. The quality is production-ready.", name: "Sarah", role: "Designer" },
  { stars: 5, text: "Built a full CRM tool with Krypton AI in one afternoon. Game changer.", name: "Raj", role: "Product Manager" },
];

const FAQS = [
  { q: "What can Krypton AI build?", a: "Websites, web apps, browser games, dashboards, calculators, portfolios, and more — all as production-ready HTML files." },
  { q: "How does Krypton AI work?", a: "Simply describe what you want to build in plain English. Krypton AI transforms your idea into a complete, responsive, and production-ready project within seconds." },
  { q: "How does Krypton AI generate projects?", a: "Krypton AI analyzes your prompt and automatically creates complete, responsive, and production-ready projects in real time." },
  { q: "Is Krypton AI reliable?", a: "Yes. Krypton AI is built for speed, accuracy, and reliability, helping users generate high-quality projects with minimal effort." },
  { q: "Can I download the code?", a: "Yes. Every project can be downloaded as a complete HTML file, ready to deploy anywhere." },
  { q: "Do I need coding skills?", a: "No. Just describe what you want in plain English and Krypton AI generates it instantly." },
];

const STEPS = [
  { step: "01", title: "Describe Your Idea", desc: "Type what you want to build in plain English. No technical knowledge needed." },
  { step: "02", title: "AI Generates Project", desc: "Krypton AI builds your project instantly — complete HTML, CSS, and JavaScript." },
  { step: "03", title: "Download & Launch", desc: "Preview live, download the code, or share directly. Ready to deploy." },
];

const EXAMPLES = [
  { title: "SaaS Dashboard", color: "rgba(245,197,66,0.15)" },
  { title: "Restaurant Site", color: "rgba(0,208,132,0.15)" },
  { title: "Portfolio", color: "rgba(255,138,0,0.15)" },
  { title: "Calculator", color: "rgba(245,197,66,0.1)" },
  { title: "Snake Game", color: "rgba(0,208,132,0.1)" },
  { title: "CRM Tool", color: "rgba(255,138,0,0.1)" },
];

  function KryptonLogo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/logo.jpeg"
      alt="Krypton AI"
      style={{ height: "40px", width: "auto", objectFit: "contain" }}
    />
  );
  }

function GradText({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", ...style }}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ textAlign: "center", fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "12px", background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
      {children}
    </p>
  );
}

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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const target = PROMPTS[promptIndex];
    let i = 0;
    setDisplayed("");
    setIsTyping(true);
    const interval = setInterval(() => {
      if (i < target.length) { setDisplayed(target.slice(0, i + 1)); i++; }
      else {
        clearInterval(interval);
        setIsTyping(false);
        setTimeout(() => setPromptIndex((p) => (p + 1) % PROMPTS.length), 2500);
      }
    }, 48);
    return () => clearInterval(interval);
  }, [promptIndex]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
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

  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", overflowX: "hidden", position: "relative" }}>

      {/* Premium background glows */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "60vw", height: "60vw", background: "radial-gradient(circle, rgba(245,197,66,0.06) 0%, transparent 65%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: "10%", right: "-15%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(0,208,132,0.05) 0%, transparent 65%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: "40%", left: "30%", width: "40vw", height: "40vw", background: "radial-gradient(circle, rgba(255,138,0,0.04) 0%, transparent 65%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: "20%", left: "-5%", width: "45vw", height: "45vw", background: "radial-gradient(circle, rgba(0,208,132,0.04) 0%, transparent 65%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: "0%", right: "10%", width: "35vw", height: "35vw", background: "radial-gradient(circle, rgba(245,197,66,0.05) 0%, transparent 65%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(245,197,66,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,66,0.018) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      {/* NAVBAR */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, borderBottom: `1px solid ${T.border}`, background: "rgba(5,5,5,0.94)", backdropFilter: "blur(20px)", padding: "0 20px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div ref={dropdownRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: "6px" }}>
          <KryptonLogo size={28} />
          <button aria-label="Krypton AI menu" aria-expanded={showDropdown} onClick={(e) => { e.stopPropagation(); setShowDropdown((v) => !v); }} style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: "8px" }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "15px", background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Krypton AI</span>
            <span style={{ color: "#666", fontSize: "10px" }}>&#9660;</span>
          </button>
          {showDropdown && (
            <div style={{ position: "absolute", top: "48px", left: 0, background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: "14px", padding: "8px", minWidth: "190px", zIndex: 200, boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(245,197,66,0.05)` }}>
              {[["Settings", "⚙"], ["Billing", "💳"], ["API Keys", "🔑"], ["Roadmap", "🗺"], ["Changelog", "📋"]].map(([label, icon]) => (
                <button key={label} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: T.muted, fontSize: "13px", cursor: "pointer", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = T.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.muted; }}>
                  {icon} {label}
                </button>
              ))}
              <div style={{ height: "1px", background: T.border, margin: "6px 0" }} />
              <button onClick={() => router.push("/auth/login")} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: "#ef4444", fontSize: "13px", cursor: "pointer", borderRadius: "8px" }}>
                Login →
              </button>
            </div>
          )}
        </div>

        <div className="desktop-nav" style={{ gap: "24px", position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          {NAV_LINKS.map((item) => (
            <button key={item} onClick={() => scrollTo(item.toLowerCase())} style={{ background: "none", border: "none", color: T.muted, fontSize: "13px", cursor: "pointer", fontWeight: 500, padding: "4px 0", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.gold)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}>
              {item}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {!isMobile && (
            <button onClick={() => router.push("/auth/login")} style={{ padding: "7px 16px", background: "none", border: `1px solid ${T.border}`, borderRadius: "9px", color: T.muted, fontSize: "13px", cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
              Login
            </button>
          )}
          <button onClick={() => router.push("/auth/signup")} style={{ padding: "7px 16px", background: T.grad, border: "none", borderRadius: "9px", color: "#050505", fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "all 0.3s", boxShadow: "0 0 20px rgba(245,197,66,0.15)" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 0 30px rgba(245,197,66,0.25)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 20px rgba(245,197,66,0.15)"; }}>
            Get Started
          </button>
          {isMobile && (
            <button aria-label="Toggle menu" onClick={() => setMobileMenu((v) => !v)} style={{ background: "none", border: "none", color: T.text, fontSize: "20px", cursor: "pointer", padding: "4px" }}>
              {mobileMenu ? "✕" : "☰"}
            </button>
          )}
        </div>
      </nav>

      {mobileMenu && (
        <div style={{ position: "fixed", top: "60px", left: 0, right: 0, background: "#0A0A0A", borderBottom: `1px solid ${T.border}`, padding: "16px 20px", zIndex: 99, display: "flex", flexDirection: "column", gap: "4px" }}>
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

       {/* HERO */}
      <section style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: isMobile ? "80px 20px 40px" : "0 24px" }}>
        <div style={{ maxWidth: "820px", width: "100%", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(245,197,66,0.07)", border: `1px solid ${T.border}`, borderRadius: "20px", padding: "5px 16px", marginBottom: "1.8rem", fontSize: "12px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.green, display: "inline-block" }} />
            <GradText>✨ Websites, Apps & Games Generated in Seconds</GradText>
          </div>

          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? "clamp(28px, 8vw, 42px)" : "clamp(40px, 5vw, 64px)", fontWeight: 800, lineHeight: 1.08, marginBottom: "1.2rem" }}>
            <GradText>Build Websites, Apps & Games with AI.</GradText>
            <br />
            <span style={{ color: T.text }}>Go from Idea to Production</span>
            <br />
            <GradText>in Minutes.</GradText>
          </h1>

          <p style={{ color: T.sub, fontSize: isMobile ? "15px" : "18px", lineHeight: 1.7, maxWidth: "580px", margin: "0 auto 2.5rem" }}>
            Turn your ideas into production-ready websites, apps, dashboards, and games with a single prompt.
          </p>

          {/* Prompt Box */}
          <div style={{ background: "rgba(13,13,13,0.9)", border: `1px solid rgba(245,197,66,0.18)`, borderRadius: "18px", padding: isMobile ? "14px" : "18px 20px", maxWidth: "700px", margin: "0 auto 1.8rem", textAlign: "left", boxShadow: "0 0 40px rgba(245,197,66,0.06), 0 0 80px rgba(255,138,0,0.04), 0 0 120px rgba(0,208,132,0.03)", transition: "box-shadow 0.3s" }}>
            <textarea
              aria-label="Describe what you want to build"
              rows={isMobile ? 3 : 4}
              placeholder={displayed + (isTyping ? "|" : "")}
              style={{ width: "100%", background: "none", border: "none", color: T.text, fontSize: isMobile ? "15px" : "16px", resize: "none", outline: "none", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px", borderTop: `1px solid ${T.border}`, paddingTop: "12px" }}>
              <button style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#1a1a1a", border: `1px solid ${T.border}`, color: T.muted, fontSize: "22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 300 }}>+</button>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button style={{ padding: "8px 14px", background: "#1a1a1a", border: `1px solid ${T.border}`, borderRadius: "9px", color: T.muted, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                  Website <span style={{ fontSize: "9px" }}>&#9660;</span>
                </button>
                <button style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#1a1a1a", border: `1px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round">
                    <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
                  </svg>
                </button>
                <button onClick={() => router.push("/auth/signup")} style={{ width: "36px", height: "36px", borderRadius: "50%", background: T.grad, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(245,197,66,0.2)", transition: "all 0.3s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(245,197,66,0.35)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 16px rgba(245,197,66,0.2)"; }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
            {["No credit card required", "Export HTML", "Mobile responsive", "Browser games"].map((item) => (
              <span key={item} style={{ fontSize: "12px", color: T.muted, display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ color: T.green }}>✓</span> {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ scrollMarginTop: "80px", padding: isMobile ? "60px 20px" : "80px 24px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <SectionLabel>What You Can Build</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>
            <GradText>Everything you need to ship fast.</GradText>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: "16px" }}>
            {FEATURES.map((c) => (
              <div key={c.title} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", transition: "all 0.3s", cursor: "default", boxShadow: "0 0 20px rgba(245,197,66,0.04)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 0 25px rgba(245,197,66,0.12), 0 0 50px rgba(255,138,0,0.07)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 20px rgba(245,197,66,0.04)"; }}>
                <div style={{ marginBottom: "14px" }}>{c.icon}</div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>
                  <GradText>{c.title}</GradText>
                </h3>
                <p style={{ color: T.sub, fontSize: "13px", lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ scrollMarginTop: "80px", padding: isMobile ? "60px 20px" : "80px 24px", background: "rgba(10,10,10,0.8)", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <SectionLabel>Simple Process</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>
            <GradText>How It Works</GradText>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "16px" }}>
            {STEPS.map((s) => (
              <div key={s.step} style={{ position: "relative", padding: "24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", transition: "all 0.3s", boxShadow: "0 0 20px rgba(0,208,132,0.03)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.green; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 25px rgba(0,208,132,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 20px rgba(0,208,132,0.03)"; }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "42px", fontWeight: 800, position: "absolute", top: "12px", right: "16px", opacity: 0.1, background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.step}</div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "10px" }}>{s.title}</h3>
                <p style={{ color: T.sub, fontSize: "13px", lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXAMPLES */}
      <section id="examples" style={{ scrollMarginTop: "80px", padding: isMobile ? "60px 20px" : "80px 24px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <SectionLabel>Built With Krypton</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>
            <GradText>Examples Gallery</GradText>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: "14px" }}>
            {EXAMPLES.map((item) => (
              <div key={item.title} style={{ background: item.color, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "40px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.3s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(245,197,66,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                <p style={{ fontFamily: "'Syne', sans-serif", color: T.text, fontWeight: 700, fontSize: "15px", margin: 0 }}>{item.title}</p>
                <p style={{ color: T.muted, fontSize: "12px", margin: "6px 0 0" }}>Click to preview →</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: isMobile ? "60px 20px" : "80px 24px", background: "rgba(10,10,10,0.8)", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <SectionLabel>Loved By Builders</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>
            <GradText>What Builders Say</GradText>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "16px" }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", transition: "all 0.3s", boxShadow: "0 0 20px rgba(245,197,66,0.03)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.boxShadow = "0 0 25px rgba(245,197,66,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "0 0 20px rgba(245,197,66,0.03)"; }}>
                <div style={{ color: T.gold, fontSize: "16px", marginBottom: "12px" }}>{"★".repeat(t.stars)}</div>
                <p style={{ color: T.sub, fontSize: "14px", lineHeight: 1.7, marginBottom: "16px", fontStyle: "italic" }}>"{t.text}"</p>
                <div>
                  <p style={{ fontWeight: 700, fontSize: "14px", margin: 0 }}>{t.name}</p>
                  <p style={{ color: T.muted, fontSize: "12px", margin: "2px 0 0" }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section style={{ scrollMarginTop: "80px", padding: isMobile ? "60px 20px" : "80px 24px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <SectionLabel>Why Krypton</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>
            <GradText>Why Builders Choose Krypton</GradText>
          </h2>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "18px", overflow: "hidden", boxShadow: "0 0 40px rgba(245,197,66,0.05)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "rgba(245,197,66,0.05)", padding: "14px 24px", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: T.muted }}>Feature</span>
              <span style={{ fontSize: "13px", fontWeight: 700, textAlign: "center", background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Krypton AI</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: T.muted, textAlign: "center" }}>Others</span>
            </div>
            {[
              ["Export Full Code", true, false],
              ["Browser Games", true, false],
              ["Instant Preview", true, true],
              ["No Coding Required", true, true],
              ["Mobile Responsive", true, false],
            ].map(([feature, us, them]) => (
              <div key={String(feature)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "14px 24px", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: "13px", color: T.sub }}>{String(feature)}</span>
                <span style={{ fontSize: "16px", textAlign: "center" }}>{us ? <span style={{ color: T.green }}>✓</span> : <span style={{ color: "#ef4444" }}>✗</span>}</span>
                <span style={{ fontSize: "16px", textAlign: "center" }}>{them ? <span style={{ color: T.green }}>✓</span> : <span style={{ color: "#ef4444" }}>✗</span>}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section id="roadmap" style={{ scrollMarginTop: "80px", padding: isMobile ? "60px 20px" : "80px 24px", background: "rgba(10,10,10,0.8)", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <SectionLabel>What's Next</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>
            <GradText>Roadmap</GradText>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "16px" }}>
            <div style={{ background: T.card, border: "1px solid rgba(0,208,132,0.2)", borderRadius: "16px", padding: "24px", boxShadow: "0 0 20px rgba(0,208,132,0.05)" }}>
              <p style={{ color: T.green, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "16px" }}>Live Now</p>
              {["Website Generator", "App Generator", "Game Generator", "Project Save & Export"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <span style={{ color: T.green, fontSize: "14px" }}>✅</span>
                  <span style={{ fontSize: "14px" }}>{item}</span>
                </div>
              ))}
            </div>
            <div style={{ background: T.card, border: "1px solid rgba(245,197,66,0.2)", borderRadius: "16px", padding: "24px", boxShadow: "0 0 20px rgba(245,197,66,0.05)" }}>
              <p style={{ color: T.gold, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "16px" }}>Coming Soon</p>
              {["AI Campaign Builder", "Team Workspaces", "Templates Marketplace", "API Access"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "14px" }}>🚀</span>
                  <span style={{ fontSize: "14px", color: T.sub }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ scrollMarginTop: "80px", padding: isMobile ? "60px 20px" : "80px 24px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <SectionLabel>Simple Pricing</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "1.5rem" }}>
            <GradText>Pricing</GradText>
          </h2>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "2.5rem" }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "4px", display: "flex" }}>
              {(["monthly", "yearly"] as const).map((c) => (
                <button key={c} onClick={() => setBilling(c)} style={{ padding: "8px 20px", borderRadius: "9px", border: "none", background: billing === c ? T.grad : "none", color: billing === c ? "#050505" : T.muted, fontSize: "13px", fontWeight: billing === c ? 700 : 400, cursor: "pointer", transition: "all 0.2s" }}>
                  {c === "monthly" ? "Monthly" : "Yearly"}{c === "yearly" && <span style={{ fontSize: "10px", marginLeft: "5px" }}>20% off</span>}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: "16px" }}>
            {PLANS.map((plan) => (
              <div key={plan.name} style={{ background: plan.highlight ? "rgba(245,197,66,0.04)" : T.card, border: plan.highlight ? "1px solid rgba(245,197,66,0.4)" : `1px solid ${T.border}`, borderRadius: "18px", padding: "24px", position: "relative", boxShadow: plan.highlight ? "0 0 40px rgba(245,197,66,0.1), 0 0 80px rgba(255,138,0,0.06)" : "0 0 20px rgba(245,197,66,0.03)", transition: "all 0.3s" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = plan.highlight ? "0 0 50px rgba(245,197,66,0.18), 0 0 100px rgba(255,138,0,0.1)" : "0 0 30px rgba(245,197,66,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = plan.highlight ? "0 0 40px rgba(245,197,66,0.1)" : "0 0 20px rgba(245,197,66,0.03)"; }}>
                {plan.highlight && (
                  <div style={{ position: "absolute" as "absolute", top: "-13px", left: "50%", transform: "translateX(-50%)", background: T.grad, color: "#050505", fontSize: "11px", fontWeight: 700, padding: "3px 16px", borderRadius: "20px", whiteSpace: "nowrap" }}>
                    Most Popular
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "16px" }}>{plan.emoji}</span>
                  <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 700, background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{plan.name}</h3>
                </div>
                <p style={{ color: T.green, fontSize: "12px", marginBottom: "12px" }}>{plan.credits}</p>
                <div style={{ marginBottom: "20px" }}>
                  <span style={{ fontSize: "32px", fontWeight: 800, background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                  </span>
                  <span style={{ color: T.muted, fontSize: "13px" }}>/mo</span>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  {plan.included.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ color: T.green, fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>✅</span>
                      <span style={{ fontSize: "12px", color: T.sub }}>{f}</span>
                    </div>
                  ))}
                  {plan.locked.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>🔒</span>
                      <span style={{ fontSize: "12px", color: "#444" }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => router.push("/auth/signup")} style={{ width: "100%", padding: "11px", background: plan.highlight ? T.grad : "#161616", border: plan.highlight ? "none" : `1px solid ${T.border}`, borderRadius: "10px", color: plan.highlight ? "#050505" : T.text, fontWeight: 700, fontSize: "14px", cursor: "pointer", transition: "all 0.3s", boxShadow: plan.highlight ? "0 0 16px rgba(245,197,66,0.15)" : "none" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = plan.highlight ? "0 0 24px rgba(245,197,66,0.3)" : "0 0 16px rgba(245,197,66,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = plan.highlight ? "0 0 16px rgba(245,197,66,0.15)" : "none"; }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ scrollMarginTop: "80px", padding: isMobile ? "60px 20px" : "80px 24px", background: "rgba(10,10,10,0.8)", borderTop: `1px solid ${T.border}`, position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <SectionLabel>FAQ</SectionLabel>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "2.5rem" }}>
            <GradText>Frequently Asked</GradText>
          </h2>
          {FAQS.map((item, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${T.border}`, padding: "18px 0", transition: "all 0.2s" }}>
              <p style={{ fontWeight: 700, fontSize: "15px", marginBottom: "8px", background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{item.q}</p>
              <p style={{ color: T.sub, fontSize: "14px", lineHeight: 1.7, margin: 0 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: isMobile ? "60px 20px" : "100px 24px", textAlign: "center", borderTop: `1px solid ${T.border}`, position: "relative", zIndex: 1 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? "clamp(24px, 7vw, 38px)" : "clamp(32px, 4vw, 52px)", fontWeight: 800, marginBottom: "1.5rem" }}>
          The future of building is<br />
          <GradText>a sentence away.</GradText>
        </h2>
        <button onClick={() => router.push("/auth/signup")} style={{ padding: "16px 40px", background: T.grad, border: "none", borderRadius: "14px", color: "#050505", fontSize: "16px", fontWeight: 700, cursor: "pointer", transition: "all 0.3s", boxShadow: "0 0 30px rgba(245,197,66,0.2)" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 0 50px rgba(245,197,66,0.35)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 30px rgba(245,197,66,0.2)"; }}>
          Start Free — No credit card required →
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: isMobile ? "40px 20px 24px" : "60px 24px 28px", background: "rgba(8,8,8,0.95)", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: isMobile ? "28px" : "32px", marginBottom: "40px" }}>
            {[
              { title: "Product", links: ["Features", "Pricing", "Roadmap", "Examples"] },
              { title: "Resources", links: ["Documentation", "Changelog", "Blog", "Support"] },
              { title: "Company", links: ["About", "Contact"] },
              { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Refund Policy"] },
              { title: "Social", links: ["X (Twitter)", "LinkedIn", "GitHub"] },
            ].map((col) => (
              <div key={col.title}>
                <p style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px", background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{col.title}</p>
                {col.links.map((link) => (
                  <p key={link} style={{ color: T.muted, fontSize: "13px", marginBottom: "9px", cursor: "pointer", transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.gold)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}>
                    {link}
                  </p>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <KryptonLogo size={40} />
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "14px", background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Krypton AI</span>
            </div>
            <p style={{ color: T.muted, fontSize: "12px", margin: 0 }}>© 2026 Krypton AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
 }
