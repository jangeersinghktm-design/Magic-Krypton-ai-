"use client";

import { useState, useEffect, useCallback, useRef, CSSProperties } from "react";
import { useRouter } from "next/navigation";

// ── Gradient Themes — cycle every 6s, 800ms transition ──
const THEMES = [
  { a: "#F5C542", b: "#00D084", ar: "245,197,66",   br: "0,208,132"  }, // Gold + Green
  { a: "#8B5CF6", b: "#EC4899", ar: "139,92,246",   br: "236,72,153" }, // Purple + Pink
  { a: "#FACC15", b: "#FB923C", ar: "250,204,21",   br: "251,146,60"  }, // Yellow + Orange
  { a: "#3B82F6", b: "#06B6D4", ar: "59,130,246",   br: "6,182,212"  }, // Blue + Cyan
  { a: "#7C3AED", b: "#2563EB", ar: "124,58,237", br: "37,99,235" }, // Purple + Electric Blue
  { a: "#10B981", b: "#14B8A6", ar: "16,185,129",   br: "20,184,166" }, // Emerald + Teal
  { a: "#14B8A6", b: "#06B6D4", ar: "20,184,166", br: "6,182,212" }, // Teal + Cyan
  { a: "#6366F1", b: "#8B5CF6", ar: "99,102,241", br: "139,92,246" }, // Indigo + Purple
];

const T = {
  bg: "#050505", card: "#0D0D0D",
  border: "rgba(255,255,255,0.08)", text: "#FFFFFF",
  sub: "#B3B3B3", muted: "#6B7280",
};

const PROMPTS = [
  "Build a SaaS dashboard with dark mode...",
  "Create a portfolio website with animations...",
  "Build an invoice generator with PDF export...",
  "Create a CRM system with kanban board...",
  "Build a browser game like Snake...",
  "Create a fitness tracking app...",
];

const NAV_LINKS = ["Features", "Pricing", "Examples", "Roadmap"];

const FEATURES = [
  { icon: "🌐", title: "Websites", desc: "Landing pages, portfolios, business sites — pixel-perfect and responsive." },
  { icon: "⚙️", title: "Web Apps", desc: "Dashboards, CRM tools, productivity apps with full interactivity." },
  { icon: "🎮", title: "Browser Games", desc: "Snake, 2048, puzzle games — fully playable in the browser." },
  { icon: "🧰", title: "Business Tools", desc: "Calculators, forms, trackers — tools that actually work." },
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
  { name: "Free", emoji: "🟢", monthlyPrice: "$0", yearlyPrice: "$0", credits: "5 Generations / Day", highlight: false, cta: "Get Started Free",
    included: ["Website Generator","App Generator","Game Generator","Live Preview","Mobile Responsive Output","Download HTML","Community Support"],
    locked: ["Save Projects","Project History","Advanced AI Model","Team Workspace","API Access"] },
  { name: "Pro", emoji: "🔥", monthlyPrice: "$25", yearlyPrice: "$20", credits: "100 Generations / Month", highlight: true, cta: "Start Pro",
    included: ["Everything in Free","Save Projects","Project History","Faster Generation","Better AI Quality","Export Full Source Code","Private Projects","Premium Templates","Email Support"],
    locked: ["Team Workspace","API Access"] },
  { name: "Premium", emoji: "💎", monthlyPrice: "$69", yearlyPrice: "$55", credits: "300 Generations / Month", highlight: false, cta: "Start Premium",
    included: ["Everything in Pro","Fastest AI Model","Unlimited Project Saves","Version History","Team Collaboration (5 Users)","Priority Support"],
    locked: ["API Access"] },
  { name: "Business", emoji: "🏢", monthlyPrice: "$149", yearlyPrice: "$119", credits: "100 Generations / Day", highlight: false, cta: "Contact Us",
    included: ["Everything in Premium","API Access","Unlimited Team Members","Admin Dashboard","White Label Support","Business SLA"],
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

// ── Helpers ──
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return [r,g,b];
}
function rgbToHex(r:number,g:number,b:number) {
  return '#'+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
}

// ── Counter hook ──
function useCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
    <div ref={ref} style={{ textAlign: "center", padding: "28px 16px" }}>
      <div className="grad-text" style={{ fontSize: "clamp(36px,5vw,56px)", fontWeight: 800, fontFamily: "'Syne',sans-serif", lineHeight:1 }}>
        {count}{suffix}
      </div>
      <div style={{ color: T.muted, fontSize: "13px", marginTop: "8px", letterSpacing:"0.02em" }}>{label}</div>
    </div>
  );
}

// ── Floating Particle ──
function Particle({ style }: { style: CSSProperties }) {
  return <div className="particle" style={style} />;
}

