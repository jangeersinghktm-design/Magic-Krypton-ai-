"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Design Tokens ────────────────────────────────────────────
const GA = "#F5D800";
const GB = "#00CC44";
const G  = `linear-gradient(135deg, ${GA} 0%, ${GB} 100%)`;
const T  = {
  bg:     "#050505",
  card:   "#0D0D0D",
  card2:  "#111111",
  border: "rgba(245,197,66,0.1)",
  text:   "#FFFFFF",
  sub:    "#9CA3AF",
  muted:  "#6B7280",
  gold:   GA,
  green:  GB,
};

// ── Container: 1800px max, 95vw ─────────────────────────────
const CONTAINER: React.CSSProperties = {
  maxWidth: 1800,
  width: "95%",
  margin: "0 auto",
};

const SECTION: React.CSSProperties = {
  padding: "80px 0",
  position: "relative",
};

export default function LandingPage() {
  const router  = useRouter();
  const [isMobile, setIsMobile]   = useState(false);
  const [isTablet, setIsTablet]   = useState(false);
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly"|"yearly">("monthly");
  const [currency, setCurrency]   = useState<"INR"|"USD">("INR");

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    const onScroll = () => setScrolled(window.scrollY > 40);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("scroll", onScroll);
    return () => { window.removeEventListener("resize", check); window.removeEventListener("scroll", onScroll); };
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const cols = isMobile ? 1 : isTablet ? 2 : 4;

  const FEATURES = [
    { icon: "🌐", title: "Website Builder", desc: "Professional websites in seconds. Fully responsive, SEO-ready." },
    { icon: "📱", title: "App Generator", desc: "Web apps with dashboards, auth, and real functionality." },
    { icon: "🎮", title: "Game Studio", desc: "Browser games with physics, scoring, and animations." },
    { icon: "🛒", title: "E-Commerce", desc: "Online stores with product pages and cart systems." },
    { icon: "📊", title: "Dashboards", desc: "Analytics dashboards with charts and live data." },
    { icon: "🤖", title: "AI Tools", desc: "Custom AI-powered tools and productivity apps." },
    { icon: "📝", title: "Landing Pages", desc: "High-converting SaaS landing pages instantly." },
    { icon: "🎨", title: "Portfolios", desc: "Stunning personal portfolios with animations." },
  ];

  const PLANS = [
    {
      name: "Free", emoji: "🟢", badge: null,
      monthly_inr: 0, yearly_inr: 0, monthly_usd: 0, yearly_usd: 0,
      credits: "5 credits/day",
      features: ["Website Generator", "App Generator", "Game Generator", "Live Preview", "Download HTML", "Community Support"],
      locked: ["Save Projects", "Advanced AI", "Team Workspace", "API Access"],
      cta: "Start Free", ctaStyle: "outline",
    },
    {
      name: "Pro", emoji: "🔥", badge: "Most Popular",
      monthly_inr: 2099, yearly_inr: 1679, monthly_usd: 25, yearly_usd: 20,
      credits: "2000 credits/month",
      features: ["Everything in Free", "Save Projects", "Project History", "Better AI Quality", "Export Source Code", "Private Projects", "Premium Templates", "Email Support"],
      locked: ["Team Workspace", "API Access"],
      cta: "Start Pro", ctaStyle: "primary",
    },
    {
      name: "Premium", emoji: "💎", badge: null,
      monthly_inr: 5799, yearly_inr: 4639, monthly_usd: 69, yearly_usd: 55,
      credits: "5000 credits/month",
      features: ["Everything in Pro", "Fastest AI Model", "Unlimited Saves", "Version History", "Team (5 Users)", "Screenshot to App", "AI Project Manager", "Priority Support"],
      locked: ["API Access"],
      cta: "Start Premium", ctaStyle: "outline",
    },
    {
      name: "Business", emoji: "🏢", badge: null,
      monthly_inr: 12499, yearly_inr: 9999, monthly_usd: 149, yearly_usd: 119,
      credits: "100 credits/day",
      features: ["Everything in Premium", "API Access", "Unlimited Team", "Admin Dashboard", "White Label", "Custom AI Training", "Business SLA", "Dedicated Support"],
      locked: [],
      cta: "Contact Sales", ctaStyle: "outline",
    },
  ];

  const STATS = [
    { value: "50K+", label: "Projects Built" },
    { value: "12K+", label: "Active Users" },
    { value: "99.9%", label: "Uptime" },
    { value: "4.9★", label: "User Rating" },
  ];

  const STEPS = [
    { num: "01", title: "Describe Your Idea", desc: "Type what you want to build in plain English. No technical knowledge needed." },
    { num: "02", title: "AI Builds It", desc: "Krypton AI understands your request and generates production-quality code instantly." },
    { num: "03", title: "Preview & Edit", desc: "See your project live. Chat with AI to make changes in real-time." },
    { num: "04", title: "Export & Deploy", desc: "Download your code, deploy to the web, or push directly to GitHub." },
  ];

  const TESTIMONIALS = [
    { name: "Rahul Sharma", role: "Founder, TechStartup", text: "Krypton AI saved me 3 weeks of development time. Built my entire SaaS landing page in 10 minutes.", avatar: "RS" },
    { name: "Priya Patel", role: "Freelance Designer", text: "I can now offer web development to my clients without knowing how to code. Game changer.", avatar: "PP" },
    { name: "Arjun Singh", role: "Product Manager", text: "We prototyped 5 different app ideas in one day. The AI quality is insane.", avatar: "AS" },
    { name: "Neha Gupta", role: "Marketing Manager", text: "Finally built the landing page I always wanted. The output is production-ready.", avatar: "NG" },
    { name: "Vikram Mehta", role: "Indie Developer", text: "The game generator blew my mind. Made a fully playable snake game in seconds.", avatar: "VM" },
    { name: "Ananya Roy", role: "Student Developer", text: "As a student, this is incredible. I can now build real projects for my portfolio.", avatar: "AR" },
  ];

  const sym = currency === "INR" ? "₹" : "$";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=Syne:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; width: 100%; background: #050505; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes orbFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes orbRotate { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes gradMove { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(3%,5%) scale(1.05)} }
        .fade-up { animation: fadeUp 0.6s ease both; }
        .grad-text { background: ${G}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hover-card { transition: all 0.2s ease; }
        .hover-card:hover { transform: translateY(-4px); border-color: rgba(245,197,66,0.35) !important; box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
        .shine-btn { position: relative; overflow: hidden; }
        .shine-btn::after { content:""; position:absolute; top:-50%; left:-60%; width:40%; height:200%; background:rgba(255,255,255,0.15); transform:skewX(-20deg); animation:shine 3s infinite; }
        @keyframes shine { 0%{left:-60%} 100%{left:120%} }
        .nav-link { color: #9CA3AF; font-size: 14px; cursor: pointer; transition: color 0.2s; text-decoration: none; background: none; border: none; font-family: 'DM Sans', sans-serif; }
        .nav-link:hover { color: #F5D800; }
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .grid-mobile-1 { grid-template-columns: 1fr !important; }
          .grid-mobile-2 { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <div style={{ background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif", overflowX: "hidden", width: "100%" }}>

        {/* ══ NAVBAR ══════════════════════════════════════════════ */}
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 5%", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", background: scrolled ? "rgba(5,5,5,0.95)" : "transparent", backdropFilter: scrolled ? "blur(20px)" : "none", borderBottom: scrolled ? `1px solid ${T.border}` : "none", transition: "all 0.3s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.png" alt="Krypton AI" style={{ height: 36, width: "auto" }} />
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Krypton AI</span>
          </div>

          {!isMobile && (
            <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
              {["Features", "How It Works", "Pricing", "Examples", "Blog"].map(item => (
                <button key={item} className="nav-link" onClick={() => scrollTo(item.toLowerCase().replace(/ /g, "-"))}>{item}</button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isMobile && <button onClick={() => router.push("/auth/login")} style={{ padding: "7px 18px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, color: T.sub, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Login</button>}
            <button onClick={() => router.push("/auth/signup")} style={{ padding: "7px 18px", background: G, border: "none", borderRadius: 8, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              {isMobile ? "Start Free" : "Start Building Free →"}
            </button>
            {isMobile && <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", color: T.text, fontSize: 20, cursor: "pointer" }}>☰</button>}
          </div>
        </nav>

        {/* Mobile Menu */}
        {menuOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(5,5,5,0.98)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
            <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: T.text, fontSize: 24, cursor: "pointer" }}>✕</button>
            {["Features", "How It Works", "Pricing", "Examples"].map(item => (
              <button key={item} className="nav-link" style={{ fontSize: 22, fontWeight: 600 }} onClick={() => scrollTo(item.toLowerCase().replace(/ /g, "-"))}>{item}</button>
            ))}
            <button onClick={() => router.push("/auth/login")} style={{ padding: "10px 32px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 16, cursor: "pointer" }}>Login</button>
            <button onClick={() => router.push("/auth/signup")} style={{ padding: "10px 32px", background: G, border: "none", borderRadius: 10, color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>Start Free →</button>
          </div>
        )}

        {/* ══ HERO ════════════════════════════════════════════════ */}
        <section style={{ ...SECTION, minHeight: isMobile ? "auto" : "100vh", paddingTop: isMobile ? 90 : 120, paddingBottom: isMobile ? 50 : 80, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", overflow: "hidden" }}>
          {/* BG Glows */}
          <div style={{ position: "absolute", top: "-15%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "80vw", maxWidth: 900, maxHeight: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,197,66,0.12) 0%, transparent 70%)", pointerEvents: "none", animation: "gradMove 18s ease-in-out infinite" }} />

          <div style={{ ...CONTAINER, display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Badge */}
            <div className="fade-up" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,197,66,0.06)", border: `1px solid rgba(245,197,66,0.2)`, borderRadius: 20, padding: "6px 18px", marginBottom: 24, fontSize: 12, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: GB, display: "inline-block", animation: "pulse 2s infinite" }} />
              <span className="grad-text">✨ Websites, Apps & Games — AI Generated in Seconds</span>
            </div>

            {/* Orb */}
            <div style={{ position: "relative", width: isMobile ? 100 : 160, height: isMobile ? 100 : 160, margin: "0 auto 28px" }}>
              <div style={{ position: "absolute", inset: -16, borderRadius: "50%", border: "1px solid rgba(245,197,66,0.3)", animation: "orbRotate 8s linear infinite", opacity: 0.5 }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", filter: "blur(24px)", background: "radial-gradient(circle, rgba(245,197,66,0.25), rgba(0,204,68,0.15))" }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, rgba(245,197,66,0.1), #0d0d0d 60%)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", animation: "orbFloat 6s ease-in-out infinite" }}>
                <img src="/logo.png" alt="Kr" style={{ width: isMobile ? 50 : 80, height: isMobile ? 50 : 80, objectFit: "contain" }} />
              </div>
            </div>

            {/* Headline */}
            <h1 className="fade-up grad-text" style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? "clamp(28px,7vw,38px)" : "clamp(48px,5vw,76px)", fontWeight: 900, lineHeight: 1.05, marginBottom: 16, maxWidth: 1000, animationDelay: "0.1s" }}>
              Build Anything with AI.<br />Ship in Minutes.
            </h1>

            <h2 className="fade-up" style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 16 : 22, fontWeight: 600, color: T.sub, marginBottom: 16, animationDelay: "0.15s" }}>
              Websites • Apps • Games • Tools • Dashboards
            </h2>

            <p className="fade-up" style={{ color: T.muted, fontSize: isMobile ? 14 : 17, lineHeight: 1.8, maxWidth: 600, marginBottom: 36, animationDelay: "0.2s" }}>
              Describe what you want in plain English. Krypton AI builds complete, production-ready code instantly — no coding required.
            </p>

            {/* CTA */}
            <div className="fade-up" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 36, animationDelay: "0.3s" }}>
              <button className="shine-btn" onClick={() => router.push("/auth/signup")} style={{ padding: isMobile ? "13px 28px" : "16px 40px", background: G, border: "none", borderRadius: 12, color: "#000", fontSize: isMobile ? 14 : 16, fontWeight: 800, cursor: "pointer" }}>
                🚀 Start Building Free
              </button>
              <button onClick={() => scrollTo("how-it-works")} style={{ padding: isMobile ? "13px 28px" : "16px 40px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: T.text, fontSize: isMobile ? 14 : 16, fontWeight: 600, cursor: "pointer" }}>
                See How It Works
              </button>
            </div>

            {/* Trust badges */}
            <div className="fade-up" style={{ display: "flex", gap: isMobile ? 12 : 28, flexWrap: "wrap", justifyContent: "center", animationDelay: "0.4s" }}>
              {["✓ Free to start", "✓ No credit card", "✓ Instant results", "✓ Export code"].map(b => (
                <span key={b} style={{ fontSize: isMobile ? 11 : 13, color: T.muted }}>{b}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ══ STATS ═══════════════════════════════════════════════ */}
        <section style={{ padding: "40px 0", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ ...CONTAINER, display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 0 }}>
            {STATS.map((s, i) => (
              <div key={s.value} style={{ textAlign: "center", padding: "20px 24px", borderRight: i < STATS.length - 1 && !isMobile ? `1px solid ${T.border}` : "none" }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 28 : 40, fontWeight: 900, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>{s.value}</p>
                <p style={{ fontSize: 13, color: T.muted }}>{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══ FEATURES ════════════════════════════════════════════ */}
        <section id="features" style={{ ...SECTION }}>
          <div style={{ ...CONTAINER }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: GA, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>WHAT YOU CAN BUILD</p>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 28 : 44, fontWeight: 900, marginBottom: 14 }}>
                One Platform. <span className="grad-text">Infinite Possibilities.</span>
              </h2>
              <p style={{ color: T.muted, fontSize: isMobile ? 14 : 17, maxWidth: 560, margin: "0 auto" }}>
                From simple landing pages to complex web applications — Krypton AI handles it all.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : isTablet ? "repeat(4, 1fr)" : "repeat(4, 1fr)", gap: 16 }}>
              {FEATURES.map(f => (
                <div key={f.title} className="hover-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px 20px" }}>
                  <div style={{ fontSize: isMobile ? 28 : 36, marginBottom: 12 }}>{f.icon}</div>
                  <h3 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                  <p style={{ fontSize: isMobile ? 12 : 13, color: T.muted, lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS ════════════════════════════════════════ */}
        <section id="how-it-works" style={{ ...SECTION, background: "rgba(245,197,66,0.02)", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ ...CONTAINER }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: GA, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>HOW IT WORKS</p>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 28 : 44, fontWeight: 900 }}>
                From Idea to <span className="grad-text">Production</span> in 4 Steps
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: 24 }}>
              {STEPS.map((s, i) => (
                <div key={s.num} style={{ position: "relative" }}>
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "28px 24px", height: "100%" }}>
                    <div style={{ fontSize: 36, fontWeight: 900, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 16, fontFamily: "'Syne', sans-serif" }}>{s.num}</div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{s.title}</h3>
                    <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.7 }}>{s.desc}</p>
                  </div>
                  {i < STEPS.length - 1 && !isMobile && (
                    <div style={{ position: "absolute", right: -12, top: "50%", transform: "translateY(-50%)", color: GA, fontSize: 20, zIndex: 1 }}>→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ PRICING ═════════════════════════════════════════════ */}
        <section id="pricing" style={{ ...SECTION }}>
          <div style={{ ...CONTAINER }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: GA, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>PRICING</p>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 28 : 44, fontWeight: 900, marginBottom: 20 }}>
                Simple, <span className="grad-text">Transparent</span> Pricing
              </h2>

              {/* Toggles */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 100, padding: 4 }}>
                  {(["monthly", "yearly"] as const).map(b => (
                    <button key={b} onClick={() => setBillingCycle(b)} style={{ padding: "8px 20px", borderRadius: 100, border: "none", background: billingCycle === b ? G : "transparent", color: billingCycle === b ? "#000" : T.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {b === "monthly" ? "Monthly" : "Yearly"}
                    </button>
                  ))}
                </div>
                {billingCycle === "yearly" && <span style={{ fontSize: 12, color: GB, background: "rgba(0,204,68,0.1)", border: "1px solid rgba(0,204,68,0.25)", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>Save 20% 🎉</span>}
                <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                  {(["INR", "USD"] as const).map(c => (
                    <button key={c} onClick={() => setCurrency(c)} style={{ padding: "6px 14px", border: "none", background: currency === c ? "rgba(245,197,66,0.15)" : "transparent", color: currency === c ? GA : T.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {c === "INR" ? "₹ INR" : "$ USD"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(4, 1fr)", gap: 16 }}>
              {PLANS.map(plan => {
                const price = currency === "INR"
                  ? (billingCycle === "yearly" ? plan.yearly_inr : plan.monthly_inr)
                  : (billingCycle === "yearly" ? plan.yearly_usd : plan.monthly_usd);
                const isPopular = plan.name === "Pro";

                return (
                  <div key={plan.name} className="hover-card" style={{ background: isPopular ? "linear-gradient(145deg, #111100, #0a0a0a)" : T.card, border: `1px solid ${isPopular ? "rgba(245,197,66,0.4)" : T.border}`, borderRadius: 20, padding: "28px 24px", position: "relative", boxShadow: isPopular ? "0 0 40px rgba(245,197,66,0.08)" : "none" }}>
                    {isPopular && <div style={{ position: "absolute", top: -1, right: 24, background: G, color: "#000", fontSize: 10, fontWeight: 800, padding: "4px 12px", borderRadius: "0 0 8px 8px", letterSpacing: 0.5 }}>⭐ MOST POPULAR</div>}

                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{plan.emoji}</div>
                      <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{plan.name}</h3>
                      <p style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>{plan.credits}</p>
                    </div>

                    <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                      {price === 0 ? (
                        <span style={{ fontSize: 36, fontWeight: 900, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Free</span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
                          <span style={{ fontSize: 14, color: T.muted, marginBottom: 6 }}>{sym}</span>
                          <span style={{ fontSize: 36, fontWeight: 900, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>{price.toLocaleString()}</span>
                          <span style={{ fontSize: 13, color: T.muted, marginBottom: 6 }}>/mo</span>
                        </div>
                      )}
                    </div>

                    <button onClick={() => router.push("/auth/signup")} style={{ width: "100%", padding: "12px", borderRadius: 10, border: isPopular ? "none" : `1px solid ${T.border}`, background: isPopular ? G : "transparent", color: isPopular ? "#000" : T.text, fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }}>
                      {plan.cta} →
                    </button>

                    <div>
                      {plan.features.map(f => (
                        <div key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: T.sub, padding: "4px 0", alignItems: "center" }}>
                          <span style={{ color: GB, flexShrink: 0 }}>✓</span>{f}
                        </div>
                      ))}
                      {plan.locked.map(f => (
                        <div key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: "#444", padding: "4px 0", alignItems: "center", opacity: 0.5 }}>
                          <span style={{ flexShrink: 0 }}>🔒</span>{f}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══ TESTIMONIALS ════════════════════════════════════════ */}
        <section style={{ ...SECTION, background: "rgba(245,197,66,0.02)", borderTop: `1px solid ${T.border}` }}>
          <div style={{ ...CONTAINER }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: GA, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>TESTIMONIALS</p>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 28 : 44, fontWeight: 900 }}>
                Loved by <span className="grad-text">Builders</span>
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3, 1fr)", gap: 16 }}>
              {TESTIMONIALS.map(t => (
                <div key={t.name} className="hover-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px" }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                    {[1,2,3,4,5].map(i => <span key={i} style={{ color: GA, fontSize: 14 }}>★</span>)}
                  </div>
                  <p style={{ fontSize: 14, color: T.sub, lineHeight: 1.7, marginBottom: 16 }}>"{t.text}"</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#000" }}>{t.avatar}</div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</p>
                      <p style={{ fontSize: 11, color: T.muted }}>{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA BANNER ══════════════════════════════════════════ */}
        <section style={{ ...SECTION, borderTop: `1px solid ${T.border}` }}>
          <div style={{ ...CONTAINER, textAlign: "center" }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 28 : 52, fontWeight: 900, marginBottom: 16 }}>
              Ready to Build with <span className="grad-text">AI?</span>
            </h2>
            <p style={{ color: T.muted, fontSize: isMobile ? 14 : 18, marginBottom: 32, maxWidth: 520, margin: "0 auto 32px" }}>
              Join thousands of builders creating amazing projects with Krypton AI.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="shine-btn" onClick={() => router.push("/auth/signup")} style={{ padding: isMobile ? "13px 28px" : "16px 40px", background: G, border: "none", borderRadius: 12, color: "#000", fontSize: isMobile ? 14 : 16, fontWeight: 800, cursor: "pointer" }}>
                🚀 Start Building Free
              </button>
              <button onClick={() => window.open("/billing", "_blank")} style={{ padding: isMobile ? "13px 28px" : "16px 40px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, fontSize: isMobile ? 14 : 16, cursor: "pointer" }}>
                View Pricing →
              </button>
            </div>
          </div>
        </section>

        {/* ══ FOOTER ══════════════════════════════════════════════ */}
        <footer style={{ borderTop: `1px solid ${T.border}`, padding: isMobile ? "40px 0 24px" : "60px 0 28px", background: "rgba(8,8,8,0.98)" }}>
          <div style={{ ...CONTAINER }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: isMobile ? 28 : 32, marginBottom: 40 }}>
              {[
                { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "Roadmap", href: "/changelog" }, { label: "Examples", href: "#examples" }] },
                { title: "Resources", links: [{ label: "Documentation", href: "/docs" }, { label: "Changelog", href: "/changelog" }, { label: "Blog", href: "/blog" }, { label: "Support", href: "/support" }] },
                { title: "Company", links: [{ label: "About", href: "/about" }, { label: "Contact", href: "/contact" }] },
                { title: "Legal", links: [{ label: "Privacy Policy", href: "/privacy" }, { label: "Terms of Service", href: "/terms" }, { label: "Refund Policy", href: "/refund" }] },
                { title: "Social", links: [{ label: "Email Us", href: "mailto:support@kryptonai.tech" }, { label: "X (Twitter)", href: "https://twitter.com/kryptonai" }, { label: "LinkedIn", href: "https://linkedin.com/company/kryptonai" }, { label: "GitHub", href: "https://github.com/jangeersinghktm-design/Magic-Krypton-ai-" }] },
              ].map(col => (
                <div key={col.title}>
                  <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 14, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textTransform: "uppercase", letterSpacing: 1 }}>{col.title}</p>
                  {col.links.map(link => (
                    <a key={link.label} href={link.href} target={link.href.startsWith("http") || link.href.startsWith("mailto") ? "_blank" : undefined} rel="noreferrer"
                      style={{ display: "block", color: T.muted, fontSize: 13, marginBottom: 9, textDecoration: "none", transition: "color 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.color = GA}
                      onMouseLeave={e => e.currentTarget.style.color = T.muted}>
                      {link.label}
                    </a>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src="/logo.png" alt="Krypton AI" style={{ height: 32, width: "auto" }} />
                <span style={{ fontSize: 14, fontWeight: 700, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Krypton AI</span>
              </div>
              <p style={{ color: T.muted, fontSize: 12 }}>© 2026 Krypton AI. All rights reserved.</p>
              <p style={{ color: "#333", fontSize: 11 }}>Made with ❤️ in India 🇮🇳</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
