"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Gradient Themes ──────────────────────────────────────────
const THEMES = [
  { a: "#F5D800", b: "#00CC44", ar: "245,216,0",   br: "0,204,68"   },
  { a: "#A855F7", b: "#EC4899", ar: "168,85,247",  br: "236,72,153" },
  { a: "#F59E0B", b: "#EF4444", ar: "245,158,11",  br: "239,68,68"  },
  { a: "#06B6D4", b: "#3B82F6", ar: "6,182,212",   br: "59,130,246" },
  { a: "#F43F5E", b: "#8B5CF6", ar: "244,63,94",   br: "139,92,246" },
  { a: "#10B981", b: "#14B8A6", ar: "16,185,129",  br: "20,184,166" },
];

const T = {
  bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF",
  sub: "#B3B3B3", muted: "#6B7280",
};

// ── LAYOUT: Wide container like Stripe/Linear/Vercel ─────────
const W: React.CSSProperties = {
  maxWidth: 1600,
  width: "92%",
  margin: "0 auto",
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
  { icon: "🌐", title: "Websites", desc: "Landing pages, portfolios, business sites — pixel-perfect and responsive." },
  { icon: "⚙️", title: "Web Apps", desc: "Dashboards, CRM tools, productivity apps with full interactivity." },
  { icon: "🎮", title: "Browser Games", desc: "Snake, 2048, puzzle games — fully playable in the browser." },
  { icon: "🧰", title: "Business Tools", desc: "Calculators, forms, trackers — tools that actually work." },
  { icon: "📊", title: "Dashboards", desc: "Analytics dashboards with charts, KPIs, and live data." },
  { icon: "🛒", title: "E-Commerce", desc: "Online stores with product pages, cart, and checkout." },
  { icon: "💼", title: "Portfolios", desc: "Stunning personal portfolios with smooth animations." },
  { icon: "🤖", title: "AI Tools", desc: "Custom AI-powered productivity tools and generators." },
];

const STATS = [
  { value: 12000, label: "Projects Generated", suffix: "+" },
  { value: 98,    label: "Satisfaction Rate",  suffix: "%" },
  { value: 8,     label: "Seconds to Build",   suffix: "s" },
  { value: 22,    label: "Premium Templates",  suffix: "+" },
];

const MARQUEE_ITEMS = [
  "🌐 Websites", "⚙️ Web Apps", "🎮 Browser Games",
  "📊 Dashboards", "🛒 E-Commerce", "📝 Forms & Tools",
  "💼 Portfolios", "📈 Analytics", "🤖 AI Features",
  "📱 Mobile-First", "🔒 Secure Output", "⚡ Instant Build",
];

const PLANS = [
  { name: "Free", emoji: "🟢", monthlyPrice: "$0", yearlyPrice: "$0",
    monthlyPriceInr: "₹0", yearlyPriceInr: "₹0",
    credits: "5 Generations / Day", highlight: false, cta: "Get Started Free",
    included: ["Website Generator","App Generator","Game Generator","Live Preview","Mobile Responsive","Download HTML","Community Support"],
    locked: ["Save Projects","Project History","Advanced AI","Team Workspace","API Access"] },
  { name: "Pro", emoji: "🔥", monthlyPrice: "$25", yearlyPrice: "$20",
    monthlyPriceInr: "₹2,099", yearlyPriceInr: "₹1,679",
    credits: "2000 Credits / Month", highlight: true, cta: "Start Pro",
    included: ["Everything in Free","Save Projects","Project History","Better AI Quality","Export Source Code","Private Projects","Premium Templates","Email Support"],
    locked: ["Team Workspace","API Access"] },
  { name: "Premium", emoji: "💎", monthlyPrice: "$69", yearlyPrice: "$55",
    monthlyPriceInr: "₹5,799", yearlyPriceInr: "₹4,639",
    credits: "5000 Credits / Month", highlight: false, cta: "Start Premium",
    included: ["Everything in Pro","Fastest AI Model","Unlimited Saves","Version History","Team (5 Users)","Screenshot to App","AI Manager","Priority Support"],
    locked: ["API Access"] },
  { name: "Business", emoji: "🏢", monthlyPrice: "$149", yearlyPrice: "$119",
    monthlyPriceInr: "₹12,499", yearlyPriceInr: "₹9,999",
    credits: "100 Credits / Day", highlight: false, cta: "Contact Us",
    included: ["Everything in Premium","API Access","Unlimited Team","Admin Dashboard","White Label","Business SLA","Dedicated Support"],
    locked: [] },
];

const TESTIMONIALS = [
  { stars: 5, text: "Generated my startup landing page in 2 minutes. Absolutely incredible.", name: "Alex", role: "Founder" },
  { stars: 5, text: "Much faster than hiring freelancers. The quality is production-ready.", name: "Sarah", role: "Designer" },
  { stars: 5, text: "Built a full CRM tool with Krypton AI in one afternoon. Game changer.", name: "Raj", role: "Product Manager" },
];