export default function LandingPage() {
  const router = useRouter();
  const [promptIndex, setPromptIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [billing, setBilling] = useState<"monthly"|"yearly">("monthly");
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [openFaq, setOpenFaq] = useState<number|null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [navScrolled, setNavScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef(0);
  const animRef = useRef<number>();
  const [liveCode, setLiveCode] = useState(0);

  // ── Responsive ──
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1200);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Nav scroll effect ──
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Mouse glow ──
  useEffect(() => {
    const handle = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handle, { passive: true });
    return () => window.removeEventListener("mousemove", handle);
  }, []);

  // ── Live code counter (hero dashboard mockup) ──
  useEffect(() => {
    const iv = setInterval(() => setLiveCode(p => p + Math.floor(Math.random() * 12 + 3)), 80);
    return () => clearInterval(iv);
  }, []);

  // ── Gradient cycling — 6s interval, 800ms smooth transition ──
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
      const dur = 800; // 800ms smooth transition
      const t0 = performance.now();
      const step = (now: number) => {
        const raw = Math.min((now - t0) / dur, 1);
        const ease = raw < 0.5 ? 2*raw*raw : -1+(4-2*raw)*raw;
        setVars(fa.map((v,i)=>lerp(v,ta[i],ease)), fb.map((v,i)=>lerp(v,tb[i],ease)));
        if (raw < 1) { animRef.current = requestAnimationFrame(step); }
        else transitioning = false;
      };
      animRef.current = requestAnimationFrame(step);
    };

    setVars(hexToRgb(THEMES[0].a), hexToRgb(THEMES[0].b));

    const timer = setInterval(() => {
      const next = (current + 1) % THEMES.length;
      doTransition(current, next);
      current = next;
      themeRef.current = next;
    }, 3000); // every 3 seconds

    return () => { clearInterval(timer); if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // ── Typewriter ──
  useEffect(() => {
    const target = PROMPTS[promptIndex];
    let i = 0;
    setDisplayed("");
    const iv = setInterval(() => {
      if (i < target.length) { setDisplayed(target.slice(0, i+1)); i++; }
      else { clearInterval(iv); setTimeout(() => setPromptIndex(p => (p+1) % PROMPTS.length), 2500); }
    }, 44);
    return () => clearInterval(iv);
  }, [promptIndex]);

  // ── Click outside dropdown ──
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

  const isDesktop = !isMobile && !isTablet;

  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: "'DM Sans',sans-serif", minHeight: "100vh", overflowX: "hidden", position: "relative" }}>

      {/* ── Global CSS ── */}
      <style>{`
        :root {
          --ga: #F5C542; --gb: #00D084;
          --ga-rgb: 245,197,66; --gb-rgb: 0,208,132;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* Gradient utilities */
        .grad-text {
          background: linear-gradient(135deg, var(--ga) 0%, var(--gb) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          transition: --ga 0.8s ease, --gb 0.8s ease;
        }
        .grad-bg {
          background: linear-gradient(135deg, var(--ga) 0%, var(--gb) 100%) !important;
        }
        .grad-border {
          border: 1px solid rgba(var(--ga-rgb), 0.35) !important;
          transition: border-color 0.8s ease;
        }
        .grad-glow {
          box-shadow: 0 0 40px rgba(var(--ga-rgb),0.22), 0 0 80px rgba(var(--gb-rgb),0.12);
          transition: box-shadow 0.8s ease;
        }
        .grad-icon { filter: drop-shadow(0 0 8px rgba(var(--ga-rgb),0.6)); }

        /* Shine button */
        .shine-btn { position: relative; overflow: hidden; }
        .shine-btn::after {
          content: '';
          position: absolute;
          top: -50%; left: -60%;
          width: 40%; height: 200%;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.28), transparent);
          transform: skewX(-20deg);
          animation: shineLoop 3.5s ease-in-out infinite;
        }

        /* Scroll reveal */
        .fade-up { animation: fadeUp 0.7s ease forwards; }
        .reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .reveal.visible { opacity: 1; transform: translateY(0); }

        /* Floating particles */
        .particle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          background: radial-gradient(circle, rgba(var(--ga-rgb),0.5) 0%, transparent 70%);
          animation: particleFloat var(--dur, 12s) ease-in-out infinite var(--delay, 0s);
          transition: background 0.8s ease;
        }

        /* Keyframes */
        @keyframes shineLoop {
          0%   { left: -60%; opacity: 0; }
          10%  { opacity: 1; }
          40%  { left: 130%; opacity: 1; }
          41%  { opacity: 0; }
          100% { left: 130%; opacity: 0; }
        }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse     { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes marquee   { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes gridFade  { 0%,100%{opacity:0.3} 50%{opacity:0.6} }
        @keyframes orbFloat  { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-10px) scale(1.04)} }
        @keyframes orbRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes gradMove  { 0%{transform:translate(0,0) scale(1)} 33%{transform:translate(4%,-4%) scale(1.06)} 66%{transform:translate(-3%,3%) scale(0.97)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes gradMove2 { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(-5%,5%) scale(1.08)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes gradMove3 { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(5%,-3%) scale(1.06)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes glowPulse { 0%,100%{opacity:0.55} 50%{opacity:0.95} }
        @keyframes particleFloat {
          0%   { transform: translate(0, 0) scale(1);   opacity: 0; }
          10%  { opacity: 1; }
          50%  { transform: translate(var(--tx, 30px), var(--ty, -60px)) scale(1.2); opacity: 0.7; }
          90%  { opacity: 0.3; }
          100% { transform: translate(0, 0) scale(1);   opacity: 0; }
        }
        @keyframes dashCard  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes codeType  { from{width:0} to{width:100%} }
        @keyframes barGrow   { from{height:0} to{height:var(--h)} }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #080808; }
        ::-webkit-scrollbar-thumb { background: rgba(var(--ga-rgb),0.3); border-radius: 3px; }

        /* Desktop nav */
        .desk-nav { display: none; }
        @media (min-width: 768px) { .desk-nav { display: flex !important; } }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* ── Floating Particles ── */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        {[
          { w:6,  h:6,  top:"15%", left:"8%",  dur:"14s", delay:"0s",   tx:"40px",  ty:"-80px" },
          { w:4,  h:4,  top:"30%", left:"92%", dur:"18s", delay:"-6s",  tx:"-30px", ty:"-60px" },
          { w:8,  h:8,  top:"60%", left:"5%",  dur:"20s", delay:"-3s",  tx:"50px",  ty:"-100px" },
          { w:3,  h:3,  top:"75%", left:"80%", dur:"12s", delay:"-9s",  tx:"-20px", ty:"-40px" },
          { w:5,  h:5,  top:"45%", left:"50%", dur:"16s", delay:"-4s",  tx:"25px",  ty:"-70px" },
          { w:7,  h:7,  top:"20%", left:"70%", dur:"22s", delay:"-11s", tx:"-40px", ty:"-90px" },
          { w:4,  h:4,  top:"85%", left:"30%", dur:"15s", delay:"-7s",  tx:"35px",  ty:"-55px" },
          { w:6,  h:6,  top:"10%", left:"45%", dur:"19s", delay:"-2s",  tx:"-25px", ty:"-75px" },
          { w:3,  h:3,  top:"55%", left:"88%", dur:"13s", delay:"-5s",  tx:"-15px", ty:"-50px" },
          { w:5,  h:5,  top:"40%", left:"18%", dur:"17s", delay:"-8s",  tx:"30px",  ty:"-65px" },
        ].map((p, i) => (
          <Particle key={i} style={{ width:p.w, height:p.h, top:p.top, left:p.left, "--dur":p.dur, "--delay":p.delay, "--tx":p.tx, "--ty":p.ty } as CSSProperties} />
        ))}

        {/* Aurora glows */}
        <div style={{ position:"absolute", top:"5%",  left:"5%",   width:"55vw", height:"55vw", borderRadius:"50%", filter:"blur(100px)", background:"radial-gradient(circle, rgba(245,197,66,0.4) 0%, transparent 70%)", animation:"gradMove 22s ease-in-out infinite, glowPulse 9s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"-5%", right:"-10%", width:"65vw", height:"65vw", borderRadius:"50%", filter:"blur(100px)", background:"radial-gradient(circle, rgba(0,208,132,0.3) 0%, transparent 70%)", animation:"gradMove2 26s ease-in-out infinite, glowPulse 11s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"-10%", left:"15%", width:"60vw", height:"60vw", borderRadius:"50%", filter:"blur(100px)", background:"radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)", animation:"gradMove3 24s ease-in-out infinite, glowPulse 8s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"30%",  right:"5%",  width:"45vw", height:"45vw", borderRadius:"50%", filter:"blur(80px)", background:"radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)", animation:"gradMove 28s ease-in-out infinite reverse, glowPulse 10s ease-in-out infinite" }} />

        {/* Animated grid */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize:"56px 56px", animation:"gridFade 8s ease-in-out infinite" }} />

        {/* Mouse glow — desktop only */}
        {isDesktop && (
          <div style={{ position:"absolute", width:"500px", height:"500px", borderRadius:"50%", filter:"blur(100px)", background:"radial-gradient(circle, rgba(var(--ga-rgb),0.07) 0%, transparent 70%)", left: mousePos.x - 250, top: mousePos.y - 250, pointerEvents:"none", transition:"left 0.25s ease, top 0.25s ease" }} />
        )}
      </div>

      {/* ── NAVBAR ── */}
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:100,
        borderBottom: navScrolled ? `1px solid rgba(255,255,255,0.08)` : "1px solid transparent",
        background: navScrolled ? "rgba(5,5,5,0.95)" : "rgba(5,5,5,0.6)",
        backdropFilter:"blur(28px)",
        padding:"0 clamp(16px, 3vw, 40px)",
        height:"62px", display:"flex", alignItems:"center", justifyContent:"space-between",
        transition:"background 0.3s ease, border-color 0.3s ease",
      }}>
        {/* Logo + dropdown */}
        <div ref={dropdownRef} style={{ position:"relative", display:"flex", alignItems:"center" }}>
          <button onClick={e => { e.stopPropagation(); setShowDropdown(v => !v); }}
            style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer", padding:"0" }}>
            <img src="/logo.png" alt="Krypton AI" style={{ height:"44px", width:"auto", objectFit:"contain" }} />
            <span style={{ color:"#555", fontSize:"10px", transition:"transform 0.2s", transform: showDropdown ? "rotate(180deg)" : "none" }}>▾</span>
          </button>

          {showDropdown && (
            <div style={{ position:"absolute", top:"54px", left:0, background:"rgba(13,13,13,0.98)", border:`1px solid rgba(255,255,255,0.08)`, borderRadius:"18px", padding:"8px", minWidth:"230px", zIndex:200, boxShadow:"0 24px 64px rgba(0,0,0,0.9)", backdropFilter:"blur(20px)" }}>
              {[
                { icon:"🏠", label:"Home",       path:"/landing" },
                { icon:"✨", label:"Features",   onClick:() => scrollTo("features") },
                { icon:"🖼️", label:"Templates",  path:"/templates" },
                { icon:"💰", label:"Pricing",    onClick:() => scrollTo("pricing") },
                { icon:"❓", label:"FAQ",         onClick:() => scrollTo("faq") },
              ].map(item => (
                <button key={item.label} onClick={() => { if ((item as any).path) router.push((item as any).path); else if ((item as any).onClick) (item as any).onClick(); setShowDropdown(false); }}
                  style={{ width:"100%", textAlign:"left", padding:"10px 12px", background:"none", border:"none", color:T.muted, fontSize:"13px", cursor:"pointer", borderRadius:"10px", display:"flex", alignItems:"center", gap:"9px", transition:"all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background="#1a1a1a"; e.currentTarget.style.color=T.text; }}
                  onMouseLeave={e => { e.currentTarget.style.background="none"; e.currentTarget.style.color=T.muted; }}>
                  <span style={{ fontSize:"15px" }}>{item.icon}</span> {item.label}
                </button>
              ))}
              <div style={{ height:"1px", background:"rgba(255,255,255,0.06)", margin:"6px 0" }} />
              <button onClick={() => { router.push("/auth/login"); setShowDropdown(false); }}
                style={{ width:"100%", textAlign:"left", padding:"10px 12px", background:"none", border:"none", color:T.muted, fontSize:"13px", cursor:"pointer", borderRadius:"10px", display:"flex", alignItems:"center", gap:"9px" }}>
                🚀 Login
              </button>
              <button onClick={() => { router.push("/auth/signup"); setShowDropdown(false); }}
                style={{ width:"100%", textAlign:"left", padding:"10px 12px", background:"rgba(var(--ga-rgb),0.1)", border:"1px solid rgba(var(--ga-rgb),0.2)", borderRadius:"10px", color:"#F5C542", fontSize:"13px", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:"9px", marginTop:4, transition:"all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background="rgba(var(--ga-rgb),0.18)"; }}
                onMouseLeave={e => { e.currentTarget.style.background="rgba(var(--ga-rgb),0.1)"; }}>
                🟢 Get Started Free
              </button>
            </div>
          )}
        </div>

        {/* Center nav */}
        <div className="desk-nav" style={{ gap:"28px", position:"absolute", left:"50%", transform:"translateX(-50%)" }}>
          {NAV_LINKS.map(item => (
            <button key={item} onClick={() => scrollTo(item.toLowerCase())}
              style={{ background:"none", border:"none", color:T.muted, fontSize:"13px", cursor:"pointer", fontWeight:500, transition:"color 0.2s", padding:"4px 0", position:"relative" }}
              onMouseEnter={e => e.currentTarget.style.color=T.text}
              onMouseLeave={e => e.currentTarget.style.color=T.muted}>
              {item}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
          {!isMobile && (
            <button onClick={() => router.push("/auth/login")}
              style={{ padding:"7px 18px", background:"none", border:`1px solid rgba(255,255,255,0.1)`, borderRadius:"10px", color:T.muted, fontSize:"13px", cursor:"pointer", transition:"all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(var(--ga-rgb),0.5)"; e.currentTarget.style.color=T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.1)"; e.currentTarget.style.color=T.muted; }}>
              Login
            </button>
          )}
          <button className="grad-bg shine-btn" onClick={() => router.push("/auth/signup")}
            style={{ padding:"7px 18px", border:"none", borderRadius:"10px", color:"#050505", fontSize:"13px", fontWeight:700, cursor:"pointer", transition:"transform 0.15s, box-shadow 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(var(--ga-rgb),0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
            Get Started
          </button>
          {isMobile && (
            <button onClick={() => setMobileMenu(v => !v)}
              style={{ background:"rgba(255,255,255,0.05)", border:`1px solid rgba(255,255,255,0.08)`, borderRadius:"9px", color:T.text, fontSize:"16px", cursor:"pointer", padding:"6px 10px", transition:"all 0.2s" }}>
              {mobileMenu ? "✕" : "☰"}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenu && (
        <div style={{ position:"fixed", top:"62px", left:0, right:0, background:"rgba(8,8,8,0.98)", borderBottom:`1px solid rgba(255,255,255,0.08)`, padding:"16px 20px", zIndex:99, backdropFilter:"blur(20px)", display:"flex", flexDirection:"column", gap:"4px" }}>
          {NAV_LINKS.map(item => (
            <button key={item} onClick={() => scrollTo(item.toLowerCase())}
              style={{ background:"none", border:"none", color:T.sub, fontSize:"15px", cursor:"pointer", padding:"12px 0", textAlign:"left", fontWeight:500, borderBottom:`1px solid rgba(255,255,255,0.05)` }}>
              {item}
            </button>
          ))}
          <div style={{ display:"flex", gap:"8px", marginTop:"12px" }}>
            <button onClick={() => { router.push("/auth/login"); setMobileMenu(false); }}
              style={{ flex:1, background:"none", border:`1px solid rgba(255,255,255,0.1)`, borderRadius:"10px", color:T.text, fontSize:"14px", cursor:"pointer", padding:"11px" }}>
              Login
            </button>
            <button className="grad-bg shine-btn" onClick={() => { router.push("/auth/signup"); setMobileMenu(false); }}
              style={{ flex:1, border:"none", borderRadius:"10px", color:"#050505", fontSize:"14px", fontWeight:700, cursor:"pointer", padding:"11px" }}>
              Sign Up Free
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          HERO — Split layout on desktop
      ══════════════════════════════════════════ */}
      <section style={{
        position:"relative", zIndex:1,
        minHeight: isMobile ? "auto" : "85vh",
        maxHeight: isMobile ? "none" : "85vh",
        paddingTop: isMobile ? "90px" : "62px",
        paddingBottom: isMobile ? "60px" : "0",
        display:"flex", alignItems:"center",
        overflow: isMobile ? "visible" : "hidden",
      }}>
        <div style={{
          width:"92%", maxWidth:"1600px", margin:"0 auto",
          display:"grid",
          gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr" : "1fr 1fr",
          gap: isMobile ? "48px" : "48px",
          alignItems:"center",
          padding: isMobile ? "0" : isTablet ? "40px 0" : "0",
        }}>

          {/* ── LEFT: Headline + CTAs ── */}
          <div style={{ display:"flex", flexDirection:"column", alignItems: isMobile || isTablet ? "center" : "flex-start", textAlign: isMobile || isTablet ? "center" : "left" }}>

            {/* Badge */}
            <div className="fade-up" style={{ display:"inline-flex", alignItems:"center", gap:"8px", background:"rgba(var(--ga-rgb),0.07)", border:"1px solid rgba(var(--ga-rgb),0.2)", borderRadius:"24px", padding:"5px 16px", marginBottom:"1.5rem", fontSize:"12px", fontWeight:600 }}>
              <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#00D084", display:"inline-block", animation:"pulse 2s infinite" }} />
              <span className="grad-text">✨ Build Websites, Apps & Games with AI</span>
            </div>

            {/* H1 */}
            <h1 className="fade-up" style={{
              fontFamily:"'Syne',sans-serif",
              fontSize: isMobile ? "clamp(30px,8vw,42px)" : isTablet ? "clamp(40px,6vw,56px)" : "clamp(44px,4.5vw,72px)",
              fontWeight:800, lineHeight:1.05, marginBottom:"1.2rem",
              maxWidth: isDesktop ? "520px" : "800px",
              animationDelay:"0.1s",
            }}>
              Build{" "}
              <span className="grad-text">Websites, Apps</span>
              {" "}&{" "}
              <span className="grad-text">Games</span>
              {" "}with AI.
            </h1>

            <p className="fade-up" style={{
              color:T.sub, fontSize: isMobile ? "15px" : "17px", lineHeight:1.75,
              maxWidth: isDesktop ? "440px" : "600px",
              marginBottom:"2rem", animationDelay:"0.2s",
            }}>
              Describe what you want. Krypton AI builds it — complete, responsive, and ready to deploy in seconds.
            </p>

            {/* CTA buttons */}
            <div className="fade-up" style={{ display:"flex", gap:"12px", flexWrap:"wrap", justifyContent: isMobile || isTablet ? "center" : "flex-start", marginBottom:"2rem", animationDelay:"0.3s" }}>
              <button className="grad-bg shine-btn" onClick={() => router.push("/auth/signup")}
                style={{ padding: isMobile ? "13px 28px" : "14px 34px", border:"none", borderRadius:"14px", color:"#050505", fontSize: isMobile ? "14px" : "16px", fontWeight:700, cursor:"pointer", transition:"transform 0.2s, box-shadow 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 12px 32px rgba(var(--ga-rgb),0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
                Start Building Free →
              </button>
              <button onClick={() => scrollTo("examples")}
                style={{ padding: isMobile ? "13px 28px" : "14px 34px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"14px", color:T.text, fontSize: isMobile ? "14px" : "16px", fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.2)"; e.currentTarget.style.transform="translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.1)"; e.currentTarget.style.transform="none"; }}>
                See Examples
              </button>
            </div>

            {/* Social proof */}
            <div className="fade-up" style={{ display:"flex", alignItems:"center", gap:"12px", animationDelay:"0.4s" }}>
              <div style={{ display:"flex" }}>
                {["👤","👤","👤","👤"].map((_, i) => (
                  <div key={i} style={{ width:"28px", height:"28px", borderRadius:"50%", background:`linear-gradient(135deg, rgba(var(--ga-rgb),0.4), rgba(var(--gb-rgb),0.4))`, border:"2px solid #050505", marginLeft: i===0?0:"-8px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px" }}>
                    {["A","S","R","J"][i]}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display:"flex", gap:"2px", marginBottom:"2px" }}>{"⭐⭐⭐⭐⭐".split("").map((s,i)=><span key={i} style={{fontSize:"11px"}}>{s}</span>)}</div>
                <p style={{ color:T.muted, fontSize:"12px" }}>Trusted by 12,000+ builders</p>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Interactive AI Dashboard Preview ── */}
          {isDesktop && (
            <div className="fade-up" style={{ position:"relative", height:"480px", animationDelay:"0.2s" }}>

              {/* Main dashboard card */}
              <div style={{ position:"absolute", inset:0, background:"rgba(13,13,13,0.85)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"24px", overflow:"hidden", backdropFilter:"blur(20px)", boxShadow:"0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--ga-rgb),0.05)" }}>

                {/* Titlebar */}
                <div style={{ padding:"14px 18px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:"10px", background:"rgba(255,255,255,0.02)" }}>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:"#EF4444" }} />
                    <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:"#F59E0B" }} />
                    <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:"#10B981" }} />
                  </div>
                  <div style={{ flex:1, textAlign:"center", fontSize:"11px", color:T.muted }}>kryptonai.tech — Live Editor</div>
                  <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#00D084", animation:"pulse 2s infinite" }} />
                </div>

                {/* Editor body */}
                <div style={{ padding:"18px", height:"calc(100% - 48px)", display:"flex", flexDirection:"column", gap:"14px" }}>

                  {/* Prompt input */}
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(var(--ga-rgb),0.2)", borderRadius:"12px", padding:"12px 16px" }}>
                    <p style={{ color:"#444", fontSize:"11px", margin:"0 0 5px" }}>Describe your project:</p>
                    <p style={{ color:"rgba(255,255,255,0.75)", fontSize:"13px", fontFamily:"monospace", margin:0, minHeight:"18px" }}>
                      {displayed}
                      <span style={{ display:"inline-block", width:"2px", height:"13px", background:"var(--ga)", marginLeft:"2px", verticalAlign:"middle", animation:"blink 1s infinite" }} />
                    </p>
                  </div>

                  {/* Code preview */}
                  <div style={{ background:"rgba(0,0,0,0.6)", borderRadius:"12px", padding:"14px 16px", flex:1, overflow:"hidden", position:"relative" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                      <span style={{ fontSize:"10px", color:"var(--ga)", fontWeight:700, fontFamily:"monospace" }}>● GENERATING</span>
                      <span style={{ fontSize:"10px", color:T.muted, fontFamily:"monospace" }}>{liveCode} lines written</span>
                    </div>
                    {[
                      { color:"#569CD6", text:"<!DOCTYPE html>" },
                      { color:"#569CD6", text:"<html lang=\"en\">" },
                      { color:"#6A9955", text:"  {/* AI-generated component */}" },
                      { color:"#CE9178", text:"  <div class=\"dashboard\">" },
                      { color:"#DCDCAA", text:"    <header class=\"nav\">" },
                      { color:"#4EC9B0", text:"      <KryptonAI />" },
                      { color:"#DCDCAA", text:"    </header>" },
                      { color:"#CE9178", text:"  </div>" },
                    ].map((line, i) => (
                      <p key={i} style={{ fontFamily:"monospace", fontSize:"11px", color:line.color, margin:"0 0 3px", opacity: i < 6 ? 1 : 0.3, whiteSpace:"nowrap", overflow:"hidden" }}>
                        {line.text}
                      </p>
                    ))}
                  </div>

                  {/* Bottom stats row */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px" }}>
                    {[
                      { label:"Build Time", value:"4.2s",  color:"var(--ga)" },
                      { label:"Lines",      value:"847",   color:"var(--gb)" },
                      { label:"Quality",    value:"98%",   color:"#3B82F6" },
                    ].map((stat, i) => (
                      <div key={i} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"10px", padding:"10px 12px", textAlign:"center" }}>
                        <p style={{ color:stat.color, fontSize:"16px", fontWeight:700, fontFamily:"'Syne',sans-serif", margin:"0 0 2px" }}>{stat.value}</p>
                        <p style={{ color:T.muted, fontSize:"10px", margin:0 }}>{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating analytics card — top right */}
              <div style={{ position:"absolute", top:"-18px", right:"-18px", background:"rgba(13,13,13,0.95)", border:"1px solid rgba(var(--ga-rgb),0.25)", borderRadius:"16px", padding:"14px 18px", boxShadow:"0 16px 40px rgba(0,0,0,0.5)", backdropFilter:"blur(16px)", animation:"dashCard 5s ease-in-out infinite", minWidth:"150px" }}>
                <p style={{ color:T.muted, fontSize:"10px", margin:"0 0 4px", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>Projects Today</p>
                <p className="grad-text" style={{ fontSize:"28px", fontWeight:800, fontFamily:"'Syne',sans-serif", margin:"0 0 4px" }}>1,247</p>
                <p style={{ color:"#00D084", fontSize:"11px", margin:0 }}>▲ 18% from yesterday</p>
              </div>

              {/* Floating tech badge — bottom left */}
              <div style={{ position:"absolute", bottom:"-16px", left:"-16px", background:"rgba(13,13,13,0.95)", border:"1px solid rgba(var(--gb-rgb),0.25)", borderRadius:"16px", padding:"12px 16px", boxShadow:"0 16px 40px rgba(0,0,0,0.5)", backdropFilter:"blur(16px)", animation:"dashCard 7s ease-in-out infinite 1s", display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:"rgba(var(--gb-rgb),0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px" }}>⚡</div>
                <div>
                  <p style={{ fontSize:"12px", fontWeight:700, margin:"0 0 1px" }}>Instant Deploy</p>
                  <p style={{ color:T.muted, fontSize:"10px", margin:0 }}>Zero config, live in 8s</p>
                </div>
              </div>

              {/* AI badge — top left */}
              <div style={{ position:"absolute", top:"80px", left:"-20px", background:"rgba(13,13,13,0.95)", border:"1px solid rgba(139,92,246,0.3)", borderRadius:"14px", padding:"10px 14px", boxShadow:"0 12px 32px rgba(0,0,0,0.5)", backdropFilter:"blur(16px)", animation:"dashCard 6s ease-in-out infinite 2s" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <span style={{ fontSize:"14px" }}>🤖</span>
                  <div>
                    <p style={{ fontSize:"11px", fontWeight:700, margin:0, color:"#C4B5FD" }}>Claude Sonnet</p>
                    <p style={{ color:T.muted, fontSize:"9px", margin:0 }}>Powering generations</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tablet: centered AI orb instead of dashboard */}
          {isTablet && (
            <div style={{ display:"flex", justifyContent:"center" }}>
              <div style={{ position:"relative", width:140, height:140 }}>
                <div style={{ position:"absolute", inset:-12, borderRadius:"50%", border:"1px solid transparent", background:"linear-gradient(#050505,#050505) padding-box, linear-gradient(135deg,var(--ga),var(--gb)) border-box", animation:"orbRotate 8s linear infinite", opacity:0.6 }} />
                <div className="grad-glow" style={{ position:"absolute", inset:0, borderRadius:"50%", filter:"blur(20px)", background:"linear-gradient(135deg,rgba(var(--ga-rgb),0.3),rgba(var(--gb-rgb),0.3))" }} />
                <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"radial-gradient(circle at 40% 35%, rgba(var(--ga-rgb),0.15) 0%, #0d0d0d 60%)", border:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center", animation:"orbFloat 6s ease-in-out infinite" }}>
                  <img src="/logo.png" alt="Krypton AI" style={{ width:70, height:70, objectFit:"contain" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── INFINITE MARQUEE ── */}
      <div style={{ overflow:"hidden", borderTop:`1px solid rgba(255,255,255,0.06)`, borderBottom:`1px solid rgba(255,255,255,0.06)`, padding:"14px 0", background:"rgba(8,8,8,0.8)", position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", animation:"marquee 22s linear infinite", width:"max-content" }}>
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} style={{ padding:"0 36px", fontSize:"13px", color:T.muted, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:"8px" }}>
              <span className="grad-text" style={{ fontWeight:600 }}>{item}</span>
              <span style={{ color:"rgba(255,255,255,0.08)" }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <section style={{ position:"relative", zIndex:1, padding: isMobile ? "60px 20px" : "80px clamp(20px,4vw,60px)" }}>
        <div style={{ width:"92%", maxWidth:"1100px", margin:"0 auto", display:"grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap:"1px", background:"rgba(255,255,255,0.05)", borderRadius:"22px", overflow:"hidden", border:`1px solid rgba(255,255,255,0.06)` }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ background:T.card }}>
              <CounterCard value={s.value} label={s.label} suffix={s.suffix} />
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ scrollMarginTop:"80px", position:"relative", zIndex:1, padding: isMobile ? "60px 20px" : "80px clamp(20px,4vw,60px)" }}>
        <div style={{ width:"92%", maxWidth:"1400px", margin:"0 auto" }}>
          <p style={{ textAlign:"center", fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"12px" }}><span className="grad-text">What You Can Build</span></p>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,4vw,48px)", fontWeight:800, textAlign:"center", marginBottom:"3rem" }}>
            One AI. <span className="grad-text">Infinite Possibilities.</span>
          </h2>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2,1fr)" : "repeat(4,1fr)", gap:"16px" }}>
            {FEATURES.map((f, i) => (
              <div key={i}
                style={{ background:"rgba(13,13,13,0.8)", border:`1px solid rgba(255,255,255,0.07)`, borderRadius:"20px", padding:"28px 24px", transition:"all 0.3s", position:"relative", overflow:"hidden", backdropFilter:"blur(10px)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(var(--ga-rgb),0.35)"; e.currentTarget.style.transform="translateY(-5px)"; e.currentTarget.style.boxShadow="0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(var(--ga-rgb),0.1)"; e.currentTarget.style.background="rgba(18,18,18,0.9)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; e.currentTarget.style.background="rgba(13,13,13,0.8)"; }}>
                <div style={{ width:"48px", height:"48px", borderRadius:"14px", background:"rgba(var(--ga-rgb),0.1)", border:"1px solid rgba(var(--ga-rgb),0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", marginBottom:"16px", transition:"background 0.8s ease" }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:"17px", fontWeight:700, marginBottom:"8px" }}><span className="grad-text">{f.title}</span></h3>
                <p style={{ color:T.sub, fontSize:"14px", lineHeight:1.7, margin:0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXAMPLES ── */}
      <section id="examples" style={{ scrollMarginTop:"80px", position:"relative", zIndex:1, padding: isMobile ? "60px 20px" : "80px clamp(20px,4vw,60px)", background:"rgba(8,8,8,0.7)", borderTop:`1px solid rgba(255,255,255,0.05)` }}>
        <div style={{ width:"92%", maxWidth:"1400px", margin:"0 auto" }}>
          <p style={{ textAlign:"center", fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"12px" }}><span className="grad-text">Examples</span></p>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,4vw,48px)", fontWeight:800, textAlign:"center", marginBottom:"3rem" }}>
            See What&apos;s <span className="grad-text">Possible</span>
          </h2>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2,1fr)" : "repeat(3,1fr)", gap:"16px" }}>
            {[
              { title:"SaaS Dashboard", tag:"Web App", emoji:"📊", accent:"245,197,66" },
              { title:"Portfolio Site",  tag:"Website", emoji:"💼", accent:"0,208,132" },
              { title:"Snake Game",      tag:"Game",    emoji:"🎮", accent:"139,92,246" },
              { title:"Invoice Tool",    tag:"Tool",    emoji:"📋", accent:"59,130,246" },
              { title:"Fitness App",     tag:"Web App", emoji:"💪", accent:"244,63,94" },
              { title:"E-Commerce",      tag:"Website", emoji:"🛒", accent:"16,185,129" },
            ].map((ex, i) => (
              <div key={i}
                style={{ background:`rgba(${ex.accent},0.06)`, border:`1px solid rgba(${ex.accent},0.15)`, borderRadius:"18px", overflow:"hidden", transition:"all 0.3s", cursor:"pointer" }}
                onMouseEnter={e => { e.currentTarget.style.transform="translateY(-5px)"; e.currentTarget.style.boxShadow=`0 20px 48px rgba(${ex.accent},0.12)`; e.currentTarget.style.borderColor=`rgba(${ex.accent},0.35)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; e.currentTarget.style.borderColor=`rgba(${ex.accent},0.15)`; }}>
                <div style={{ height:"140px", background:`linear-gradient(135deg, rgba(${ex.accent},0.12), rgba(${ex.accent},0.03))`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"44px" }}>
                  {ex.emoji}
                </div>
                <div style={{ padding:"18px" }}>
                  <span style={{ fontSize:"10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:`rgba(${ex.accent},1)` }}>{ex.tag}</span>
                  <p style={{ fontSize:"15px", fontWeight:600, margin:"5px 0 0", color:T.text }}>{ex.title}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center", marginTop:"2.5rem" }}>
            <button className="grad-bg shine-btn" onClick={() => router.push("/auth/signup")}
              style={{ padding:"12px 36px", border:"none", borderRadius:"12px", color:"#050505", fontSize:"14px", fontWeight:700, cursor:"pointer", transition:"transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 12px 32px rgba(var(--ga-rgb),0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
              Build Your Own →
            </button>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ position:"relative", zIndex:1, padding: isMobile ? "60px 20px" : "80px clamp(20px,4vw,60px)" }}>
        <div style={{ width:"92%", maxWidth:"1400px", margin:"0 auto" }}>
          <p style={{ textAlign:"center", fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"12px" }}><span className="grad-text">Testimonials</span></p>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,4vw,48px)", fontWeight:800, textAlign:"center", marginBottom:"3rem" }}>
            Loved by <span className="grad-text">Builders</span>
          </h2>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap:"16px" }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i}
                style={{ background:"rgba(255,255,255,0.02)", border:`1px solid rgba(255,255,255,0.07)`, borderRadius:"20px", padding:"28px", backdropFilter:"blur(12px)", transition:"all 0.3s", position:"relative", overflow:"hidden" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(var(--ga-rgb),0.3)"; e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow="0 20px 48px rgba(0,0,0,0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
                {/* Subtle glow */}
                <div style={{ position:"absolute", top:0, right:0, width:"80px", height:"80px", borderRadius:"50%", background:"radial-gradient(circle, rgba(var(--ga-rgb),0.08) 0%, transparent 70%)", pointerEvents:"none" }} />
                <div style={{ marginBottom:"14px", fontSize:"14px" }}>{"⭐".repeat(t.stars)}</div>
                <p style={{ color:T.sub, fontSize:"14px", lineHeight:1.75, marginBottom:"20px", fontStyle:"italic" }}>&ldquo;{t.text}&rdquo;</p>
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:"linear-gradient(135deg, rgba(var(--ga-rgb),0.3), rgba(var(--gb-rgb),0.3))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", fontWeight:700, flexShrink:0 }}>
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
      <section id="pricing" style={{ scrollMarginTop:"80px", position:"relative", zIndex:1, padding: isMobile ? "60px 20px" : "80px clamp(20px,4vw,60px)", background:"rgba(8,8,8,0.8)", borderTop:`1px solid rgba(255,255,255,0.05)` }}>
        <div style={{ width:"92%", maxWidth:"1400px", margin:"0 auto" }}>
          <p style={{ textAlign:"center", fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"12px" }}><span className="grad-text">Pricing</span></p>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,4vw,48px)", fontWeight:800, textAlign:"center", marginBottom:"1rem" }}>
            Simple, <span className="grad-text">Transparent Pricing</span>
          </h2>
          <p style={{ color:T.sub, textAlign:"center", marginBottom:"2rem", fontSize:"15px" }}>Start free. Upgrade when you need more.</p>

          {/* Billing toggle */}
          <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:"10px", marginBottom:"2.5rem" }}>
            {["monthly","yearly"].map(b => (
              <button key={b} onClick={() => setBilling(b as any)}
                style={{ padding:"8px 22px", borderRadius:"12px", border:"1px solid", borderColor: billing===b ? "rgba(var(--ga-rgb),0.4)" : "rgba(255,255,255,0.08)", background: billing===b ? "rgba(var(--ga-rgb),0.1)" : "transparent", color: billing===b ? "var(--ga)" : T.muted, fontWeight:600, fontSize:"13px", cursor:"pointer", transition:"all 0.2s", textTransform:"capitalize" }}>
                {b} {b==="yearly" && <span style={{ fontSize:"10px", marginLeft:"4px", color:"#00D084" }}>Save 20%</span>}
              </button>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2,1fr)" : "repeat(4,1fr)", gap:"16px" }}>
            {PLANS.map(plan => (
              <div key={plan.name}
                style={{ background: plan.highlight ? "rgba(var(--ga-rgb),0.04)" : "rgba(13,13,13,0.8)", border: plan.highlight ? "1px solid rgba(var(--ga-rgb),0.35)" : `1px solid rgba(255,255,255,0.07)`, borderRadius:"20px", padding:"26px", position:"relative", boxShadow: plan.highlight ? "0 0 60px rgba(var(--ga-rgb),0.08)" : "none", transition:"all 0.3s", backdropFilter:"blur(10px)" }}
                onMouseEnter={e => { e.currentTarget.style.transform="translateY(-5px)"; e.currentTarget.style.boxShadow= plan.highlight ? "0 20px 60px rgba(var(--ga-rgb),0.15)" : "0 20px 40px rgba(0,0,0,0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow= plan.highlight ? "0 0 60px rgba(var(--ga-rgb),0.08)" : "none"; }}>

                {plan.highlight && (
                  <div className="grad-bg" style={{ position:"absolute", top:"-13px", left:"50%", transform:"translateX(-50%)", color:"#050505", fontSize:"11px", fontWeight:700, padding:"4px 16px", borderRadius:"20px", whiteSpace:"nowrap" }}>
                    ✨ Most Popular
                  </div>
                )}

                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" }}>
                  <span style={{ fontSize:"18px" }}>{plan.emoji}</span>
                  <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:"18px", fontWeight:700 }}><span className="grad-text">{plan.name}</span></h3>
                </div>
                <p style={{ color:"#00D084", fontSize:"11px", marginBottom:"12px", fontWeight:600 }}>{plan.credits}</p>
                <div style={{ marginBottom:"18px" }}>
                  <span style={{ fontSize:"36px", fontWeight:800 }}><span className="grad-text">{billing==="monthly" ? plan.monthlyPrice : plan.yearlyPrice}</span></span>
                  <span style={{ color:T.muted, fontSize:"13px" }}>/mo</span>
                </div>
                {plan.included.map(f => (
                  <div key={f} style={{ display:"flex", alignItems:"flex-start", gap:"8px", marginBottom:"8px" }}>
                    <span className="grad-text" style={{ fontSize:"12px", flexShrink:0, fontWeight:700 }}>✓</span>
                    <span style={{ fontSize:"13px", color:T.sub }}>{f}</span>
                  </div>
                ))}
                {plan.locked.map(f => (
                  <div key={f} style={{ display:"flex", alignItems:"flex-start", gap:"8px", marginBottom:"8px" }}>
                    <span style={{ fontSize:"12px", flexShrink:0, color:"#2a2a2a" }}>✕</span>
                    <span style={{ fontSize:"13px", color:"#333" }}>{f}</span>
                  </div>
                ))}
                <button
                  className={plan.highlight ? "grad-bg shine-btn" : ""}
                  onClick={() => router.push("/auth/signup")}
                  style={{ width:"100%", marginTop:"18px", padding:"12px", background: plan.highlight ? undefined : "rgba(255,255,255,0.04)", border: plan.highlight ? "none" : `1px solid rgba(255,255,255,0.08)`, borderRadius:"12px", color: plan.highlight ? "#050505" : T.text, fontWeight:700, fontSize:"13px", cursor:"pointer", transition:"all 0.2s" }}
                  onMouseEnter={e => { if (!plan.highlight) { e.currentTarget.style.background="rgba(255,255,255,0.08)"; e.currentTarget.style.transform="translateY(-1px)"; } }}
                  onMouseLeave={e => { if (!plan.highlight) { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.transform="none"; } }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ scrollMarginTop:"80px", position:"relative", zIndex:1, padding: isMobile ? "60px 20px" : "80px clamp(20px,4vw,60px)", borderTop:`1px solid rgba(255,255,255,0.05)` }}>
        <div style={{ width:"92%", maxWidth:"720px", margin:"0 auto" }}>
          <p style={{ textAlign:"center", fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"12px" }}><span className="grad-text">FAQ</span></p>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,4vw,48px)", fontWeight:800, textAlign:"center", marginBottom:"2.5rem" }}>
            <span className="grad-text">Frequently Asked</span>
          </h2>
          {FAQS.map((item, i) => (
            <div key={i} style={{ borderBottom:`1px solid rgba(255,255,255,0.06)`, overflow:"hidden" }}>
              <button onClick={() => setOpenFaq(openFaq===i ? null : i)}
                style={{ width:"100%", textAlign:"left", background:"none", border:"none", cursor:"pointer", padding:"20px 0", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px", transition:"all 0.2s" }}>
                <span style={{ fontWeight:700, fontSize:"15px" }}><span className="grad-text">{item.q}</span></span>
                <span style={{ color:T.muted, transition:"transform 0.3s", transform: openFaq===i ? "rotate(45deg)" : "none", display:"inline-block", fontSize:"20px", flexShrink:0, lineHeight:1 }}>+</span>
              </button>
              {openFaq===i && (
                <p style={{ color:T.sub, fontSize:"14px", lineHeight:1.75, paddingBottom:"20px", margin:0 }}>{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: isMobile ? "60px 20px" : "100px clamp(20px,4vw,60px)", textAlign:"center", borderTop:`1px solid rgba(255,255,255,0.05)`, position:"relative", zIndex:1, overflow:"hidden" }}>
        {/* Background orb */}
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"600px", height:"600px", borderRadius:"50%", background:"radial-gradient(circle, rgba(var(--ga-rgb),0.06) 0%, transparent 70%)", pointerEvents:"none" }} />
        <div style={{ width:"92%", maxWidth:"800px", margin:"0 auto", position:"relative" }}>
          <div className="grad-glow" style={{ width:"100px", height:"100px", borderRadius:"50%", background:"linear-gradient(135deg,rgba(var(--ga-rgb),0.2),rgba(var(--gb-rgb),0.2))", margin:"0 auto 2rem", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"40px", border:"1px solid rgba(var(--ga-rgb),0.2)" }}>
            ⚡
          </div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize: isMobile ? "clamp(26px,7vw,38px)" : "clamp(36px,4vw,58px)", fontWeight:800, marginBottom:"1.5rem", lineHeight:1.1 }}>
            The future of building is{" "}
            <span className="grad-text">a sentence away.</span>
          </h2>
          <p style={{ color:T.sub, fontSize:"17px", marginBottom:"2.5rem", lineHeight:1.75, maxWidth:"520px", margin:"0 auto 2.5rem" }}>
            Join thousands of builders creating the web with Krypton AI.
          </p>
          <div style={{ display:"flex", gap:"12px", justifyContent:"center", flexWrap:"wrap" }}>
            <button className="grad-bg shine-btn" onClick={() => router.push("/auth/signup")}
              style={{ padding:"16px 44px", border:"none", borderRadius:"14px", color:"#050505", fontSize:"16px", fontWeight:700, cursor:"pointer", transition:"transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 16px 48px rgba(var(--ga-rgb),0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
              Start Free — No credit card required →
            </button>
          </div>
          <p style={{ color:T.muted, fontSize:"12px", marginTop:"1.2rem" }}>5 free generations every day. No card needed.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop:`1px solid rgba(255,255,255,0.06)`, padding: isMobile ? "40px 20px 24px" : "64px clamp(20px,4vw,60px) 32px", background:"rgba(6,6,6,0.98)", position:"relative", zIndex:1 }}>
        <div style={{ width:"92%", maxWidth:"1400px", margin:"0 auto" }}>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap: isMobile ? "28px" : "32px", marginBottom:"48px" }}>
            {[
              { title:"Product",   links:[{label:"Features",href:"/landing#features"},{label:"Pricing",href:"/landing#pricing"},{label:"Roadmap",href:"/landing#roadmap"},{label:"Examples",href:"/landing#examples"}] },
              { title:"Resources", links:[{label:"Documentation",href:"/docs"},{label:"Changelog",href:"/changelog"},{label:"Blog",href:"/blog"},{label:"Support",href:"/support"}] },
              { title:"Company",   links:[{label:"About",href:"/about"},{label:"Contact",href:"/contact"}] },
              { title:"Legal",     links:[{label:"Privacy Policy",href:"/privacy"},{label:"Terms of Service",href:"/terms"},{label:"Refund Policy",href:"/refund"}] },
              { title:"Social",    links:[{label:"X (Twitter)",href:"https://twitter.com/kryptonai"},{label:"LinkedIn",href:"https://linkedin.com/company/kryptonai"},{label:"GitHub",href:"https://github.com/jangeersinghktm-design/Magic-Krypton-ai-"}] },
            ].map(col => (
              <div key={col.title}>
                <p style={{ fontWeight:700, fontSize:"13px", marginBottom:"14px" }}><span className="grad-text">{col.title}</span></p>
                {col.links.map(link => (
                  <a key={link.label} href={link.href}
                    style={{ display:"block", color:T.muted, fontSize:"13px", marginBottom:"10px", textDecoration:"none", transition:"color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.color=T.text}
                    onMouseLeave={e => e.currentTarget.style.color=T.muted}>
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop:`1px solid rgba(255,255,255,0.06)`, paddingTop:"24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
            <img src="/logo.png" alt="Krypton AI" style={{ height:"42px", width:"auto", objectFit:"contain" }} />
            <p style={{ color:T.muted, fontSize:"12px", margin:0 }}>© 2026 Krypton AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
