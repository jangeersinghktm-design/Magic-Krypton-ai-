"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(2);
  const inputRef = useRef<HTMLInputElement>(null);

  // Nav scroll effect
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Demo phases animation
  useEffect(() => {
    const iv = setInterval(() => {
      setPhaseIdx(p => (p >= 4 ? 1 : p + 1));
    }, 1800);
    return () => clearInterval(iv);
  }, []);

  // Scroll reveal
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("vis"); obs.unobserve(e.target); } }),
      { threshold: 0.08 }
    );
    document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Counter animation
  useEffect(() => {
    const animate = (id: string, target: number, suffix = "") => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / 2000, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(ease * target) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      tick();
    };
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animate("s1", 2847); animate("s2", 1203);
          animate("s3", 45, "s"); animate("s4", 46);
          obs.disconnect();
        }
      });
    }, { threshold: 0.3 });
    const el = document.getElementById("stats-grid");
    if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleGenerate = () => {
    if (!prompt.trim()) { inputRef.current?.focus(); return; }
    router.push(`/create?prompt=${encodeURIComponent(prompt.trim())}`);
  };

  const setQuickPrompt = (p: string) => {
    setPrompt(p);
    inputRef.current?.focus();
  };

  const phases = [
    { label: "📐 Blueprint analysis complete", state: "done" },
    { label: "🎨 Design system generated", state: "done" },
    { label: "⚡ Building components...", state: "active" },
    { label: "🔍 Quality gate check", state: "pending" },
    { label: "✅ Ready to download", state: "pending" },
  ];

  const C = {
    bg: "#040610", surf: "#070B16", card: "#0C1020", card2: "#101525",
    border: "rgba(255,255,255,0.07)", borderH: "rgba(255,255,255,0.16)",
    text: "#F0F2F5", sub: "#8892A0", muted: "#45505E",
    grad: "linear-gradient(135deg,#F0F2F5 0%,#C8CDD4 50%,#A8B0BA 100%)",
    green: "#4CAF8A",
  };

  const Logo = () => (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill="#050816"/>
      <defs>
        <linearGradient id="lg" x1="4" y1="4" x2="36" y2="36">
          <stop stopColor="#F5F5F5"/>
          <stop offset="55%" stopColor="#D9D9D9"/>
          <stop offset="100%" stopColor="#BFC5CC"/>
        </linearGradient>
      </defs>
      <line x1="20" y1="20" x2="9" y2="9" stroke="url(#lg)" strokeWidth="1.4" strokeLinecap="round" opacity=".55"/>
      <line x1="20" y1="20" x2="31" y2="9" stroke="url(#lg)" strokeWidth="1.4" strokeLinecap="round" opacity=".55"/>
      <line x1="20" y1="20" x2="9" y2="31" stroke="url(#lg)" strokeWidth="1.4" strokeLinecap="round" opacity=".55"/>
      <line x1="20" y1="20" x2="31" y2="31" stroke="url(#lg)" strokeWidth="1.4" strokeLinecap="round" opacity=".55"/>
      <circle cx="9" cy="9" r="2.6" fill="url(#lg)"/><circle cx="31" cy="9" r="2.6" fill="url(#lg)"/>
      <circle cx="9" cy="31" r="2.6" fill="url(#lg)"/><circle cx="31" cy="31" r="2.6" fill="url(#lg)"/>
      <circle cx="20" cy="20" r="4" fill="#050816"/><circle cx="20" cy="20" r="3" fill="url(#lg)"/>
    </svg>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        body{background:${C.bg};color:${C.text};font-family:"DM Sans",sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:2px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px;}
        .reveal{opacity:0;transform:translateY(28px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);}
        .reveal.vis{opacity:1;transform:none;}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .hero-badge-dot{animation:pulse 2s infinite;}
        .step-card:hover,.type-card:hover,.feat-card:hover,.testi-card:hover{border-color:rgba(255,255,255,.18)!important;transform:translateY(-3px)!important;}
        .nav-cta:hover{opacity:.9!important;transform:translateY(-1px)!important;}
        .hero-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(240,242,245,.2);}
        .hero-tag:hover{color:${C.text}!important;border-color:rgba(255,255,255,.2)!important;background:rgba(255,255,255,.04)!important;}
        .price-card:hover{transform:translateY(-4px);}
        .btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(240,242,245,.2);}
        .btn-outline:hover{border-color:rgba(255,255,255,.25)!important;background:rgba(255,255,255,.05)!important;}
        @media(max-width:768px){.nav-links-desktop{display:none!important;}.hamburger{display:flex!important;}}
        @media(max-width:900px){.steps-grid{grid-template-columns:repeat(2,1fr)!important;}.types-grid{grid-template-columns:repeat(2,1fr)!important;}.feat-grid{grid-template-columns:1fr!important;}.testi-grid{grid-template-columns:1fr!important;}.pricing-grid{grid-template-columns:1fr!important;}.footer-grid{grid-template-columns:1fr 1fr!important;}.demo-content{grid-template-columns:1fr!important;}.demo-right-panel{display:none!important;}}
        @media(max-width:600px){.stats-grid{grid-template-columns:repeat(2,1fr)!important;}.hero-input-wrap{flex-direction:column!important;}.hero-btn{width:100%!important;justify-content:center!important;border-radius:10px!important;}.footer-grid{grid-template-columns:1fr!important;}}
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:99,
        padding:"0 clamp(20px,5vw,60px)",height:58,
        display:"flex",alignItems:"center",justifyContent:"space-between",
        background:navScrolled?"rgba(4,6,16,.97)":"rgba(4,6,16,.8)",
        backdropFilter:"blur(20px)",borderBottom:`1px solid ${C.border}`,
        transition:"background .3s",
      }}>
        <button onClick={()=>router.push("/")} style={{display:"flex",alignItems:"center",gap:10,background:"none",border:"none",cursor:"pointer",textDecoration:"none"}}>
          <Logo/>
          <span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:16,color:C.text}}>Krypton AI</span>
        </button>

        {/* Desktop links */}
        <div className="nav-links-desktop" style={{display:"flex",alignItems:"center",gap:6}}>
          {[["#how","How it works"],["#features","Features"],["#pricing","Pricing"]].map(([href,label])=>(
            <a key={href} href={href} style={{fontSize:13,color:C.sub,textDecoration:"none",padding:"6px 14px",borderRadius:8,transition:"all .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.color=C.text;e.currentTarget.style.background="rgba(255,255,255,.05)";}}
              onMouseLeave={e=>{e.currentTarget.style.color=C.sub;e.currentTarget.style.background="transparent";}}
            >{label}</a>
          ))}
          <a href="/login" style={{fontSize:13,color:C.sub,textDecoration:"none",padding:"6px 14px",borderRadius:8}}
            onMouseEnter={e=>{e.currentTarget.style.color=C.text;}} onMouseLeave={e=>{e.currentTarget.style.color=C.sub;}}>Login</a>
          <a href="/signup" className="nav-cta" style={{background:C.grad,color:"#040610",fontWeight:700,fontSize:13,padding:"7px 18px",borderRadius:8,textDecoration:"none",transition:"all .2s"}}>
            Get Started Free
          </a>
        </div>

        {/* Hamburger */}
        <button className="hamburger" onClick={()=>setMobileOpen(o=>!o)}
          style={{display:"none",background:"none",border:"none",color:C.text,cursor:"pointer",fontSize:20,alignItems:"center"}}>
          {mobileOpen?"✕":"☰"}
        </button>

        {/* Mobile menu */}
        {mobileOpen&&(
          <div style={{position:"fixed",top:58,left:0,right:0,bottom:0,background:"rgba(4,6,16,.97)",display:"flex",flexDirection:"column",padding:24,gap:12,zIndex:98}}>
            {[["#how","How it works"],["#features","Features"],["#pricing","Pricing"],["#login","Login"]].map(([href,label])=>(
              <a key={href} href={href} onClick={()=>setMobileOpen(false)}
                style={{fontSize:18,color:C.text,textDecoration:"none",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>{label}</a>
            ))}
            <a href="/signup" style={{background:C.grad,color:"#040610",fontWeight:700,fontSize:15,padding:"14px 28px",borderRadius:10,textDecoration:"none",textAlign:"center",marginTop:8}}>
              Get Started Free
            </a>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section style={{minHeight:"100vh",display:"flex",alignItems:"center",padding:"100px 0 80px",position:"relative",overflow:"hidden"}}>
        {/* Backgrounds */}
        <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"radial-gradient(ellipse 80% 50% at 20% 80%,rgba(240,242,245,.04) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 20%,rgba(200,205,212,.03) 0%,transparent 50%)"}}/>
        <div style={{position:"absolute",inset:0,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)",backgroundSize:"64px 64px",WebkitMaskImage:"radial-gradient(ellipse at center,black 30%,transparent 80%)"}}/>

        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 clamp(20px,5vw,60px)",width:"100%",position:"relative",zIndex:1}}>
          <div style={{textAlign:"center",maxWidth:800,margin:"0 auto"}}>

            {/* Badge */}
            <div className="reveal" style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.06)",border:`1px solid rgba(255,255,255,.12)`,borderRadius:999,padding:"6px 16px",marginBottom:28,fontSize:12,fontWeight:600,color:C.sub}}>
              <span className="hero-badge-dot" style={{width:6,height:6,borderRadius:"50%",background:C.green,display:"inline-block"}}/>
              Powered by Krypton Intelligence Engine
            </div>

            {/* Headline */}
            <h1 className="reveal" style={{fontFamily:"Syne,sans-serif",fontWeight:800,letterSpacing:"-0.03em",lineHeight:1.02,fontSize:"clamp(40px,8vw,88px)",marginBottom:22}}>
              Build Anything<br/>with{" "}
              <span style={{background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
                One Prompt
              </span>
            </h1>

            {/* Sub */}
            <p className="reveal" style={{fontSize:"clamp(16px,2.5vw,20px)",color:C.sub,lineHeight:1.7,maxWidth:560,margin:"0 auto 40px",fontWeight:400}}>
              Krypton AI generates complete, production-ready websites, apps, dashboards, and games — in seconds. No code. No designer. Just describe what you want.
            </p>

            {/* Input */}
            <div className="reveal hero-input-wrap" style={{display:"flex",gap:0,maxWidth:640,margin:"0 auto 36px",background:C.card,border:`1px solid ${C.borderH}`,borderRadius:14,padding:6,boxShadow:`0 0 0 4px rgba(240,242,245,.04),0 24px 48px rgba(0,0,0,.4)`}}>
              <input
                ref={inputRef} value={prompt} onChange={e=>setPrompt(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleGenerate()}
                placeholder="Build a luxury perfume store with cart..."
                style={{flex:1,background:"none",border:"none",outline:"none",color:C.text,fontFamily:"DM Sans,sans-serif",fontSize:15,padding:"12px 16px"}}
              />
              <button className="hero-btn" onClick={handleGenerate}
                style={{background:C.grad,color:"#040610",border:"none",borderRadius:10,padding:"13px 24px",fontFamily:"DM Sans,sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:8,transition:"all .2s"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="#040610" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Build Now
              </button>
            </div>

            {/* Tags */}
            <div className="reveal" style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:56}}>
              {[
                ["🛍️ Luxury Store","Luxury perfume store with cart"],
                ["🎮 Snake Game","Snake game with dark neon theme"],
                ["📊 Dashboard","Analytics dashboard with charts"],
                ["✅ Task App","Task manager kanban board"],
                ["🏋️ Landing Page","Fitness coaching landing page"],
                ["🎨 Portfolio","Creative photographer portfolio"],
              ].map(([label,p])=>(
                <button key={label} className="hero-tag" onClick={()=>setQuickPrompt(p)}
                  style={{fontSize:12,color:C.muted,padding:"5px 14px",border:`1px solid ${C.border}`,borderRadius:999,cursor:"pointer",background:"none",transition:"all .15s"}}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGOS ── */}
      <div style={{padding:"0 0 80px",textAlign:"center"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 clamp(20px,5vw,60px)"}}>
          <p style={{fontSize:12,color:C.muted,letterSpacing:".12em",textTransform:"uppercase",marginBottom:24}}>Trusted technology</p>
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:48,flexWrap:"wrap",opacity:.35}}>
            {["Krypton AI","Supabase","Vercel","Next.js","TypeScript"].map(n=>(
              <span key={n} style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:16,color:C.text}}>{n}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{padding:"0 0 100px"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 clamp(20px,5vw,60px)"}}>
          <div className="reveal stats-grid" id="stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:C.border,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
            {[
              {id:"s1",label:"Websites Generated"},
              {id:"s2",label:"Games Created"},
              {id:"s3",label:"Avg Generation Time"},
              {id:"s4",label:"Components Available"},
            ].map(s=>(
              <div key={s.id} style={{background:C.card,padding:"32px 24px",textAlign:"center"}}>
                <div id={s.id} style={{fontFamily:"Syne,sans-serif",fontSize:36,fontWeight:800,background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",marginBottom:6}}>0</div>
                <div style={{fontSize:13,color:C.sub}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{padding:"0 0 100px"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 clamp(20px,5vw,60px)"}}>
          <p className="reveal" style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.sub,marginBottom:14}}>How it works</p>
          <h2 className="reveal" style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:"clamp(28px,4vw,48px)",letterSpacing:"-.02em",marginBottom:56}}>
            From idea to live site<br/>in{" "}
            <span style={{background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>under 60 seconds</span>
          </h2>
          <div className="steps-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18}}>
            {[
              {num:"STEP 01",icon:"💬",title:"Describe Your Idea",desc:"Type anything — a business name, a concept, a niche. Krypton AI understands exactly what you want to build."},
              {num:"STEP 02",icon:"🧠",title:"AI Designs & Codes",desc:"Krypton Intelligence Engine generates responsive HTML, CSS & JavaScript — premium quality, production-ready."},
              {num:"STEP 03",icon:"✏️",title:"Edit with Chat",desc:"Say "make the header dark" — AI makes surgical edits while preserving your colors, fonts, and layout."},
              {num:"STEP 04",icon:"🚀",title:"Download & Launch",desc:"Download the complete file and deploy anywhere — Netlify, Vercel, GitHub Pages, or any hosting platform."},
            ].map(s=>(
              <div key={s.num} className="reveal step-card" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:28,transition:"all .25s",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(255,255,255,.025),transparent)",pointerEvents:"none"}}/>
                <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:11,color:C.muted,marginBottom:14,letterSpacing:".08em"}}>{s.num}</div>
                <div style={{fontSize:28,marginBottom:14}}>{s.icon}</div>
                <h3 style={{fontFamily:"Syne,sans-serif",fontSize:16,fontWeight:700,marginBottom:8}}>{s.title}</h3>
                <p style={{fontSize:13,color:C.sub,lineHeight:1.7}}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUILD TYPES ── */}
      <section style={{padding:"0 0 100px"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 clamp(20px,5vw,60px)"}}>
          <p className="reveal" style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.sub,marginBottom:14}}>What you can build</p>
          <h2 className="reveal" style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:"clamp(28px,4vw,48px)",letterSpacing:"-.02em",marginBottom:56}}>
            One platform,<br/>
            <span style={{background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>infinite possibilities</span>
          </h2>
          <div className="types-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
            {[
      {icon:"🌐",name:"Websites",desc:"Business sites, agencies, SaaS — fully responsive and SEO-ready.",prompt:"Modern SaaS landing page with pricing"},
              {icon:"🎮",name:"Games",desc:"Browser games — Snake, Platformer, Shooter — fully playable instantly.",prompt:"Snake game with dark neon theme"},
              {icon:"📊",name:"Dashboards",desc:"Admin panels, analytics boards with real data visualization.",prompt:"Analytics dashboard with charts"},
              {icon:"🛒",name:"E-Commerce",desc:"Product showcases, luxury stores — ready to integrate payments.",prompt:"Luxury perfume e-commerce store"},
              {icon:"📱",name:"Web Apps",desc:"Task managers, kanban boards, productivity tools with full interactivity.",prompt:"Task manager kanban board app"},
              {icon:"🎨",name:"Portfolios",desc:"Showcase your work with masonry grids and filter galleries.",prompt:"Creative photographer portfolio"},
              {icon:"🚀",name:"Landing Pages",desc:"High-converting launch pages with hero, features, and pricing.",prompt:"SaaS product landing page"},
              {icon:"🍽️",name:"Business Sites",desc:"Restaurants, gyms, salons — niche-aware design every time.",prompt:"Restaurant website with menu"},
            ].map(t=>(
              <div key={t.name} className="reveal type-card" onClick={()=>setQuickPrompt(t.prompt)}
                style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"24px 20px",cursor:"pointer",transition:"all .25s",textAlign:"left"}}>
                <span style={{fontSize:24,marginBottom:12,display:"block"}}>{t.icon}</span>
                <div style={{fontFamily:"Syne,sans-serif",fontSize:15,fontWeight:700,marginBottom:6}}>{t.name}</div>
                <div style={{fontSize:12,color:C.sub,lineHeight:1.6}}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO ── */}
      <section style={{padding:"0 0 100px"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 clamp(20px,5vw,60px)"}}>
          <p className="reveal" style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.sub,marginBottom:14,textAlign:"center"}}>Live preview</p>
          <h2 className="reveal" style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:"clamp(28px,4vw,48px)",letterSpacing:"-.02em",marginBottom:56,textAlign:"center"}}>
            Watch it generate<br/>
            <span style={{background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>in real time</span>
          </h2>
          <div className="reveal" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,overflow:"hidden"}}>
            {/* Bar */}
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"14px 20px",borderBottom:`1px solid ${C.border}`,background:"rgba(255,255,255,.02)"}}>
              {["#FF5F57","#FEBC2E","#28C840"].map(c=><div key={c} style={{width:11,height:11,borderRadius:"50%",background:c}}/>)}
              <span style={{fontSize:12,color:C.muted,marginLeft:8,fontFamily:"JetBrains Mono,monospace"}}>kryptonai.tech/create</span>
            </div>
            {/* Content */}
            <div className="demo-content" style={{display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:300}}>
              <div style={{padding:32,borderRight:`1px solid ${C.border}`}}>
                <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:13,color:C.sub,marginBottom:20}}>
                  $ <span style={{color:C.text}}>"Build a luxury perfume store"</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {phases.map((ph,i)=>{
                    const state = i < phaseIdx ? "done" : i === phaseIdx ? "active" : "pending";
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,fontSize:13}}>
                        <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:state==="done"?"#4CAF8A":state==="active"?"#F0F2F5":"#45505E",transition:"all .3s"}}/>
                        <span style={{color:state==="done"?C.sub:state==="active"?C.text:C.muted,fontWeight:state==="active"?600:400,transition:"all .3s"}}>{ph.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="demo-right-panel" style={{padding:32,background:"rgba(255,255,255,.01)"}}>
                <div style={{background:C.card2,borderRadius:10,border:`1px solid ${C.border}`,height:"100%",minHeight:220,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
                  <div style={{textAlign:"center",position:"relative",zIndex:1}}>
                    <div style={{fontFamily:"Syne,sans-serif",fontSize:22,fontWeight:800,marginBottom:8,background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>PARFUM LUXE</div>
                    <div style={{fontSize:12,color:C.sub,marginBottom:16}}>Fine Fragrances Collection</div>
                    <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                      <span style={{fontSize:11,padding:"4px 12px",border:"1px solid rgba(201,168,76,.3)",borderRadius:999,color:"#C9A84C"}}>Shop Now</span>
                      <span style={{fontSize:11,padding:"4px 12px",border:`1px solid ${C.border}`,borderRadius:999,color:C.muted}}>Explore</span>
                    </div>
                  </div>
                  <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at center,rgba(201,168,76,.06),transparent)",pointerEvents:"none"}}/>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{padding:"0 0 100px"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 clamp(20px,5vw,60px)"}}>
          <p className="reveal" style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.sub,marginBottom:14}}>Why Krypton AI</p>
          <h2 className="reveal" style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:"clamp(28px,4vw,48px)",letterSpacing:"-.02em",marginBottom:56}}>
            Everything you need,<br/>
            <span style={{background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>nothing you don't</span>
          </h2>
          <div className="feat-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18}}>
            {[
              {icon:"⚡",title:"Krypton Intelligence Engine",desc:"Our proprietary AI pipeline generates premium output every time — fast, reliable, and production-ready."},
              {icon:"📦",title:"46+ Premium Components",desc:"Production-ready hero sections, pricing tables, testimonials, FAQ accordions — assembled per your niche."},
              {icon:"🎮",title:"Game Engine",desc:"Full browser games with polished UI, mobile D-pad, score tracking, and level progression — one prompt away."},
              {icon:"✏️",title:"AI Chat Editing",desc:"Edit any part of your website by describing the change. Memory system preserves your colors and style."},
              {icon:"👁️",title:"Vision Review",desc:"AI screenshots your website, reviews it for issues — broken layouts, cut text — and suggests fixes."},
              {icon:"📱",title:"Always Responsive",desc:"Every generation is tested at 375px, 768px, and 1440px. Mobile-first layouts that work everywhere."},
            ].map(f=>(
              <div key={f.title} className="reveal feat-card" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:28,transition:"all .25s"}}>
                <div style={{fontSize:24,marginBottom:16}}>{f.icon}</div>
                <h3 style={{fontFamily:"Syne,sans-serif",fontSize:16,fontWeight:700,marginBottom:10}}>{f.title}</h3>
                <p style={{fontSize:13,color:C.sub,lineHeight:1.75}}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{padding:"0 0 100px"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 clamp(20px,5vw,60px)"}}>
          <p className="reveal" style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.sub,marginBottom:14,textAlign:"center"}}>What users say</p>
          <h2 className="reveal" style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:"clamp(28px,4vw,48px)",letterSpacing:"-.02em",marginBottom:56,textAlign:"center"}}>
            Loved by builders<br/>
            <span style={{background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>worldwide</span>
          </h2>
          <div className="testi-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18}}>
            {[
              {init:"A",name:"Arjun Mehta",role:"E-Commerce Founder",text:"Generated a complete luxury perfume store in under a minute. The quality was unbelievable — sections, animations, mobile layout, everything perfect."},
              {init:"S",name:"Sarah Chen",role:"Freelance Developer",text:"I needed a Snake game for my client's product launch. Krypton AI built it in 45 seconds — with dark theme and mobile controls. Client loved it."},
              {init:"R",name:"Rahul Sharma",role:"Product Designer",text:"The AI editing is what sold me. I said 'make the header dark' — it updated exactly that and nothing else. Memory system is incredibly smart."},
            ].map(t=>(
              <div key={t.name} className="reveal testi-card" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:26,transition:"all .25s"}}>
                <div style={{color:"#F59E0B",fontSize:12,marginBottom:14,letterSpacing:2}}>★★★★★</div>
                <p style={{fontSize:14,color:C.text,lineHeight:1.75,marginBottom:20,fontStyle:"italic"}}>"{t.text}"</p>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"#040610",background:C.grad,flexShrink:0}}>{t.init}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700}}>{t.name}</div>
                    <div style={{fontSize:11,color:C.sub,marginTop:2}}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{padding:"0 0 100px"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 clamp(20px,5vw,60px)"}}>
          <p className="reveal" style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.sub,marginBottom:14,textAlign:"center"}}>Simple pricing</p>
          <h2 className="reveal" style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:"clamp(28px,4vw,48px)",letterSpacing:"-.02em",marginBottom:56,textAlign:"center"}}>
            Start free,<br/>
            <span style={{background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>scale as you grow</span>
          </h2>
          <div className="pricing-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18,maxWidth:900,margin:"0 auto"}}>
            {[
              {name:"Starter",price:"Free",period:"Forever free",featured:false,features:["5 generations/month","Websites, games, apps","Download HTML","AI chat editing","46+ components"],cta:"Get Started Free",href:"/signup"},
              {name:"Pro",price:"₹999",period:"per month",featured:true,badge:"Most Popular",features:["100 generations/month","Priority Krypton AI","Vision review system","Premium templates","Version history","Early access"],cta:"Start Pro →",href:"/signup"},
              {name:"Agency",price:"₹2499",period:"per month",featured:false,features:["Unlimited generations","Team collaboration","White-label export","API access","Priority support","Custom templates"],cta:"Contact Sales",href:"/signup"},
            ].map(p=>(
              <div key={p.name} className="reveal price-card" style={{background:p.featured?C.card2:C.card,border:`1px solid ${p.featured?"rgba(240,242,245,.25)":C.border}`,borderRadius:18,padding:32,transition:"all .25s",position:"relative"}}>
                {p.badge&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:C.grad,color:"#040610",fontSize:10,fontWeight:700,padding:"3px 14px",borderRadius:999,letterSpacing:".08em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{p.badge}</div>}
                <div style={{fontFamily:"Syne,sans-serif",fontSize:16,fontWeight:700,marginBottom:8}}>{p.name}</div>
                <div style={{fontFamily:"Syne,sans-serif",fontSize:42,fontWeight:800,letterSpacing:"-.03em",marginBottom:4,background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{p.price}</div>
                <div style={{fontSize:13,color:C.sub,marginBottom:24}}>{p.period}</div>
                <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
                  {p.features.map(f=>(
                    <li key={f} style={{fontSize:13,display:"flex",alignItems:"center",gap:10}}>
                      <span style={{color:"#4CAF8A",fontWeight:700,fontSize:12}}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button onClick={()=>router.push(p.href)}
                  style={{width:"100%",padding:13,borderRadius:10,fontFamily:"DM Sans,sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",border:p.featured?"none":`1px solid ${C.border}`,background:p.featured?C.grad:"rgba(255,255,255,.07)",color:p.featured?"#040610":C.text,transition:"all .2s"}}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{padding:"0 0 100px"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 clamp(20px,5vw,60px)"}}>
          <div className="reveal" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:24,padding:"clamp(48px,8vw,80px)",textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at center,rgba(255,255,255,.04),transparent 70%)",pointerEvents:"none"}}/>
            <h2 className="display" style={{fontFamily:"Syne,sans-serif",fontSize:"clamp(28px,5vw,52px)",fontWeight:800,letterSpacing:"-.02em",marginBottom:16,position:"relative"}}>
              Ready to build<br/>
              <span style={{background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>something amazing?</span>
            </h2>
            <p style={{fontSize:16,color:C.sub,marginBottom:36,maxWidth:440,marginLeft:"auto",marginRight:"auto",position:"relative"}}>
              Join thousands of creators. Free to start — no credit card required.
            </p>
            <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",position:"relative"}}>
              <button className="btn-primary" onClick={()=>router.push("/signup")}
                style={{background:C.grad,color:"#040610",border:"none",padding:"14px 32px",borderRadius:10,fontFamily:"DM Sans,sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",transition:"all .2s"}}>
                Start Building Free →
              </button>
              <a href="#how" className="btn-outline"
                style={{background:"transparent",color:C.text,border:`1px solid ${C.border}`,padding:"14px 32px",borderRadius:10,fontFamily:"DM Sans,sans-serif",fontWeight:600,fontSize:15,cursor:"pointer",transition:"all .2s",textDecoration:"none",display:"inline-flex",alignItems:"center"}}>
                See How It Works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{padding:"clamp(48px,6vw,80px) 0 28px",borderTop:`1px solid ${C.border}`}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:"0 clamp(20px,5vw,60px)"}}>
          <div className="footer-grid" style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr",gap:48,marginBottom:48}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><Logo/><span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:16}}>Krypton AI</span></div>
              <p style={{fontSize:13,color:C.sub,lineHeight:1.75,maxWidth:220}}>Build websites, apps, and games with AI — in seconds.</p>
            </div>
            {[
              {title:"Product",links:[["#how","How It Works"],["#features","Features"],["#pricing","Pricing"],["/create","Try Now"]]},
              {title:"Build",links:[["/create","Websites"],["/create","Games"],["/create","Dashboards"],["/create","Landing Pages"]]},
              {title:"Account",links:[["/login","Login"],["/signup","Sign Up"],["/billing","Billing"],["mailto:support@kryptonai.tech","Support"]]},
            ].map(col=>(
              <div key={col.title}>
                <h4 style={{fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.muted,marginBottom:14}}>{col.title}</h4>
                <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:9}}>
                  {col.links.map(([href,label])=>(
                    <li key={label}><a href={href} style={{fontSize:13,color:C.sub,textDecoration:"none",transition:"color .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.color=C.text} onMouseLeave={e=>e.currentTarget.style.color=C.sub}>{label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:24,borderTop:`1px solid ${C.border}`,flexWrap:"wrap",gap:12}}>
            <p style={{fontSize:12,color:C.muted}}>&copy; 2026 Krypton AI. All rights reserved.</p>
            <p style={{fontSize:12,color:C.muted}}>Powered by Krypton Intelligence Engine</p>
          </div>
        </div>
      </footer>
    </>
  );
}
