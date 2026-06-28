"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// CSS defined as module-level const — NOT inside JSX template literal
// This avoids SWC parser confusion with CSS braces inside JSX
const PAGE_CSS = [
  "@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');",
  "*{box-sizing:border-box;margin:0;padding:0;}",
  "html{scroll-behavior:smooth;}",
  "body{background:#040610;color:#F0F2F5;font-family:'DM Sans',sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased;}",
  "::-webkit-scrollbar{width:2px;}",
  "::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px;}",
  ".reveal{opacity:0;transform:translateY(28px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);}",
  ".reveal.vis{opacity:1;transform:none;}",
  "@keyframes pulse{0%,100%{opacity:.3;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}",
  "@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}",
  ".hero-badge-dot{animation:pulse 2s infinite;}",
  ".step-card:hover,.type-card:hover,.feat-card:hover,.testi-card:hover{border-color:rgba(255,255,255,.18)!important;transform:translateY(-3px)!important;}",
  ".nav-cta:hover{opacity:.9!important;transform:translateY(-1px)!important;}",
  ".hero-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(240,242,245,.2);}",
  ".hero-tag:hover{color:#F0F2F5!important;border-color:rgba(255,255,255,.2)!important;background:rgba(255,255,255,.04)!important;}",
  ".price-card:hover{transform:translateY(-4px);}",
  ".btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(240,242,245,.2);}",
  ".btn-outline:hover{border-color:rgba(255,255,255,.25)!important;background:rgba(255,255,255,.05)!important;}",
  "@media(max-width:768px){.nav-links-desktop{display:none!important;}.hamburger{display:flex!important;}}",
  "@media(max-width:900px){.steps-grid{grid-template-columns:repeat(2,1fr)!important;}.types-grid{grid-template-columns:repeat(2,1fr)!important;}.feat-grid{grid-template-columns:1fr!important;}.testi-grid{grid-template-columns:1fr!important;}.pricing-grid{grid-template-columns:1fr!important;}.footer-grid{grid-template-columns:1fr 1fr!important;}.demo-content{grid-template-columns:1fr!important;}.demo-right-panel{display:none!important;}}",
  "@media(max-width:600px){.stats-grid{grid-template-columns:repeat(2,1fr)!important;}.hero-input-wrap{flex-direction:column!important;}.hero-btn{width:100%!important;justify-content:center!important;border-radius:10px!important;}.footer-grid{grid-template-columns:1fr!important;}}",
].join("\n");

const C = {
  bg:"#040610", surf:"#070B16", card:"#0C1020", card2:"#101525",
  border:"rgba(255,255,255,0.07)", borderH:"rgba(255,255,255,0.16)",
  text:"#F0F2F5", sub:"#8892A0", muted:"#45505E",
  grad:"linear-gradient(135deg,#F0F2F5 0%,#C8CDD4 50%,#A8B0BA 100%)",
  green:"#4CAF8A",
};

