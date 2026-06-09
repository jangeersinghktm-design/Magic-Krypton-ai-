"use client";

import { useState, useEffect, useCallback, useRef, CSSProperties } from "react";
import { useRouter } from "next/navigation";

/* ─────────────────────────────────────────────
   GRADIENT THEMES  — cycle every 3 s, 800 ms ease
───────────────────────────────────────────── */
const THEMES = [
  { a: "#F5C542", b: "#00D084" },  // Gold  + Green
  { a: "#8B5CF6", b: "#EC4899" },  // Purple+ Pink
  { a: "#FACC15", b: "#FB923C" },  // Yellow+ Orange
  { a: "#3B82F6", b: "#06B6D4" },  // Blue  + Cyan
  { a: "#7C3AED", b: "#2563EB" },  // Violet+ Indigo
  { a: "#10B981", b: "#14B8A6" },  // Emerald+Teal
];

/* ─────────────────────────────────────────────
   STATIC DATA
───────────────────────────────────────────── */
const T = { bg:"#050505", card:"#0D0D0D", text:"#FFFFFF", sub:"#B0B0B0", muted:"#6B7280" };

const PROMPTS = [
  "Build a SaaS dashboard with dark mode...",
  "Create a portfolio website with animations...",
  "Build an invoice generator with PDF export...",
  "Create a CRM system with kanban board...",
  "Build a browser game like Snake...",
  "Create a fitness tracking app...",
];

const NAV_LINKS = ["Features","Pricing","Examples","Roadmap"];

const FEATURES = [
  { icon:"🌐", title:"Websites",      desc:"Landing pages, portfolios, business sites — pixel-perfect and responsive." },
  { icon:"⚙️", title:"Web Apps",      desc:"Dashboards, CRM tools, productivity apps with full interactivity." },
  { icon:"🎮", title:"Browser Games", desc:"Snake, 2048, puzzle games — fully playable in the browser." },
  { icon:"🧰", title:"Business Tools",desc:"Calculators, forms, trackers — tools that actually work." },
];

const STATS = [
  { value:12000, label:"Projects Generated", suffix:"+" },
  { value:98,    label:"Satisfaction Rate",  suffix:"%" },
  { value:8,     label:"Seconds to Build",   suffix:"s" },
  { value:22,    label:"Premium Templates",  suffix:"+" },
];

const MARQUEE_ITEMS = [
  "🌐 Websites","⚙️ Web Apps","🎮 Browser Games","📊 Dashboards",
  "🛒 E-Commerce","📝 Forms & Tools","💼 Portfolios","📈 Analytics",
  "🤖 AI Features","📱 Mobile-First","🔒 Secure Output","⚡ Instant Build",
];

const PLANS = [
  { name:"Free",     emoji:"🟢", monthly:"$0",   yearly:"$0",   credits:"5 / Day",     hot:false, cta:"Get Started Free",
    inc:["Website Generator","App Generator","Game Generator","Live Preview","Download HTML","Community Support"],
    off:["Save Projects","Project History","Advanced AI","Team Workspace","API Access"] },
  { name:"Pro",      emoji:"🔥", monthly:"$25",  yearly:"$20",  credits:"100 / Month",  hot:true,  cta:"Start Pro",
    inc:["Everything in Free","Save Projects","Project History","Faster Generation","Better AI Quality","Export Source Code","Premium Templates","Email Support"],
    off:["Team Workspace","API Access"] },
  { name:"Premium",  emoji:"💎", monthly:"$69",  yearly:"$55",  credits:"300 / Month",  hot:false, cta:"Start Premium",
    inc:["Everything in Pro","Fastest AI Model","Unlimited Saves","Version History","Team (5 Users)","Priority Support"],
    off:["API Access"] },
  { name:"Business", emoji:"🏢", monthly:"$149", yearly:"$119", credits:"100 / Day",    hot:false, cta:"Contact Us",
    inc:["Everything in Premium","API Access","Unlimited Team","Admin Dashboard","White Label","Business SLA"],
    off:[] },
];

const TESTIMONIALS = [
  { stars:5, text:"Generated my startup landing page in 2 minutes. Absolutely incredible.", name:"Alex", role:"Founder" },
  { stars:5, text:"Much faster than hiring freelancers. The quality is production-ready.",   name:"Sarah",role:"Designer" },
  { stars:5, text:"Built a full CRM tool with Krypton AI in one afternoon. Game changer.",  name:"Raj",  role:"Product Manager" },
];

const FAQS = [
  { q:"What can Krypton AI build?",   a:"Websites, web apps, browser games, dashboards, calculators, portfolios — all as production-ready HTML files." },
  { q:"How does Krypton AI work?",    a:"Describe what you want in plain English. Krypton AI transforms your idea into a complete, responsive, production-ready project within seconds." },
  { q:"Can I download the code?",     a:"Yes. Every project can be downloaded as a complete HTML file, ready to deploy anywhere." },
  { q:"Do I need coding skills?",     a:"No. Just describe what you want in plain English and Krypton AI generates it instantly." },
  { q:"Is Krypton AI reliable?",      a:"Yes. Built for speed, accuracy, and reliability — helping users generate high-quality projects with minimal effort." },
];

const CODE_LINES = [
  { c:"#569CD6", t:'<!DOCTYPE html>' },
  { c:"#569CD6", t:'<html lang="en">' },
  { c:"#6A9955", t:"  {/* AI-generated */}" },
  { c:"#CE9178", t:'  <div class="app">' },
  { c:"#DCDCAA", t:'    <header class="nav">' },
  { c:"#4EC9B0", t:"      <KryptonAI />" },
  { c:"#DCDCAA", t:"    </header>" },
  { c:"#CE9178", t:"  </div>" },
];

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function lerp(a:number, b:number, t:number){ return a+(b-a)*t; }
function hexToRgb(hex:string){ return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)); }
function rgbToHex(r:number,g:number,b:number){
  return "#"+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join("");
}