const FAQS = [
  { q: "What can Krypton AI build?", a: "Websites, web apps, browser games, dashboards, calculators, portfolios, and more — all as production-ready HTML files." },
  { q: "How does Krypton AI work?", a: "Simply describe what you want to build in plain English. Krypton AI transforms your idea into a complete, responsive, and production-ready project within seconds." },
  { q: "Can I download the code?", a: "Yes. Every project can be downloaded as a complete HTML file, ready to deploy anywhere." },
  { q: "Do I need coding skills?", a: "No. Just describe what you want in plain English and Krypton AI generates it instantly." },
  { q: "Is Krypton AI reliable?", a: "Yes. Krypton AI is built for speed, accuracy, and reliability, helping users generate high-quality projects with minimal effort." },
];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function hexToRgb(hex: string) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}
function rgbToHex(r:number,g:number,b:number) {
  return '#'+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
}

function useCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        setCount(Math.round(ease * target));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return { count, ref };
}

function CounterCard({ value, label, suffix }: { value: number; label: string; suffix: string }) {
  const { count, ref } = useCounter(value);
  return (
    <div ref={ref} style={{ textAlign: "center", padding: "32px 24px" }}>
      <div className="grad-text" style={{ fontSize: "clamp(36px,5vw,56px)", fontWeight: 800, fontFamily: "'Syne',sans-serif", lineHeight:1 }}>
        {count}{suffix}
      </div>
      <div style={{ color: T.muted, fontSize: "14px", marginTop: "8px" }}>{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [promptIndex, setPromptIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [billing, setBilling] = useState<"monthly"|"yearly">("monthly");
  const [currency, setCurrency] = useState<"USD"|"INR">("INR");
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [openFaq, setOpenFaq] = useState<number|null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>();

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1100);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handle);
    return () => window.removeEventListener("mousemove", handle);
  }, []);

  // ── Gradient cycling ──
  useEffect(() => {
    const root = document.documentElement;
    let current = 0;
    let transitioning = false;
    const setVars = (a: number[], b: number[]) => {
      root.style.setProperty("--ga", rgbToHex(a[0],a[1],a[2]));
      root.style.setProperty("--gb", rgbToHex(b[0],b[1],b[2]));
      root.style.setProperty("--ga-rgb", `${Math.round(a[0])},${Math.round(a[1])},${Math.round(a[2])}`);
      root.style.setProperty("--gb-rgb", `${Math.round(b[0])},${Math.round(b[1])},${Math.round(b[2])}`);
    };
    const doTransition = (fromIdx: number, toIdx: number) => {
      if (transitioning) return;
      transitioning = true;
      const from = THEMES[fromIdx], to = THEMES[toIdx];
      const fa = hexToRgb(from.a), fb = hexToRgb(from.b);
      const ta = hexToRgb(to.a),   tb = hexToRgb(to.b);
      const dur = 2000, t0 = performance.now();
      const step = (now: number) => {
        const raw = Math.min((now - t0) / dur, 1);
        const ease = raw < 0.5 ? 2*raw*raw : -1+(4-2*raw)*raw;
        setVars(fa.map((v,i) => lerp(v, ta[i], ease)), fb.map((v,i) => lerp(v, tb[i], ease)));
        if (raw < 1) { animRef.current = requestAnimationFrame(step); } else transitioning = false;
      };
      animRef.current = requestAnimationFrame(step);
    };
    setVars(hexToRgb(THEMES[0].a), hexToRgb(THEMES[0].b));
    const timer = setInterval(() => {
      const next = (current + 1) % THEMES.length;
      doTransition(current, next);
      current = next;
    }, 10000);
    return () => { clearInterval(timer); if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // ── Typewriter ──
  useEffect(() => {
    const target = PROMPTS[promptIndex];
    let i = 0; setDisplayed("");
    const iv = setInterval(() => {
      if (i < target.length) { setDisplayed(target.slice(0, i+1)); i++; }
      else { clearInterval(iv); setTimeout(() => setPromptIndex(p => (p+1) % PROMPTS.length), 2500); }
    }, 48);
    return () => clearInterval(iv);
  }, [promptIndex]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const scrollTo = useCallback((id: string) => {
    setMobileMenu(false);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const getPrice = (plan: typeof PLANS[0]) => {
    if (currency === "INR") return billing === "monthly" ? plan.monthlyPriceInr : plan.yearlyPriceInr;
    return billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
  };

  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: "'DM Sans',sans-serif", minHeight: "100vh", overflowX: "hidden", width: "100%" }}>

      <style>{`
        :root { --ga: #F5D800; --gb: #00CC44; --ga-rgb: 245,216,0; --gb-rgb: 0,204,68; }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; width: 100%; }
        .grad-text {
          background: linear-gradient(135deg, var(--ga) 0%, var(--gb) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          transition: background 2s ease;
        }
        .grad-bg {
          background: linear-gradient(135deg, var(--ga) 0%, var(--gb) 100%) !important;
          transition: background 2s ease;
        }
        .grad-glow {
          box-shadow: 0 0 30px rgba(var(--ga-rgb),0.25), 0 0 60px rgba(var(--gb-rgb),0.12);
          transition: box-shadow 2s ease;
        }
        .shine-btn { position: relative; overflow: hidden; }
        .shine-btn::after {
          content: ''; position: absolute; top: -50%; left: -60%;
          width: 40%; height: 200%;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.25), transparent);
          transform: skewX(-20deg); animation: shineLoop 4s ease-in-out infinite;
        }
        @keyframes shineLoop { 0%{left:-60%;opacity:0} 10%{opacity:1} 40%{left:130%;opacity:1} 41%{opacity:0} 100%{left:130%;opacity:0} }
        @keyframes gradMove  { 0%{transform:translate(0,0) scale(1)} 33%{transform:translate(3%,-3%) scale(1.05)} 66%{transform:translate(-3%,3%) scale(0.97)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes gradMove2 { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(-4%,4%) scale(1.08)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes gradMove3 { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(4%,-2%) scale(1.06)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes glowPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes orbFloat  { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.04)} }
        @keyframes orbRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes marquee   { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes gridFade  { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse     { 0%,100%{transform:scale(1);opacity:0.8} 50%{transform:scale(1.15);opacity:1} }
        .fade-up { animation: fadeUp 0.7s ease forwards; }
        .hover-lift { transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .desktop-nav { display: none; }
        @media (min-width: 768px) { .desktop-nav { display: flex !important; } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: rgba(245,197,66,0.3); border-radius: 3px; }
      `}</style>

      {/* ── Aurora Background ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position:"absolute", top:"10%", left:"10%", width:"50vw", height:"50vw", borderRadius:"50%", filter:"blur(90px)", background:"radial-gradient(circle, rgba(245,197,66,0.45) 0%, transparent 70%)", animation:"gradMove 20s ease-in-out infinite, glowPulse 8s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"0%", right:"-8%", width:"60vw", height:"60vw", borderRadius:"50%", filter:"blur(90px)", background:"radial-gradient(circle, rgba(255,140,0,0.40) 0%, transparent 70%)", animation:"gradMove2 24s ease-in-out infinite, glowPulse 10s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"-5%", left:"10%", width:"55vw", height:"55vw", borderRadius:"50%", filter:"blur(90px)", background:"radial-gradient(circle, rgba(0,208,132,0.35) 0%, transparent 70%)", animation:"gradMove3 22s ease-in-out infinite, glowPulse 7s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"5%", left:"35%", width:"60vw", height:"60vw", borderRadius:"50%", filter:"blur(90px)", background:"radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)", animation:"gradMove2 26s ease-in-out infinite, glowPulse 11s ease-in-out infinite" }} />
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(245,197,66,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,66,0.03) 1px, transparent 1px)", backgroundSize:"48px 48px", animation:"gridFade 6s ease-in-out infinite" }} />
        {!isMobile && (
          <div style={{ position:"absolute", width:"400px", height:"400px", borderRadius:"50%", filter:"blur(80px)", background:`radial-gradient(circle, rgba(var(--ga-rgb),0.08) 0%, transparent 70%)`, left: mousePos.x - 200, top: mousePos.y - 200, transition:"left 0.3s ease, top 0.3s ease" }} />
        )}
      </div>

      {/* ── NAVBAR ── */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, borderBottom:`1px solid ${T.border}`, background:"rgba(5,5,5,0.92)", backdropFilter:"blur(24px)", height:"60px", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 4%" }}>
        <div ref={dropdownRef} style={{ position:"relative", display:"flex", alignItems:"center" }}>
          <button onClick={e => { e.stopPropagation(); setShowDropdown(v => !v); }} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer" }}>
            <img src="/logo.png" alt="Krypton AI" style={{ height:"42px", width:"auto", objectFit:"contain" }} />
            <span style={{ color:"#555", fontSize:"10px" }}>▾</span>
          </button>
          {showDropdown && (
            <div style={{ position:"absolute", top:"50px", left:0, background:"#0D0D0D", border:`1px solid ${T.border}`, borderRadius:"16px", padding:"8px", minWidth:"220px", zIndex:200, boxShadow:"0 8px 32px rgba(0,0,0,0.8)" }}>
              {[
                { icon:"🏠", label:"Home", path:"/landing" },
                { icon:"✨", label:"Features", onClick:() => scrollTo("features") },
                { icon:"🖼️", label:"Templates", path:"/templates" },
                { icon:"💰", label:"Pricing", onClick:() => scrollTo("pricing") },
                { icon:"❓", label:"FAQ", onClick:() => scrollTo("faq") },
              ].map(item => (
                <button key={item.label} onClick={() => { if ((item as any).path) router.push((item as any).path); else if ((item as any).onClick) (item as any).onClick(); setShowDropdown(false); }}
                  style={{ width:"100%", textAlign:"left", padding:"9px 12px", background:"none", border:"none", color:T.muted, fontSize:"13px", cursor:"pointer", borderRadius:"8px", display:"flex", alignItems:"center", gap:"8px" }}
                  onMouseEnter={e => { e.currentTarget.style.background="#1a1a1a"; e.currentTarget.style.color=T.text; }}
                  onMouseLeave={e => { e.currentTarget.style.background="none"; e.currentTarget.style.color=T.muted; }}>
                  {item.icon} {item.label}
                </button>
              ))}
              <div style={{ height:"1px", background:T.border, margin:"6px 0" }} />
              <button onClick={() => { router.push("/auth/login"); setShowDropdown(false); }} style={{ width:"100%", textAlign:"left", padding:"9px 12px", background:"none", border:"none", color:T.muted, fontSize:"13px", cursor:"pointer", borderRadius:"8px", display:"flex", alignItems:"center", gap:"8px" }}>🚀 Login</button>
              <button onClick={() => { router.push("/auth/signup"); setShowDropdown(false); }} style={{ width:"100%", textAlign:"left", padding:"9px 12px", background:"linear-gradient(135deg,rgba(245,197,66,0.15),rgba(0,208,132,0.1))", border:"1px solid rgba(245,197,66,0.2)", borderRadius:"8px", color:"#F5D800", fontSize:"13px", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:"8px", marginTop:4 }}>🟢 Get Started Free</button>
            </div>
          )}
        </div>

        <div className="desktop-nav" style={{ gap:"28px", position:"absolute", left:"50%", transform:"translateX(-50%)" }}>
          {NAV_LINKS.map(item => (
            <button key={item} onClick={() => scrollTo(item.toLowerCase())} style={{ background:"none", border:"none", color:T.muted, fontSize:"13px", cursor:"pointer", fontWeight:500, transition:"color 0.2s", fontFamily:"'DM Sans',sans-serif" }}
              onMouseEnter={e => e.currentTarget.style.color="#F5D800"}
              onMouseLeave={e => e.currentTarget.style.color=T.muted}>
              {item}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
          {!isMobile && (
            <button onClick={() => router.push("/auth/login")} style={{ padding:"7px 16px", background:"none", border:`1px solid ${T.border}`, borderRadius:"9px", color:T.muted, fontSize:"13px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="#F5D800"; e.currentTarget.style.color=T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.muted; }}>
              Login
            </button>
          )}
          <button className="grad-bg shine-btn" onClick={() => router.push("/auth/signup")} style={{ padding:"7px 16px", border:"none", borderRadius:"9px", color:"#050505", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            Get Started
          </button>
          {isMobile && (
            <button onClick={() => setMobileMenu(v => !v)} style={{ background:"none", border:"none", color:T.text, fontSize:"20px", cursor:"pointer" }}>
              {mobileMenu ? "✕" : "☰"}
            </button>
          )}
        </div>
      </nav>

      {mobileMenu && (
        <div style={{ position:"fixed", top:"60px", left:0, right:0, background:"#0A0A0A", borderBottom:`1px solid ${T.border}`, padding:"16px 5%", zIndex:99, display:"flex", flexDirection:"column", gap:"4px" }}>
          {NAV_LINKS.map(item => (
            <button key={item} onClick={() => scrollTo(item.toLowerCase())} style={{ background:"none", border:"none", color:T.sub, fontSize:"15px", cursor:"pointer", padding:"10px 0", textAlign:"left", fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>{item}</button>
          ))}
          <button onClick={() => { router.push("/auth/login"); setMobileMenu(false); }} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:"9px", color:T.text, fontSize:"14px", cursor:"pointer", padding:"10px", marginTop:"8px", fontFamily:"'DM Sans',sans-serif" }}>Login</button>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight: isMobile ? "auto" : "100vh", paddingTop: isMobile ? 90 : 120, paddingBottom: isMobile ? 50 : 80, textAlign:"center", overflow:"hidden" }}>
        <div style={{ ...W, display:"flex", flexDirection:"column", alignItems:"center" }}>

          {/* Badge */}
          <div className="fade-up" style={{ display:"inline-flex", alignItems:"center", gap:"8px", background:"rgba(245,197,66,0.06)", border:`1px solid rgba(245,197,66,0.15)`, borderRadius:"20px", padding:"5px 16px", marginBottom:"1.5rem", fontSize:"12px" }}>
            <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#00D084", display:"inline-block", animation:"pulse 2s infinite" }} />
            <span className="grad-text" style={{ fontWeight:600 }}>✨ Websites, Apps & Games Generated in Seconds</span>
          </div>

          {/* AI Orb */}
          <div style={{ position:"relative", width: isMobile ? 110 : 160, height: isMobile ? 110 : 160, margin:"0 auto 2rem", flexShrink:0 }}>
            <div style={{ position:"absolute", inset:-12, borderRadius:"50%", border:"1px solid transparent", background:"linear-gradient(#050505,#050505) padding-box, linear-gradient(135deg,var(--ga),var(--gb)) border-box", animation:"orbRotate 8s linear infinite", opacity:0.6 }} />
            <div className="grad-glow" style={{ position:"absolute", inset:0, borderRadius:"50%", filter:"blur(20px)", background:"linear-gradient(135deg,rgba(var(--ga-rgb),0.3),rgba(var(--gb-rgb),0.3))" }} />
            <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"radial-gradient(circle at 40% 35%, rgba(var(--ga-rgb),0.15) 0%, #0d0d0d 60%)", border:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center", animation:"orbFloat 6s ease-in-out infinite" }}>
              <img src="/logo.png" alt="Kr" style={{ width: isMobile ? 55 : 80, height: isMobile ? 55 : 80, objectFit:"contain" }} />
            </div>
          </div>

          {/* H1 */}
          <h1 className="fade-up" style={{ fontFamily:"'Syne',sans-serif", fontSize: isMobile ? "clamp(28px,7vw,42px)" : "clamp(48px,5vw,72px)", fontWeight:800, lineHeight:1.07, marginBottom:"1.2rem", maxWidth:"1000px", animationDelay:"0.1s" }}>
            Build Websites, Apps & Games with AI.
            <br />
            <span className="grad-text">Go from Idea to Production in Minutes.</span>
          </h1>

          <p className="fade-up" style={{ color:T.sub, fontSize: isMobile ? "15px" : "19px", lineHeight:1.7, maxWidth:"620px", marginBottom:"2.5rem", animationDelay:"0.2s" }}>
            Describe what you want. Krypton AI builds it — complete, responsive, and ready to deploy.
          </p>

          {/* CTA Buttons */}
          <div className="fade-up" style={{ display:"flex", gap:"12px", flexWrap:"wrap", justifyContent:"center", marginBottom:"2.5rem", animationDelay:"0.3s" }}>
            <button className="grad-bg shine-btn" onClick={() => router.push("/auth/signup")}
              style={{ padding: isMobile ? "13px 28px" : "15px 40px", border:"none", borderRadius:"14px", color:"#050505", fontSize: isMobile ? "14px" : "16px", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              Start Building Free →
            </button>
            <button onClick={() => scrollTo("examples")} style={{ padding: isMobile ? "13px 28px" : "15px 40px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"14px", color:T.text, fontSize: isMobile ? "14px" : "16px", fontWeight:600, cursor:"pointer", transition:"all 0.2s", fontFamily:"'DM Sans',sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.1)"; }}>
              See Examples
            </button>
          </div>

          {/* Prompt mockup */}
          <div className="fade-up" style={{ width:"100%", maxWidth:"700px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"16px", padding:"16px 20px", animationDelay:"0.4s" }}>
            <p style={{ color:"#444", fontSize:"13px", margin:"0 0 8px" }}>Try asking:</p>
            <p style={{ color:"rgba(255,255,255,0.7)", fontSize: isMobile ? "14px" : "16px", margin:0, fontFamily:"monospace", minHeight:"24px" }}>
              {displayed}<span style={{ animation:"pulse 1s infinite", display:"inline-block", width:"2px", height:"16px", background:"#F5D800", marginLeft:"2px", verticalAlign:"middle" }} />
            </p>
          </div>

          {/* Trust row */}
          <div className="fade-up" style={{ display:"flex", gap: isMobile ? 12 : 28, flexWrap:"wrap", justifyContent:"center", marginTop:"1.5rem", animationDelay:"0.5s" }}>
            {["✓ Free to start", "✓ No credit card", "✓ Instant results", "✓ Export code"].map(b => (
              <span key={b} style={{ fontSize: isMobile ? 11 : 13, color: T.muted }}>{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div style={{ overflow:"hidden", borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, padding:"14px 0", background:"rgba(10,10,10,0.8)", position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", animation:"marquee 20s linear infinite", width:"max-content" }}>
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} style={{ padding:"0 32px", fontSize:"13px", color:T.muted, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:"8px" }}>
              <span className="grad-text" style={{ fontWeight:600 }}>{item}</span>
              <span style={{ color:"rgba(255,255,255,0.1)" }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <section style={{ position:"relative", zIndex:1, padding: isMobile ? "50px 0" : "70px 0" }}>
        <div style={{ ...W }}>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap:"1px", background:`rgba(255,255,255,0.05)`, borderRadius:"20px", overflow:"hidden", border:`1px solid ${T.border}` }}>
            {STATS.map((s, i) => (
              <div key={i} style={{ background:T.card }}>
                <CounterCard value={s.value} label={s.label} suffix={s.suffix} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ scrollMarginTop:"80px", position:"relative", zIndex:1, padding: isMobile ? "60px 0" : "90px 0" }}>
        <div style={{ ...W }}>
          <p style={{ textAlign:"center", fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"12px" }}><span className="grad-text">What You Can Build</span></p>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,4vw,48px)", fontWeight:800, textAlign:"center", marginBottom:"3rem" }}>
            One AI. <span className="grad-text">Infinite Possibilities.</span>
          </h2>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : isTablet ? "repeat(2,1fr)" : "repeat(4,1fr)", gap:"16px" }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="hover-lift" style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"18px", padding: isMobile ? "20px 16px" : "28px 24px" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(var(--ga-rgb),0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; }}>
                <div style={{ fontSize: isMobile ? "28px" : "32px", marginBottom:"14px" }}>{f.icon}</div>
                <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize: isMobile ? "15px" : "18px", fontWeight:700, marginBottom:"8px" }}><span className="grad-text">{f.title}</span></h3>
                <p style={{ color:T.sub, fontSize: isMobile ? "12px" : "14px", lineHeight:1.7, margin:0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXAMPLES ── */}
      <section id="examples" style={{ scrollMarginTop:"80px", position:"relative", zIndex:1, padding: isMobile ? "60px 0" : "90px 0", background:"rgba(10,10,10,0.6)", borderTop:`1px solid ${T.border}` }}>
        <div style={{ ...W }}>
          <p style={{ textAlign:"center", fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"12px" }}><span className="grad-text">Examples</span></p>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,4vw,48px)", fontWeight:800, textAlign:"center", marginBottom:"3rem" }}>
            See What's <span className="grad-text">Possible</span>
          </h2>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : isTablet ? "repeat(3,1fr)" : "repeat(6,1fr)", gap:"14px" }}>
            {[
              { title:"SaaS Dashboard", tag:"Web App", color:"rgba(245,197,66,0.1)", icon:"📊" },
              { title:"Portfolio Site", tag:"Website", color:"rgba(0,208,132,0.1)", icon:"💼" },
              { title:"Snake Game",     tag:"Game",    color:"rgba(139,92,246,0.1)", icon:"🎮" },
              { title:"Invoice Tool",   tag:"Tool",    color:"rgba(59,130,246,0.1)", icon:"📋" },
              { title:"Fitness App",    tag:"Web App", color:"rgba(244,63,94,0.1)",  icon:"💪" },
              { title:"E-Commerce",     tag:"Website", color:"rgba(16,185,129,0.1)", icon:"🛒" },
            ].map((ex, i) => (
              <div key={i} className="hover-lift" style={{ background:ex.color, border:`1px solid ${T.border}`, borderRadius:"16px", overflow:"hidden" }}
                onMouseEnter={e => e.currentTarget.style.borderColor="rgba(var(--ga-rgb),0.3)"}
                onMouseLeave={e => e.currentTarget.style.borderColor=T.border}>
                <div style={{ height:"120px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:"40px" }}>{ex.icon}</span>
                </div>
                <div style={{ padding:"14px 16px" }}>
                  <span style={{ fontSize:"10px", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.1em" }}><span className="grad-text">{ex.tag}</span></span>
                  <p style={{ fontSize:"14px", fontWeight:600, margin:"4px 0 0", color:T.text }}>{ex.title}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center", marginTop:"2.5rem" }}>
            <button className="grad-bg shine-btn" onClick={() => router.push("/auth/signup")} style={{ padding:"13px 36px", border:"none", borderRadius:"12px", color:"#050505", fontSize:"15px", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              Build Your Own →
            </button>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ position:"relative", zIndex:1, padding: isMobile ? "60px 0" : "90px 0" }}>
        <div style={{ ...W }}>
          <p style={{ textAlign:"center", fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"12px" }}><span className="grad-text">Testimonials</span></p>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,4vw,48px)", fontWeight:800, textAlign:"center", marginBottom:"3rem" }}>
            Loved by <span className="grad-text">Builders</span>
          </h2>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap:"16px" }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="hover-lift" style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${T.border}`, borderRadius:"18px", padding:"28px 24px" }}
                onMouseEnter={e => e.currentTarget.style.borderColor="rgba(var(--ga-rgb),0.3)"}
                onMouseLeave={e => e.currentTarget.style.borderColor=T.border}>
                <div style={{ marginBottom:"14px" }}>{"⭐".repeat(t.stars)}</div>
                <p style={{ color:T.sub, fontSize:"15px", lineHeight:1.7, marginBottom:"20px", fontStyle:"italic" }}>"{t.text}"</p>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,var(--ga),var(--gb))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#050505", flexShrink:0 }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <p style={{ fontWeight:700, fontSize:"14px", margin:0 }}>{t.name}</p>
                    <p style={{ color:T.muted, fontSize:"12px", margin:"2px 0 0" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ scrollMarginTop:"80px", position:"relative", zIndex:1, padding: isMobile ? "60px 0" : "90px 0", background:"rgba(10,10,10,0.8)", borderTop:`1px solid ${T.border}` }}>
        <div style={{ ...W }}>
          <p style={{ textAlign:"center", fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"12px" }}><span className="grad-text">Pricing</span></p>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,4vw,48px)", fontWeight:800, textAlign:"center", marginBottom:"1rem" }}>
            Simple, <span className="grad-text">Transparent Pricing</span>
          </h2>
          <p style={{ color:T.sub, textAlign:"center", marginBottom:"2rem", fontSize:"16px" }}>Start free. Upgrade when you need more.</p>

          <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:"12px", marginBottom:"2.5rem", flexWrap:"wrap" }}>
            {/* Billing toggle */}
            <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:"12px", padding:4 }}>
              {["monthly","yearly"].map(b => (
                <button key={b} onClick={() => setBilling(b as any)} style={{ padding:"8px 20px", borderRadius:"9px", border:"1px solid", borderColor: billing===b ? "rgba(var(--ga-rgb),0.4)" : "transparent", background: billing===b ? "rgba(var(--ga-rgb),0.1)" : "transparent", color: billing===b ? "#F5D800" : T.muted, fontWeight:600, fontSize:"13px", cursor:"pointer", transition:"all 0.2s", textTransform:"capitalize", fontFamily:"'DM Sans',sans-serif" }}>
                  {b} {b==="yearly" && <span style={{ fontSize:"10px", marginLeft:"4px", color:"#00D084" }}>Save 20%</span>}
                </button>
              ))}
            </div>
            {/* Currency toggle */}
            <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:"10px", overflow:"hidden" }}>
              {(["INR","USD"] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)} style={{ padding:"8px 16px", border:"none", background: currency===c ? "rgba(245,197,66,0.15)" : "transparent", color: currency===c ? "#F5D800" : T.muted, fontSize:"12px", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                  {c === "INR" ? "₹ INR" : "$ USD"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(4,1fr)", gap:"16px" }}>
            {PLANS.map(plan => (
              <div key={plan.name} className="hover-lift" style={{ background: plan.highlight ? "rgba(245,197,66,0.04)" : T.card, border: plan.highlight ? "1px solid rgba(var(--ga-rgb),0.4)" : `1px solid ${T.border}`, borderRadius:"20px", padding:"28px 22px", position:"relative", boxShadow: plan.highlight ? "0 0 40px rgba(var(--ga-rgb),0.1)" : "none" }}>
                {plan.highlight && (
                  <div className="grad-bg" style={{ position:"absolute", top:"-12px", left:"50%", transform:"translateX(-50%)", color:"#050505", fontSize:"11px", fontWeight:700, padding:"4px 16px", borderRadius:"20px", whiteSpace:"nowrap" }}>⭐ Most Popular</div>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"4px" }}>
                  <span>{plan.emoji}</span>
                  <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:"18px", fontWeight:700 }}><span className="grad-text">{plan.name}</span></h3>
                </div>
                <p style={{ color:"#00D084", fontSize:"11px", marginBottom:"12px" }}>{plan.credits}</p>
                <div style={{ marginBottom:"18px" }}>
                  <span style={{ fontSize:"34px", fontWeight:800 }}><span className="grad-text">{getPrice(plan)}</span></span>
                  <span style={{ color:T.muted, fontSize:"12px" }}>/mo</span>
                </div>
                {plan.included.map(f => (
                  <div key={f} style={{ display:"flex", alignItems:"flex-start", gap:"7px", marginBottom:"8px" }}>
                    <span style={{ color:"#00D084", fontSize:"12px", flexShrink:0, marginTop:1 }}>✓</span>
                    <span style={{ fontSize:"13px", color:T.sub }}>{f}</span>
                  </div>
                ))}
                {plan.locked.map(f => (
                  <div key={f} style={{ display:"flex", alignItems:"flex-start", gap:"7px", marginBottom:"8px" }}>
                    <span style={{ fontSize:"12px", flexShrink:0, color:"#333" }}>✕</span>
                    <span style={{ fontSize:"13px", color:"#444" }}>{f}</span>
                  </div>
                ))}
                <button className={plan.highlight ? "grad-bg shine-btn" : ""} onClick={() => router.push(plan.name === "Business" ? "/contact" : "/auth/signup")} style={{ width:"100%", marginTop:"18px", padding:"12px", background: plan.highlight ? undefined : "#161616", border: plan.highlight ? "none" : `1px solid ${T.border}`, borderRadius:"10px", color: plan.highlight ? "#050505" : T.text, fontWeight:700, fontSize:"13px", cursor:"pointer", transition:"all 0.2s", fontFamily:"'DM Sans',sans-serif" }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ scrollMarginTop:"80px", position:"relative", zIndex:1, padding: isMobile ? "60px 0" : "90px 0", borderTop:`1px solid ${T.border}` }}>
        <div style={{ ...W, maxWidth: 800 }}>
          <p style={{ textAlign:"center", fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"12px" }}><span className="grad-text">FAQ</span></p>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,4vw,44px)", fontWeight:800, textAlign:"center", marginBottom:"2.5rem" }}>
            <span className="grad-text">Frequently Asked</span>
          </h2>
          {FAQS.map((item, i) => (
            <div key={i} style={{ borderBottom:`1px solid ${T.border}`, overflow:"hidden" }}>
              <button onClick={() => setOpenFaq(openFaq===i ? null : i)} style={{ width:"100%", textAlign:"left", background:"none", border:"none", cursor:"pointer", padding:"18px 0", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px", fontFamily:"'DM Sans',sans-serif" }}>
                <span style={{ fontWeight:700, fontSize:"15px" }}><span className="grad-text">{item.q}</span></span>
                <span style={{ color:T.muted, transition:"transform 0.3s", transform: openFaq===i ? "rotate(45deg)" : "none", display:"inline-block", fontSize:"18px", flexShrink:0 }}>+</span>
              </button>
              {openFaq===i && (
                <p style={{ color:T.sub, fontSize:"14px", lineHeight:1.7, paddingBottom:"18px", margin:0 }}>{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ padding: isMobile ? "60px 0" : "100px 0", textAlign:"center", borderTop:`1px solid ${T.border}`, position:"relative", zIndex:1 }}>
        <div style={{ ...W, maxWidth: 800 }}>
          <div className="grad-glow" style={{ width:"120px", height:"120px", borderRadius:"50%", background:"linear-gradient(135deg,rgba(var(--ga-rgb),0.2),rgba(var(--gb-rgb),0.2))", margin:"0 auto 2rem", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"40px" }}>⚡</div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize: isMobile ? "clamp(26px,7vw,38px)" : "clamp(32px,4vw,52px)", fontWeight:800, marginBottom:"1.5rem" }}>
            The future of building is <span className="grad-text">a sentence away.</span>
          </h2>
          <p style={{ color:T.sub, fontSize:"16px", marginBottom:"2.5rem", lineHeight:1.7 }}>
            Join thousands of builders creating the web with Krypton AI.
          </p>
          <button className="grad-bg shine-btn" onClick={() => router.push("/auth/signup")} style={{ padding:"15px 40px", border:"none", borderRadius:"14px", color:"#050505", fontSize:"16px", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            Start Free — No credit card required →
          </button>
          <p style={{ color:T.muted, fontSize:"12px", marginTop:"1rem" }}>5 free generations every day. No card needed.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop:`1px solid ${T.border}`, padding: isMobile ? "40px 0 24px" : "60px 0 28px", background:"rgba(8,8,8,0.98)", position:"relative", zIndex:1 }}>
        <div style={{ ...W }}>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap: isMobile ? "28px" : "40px", marginBottom:"40px" }}>
            {[
              { title:"Product", links:[{label:"Features",href:"/landing#features"},{label:"Pricing",href:"/landing#pricing"},{label:"Roadmap",href:"/changelog"},{label:"Examples",href:"/landing#examples"}] },
              { title:"Resources", links:[{label:"Documentation",href:"/docs"},{label:"Changelog",href:"/changelog"},{label:"Blog",href:"/blog"},{label:"Support",href:"/support"}] },
              { title:"Company", links:[{label:"About",href:"/about"},{label:"Contact",href:"/contact"}] },
              { title:"Legal", links:[{label:"Privacy Policy",href:"/privacy"},{label:"Terms of Service",href:"/terms"},{label:"Refund Policy",href:"/refund"}] },
              { title:"Social", links:[{label:"Email Us",href:"mailto:support@kryptonai.tech"},{label:"X (Twitter)",href:"https://twitter.com/kryptonai"},{label:"LinkedIn",href:"https://linkedin.com/company/kryptonai"},{label:"GitHub",href:"https://github.com/jangeersinghktm-design/Magic-Krypton-ai-"}] },
            ].map(col => (
              <div key={col.title}>
                <p style={{ fontWeight:700, fontSize:"13px", marginBottom:"14px" }}><span className="grad-text">{col.title}</span></p>
                {col.links.map(link => (
                  <a key={link.label} href={link.href} target={link.href.startsWith("http") || link.href.startsWith("mailto") ? "_blank" : undefined} rel="noreferrer"
                    style={{ display:"block", color:T.muted, fontSize:"13px", marginBottom:"9px", textDecoration:"none", transition:"color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.color="#F5D800"}
                    onMouseLeave={e => e.currentTarget.style.color=T.muted}>
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:"20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"10px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <img src="/logo.png" alt="Krypton AI" style={{ height:"36px", width:"auto", objectFit:"contain" }} />
              <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16 }}><span className="grad-text">Krypton AI</span></span>
            </div>
            <p style={{ color:T.muted, fontSize:"12px", margin:0 }}>© 2026 Krypton AI. All rights reserved.</p>
            <p style={{ color:"#333", fontSize:"11px" }}>Made with ❤️ in India 🇮🇳</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