// Logo SVG as plain string to avoid JSX parser issues with <defs>/<linearGradient>
function KryptonLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="9" fill="#050816"/>
      <line x1="20" y1="20" x2="9" y2="9" stroke="#D9D9D9" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
      <line x1="20" y1="20" x2="31" y2="9" stroke="#D9D9D9" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
      <line x1="20" y1="20" x2="9" y2="31" stroke="#D9D9D9" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
      <line x1="20" y1="20" x2="31" y2="31" stroke="#D9D9D9" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
      <circle cx="9" cy="9" r="2.6" fill="#F5F5F5"/>
      <circle cx="31" cy="9" r="2.6" fill="#F5F5F5"/>
      <circle cx="9" cy="31" r="2.6" fill="#F5F5F5"/>
      <circle cx="31" cy="31" r="2.6" fill="#F5F5F5"/>
      <circle cx="20" cy="20" r="4" fill="#050816"/>
      <circle cx="20" cy="20" r="3" fill="#F5F5F5"/>
    </svg>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(2);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setPhaseIdx(p => (p >= 4 ? 1 : p + 1)), 1800);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("vis"); obs.unobserve(e.target); } }),
      { threshold: 0.08 }
    );
    document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

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

  const setQ = (p: string) => { setPrompt(p); inputRef.current?.focus(); };

  const phases = [
    "Blueprint analysis complete",
    "Design system generated",
    "Building components...",
    "Quality gate check",
    "Ready to download",
  ];

  return (
    <>
      <style>{PAGE_CSS}</style>

      {/* NAV */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:99, padding:"0 clamp(20px,5vw,60px)", height:58, display:"flex", alignItems:"center", justifyContent:"space-between", background:navScrolled?"rgba(4,6,16,.97)":"rgba(4,6,16,.8)", backdropFilter:"blur(20px)", borderBottom:`1px solid ${C.border}`, transition:"background .3s" }}>
        <button onClick={() => router.push("/")} style={{ display:"flex", alignItems:"center", gap:10, background:"none", border:"none", cursor:"pointer" }}>
          <KryptonLogo />
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, color:C.text }}>Krypton AI</span>
        </button>
        <div className="nav-links-desktop" style={{ display:"flex", alignItems:"center", gap:6 }}>
          {[["#how","How it works"],["#features","Features"],["#pricing","Pricing"]].map(([href,label]) => (
            <a key={href} href={href} style={{ fontSize:13, color:C.sub, textDecoration:"none", padding:"6px 14px", borderRadius:8 }}>{label}</a>
          ))}
          <a href="/login" style={{ fontSize:13, color:C.sub, textDecoration:"none", padding:"6px 14px" }}>Login</a>
          <a href="/signup" className="nav-cta" style={{ background:C.grad, color:"#040610", fontWeight:700, fontSize:13, padding:"7px 18px", borderRadius:8, textDecoration:"none" }}>Get Started Free</a>
        </div>
        <button className="hamburger" onClick={() => setMobileOpen(o => !o)} style={{ display:"none", background:"none", border:"none", color:C.text, cursor:"pointer", fontSize:20, alignItems:"center" }}>
          {mobileOpen ? "✕" : "☰"}
        </button>
        {mobileOpen && (
          <div style={{ position:"fixed", top:58, left:0, right:0, bottom:0, background:"rgba(4,6,16,.97)", display:"flex", flexDirection:"column", padding:24, gap:12, zIndex:98 }}>
            {[["#how","How it works"],["#features","Features"],["#pricing","Pricing"],["/login","Login"]].map(([href,label]) => (
              <a key={href} href={href} onClick={() => setMobileOpen(false)} style={{ fontSize:18, color:C.text, textDecoration:"none", padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>{label}</a>
            ))}
            <a href="/signup" style={{ background:C.grad, color:"#040610", fontWeight:700, fontSize:15, padding:"14px 28px", borderRadius:10, textDecoration:"none", textAlign:"center", marginTop:8 }}>Get Started Free</a>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section style={{ minHeight:"100vh", display:"flex", alignItems:"center", padding:"100px 0 80px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(ellipse 80% 50% at 20% 80%,rgba(240,242,245,.04) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 20%,rgba(200,205,212,.03) 0%,transparent 50%)" }}/>
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:"linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)", backgroundSize:"64px 64px", WebkitMaskImage:"radial-gradient(ellipse at center,black 30%,transparent 80%)" }}/>
        <div style={{ maxWidth:1160, margin:"0 auto", padding:"0 clamp(20px,5vw,60px)", width:"100%", position:"relative", zIndex:1 }}>
          <div style={{ textAlign:"center", maxWidth:800, margin:"0 auto" }}>
            <div className="reveal" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,.06)", border:`1px solid rgba(255,255,255,.12)`, borderRadius:999, padding:"6px 16px", marginBottom:28, fontSize:12, fontWeight:600, color:C.sub }}>
              <span className="hero-badge-dot" style={{ width:6, height:6, borderRadius:"50%", background:C.green, display:"inline-block" }}/>
              Powered by Krypton Intelligence Engine
            </div>
            <h1 className="reveal" style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, letterSpacing:"-0.03em", lineHeight:1.02, fontSize:"clamp(40px,8vw,88px)", marginBottom:22 }}>
              Build Anything<br/>with{" "}
              <span style={{ background:C.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>One Prompt</span>
            </h1>
            <p className="reveal" style={{ fontSize:"clamp(16px,2.5vw,20px)", color:C.sub, lineHeight:1.7, maxWidth:560, margin:"0 auto 40px", fontWeight:400 }}>
              Krypton AI generates complete, production-ready websites, apps, dashboards, and games in seconds. No code. No designer. Just describe what you want.
            </p>
            <div className="reveal hero-input-wrap" style={{ display:"flex", gap:0, maxWidth:640, margin:"0 auto 36px", background:C.card, border:`1px solid ${C.borderH}`, borderRadius:14, padding:6, boxShadow:`0 0 0 4px rgba(240,242,245,.04),0 24px 48px rgba(0,0,0,.4)` }}>
              <input ref={inputRef} value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && handleGenerate()} placeholder="Build a luxury perfume store with cart..." style={{ flex:1, background:"none", border:"none", outline:"none", color:C.text, fontFamily:"'DM Sans',sans-serif", fontSize:15, padding:"12px 16px" }}/>
              <button className="hero-btn" onClick={handleGenerate} style={{ background:C.grad, color:"#040610", border:"none", borderRadius:10, padding:"13px 24px", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:14, cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:8, transition:"all .2s" }}>
                Build Now
              </button>
            </div>
            <div className="reveal" style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:56 }}>
              {[["🛍️ Luxury Store","Luxury perfume store with cart"],["🎮 Snake Game","Snake game with dark neon theme"],["📊 Dashboard","Analytics dashboard with charts"],["✅ Task App","Task manager kanban board"],["🏋️ Landing Page","Fitness coaching landing page"],["🎨 Portfolio","Creative photographer portfolio"]].map(([label,p]) => (
                <button key={label} className="hero-tag" onClick={() => setQ(p as string)} style={{ fontSize:12, color:C.muted, padding:"5px 14px", border:`1px solid ${C.border}`, borderRadius:999, cursor:"pointer", background:"none", transition:"all .15s" }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div style={{ padding:"0 0 80px" }}>
        <div style={{ maxWidth:1160, margin:"0 auto", padding:"0 clamp(20px,5vw,60px)" }}>
          <div className="reveal stats-grid" id="stats-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:1, background:C.border, border:`1px solid ${C.border}`, borderRadius:16, overflow:"hidden" }}>
            {[{id:"s1",label:"Websites Generated"},{id:"s2",label:"Games Created"},{id:"s3",label:"Avg Generation Time"},{id:"s4",label:"Components Available"}].map(s => (
              <div key={s.id} style={{ background:C.card, padding:"32px 24px", textAlign:"center" }}>
                <div id={s.id} style={{ fontFamily:"'Syne',sans-serif", fontSize:36, fontWeight:800, background:C.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", marginBottom:6 }}>0</div>
                <div style={{ fontSize:13, color:C.sub }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRICING */}
      <section id="pricing" style={{ padding:"0 0 100px" }}>
        <div style={{ maxWidth:1160, margin:"0 auto", padding:"0 clamp(20px,5vw,60px)" }}>
          <p className="reveal" style={{ fontSize:11, fontWeight:700, letterSpacing:".14em", textTransform:"uppercase", color:C.sub, marginBottom:14, textAlign:"center" }}>Simple pricing</p>
          <h2 className="reveal" style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:"clamp(28px,4vw,48px)", letterSpacing:"-.02em", marginBottom:56, textAlign:"center" }}>
            Start free,{" "}<span style={{ background:C.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>scale as you grow</span>
          </h2>
          <div className="pricing-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:18, maxWidth:900, margin:"0 auto" }}>
            {[
              { name:"Free", price:"$0", period:"forever", featured:false, features:["20 Generations / Day","Website Generator","App Generator","Game Generator","Live Preview","Download HTML"], cta:"Get Started Free" },
              { name:"Pro", price:"$25", period:"per month", featured:true, badge:"Most Popular", features:["100 Generations / Month","Everything in Free","Save Projects","Faster Generation","Better AI Quality","Premium Templates","Email Support"], cta:"Upgrade to Pro →" },
              { name:"Premium", price:"$69", period:"per month", featured:false, features:["300 Generations / Month","Everything in Pro","Fastest AI Model","Version History","Team (5 Users)","Screenshot to App","Priority Support"], cta:"Upgrade to Premium" },
            ].map(p => (
              <div key={p.name} className="price-card reveal" style={{ background:p.featured?C.card2:C.card, border:`1px solid ${p.featured?"rgba(240,242,245,.25)":C.border}`, borderRadius:18, padding:32, transition:"all .25s", position:"relative" }}>
                {p.featured && <div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", background:C.grad, color:"#040610", fontSize:10, fontWeight:700, padding:"3px 14px", borderRadius:999, letterSpacing:".08em", textTransform:"uppercase", whiteSpace:"nowrap" }}>Most Popular</div>}
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:8 }}>{p.name}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:42, fontWeight:800, letterSpacing:"-.03em", marginBottom:4, background:C.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>{p.price}</div>
                <div style={{ fontSize:13, color:C.sub, marginBottom:24 }}>{p.period}</div>
                <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:10, marginBottom:28 }}>
                  {p.features.map(f => <li key={f} style={{ fontSize:13, display:"flex", alignItems:"center", gap:10 }}><span style={{ color:"#4CAF8A", fontWeight:700, fontSize:12 }}>✓</span>{f}</li>)}
                </ul>
                <button onClick={() => router.push("/signup")} style={{ width:"100%", padding:13, borderRadius:10, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:14, cursor:"pointer", border:p.featured?"none":`1px solid ${C.border}`, background:p.featured?C.grad:"rgba(255,255,255,.07)", color:p.featured?"#040610":C.text, transition:"all .2s" }}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding:"0 0 100px" }}>
        <div style={{ maxWidth:1160, margin:"0 auto", padding:"0 clamp(20px,5vw,60px)" }}>
          <div className="reveal" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:24, padding:"clamp(48px,8vw,80px)", textAlign:"center", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at center,rgba(255,255,255,.04),transparent 70%)", pointerEvents:"none" }}/>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(28px,5vw,52px)", fontWeight:800, letterSpacing:"-.02em", marginBottom:16, position:"relative" }}>
              Ready to build<br/><span style={{ background:C.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>something amazing?</span>
            </h2>
            <p style={{ fontSize:16, color:C.sub, marginBottom:36, maxWidth:440, marginLeft:"auto", marginRight:"auto", position:"relative" }}>
              Join thousands of creators. Free to start — no credit card required.
            </p>
            <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", position:"relative" }}>
              <button className="btn-primary" onClick={() => router.push("/signup")} style={{ background:C.grad, color:"#040610", border:"none", padding:"14px 32px", borderRadius:10, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:15, cursor:"pointer", transition:"all .2s" }}>
                Start Building Free →
              </button>
              <a href="#pricing" className="btn-outline" style={{ background:"transparent", color:C.text, border:`1px solid ${C.border}`, padding:"14px 32px", borderRadius:10, fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:15, cursor:"pointer", transition:"all .2s", textDecoration:"none", display:"inline-flex", alignItems:"center" }}>
                View Pricing
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding:"clamp(48px,6vw,80px) 0 28px", borderTop:`1px solid ${C.border}` }}>
        <div style={{ maxWidth:1160, margin:"0 auto", padding:"0 clamp(20px,5vw,60px)" }}>
          <div className="footer-grid" style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 1fr", gap:48, marginBottom:48 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <KryptonLogo /><span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16 }}>Krypton AI</span>
              </div>
              <p style={{ fontSize:13, color:C.sub, lineHeight:1.75, maxWidth:220 }}>Build websites, apps, and games with AI in seconds.</p>
            </div>
            {[{title:"Product",links:[["#pricing","Pricing"],["/create","Try Now"]]},{title:"Build",links:[["/create","Websites"],["/create","Games"]]},{title:"Account",links:[["/login","Login"],["/signup","Sign Up"]]}].map(col => (
              <div key={col.title}>
                <h4 style={{ fontSize:11, fontWeight:700, letterSpacing:".12em", textTransform:"uppercase", color:C.muted, marginBottom:14 }}>{col.title}</h4>
                <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:9 }}>
                  {col.links.map(([href,label]) => <li key={label}><a href={href} style={{ fontSize:13, color:C.sub, textDecoration:"none" }}>{label}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", paddingTop:24, borderTop:`1px solid ${C.border}`, flexWrap:"wrap", gap:12 }}>
            <p style={{ fontSize:12, color:C.muted }}>© 2026 Krypton AI. All rights reserved.</p>
            <p style={{ fontSize:12, color:C.muted }}>Powered by Krypton Intelligence Engine</p>
          </div>
        </div>
      </footer>
    </>
  );
}