/* ─────────────────────────────────────────────
   ANIMATED COUNTER
───────────────────────────────────────────── */
function Counter({ value, suffix }:{ value:number; suffix:string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el = ref.current; if(!el) return;
    const obs = new IntersectionObserver(([e])=>{
      if(!e.isIntersecting) return; obs.disconnect();
      const t0 = performance.now();
      const step = (now:number)=>{
        const t = Math.min((now-t0)/2000,1);
        setCount(Math.round((1-Math.pow(1-t,3))*value));
        if(t<1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },{ threshold:0.3 });
    obs.observe(el);
    return ()=>obs.disconnect();
  },[value]);
  return (
    <div ref={ref} style={{ textAlign:"center", padding:"32px 16px" }}>
      <div className="gt" style={{ fontSize:"clamp(36px,4vw,54px)", fontWeight:800, fontFamily:"'Syne',sans-serif", lineHeight:1 }}>
        {count}{suffix}
      </div>
      <div style={{ color:T.muted, fontSize:"13px", marginTop:"8px" }}>{STATS.find(s=>s.value===value)?.label}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PARTICLE
───────────────────────────────────────────── */
function Particle({ s }:{ s:CSSProperties }){ return <div className="ptcl" style={s} />; }

/* ─────────────────────────────────────────────
   LANDING PAGE
───────────────────────────────────────────── */
export default function LandingPage() {
  const router = useRouter();

  /* state */
  const [promptIdx, setPromptIdx] = useState(0);
  const [typed,     setTyped]     = useState("");
  const [dropdown,  setDropdown]  = useState(false);
  const [mobMenu,   setMobMenu]   = useState(false);
  const [billing,   setBilling]   = useState<"monthly"|"yearly">("monthly");
  const [openFaq,   setOpenFaq]   = useState<number|null>(null);
  const [scrolled,  setScrolled]  = useState(false);
  const [mounted,   setMounted]   = useState(false);      // SSR safety
  const [isDesktop, setIsDesktop] = useState(false);      // for JS-only branches
  const [liveLines, setLiveLines] = useState(847);

  /* refs */
  const dropRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>();

  /* ── mount + responsive ── */
  useEffect(()=>{
    const check = ()=>{ const w=window.innerWidth; setIsDesktop(w>=1200); };
    check();
    setMounted(true);
    window.addEventListener("resize", check);
    return ()=>window.removeEventListener("resize", check);
  },[]);

  /* ── nav scroll ── */
  useEffect(()=>{
    const h = ()=>setScrolled(window.scrollY>20);
    window.addEventListener("scroll",h,{passive:true});
    return ()=>window.removeEventListener("scroll",h);
  },[]);

  /* ── live code counter ── */
  useEffect(()=>{
    const iv = setInterval(()=>setLiveLines(p=>p+Math.floor(Math.random()*8+2)),120);
    return ()=>clearInterval(iv);
  },[]);

  /* ── gradient theme cycle — 3 s / 800 ms ── */
  useEffect(()=>{
    const root = document.documentElement;
    let cur=0, busy=false;
    const set=(a:number[],b:number[])=>{
      root.style.setProperty("--ga",rgbToHex(a[0],a[1],a[2]));
      root.style.setProperty("--gb",rgbToHex(b[0],b[1],b[2]));
      root.style.setProperty("--ga-rgb",a.map(Math.round).join(","));
      root.style.setProperty("--gb-rgb",b.map(Math.round).join(","));
    };
    const transit=(fi:number,ti:number)=>{
      if(busy) return; busy=true;
      const fa=hexToRgb(THEMES[fi].a), fb=hexToRgb(THEMES[fi].b);
      const ta=hexToRgb(THEMES[ti].a), tb=hexToRgb(THEMES[ti].b);
      const t0=performance.now();
      const step=(now:number)=>{
        const raw=Math.min((now-t0)/800,1);
        const e=raw<.5?2*raw*raw:-1+(4-2*raw)*raw;
        set(fa.map((v,i)=>lerp(v,ta[i],e)),fb.map((v,i)=>lerp(v,tb[i],e)));
        if(raw<1){ animRef.current=requestAnimationFrame(step); } else busy=false;
      };
      animRef.current=requestAnimationFrame(step);
    };
    set(hexToRgb(THEMES[0].a),hexToRgb(THEMES[0].b));
    const iv = setInterval(()=>{ const n=(cur+1)%THEMES.length; transit(cur,n); cur=n; },3000);
    return ()=>{ clearInterval(iv); if(animRef.current) cancelAnimationFrame(animRef.current); };
  },[]);

  /* ── typewriter ── */
  useEffect(()=>{
    const target=PROMPTS[promptIdx];
    let i=0; setTyped("");
    const iv=setInterval(()=>{
      if(i<target.length){ setTyped(target.slice(0,i+1)); i++; }
      else{ clearInterval(iv); setTimeout(()=>setPromptIdx(p=>(p+1)%PROMPTS.length),2200); }
    },42);
    return ()=>clearInterval(iv);
  },[promptIdx]);

  /* ── close dropdown outside click ── */
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(dropRef.current&&!dropRef.current.contains(e.target as Node)) setDropdown(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);

  const scrollTo = useCallback((id:string)=>{
    setMobMenu(false);
    setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"}),80);
  },[]);

  /* ────────────────── RENDER ────────────────── */
  return (
    <div style={{ background:T.bg, color:T.text, fontFamily:"'DM Sans',system-ui,sans-serif", minHeight:"100vh" }}>

      {/* ══════════════════════════════════════
          GLOBAL STYLES
      ══════════════════════════════════════ */}
      <style>{`
        :root{
          --ga:#F5C542; --gb:#00D084;
          --ga-rgb:245,197,66; --gb-rgb:0,208,132;
        }
        *,*::before,*::after{ box-sizing:border-box; margin:0; padding:0; }
        html,body{ overflow-x:hidden; }

        /* ── gradient helpers ── */
        .gt{
          background:linear-gradient(135deg,var(--ga) 0%,var(--gb) 100%);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          background-clip:text;
        }
        .gb{ background:linear-gradient(135deg,var(--ga) 0%,var(--gb) 100%)!important; }
        .gg{ box-shadow:0 0 40px rgba(var(--ga-rgb),.2),0 0 80px rgba(var(--gb-rgb),.1); }

        /* ── shine button ── */
        .shine{ position:relative; overflow:hidden; }
        .shine::after{
          content:''; position:absolute;
          top:-50%; left:-60%; width:40%; height:200%;
          background:linear-gradient(to right,transparent,rgba(255,255,255,.28),transparent);
          transform:skewX(-20deg);
          animation:shineL 3.5s ease-in-out infinite;
        }

        /* ── particles ── */
        .ptcl{
          position:absolute; border-radius:50%; pointer-events:none;
          background:radial-gradient(circle,rgba(var(--ga-rgb),.45) 0%,transparent 70%);
          animation:pfloat var(--d,12s) ease-in-out infinite var(--dl,0s);
        }

        /* ── nav ── */
        .desk-nav{ display:none; }
        @media(min-width:768px){ .desk-nav{ display:flex!important; } }

        /* ── hero layout ── */
        .hero-grid{
          display:grid;
          grid-template-columns:1fr;
          gap:48px;
          align-items:center;
          width:100%;
          max-width:1400px;
          margin:0 auto;
          padding:0 clamp(20px,4vw,64px);
        }
        @media(min-width:1200px){
          .hero-grid{ grid-template-columns:1fr 1fr; }
        }

        /* ── hero left alignment ── */
        .hero-left{
          display:flex; flex-direction:column;
          align-items:center; text-align:center;
        }
        @media(min-width:1200px){
          .hero-left{ align-items:flex-start; text-align:left; }
        }

        /* ── hero dashboard — hide on mobile/tablet ── */
        .hero-dash{ display:none; }
        @media(min-width:1200px){ .hero-dash{ display:block; } }

        /* ── section containers ── */
        .wrap{
          width:100%; max-width:1280px;
          margin:0 auto;
          padding:0 clamp(20px,4vw,64px);
        }
        .wrap-narrow{ max-width:700px; margin:0 auto; padding:0 clamp(20px,4vw,64px); }

        /* ── section padding ── */
        .sec{ padding:clamp(60px,8vw,100px) 0; position:relative; z-index:1; }
        .sec-alt{ background:rgba(255,255,255,.018); border-top:1px solid rgba(255,255,255,.05); }

        /* ── grid utilities ── */
        .grid-2{ display:grid; grid-template-columns:1fr; gap:16px; }
        .grid-3{ display:grid; grid-template-columns:1fr; gap:16px; }
        .grid-4{ display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
        @media(min-width:768px){
          .grid-2{ grid-template-columns:repeat(2,1fr); }
          .grid-3{ grid-template-columns:repeat(2,1fr); }
          .grid-4{ grid-template-columns:repeat(2,1fr); }
        }
        @media(min-width:1200px){
          .grid-3{ grid-template-columns:repeat(3,1fr); }
          .grid-4{ grid-template-columns:repeat(4,1fr); }
        }

        /* ── stats ── */
        .stats-grid{
          display:grid; grid-template-columns:repeat(2,1fr);
          gap:1px; background:rgba(255,255,255,.06);
          border-radius:20px; overflow:hidden;
          border:1px solid rgba(255,255,255,.07);
        }
        @media(min-width:768px){ .stats-grid{ grid-template-columns:repeat(4,1fr); } }

        /* ── cards ── */
        .card{
          background:rgba(255,255,255,.025);
          border:1px solid rgba(255,255,255,.08);
          border-radius:18px; padding:24px;
          transition:all .3s ease;
          backdropFilter:blur(12px);
        }
        .card:hover{
          border-color:rgba(var(--ga-rgb),.3);
          transform:translateY(-4px);
          box-shadow:0 20px 48px rgba(0,0,0,.45),0 0 0 1px rgba(var(--ga-rgb),.08);
        }

        /* ── buttons ── */
        .btn-primary{
          display:inline-flex; align-items:center; justify-content:center;
          padding:14px 32px; border:none; border-radius:12px;
          color:#050505; font-size:15px; font-weight:700;
          cursor:pointer; white-space:nowrap;
          transition:transform .2s ease, box-shadow .2s ease;
        }
        .btn-primary:hover{ transform:translateY(-2px); box-shadow:0 12px 32px rgba(var(--ga-rgb),.38); }

        .btn-ghost{
          display:inline-flex; align-items:center; justify-content:center;
          padding:14px 32px; border:1px solid rgba(255,255,255,.12);
          background:rgba(255,255,255,.04); border-radius:12px;
          color:#fff; font-size:15px; font-weight:600;
          cursor:pointer; white-space:nowrap;
          transition:all .2s ease;
        }
        .btn-ghost:hover{
          background:rgba(255,255,255,.08);
          border-color:rgba(255,255,255,.22);
          transform:translateY(-2px);
        }

        /* ── animations ── */
        @keyframes shineL{
          0%{left:-60%;opacity:0} 10%{opacity:1}
          40%{left:130%;opacity:1} 41%{opacity:0} 100%{left:130%;opacity:0}
        }
        @keyframes fadeUp{ from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse{ 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes blink{ 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes marquee{ from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes gridFade{ 0%,100%{opacity:.25} 50%{opacity:.5} }
        @keyframes gm1{ 0%,100%{transform:translate(0,0)scale(1)} 50%{transform:translate(3%,-3%)scale(1.05)} }
        @keyframes gm2{ 0%,100%{transform:translate(0,0)scale(1)} 50%{transform:translate(-4%,4%)scale(1.07)} }
        @keyframes gm3{ 0%,100%{transform:translate(0,0)scale(1)} 50%{transform:translate(4%,-2%)scale(1.04)} }
        @keyframes glow{ 0%,100%{opacity:.5} 50%{opacity:.9} }
        @keyframes pfloat{
          0%,100%{transform:translate(0,0)scale(1);opacity:0}
          10%{opacity:.8}
          50%{transform:translate(var(--tx,30px),var(--ty,-60px))scale(1.3);opacity:.5}
          90%{opacity:.2}
        }
        @keyframes float1{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes float2{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes spin{ from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeIn{ from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }

        /* ── scrollbar ── */
        ::-webkit-scrollbar{ width:4px; }
        ::-webkit-scrollbar-track{ background:#080808; }
        ::-webkit-scrollbar-thumb{ background:rgba(var(--ga-rgb),.3); border-radius:4px; }

        @media(prefers-reduced-motion:reduce){
          *,*::before,*::after{ animation-duration:.01ms!important; transition-duration:.01ms!important; }
        }
      `}</style>

      {/* ══════════════════════════════════════
          BACKGROUND LAYER
      ══════════════════════════════════════ */}
      <div style={{ position:"fixed", inset:0, zIndex:0, overflow:"hidden", pointerEvents:"none" }}>
        {/* Aurora blobs */}
        <div style={{ position:"absolute", top:"-5%", left:"-5%", width:"50vw", height:"50vw", borderRadius:"50%", filter:"blur(90px)", background:"radial-gradient(circle,rgba(var(--ga-rgb),.35) 0%,transparent 70%)", animation:"gm1 20s ease-in-out infinite,glow 9s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"-10%", right:"-10%", width:"60vw", height:"60vw", borderRadius:"50%", filter:"blur(90px)", background:"radial-gradient(circle,rgba(var(--gb-rgb),.28) 0%,transparent 70%)", animation:"gm2 24s ease-in-out infinite,glow 11s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"-10%", left:"20%", width:"55vw", height:"55vw", borderRadius:"50%", filter:"blur(90px)", background:"radial-gradient(circle,rgba(139,92,246,.18) 0%,transparent 70%)", animation:"gm3 22s ease-in-out infinite,glow 8s ease-in-out infinite" }} />
        {/* Dot grid */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px)", backgroundSize:"36px 36px", animation:"gridFade 10s ease-in-out infinite" }} />
        {/* Particles */}
        {[
           { w:5,h:5, top:"14%",left:"8%",  d:"16s",dl:"0s",    tx:"40px",  ty:"-80px" },
          { w:3,h:3, top:"32%",left:"91%", d:"20s",dl:"-7s",   tx:"-30px", ty:"-55px" },
          { w:7,h:7, top:"62%",left:"6%",  d:"22s",dl:"-3s",   tx:"55px",  ty:"-90px" },
          { w:4,h:4, top:"78%",left:"82%", d:"14s",dl:"-10s",  tx:"-25px", ty:"-45px" },
          { w:5,h:5, top:"45%",left:"50%", d:"18s",dl:"-5s",   tx:"28px",  ty:"-70px" },
          { w:6,h:6, top:"20%",left:"68%", d:"24s",dl:"-12s",  tx:"-38px", ty:"-85px" },
          { w:3,h:3, top:"86%",left:"28%", d:"16s",dl:"-8s",   tx:"32px",  ty:"-50px" },
          { w:4,h:4, top:"10%",left:"42%", d:"20s",dl:"-2s",   tx:"-20px", ty:"-72px" },
        ].map((p,i)=>(
          <Particle key={i} s={{ width:p.w,height:p.h,top:p.top,left:p.left,"--d":p.d,"--dl":p.dl,"--tx":p.tx,"--ty":p.ty } as CSSProperties} />
        ))}
      </div>

      {/* ══════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════ */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:100,
        height:62,display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 clamp(16px,3vw,40px)",
        background: scrolled ? "rgba(5,5,5,.96)" : "rgba(5,5,5,.5)",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,.07)" : "1px solid transparent",
        backdropFilter:"blur(28px)",
        transition:"all .3s ease",
      }}>
        {/* Logo + dropdown */}
        <div ref={dropRef} style={{ position:"relative", display:"flex", alignItems:"center" }}>
          <button onClick={e=>{e.stopPropagation();setDropdown(v=>!v);}}
            style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0 }}>
            <img src="/logo.png" alt="Krypton AI" style={{ height:44,width:"auto",objectFit:"contain" }} />
            <span style={{ color:"#555",fontSize:10,transition:"transform .2s",transform:dropdown?"rotate(180deg)":"none" }}>▾</span>
          </button>
          {dropdown && (
            <div style={{ position:"absolute",top:54,left:0,background:"rgba(12,12,12,.98)",border:"1px solid rgba(255,255,255,.08)",borderRadius:18,padding:8,minWidth:230,zIndex:200,boxShadow:"0 24px 64px rgba(0,0,0,.9)",backdropFilter:"blur(20px)" }}>
              {[
                { icon:"🏠", label:"Home",      path:"/landing" },
                { icon:"✨", label:"Features",  cb:()=>scrollTo("features") },
                { icon:"🖼️", label:"Templates", path:"/templates" },
                { icon:"💰", label:"Pricing",   cb:()=>scrollTo("pricing") },
                { icon:"❓", label:"FAQ",        cb:()=>scrollTo("faq") },
              ].map(it=>(
                <button key={it.label}
                  onClick={()=>{ if((it as any).path) router.push((it as any).path); else (it as any).cb(); setDropdown(false); }}
                  style={{ width:"100%",textAlign:"left",padding:"10px 12px",background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",borderRadius:10,display:"flex",alignItems:"center",gap:9,transition:"all .15s" }}
                  onMouseEnter={e=>{e.currentTarget.style.background="#1a1a1a";e.currentTarget.style.color="#fff";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.muted;}}>
                  <span style={{fontSize:15}}>{it.icon}</span>{it.label}
                </button>
              ))}
              <div style={{ height:1,background:"rgba(255,255,255,.06)",margin:"6px 0" }} />
              <button onClick={()=>{router.push("/auth/login");setDropdown(false);}}
                style={{ width:"100%",textAlign:"left",padding:"10px 12px",background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",borderRadius:10,display:"flex",alignItems:"center",gap:9 }}>
                🚀 Login
              </button>
              <button onClick={()=>{router.push("/auth/signup");setDropdown(false);}}
                style={{ width:"100%",textAlign:"left",padding:"10px 12px",background:"rgba(var(--ga-rgb),.1)",border:"1px solid rgba(var(--ga-rgb),.2)",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:9,marginTop:4,transition:"all .15s" }}
                className="gt">
                🟢 Get Started Free
              </button>
            </div>
          )}
        </div>

        {/* Center links */}
        <div className="desk-nav" style={{ gap:32,position:"absolute",left:"50%",transform:"translateX(-50%)" }}>
          {NAV_LINKS.map(l=>(
            <button key={l} onClick={()=>scrollTo(l.toLowerCase())}
              style={{ background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",fontWeight:500,transition:"color .2s",padding:"4px 0" }}
              onMouseEnter={e=>e.currentTarget.style.color="#fff"}
              onMouseLeave={e=>e.currentTarget.style.color=T.muted}>
              {l}
            </button>
          ))}
        </div>

        {/* Right CTA */}
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <button onClick={()=>router.push("/auth/login")}
            style={{ padding:"7px 18px",background:"none",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:T.muted,fontSize:13,cursor:"pointer",transition:"all .2s",display:"none" }}
            className="desk-nav"
            onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(var(--ga-rgb),.5)";e.currentTarget.style.color="#fff";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,.1)";e.currentTarget.style.color=T.muted;}}>
            Login
          </button>
          <button className="gb shine" onClick={()=>router.push("/auth/signup")}
            style={{ padding:"7px 18px",border:"none",borderRadius:10,color:"#050505",fontSize:13,fontWeight:700,cursor:"pointer",transition:"transform .15s,box-shadow .15s" }}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(var(--ga-rgb),.35)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
            Get Started
          </button>
          {/* Mobile hamburger — CSS controlled */}
          <button onClick={()=>setMobMenu(v=>!v)}
            style={{ background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,color:"#fff",fontSize:16,cursor:"pointer",padding:"6px 10px",display:"none" }}
            className="mob-ham">
            {mobMenu ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mounted && mobMenu && (
        <div style={{ position:"fixed",top:62,left:0,right:0,background:"rgba(6,6,6,.98)",borderBottom:"1px solid rgba(255,255,255,.08)",padding:"16px 20px",zIndex:99,backdropFilter:"blur(20px)",display:"flex",flexDirection:"column",gap:4 }}>
          {NAV_LINKS.map(l=>(
            <button key={l} onClick={()=>scrollTo(l.toLowerCase())}
              style={{ background:"none",border:"none",color:T.sub,fontSize:15,cursor:"pointer",padding:"12px 0",textAlign:"left",fontWeight:500,borderBottom:"1px solid rgba(255,255,255,.05)" }}>
              {l}
            </button>
          ))}
          <div style={{ display:"flex",gap:8,marginTop:12 }}>
            <button onClick={()=>{router.push("/auth/login");setMobMenu(false);}}
              style={{ flex:1,background:"none",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"#fff",fontSize:14,cursor:"pointer",padding:11 }}>
              Login
            </button>
            <button className="gb shine" onClick={()=>{router.push("/auth/signup");setMobMenu(false);}}
              style={{ flex:1,border:"none",borderRadius:10,color:"#050505",fontSize:14,fontWeight:700,cursor:"pointer",padding:11 }}>
              Sign Up Free
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section style={{
        position:"relative",zIndex:1,
        paddingTop:"clamp(100px,12vw,140px)",
        paddingBottom:"clamp(60px,8vw,100px)",
        overflow:"hidden",
      }}>
        <div className="hero-grid">

          {/* ── LEFT ── */}
          <div className="hero-left" style={{ animation:"fadeIn .7s ease forwards" }}>

            {/* Badge */}
            <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:"rgba(var(--ga-rgb),.08)",border:"1px solid rgba(var(--ga-rgb),.2)",borderRadius:24,padding:"5px 16px",marginBottom:"1.4rem",fontSize:12,fontWeight:600 }}>
              <span style={{ width:7,height:7,borderRadius:"50%",background:"var(--gb)",display:"inline-block",animation:"pulse 2s infinite" }} />
              <span className="gt">✨ Build Websites, Apps &amp; Games with AI</span>
            </div>

            {/* H1 */}
            <h1 style={{
              fontFamily:"'Syne',sans-serif",
              fontSize:"clamp(36px,5.5vw,72px)",
              fontWeight:800,lineHeight:1.04,
              marginBottom:"1.2rem",
              maxWidth:560,
              animationDelay:".1s",
            }}>
              Build{" "}
              <span className="gt">Websites,<br />Apps &amp; Games</span>{" "}
              with AI.
            </h1>

            <p style={{ color:T.sub,fontSize:"clamp(15px,1.8vw,18px)",lineHeight:1.75,maxWidth:460,marginBottom:"2rem" }}>
              Describe what you want. Krypton AI builds it — complete, responsive, and ready to deploy in seconds.
            </p>

            {/* CTAs */}
            <div style={{ display:"flex",gap:12,flexWrap:"wrap",justifyContent:"inherit",marginBottom:"2rem" }}>
              <button className="gb btn-primary shine" onClick={()=>router.push("/auth/signup")}>
                Start Building Free →
              </button>
              <button className="btn-ghost" onClick={()=>scrollTo("examples")}>
                See Examples
              </button>
            </div>

            {/* Social proof */}
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ display:"flex" }}>
                {["A","S","R","J"].map((l,i)=>(
                  <div key={i} style={{ width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,rgba(var(--ga-rgb),.4),rgba(var(--gb-rgb),.4))",border:"2px solid #050505",marginLeft:i===0?0:-9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700 }}>
                    {l}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize:12,marginBottom:2 }}>⭐⭐⭐⭐⭐</div>
                <p style={{ color:T.muted,fontSize:12 }}>Trusted by 12,000+ builders</p>
              </div>
            </div>
          </div>

          {/* ── RIGHT — Dashboard Preview (desktop only via CSS) ── */}
          <div className="hero-dash" style={{ position:"relative",height:460,animation:"fadeIn .8s ease .15s both" }}>

            {/* Main editor card */}
            <div style={{ position:"absolute",inset:0,background:"rgba(11,11,11,.9)",border:"1px solid rgba(255,255,255,.1)",borderRadius:22,overflow:"hidden",backdropFilter:"blur(20px)",boxShadow:"0 32px 80px rgba(0,0,0,.7),0 0 0 1px rgba(var(--ga-rgb),.06)" }}>

              {/* Title bar */}
              <div style={{ padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(255,255,255,.02)",display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ display:"flex",gap:6 }}>
                  {["#EF4444","#F59E0B","#10B981"].map(c=>(
                    <div key={c} style={{ width:10,height:10,borderRadius:"50%",background:c }} />
                  ))}
                </div>
                <span style={{ flex:1,textAlign:"center",fontSize:11,color:T.muted }}>kryptonai.tech — Live Editor</span>
                <span style={{ width:7,height:7,borderRadius:"50%",background:"#10B981",animation:"pulse 2s infinite" }} />
              </div>

              {/* Prompt bar */}
              <div style={{ margin:"14px 16px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(var(--ga-rgb),.18)",borderRadius:10,padding:"10px 14px" }}>
                <p style={{ color:"#444",fontSize:11,marginBottom:4 }}>Describe your project:</p>
                <p style={{ color:"rgba(255,255,255,.75)",fontSize:13,fontFamily:"monospace",minHeight:18 }}>
                  {typed}
                  <span style={{ display:"inline-block",width:2,height:13,background:"var(--ga)",marginLeft:2,verticalAlign:"middle",animation:"blink 1s infinite" }} />
                </p>
              </div>

              {/* Code preview */}
              <div style={{ margin:"0 16px",background:"rgba(0,0,0,.55)",borderRadius:12,padding:"12px 14px",height:180,overflow:"hidden" }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <span style={{ fontSize:10,color:"var(--ga)",fontWeight:700,fontFamily:"monospace" }}>● GENERATING</span>
                  <span style={{ fontSize:10,color:T.muted,fontFamily:"monospace" }}>{liveLines} lines written</span>
                </div>
                {CODE_LINES.map((l,i)=>(
                  <p key={i} style={{ fontFamily:"monospace",fontSize:11,color:l.c,margin:"0 0 3px",opacity:i<5?1:.3,whiteSpace:"nowrap" }}>
                    {l.t}
                  </p>
                ))}
              </div>

              {/* Bottom stats */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,margin:"12px 16px" }}>
                {[{v:"4.2s",l:"Build Time",c:"var(--ga)"},{v:`${liveLines}`,l:"Lines",c:"var(--gb)"},{v:"98%",l:"Quality",c:"#60A5FA"}].map(s=>(
                  <div key={s.l} style={{ background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10,padding:"10px 12px",textAlign:"center" }}>
                    <p style={{ color:s.c,fontSize:16,fontWeight:800,fontFamily:"'Syne',sans-serif",margin:"0 0 2px" }}>{s.v}</p>
                    <p style={{ color:T.muted,fontSize:10,margin:0 }}>{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating card: Projects */}
            <div style={{ position:"absolute",top:16,right:16,background:"rgba(11,11,11,.95)",border:"1px solid rgba(var(--ga-rgb),.25)",borderRadius:14,padding:"12px 16px",boxShadow:"0 16px 40px rgba(0,0,0,.5)",backdropFilter:"blur(16px)",animation:"float1 5s ease-in-out infinite",zIndex:10,minWidth:140 }}>
              <p style={{ color:T.muted,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",margin:"0 0 4px" }}>Projects Today</p>
              <p className="gt" style={{ fontSize:26,fontWeight:800,fontFamily:"'Syne',sans-serif",margin:"0 0 3px" }}>1,247</p>
              <p style={{ color:"#10B981",fontSize:11,margin:0 }}>▲ 18% yesterday</p>
            </div>

            {/* Floating card: Deploy */}
            <div style={{ position:"absolute",bottom:16,left:16,background:"rgba(11,11,11,.95)",border:"1px solid rgba(var(--gb-rgb),.25)",borderRadius:14,padding:"10px 14px",boxShadow:"0 16px 40px rgba(0,0,0,.5)",backdropFilter:"blur(16px)",animation:"float2 7s ease-in-out infinite 1s",zIndex:10,display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:34,height:34,borderRadius:10,background:"rgba(var(--gb-rgb),.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>⚡</div>
              <div>
                <p style={{ fontSize:12,fontWeight:700,margin:"0 0 1px" }}>Instant Deploy</p>
                <p style={{ color:T.muted,fontSize:10,margin:0 }}>Live in 8 seconds</p>
              </div>
            </div>

            {/* Floating card: AI model */}
            <div style={{ position:"absolute",bottom:90,right:16,background:"rgba(11,11,11,.95)",border:"1px solid rgba(139,92,246,.3)",borderRadius:14,padding:"10px 14px",boxShadow:"0 12px 32px rgba(0,0,0,.5)",backdropFilter:"blur(16px)",animation:"float1 6s ease-in-out infinite 2s",zIndex:10,display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ fontSize:14 }}>🤖</span>
              <div>
                <p style={{ fontSize:11,fontWeight:700,margin:0,color:"#C4B5FD" }}>Claude Sonnet</p>
                <p style={{ color:T.muted,fontSize:9,margin:0 }}>Powering generations</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          MARQUEE
      ══════════════════════════════════════ */}
      <div style={{ overflow:"hidden",borderTop:"1px solid rgba(255,255,255,.06)",borderBottom:"1px solid rgba(255,255,255,.06)",padding:"13px 0",background:"rgba(6,6,6,.8)",position:"relative",zIndex:1 }}>
        <div style={{ display:"flex",animation:"marquee 24s linear infinite",width:"max-content" }}>
          {[...MARQUEE_ITEMS,...MARQUEE_ITEMS].map((it,i)=>(
            <span key={i} style={{ padding:"0 32px",fontSize:13,color:T.muted,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:8 }}>
              <span className="gt" style={{ fontWeight:600 }}>{it}</span>
              <span style={{ color:"rgba(255,255,255,.08)" }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
          STATS
      ══════════════════════════════════════ */}
      <section className="sec" style={{ zIndex:1 }}>
        <div className="wrap">
          <div className="stats-grid">
            {STATS.map(s=>(
              <div key={s.label} style={{ background:T.card }}>
                <Counter value={s.value} suffix={s.suffix} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURES
      ══════════════════════════════════════ */}
      <section id="features" className="sec sec-alt" style={{ scrollMarginTop:80, zIndex:1 }}>
        <div className="wrap">
          <p style={{ textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10 }}>
            <span className="gt">What You Can Build</span>
          </p>
          <h2 style={{ fontFamily:"'Syne',sans-serif",fontSize:"clamp(26px,4vw,48px)",fontWeight:800,textAlign:"center",marginBottom:"3rem" }}>
            One AI. <span className="gt">Infinite Possibilities.</span>
          </h2>
          <div className="grid-4">
            {FEATURES.map(f=>(
              <div key={f.title} className="card">
                <div style={{ width:46,height:46,borderRadius:13,background:"rgba(var(--ga-rgb),.1)",border:"1px solid rgba(var(--ga-rgb),.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:14 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,marginBottom:8 }}>
                  <span className="gt">{f.title}</span>
                </h3>
                <p style={{ color:T.sub,fontSize:14,lineHeight:1.7,margin:0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          EXAMPLES
      ══════════════════════════════════════ */}
      <section id="examples" className="sec" style={{ scrollMarginTop:80, zIndex:1 }}>
        <div className="wrap">
          <p style={{ textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10 }}>
            <span className="gt">Examples</span>
          </p>
          <h2 style={{ fontFamily:"'Syne',sans-serif",fontSize:"clamp(26px,4vw,48px)",fontWeight:800,textAlign:"center",marginBottom:"3rem" }}>
            See What&apos;s <span className="gt">Possible</span>
          </h2>
          <div className="grid-3">
            {[
              { title:"SaaS Dashboard", tag:"Web App", emoji:"📊", acc:"245,197,66" },
              { title:"Portfolio Site",  tag:"Website", emoji:"💼", acc:"0,208,132" },
              { title:"Snake Game",      tag:"Game",    emoji:"🎮", acc:"139,92,246" },
              { title:"Invoice Tool",    tag:"Tool",    emoji:"📋", acc:"59,130,246" },
              { title:"Fitness App",     tag:"Web App", emoji:"💪", acc:"244,63,94" },
              { title:"E-Commerce",      tag:"Website", emoji:"🛒", acc:"16,185,129" },
            ].map(ex=>(
              <div key={ex.title}
                style={{ background:`rgba(${ex.acc},.06)`,border:`1px solid rgba(${ex.acc},.15)`,borderRadius:18,overflow:"hidden",cursor:"pointer",transition:"all .3s" }}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow=`0 20px 48px rgba(${ex.acc},.14)`;e.currentTarget.style.borderColor=`rgba(${ex.acc},.35)`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";e.currentTarget.style.borderColor=`rgba(${ex.acc},.15)`;}}>
                <div style={{ height:140,background:`linear-gradient(135deg,rgba(${ex.acc},.14),rgba(${ex.acc},.03))`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:44 }}>
                  {ex.emoji}
                </div>
                <div style={{ padding:"16px 18px" }}>
                  <span style={{ fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:`rgba(${ex.acc},1)` }}>{ex.tag}</span>
                  <p style={{ fontSize:15,fontWeight:600,margin:"5px 0 0" }}>{ex.title}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center",marginTop:"2.5rem" }}>
            <button className="gb btn-primary shine" onClick={()=>router.push("/auth/signup")}>
              Build Your Own →
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════ */}
      <section className="sec sec-alt" style={{ zIndex:1 }}>
        <div className="wrap">
          <p style={{ textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10 }}>
            <span className="gt">Testimonials</span>
          </p>
          <h2 style={{ fontFamily:"'Syne',sans-serif",fontSize:"clamp(26px,4vw,48px)",fontWeight:800,textAlign:"center",marginBottom:"3rem" }}>
            Loved by <span className="gt">Builders</span>
          </h2>
          <div className="grid-3">
            {TESTIMONIALS.map((t,i)=>(
              <div key={i} className="card" style={{ position:"relative",overflow:"hidden" }}>
                <div style={{ position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"50%",background:"radial-gradient(circle,rgba(var(--ga-rgb),.08) 0%,transparent 70%)",pointerEvents:"none" }} />
                <div style={{ fontSize:14,marginBottom:12 }}>{"⭐".repeat(t.stars)}</div>
                <p style={{ color:T.sub,fontSize:14,lineHeight:1.75,marginBottom:20,fontStyle:"italic" }}>&ldquo;{t.text}&rdquo;</p>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,rgba(var(--ga-rgb),.3),rgba(var(--gb-rgb),.3))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,flexShrink:0 }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <p style={{ fontWeight:700,fontSize:14,margin:0 }}>{t.name}</p>
                    <p style={{ color:T.muted,fontSize:12,margin:"2px 0 0" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          PRICING
      ══════════════════════════════════════ */}
      <section id="pricing" className="sec" style={{ scrollMarginTop:80, zIndex:1 }}>
        <div className="wrap">
          <p style={{ textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10 }}>
            <span className="gt">Pricing</span>
          </p>
          <h2 style={{ fontFamily:"'Syne',sans-serif",fontSize:"clamp(26px,4vw,48px)",fontWeight:800,textAlign:"center",marginBottom:12 }}>
            Simple, <span className="gt">Transparent Pricing</span>
          </h2>
          <p style={{ color:T.sub,textAlign:"center",fontSize:16,marginBottom:"2rem" }}>Start free. Upgrade when you&apos;re ready.</p>

          {/* Billing toggle */}
          <div style={{ display:"flex",justifyContent:"center",gap:8,marginBottom:"2.5rem" }}>
            {(["monthly","yearly"] as const).map(b=>(
              <button key={b} onClick={()=>setBilling(b)}
                style={{ padding:"8px 22px",borderRadius:12,border:"1px solid",borderColor:billing===b?"rgba(var(--ga-rgb),.4)":"rgba(255,255,255,.08)",background:billing===b?"rgba(var(--ga-rgb),.1)":"transparent",color:billing===b?"var(--ga)":T.muted,fontWeight:600,fontSize:13,cursor:"pointer",transition:"all .2s",textTransform:"capitalize" }}>
                {b}{b==="yearly"&&<span style={{ fontSize:10,marginLeft:4,color:"#10B981" }}> Save 20%</span>}
              </button>
            ))}
          </div>

          <div className="grid-4">
            {PLANS.map(plan=>(
              <div key={plan.name}
                style={{ background:plan.hot?"rgba(var(--ga-rgb),.05)":"rgba(13,13,13,.8)",border:plan.hot?"1px solid rgba(var(--ga-rgb),.35)":"1px solid rgba(255,255,255,.07)",borderRadius:20,padding:24,position:"relative",backdropFilter:"blur(10px)",transition:"all .3s",boxShadow:plan.hot?"0 0 60px rgba(var(--ga-rgb),.08)":"none" }}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow=plan.hot?"0 20px 60px rgba(var(--ga-rgb),.15)":"0 20px 40px rgba(0,0,0,.4)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=plan.hot?"0 0 60px rgba(var(--ga-rgb),.08)":"none";}}>

                {plan.hot && (
                  <div className="gb" style={{ position:"absolute",top:-13,left:"50%",transform:"translateX(-50%)",color:"#050505",fontSize:11,fontWeight:700,padding:"4px 16px",borderRadius:20,whiteSpace:"nowrap" }}>
                    ✨ Most Popular
                  </div>
                )}

                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                  <span style={{ fontSize:18 }}>{plan.emoji}</span>
                  <h3 style={{ fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700 }}><span className="gt">{plan.name}</span></h3>
                </div>
                <p style={{ color:"#10B981",fontSize:11,fontWeight:600,marginBottom:12 }}>{plan.credits}</p>
                <div style={{ marginBottom:18 }}>
                  <span className="gt" style={{ fontSize:36,fontWeight:800,fontFamily:"'Syne',sans-serif" }}>
                    {billing==="monthly"?plan.monthly:plan.yearly}
                  </span>
                  <span style={{ color:T.muted,fontSize:13 }}>/mo</span>
                </div>

                {plan.inc.map(f=>(
                  <div key={f} style={{ display:"flex",alignItems:"flex-start",gap:8,marginBottom:8 }}>
                    <span className="gt" style={{ fontSize:12,flexShrink:0,fontWeight:700 }}>✓</span>
                    <span style={{ fontSize:13,color:T.sub }}>{f}</span>
                  </div>
                ))}
                {plan.off.map(f=>(
                  <div key={f} style={{ display:"flex",alignItems:"flex-start",gap:8,marginBottom:8 }}>
                    <span style={{ fontSize:12,flexShrink:0,color:"#2a2a2a" }}>✕</span>
                    <span style={{ fontSize:13,color:"#333" }}>{f}</span>
                  </div>
                ))}

                <button
                  className={plan.hot?"gb shine":""}
                  onClick={()=>router.push("/auth/signup")}
                  style={{ width:"100%",marginTop:18,padding:12,background:plan.hot?undefined:"rgba(255,255,255,.04)",border:plan.hot?"none":"1px solid rgba(255,255,255,.08)",borderRadius:12,color:plan.hot?"#050505":T.text,fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .2s" }}
                  onMouseEnter={e=>{if(!plan.hot){e.currentTarget.style.background="rgba(255,255,255,.08)";e.currentTarget.style.transform="translateY(-1px)";}}}
                  onMouseLeave={e=>{if(!plan.hot){e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.transform="none";}}}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FAQ
      ══════════════════════════════════════ */}
      <section id="faq" className="sec sec-alt" style={{ scrollMarginTop:80, zIndex:1 }}>
        <div className="wrap-narrow">
          <p style={{ textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10 }}>
            <span className="gt">FAQ</span>
          </p>
          <h2 style={{ fontFamily:"'Syne',sans-serif",fontSize:"clamp(26px,4vw,48px)",fontWeight:800,textAlign:"center",marginBottom:"2.5rem" }}>
            <span className="gt">Frequently Asked</span>
          </h2>
          {FAQS.map((item,i)=>(
            <div key={i} style={{ borderBottom:"1px solid rgba(255,255,255,.06)" }}>
              <button onClick={()=>setOpenFaq(openFaq===i?null:i)}
                style={{ width:"100%",textAlign:"left",background:"none",border:"none",cursor:"pointer",padding:"20px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12 }}>
                <span style={{ fontWeight:700,fontSize:15 }}><span className="gt">{item.q}</span></span>
                <span style={{ color:T.muted,transition:"transform .3s",transform:openFaq===i?"rotate(45deg)":"none",display:"inline-block",fontSize:22,flexShrink:0,lineHeight:1 }}>+</span>
              </button>
              {openFaq===i && (
                <p style={{ color:T.sub,fontSize:14,lineHeight:1.8,paddingBottom:20,margin:0 }}>{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════ */}
      <section className="sec" style={{ textAlign:"center", overflow:"hidden", zIndex:1 }}>
        {/* Orb background */}
        <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"70vw",height:"70vw",maxWidth:700,maxHeight:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(var(--ga-rgb),.05) 0%,transparent 70%)",pointerEvents:"none" }} />
        <div className="wrap" style={{ position:"relative" }}>
          <div className="gg" style={{ width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,rgba(var(--ga-rgb),.2),rgba(var(--gb-rgb),.2))",border:"1px solid rgba(var(--ga-rgb),.2)",margin:"0 auto 2rem",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38 }}>
            ⚡
          </div>
          <h2 style={{ fontFamily:"'Syne',sans-serif",fontSize:"clamp(30px,4.5vw,58px)",fontWeight:800,lineHeight:1.08,marginBottom:"1.4rem",maxWidth:680,margin:"0 auto 1.4rem" }}>
            The future of building is{" "}
            <span className="gt">a sentence away.</span>
          </h2>
          <p style={{ color:T.sub,fontSize:17,lineHeight:1.75,maxWidth:500,margin:"0 auto 2.5rem" }}>
            Join thousands of builders creating the web with Krypton AI.
          </p>
          <button className="gb btn-primary shine" onClick={()=>router.push("/auth/signup")}
            style={{ fontSize:16,padding:"16px 44px" }}>
            Start Free — No credit card required →
          </button>
          <p style={{ color:T.muted,fontSize:12,marginTop:"1.2rem" }}>5 free generations every day. No card needed.</p>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer style={{ borderTop:"1px solid rgba(255,255,255,.06)",background:"rgba(4,4,4,.98)",position:"relative",zIndex:1 }}>
        <div className="wrap" style={{ padding:"clamp(48px,6vw,72px) clamp(20px,4vw,64px) clamp(24px,3vw,40px)" }}>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:28,marginBottom:48 }}
            className="footer-grid">
            {[
              { title:"Product",   links:[{l:"Features",h:"/landing#features"},{l:"Pricing",h:"/landing#pricing"},{l:"Roadmap",h:"/landing#roadmap"},{l:"Examples",h:"/landing#examples"}] },
              { title:"Resources", links:[{l:"Documentation",h:"/docs"},{l:"Changelog",h:"/changelog"},{l:"Blog",h:"/blog"},{l:"Support",h:"/support"}] },
              { title:"Company",   links:[{l:"About",h:"/about"},{l:"Contact",h:"/contact"}] },
              { title:"Legal",     links:[{l:"Privacy Policy",h:"/privacy"},{l:"Terms of Service",h:"/terms"},{l:"Refund Policy",h:"/refund"}] },
              { title:"Social",    links:[{l:"X (Twitter)",h:"https://twitter.com/kryptonai"},{l:"LinkedIn",h:"https://linkedin.com/company/kryptonai"},{l:"GitHub",h:"https://github.com/jangeersinghktm-design/Magic-Krypton-ai-"}] },
            ].map(col=>(
              <div key={col.title}>
                <p style={{ fontWeight:700,fontSize:13,marginBottom:14 }}><span className="gt">{col.title}</span></p>
                {col.links.map(link=>(
                  <a key={link.l} href={link.h}
                    style={{ display:"block",color:T.muted,fontSize:13,marginBottom:10,textDecoration:"none",transition:"color .2s" }}
                    onMouseEnter={e=>e.currentTarget.style.color="#fff"}
                    onMouseLeave={e=>e.currentTarget.style.color=T.muted}>
                    {link.l}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <style>{`
            @media(min-width:768px){ .footer-grid{ grid-template-columns:repeat(5,1fr)!important; } }
          `}</style>
          <div style={{ borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:24,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12 }}>
            <img src="/logo.png" alt="Krypton AI" style={{ height:42,objectFit:"contain" }} />
            <p style={{ color:T.muted,fontSize:12,margin:0 }}>© 2026 Krypton AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
