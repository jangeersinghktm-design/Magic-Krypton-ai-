"use client";

import { useState, useEffect, useCallback, useRef, CSSProperties } from "react";
import { useRouter } from "next/navigation";

/* ── Themes ── */
const THEMES = [
  { a:"#F5C542",b:"#00D084" },
  { a:"#8B5CF6",b:"#EC4899" },
  { a:"#FACC15",b:"#FB923C" },
  { a:"#3B82F6",b:"#06B6D4" },
  { a:"#7C3AED",b:"#2563EB" },
  { a:"#10B981",b:"#14B8A6" },
];

/* ── Colors ── */
const BG="#050505", CARD="#0D0D0D", WHITE="#FFFFFF", SUB="#A0A0A0", MUTED="#6B7280";

/* ── Data ── */
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
  { icon:"🌐", title:"Websites",       desc:"Landing pages, portfolios, business sites — pixel-perfect and responsive." },
  { icon:"⚙️", title:"Web Apps",       desc:"Dashboards, CRM tools, productivity apps with full interactivity." },
  { icon:"🎮", title:"Browser Games",  desc:"Snake, 2048, puzzle games — fully playable in the browser." },
  { icon:"🧰", title:"Business Tools", desc:"Calculators, forms, trackers — tools that actually work." },
];

const STATS = [
  { value:12000, label:"Projects Generated", suffix:"+" },
  { value:98,    label:"Satisfaction Rate",   suffix:"%" },
  { value:8,     label:"Seconds to Build",    suffix:"s"  },
  { value:22,    label:"Premium Templates",   suffix:"+"  },
];

const MARQUEE = [
  "🌐 Websites","⚙️ Web Apps","🎮 Browser Games","📊 Dashboards",
  "🛒 E-Commerce","📝 Forms & Tools","💼 Portfolios","📈 Analytics",
  "🤖 AI Features","📱 Mobile-First","🔒 Secure Output","⚡ Instant Build",
];

const PLANS = [
  { name:"Free",     emoji:"🟢", m:"$0",   y:"$0",   credits:"5 / Day",     hot:false, cta:"Get Started Free",
    inc:["Website Generator","App Generator","Game Generator","Live Preview","Download HTML","Community Support"],
    off:["Save Projects","Project History","Advanced AI","Team Workspace","API Access"] },
  { name:"Pro",      emoji:"🔥", m:"$25",  y:"$20",  credits:"100 / Month",  hot:true,  cta:"Start Pro",
    inc:["Everything in Free","Save Projects","Project History","Faster Generation","Better AI","Export Code","Premium Templates","Email Support"],
    off:["Team Workspace","API Access"] },
  { name:"Premium",  emoji:"💎", m:"$69",  y:"$55",  credits:"300 / Month",  hot:false, cta:"Start Premium",
    inc:["Everything in Pro","Fastest AI","Unlimited Saves","Version History","Team (5 Users)","Priority Support"],
    off:["API Access"] },
  { name:"Business", emoji:"🏢", m:"$149", y:"$119", credits:"100 / Day",    hot:false, cta:"Contact Us",
    inc:["Everything in Premium","API Access","Unlimited Team","Admin Dashboard","White Label","Business SLA"],
    off:[] },
];

const TESTIMONIALS = [
  { stars:5, text:"Generated my startup landing page in 2 minutes. Absolutely incredible.", name:"Alex",  role:"Founder" },
  { stars:5, text:"Much faster than hiring freelancers. The quality is production-ready.",   name:"Sarah", role:"Designer" },
  { stars:5, text:"Built a full CRM with Krypton AI in one afternoon. Game changer.",        name:"Raj",   role:"Product Manager" },
];

const FAQS = [
  { q:"What can Krypton AI build?",  a:"Websites, web apps, browser games, dashboards, calculators, portfolios — all production-ready HTML." },
  { q:"How does Krypton AI work?",   a:"Describe what you want in plain English. Krypton AI transforms your idea into a complete, responsive project in seconds." },
  { q:"Can I download the code?",    a:"Yes. Every project downloads as a complete HTML file, ready to deploy anywhere." },
  { q:"Do I need coding skills?",    a:"No. Just describe what you want and Krypton AI generates it instantly." },
  { q:"Is Krypton AI reliable?",     a:"Yes — built for speed, accuracy, and reliability." },
];

/* ── Helpers ── */
function lerp(a:number,b:number,t:number){return a+(b-a)*t;}
function h2r(h:string){return[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));}
function r2h(r:number,g:number,b:number){return"#"+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join("");}

/* ── Animated counter ── */
function Counter({value,suffix,label}:{value:number;suffix:string;label:string}){
  const[n,sn]=useState(0);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    const obs=new IntersectionObserver(([e])=>{
      if(!e.isIntersecting)return;obs.disconnect();
      const t0=performance.now();
      const step=(now:number)=>{const t=Math.min((now-t0)/2000,1);sn(Math.round((1-Math.pow(1-t,3))*value));if(t<1)requestAnimationFrame(step);};
      requestAnimationFrame(step);
    },{threshold:0.3});
    obs.observe(el);return()=>obs.disconnect();
  },[value]);
  return(
    <div ref={ref} style={{textAlign:"center",padding:"32px 12px",background:CARD}}>
      <div style={{fontSize:"clamp(34px,4vw,52px)",fontWeight:800,fontFamily:"'Syne',sans-serif",lineHeight:1,background:"linear-gradient(135deg,var(--ga),var(--gb))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
        {n}{suffix}
      </div>
      <div style={{color:MUTED,fontSize:13,marginTop:8}}>{label}</div>
    </div>
  );
}

export default function LandingPage(){
  const router=useRouter();
  const[promptIdx,setPIdx]=useState(0);
  const[typed,setTyped]=useState("");
  const[dropdown,setDrop]=useState(false);
  const[mobMenu,setMob]=useState(false);
  const[billing,setBill]=useState<"m"|"y">("m");
  const[openFaq,setFaq]=useState<number|null>(null);
  const[scrolled,setScrolled]=useState(false);
  const[isWide,setIsWide]=useState(false);    // ≥768px
  const[isDesk,setIsDesk]=useState(false);    // ≥1200px
  const[liveLines,setLines]=useState(847);
  const dropRef=useRef<HTMLDivElement>(null);
  const aref=useRef<number>();

  /* responsive */
  useEffect(()=>{
    const check=()=>{setIsWide(window.innerWidth>=768);setIsDesk(window.innerWidth>=1200);};
    check();window.addEventListener("resize",check);return()=>window.removeEventListener("resize",check);
  },[]);

  /* scroll */
  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>20);
    window.addEventListener("scroll",h,{passive:true});return()=>window.removeEventListener("scroll",h);
  },[]);

  /* live code counter */
  useEffect(()=>{
    const iv=setInterval(()=>setLines(p=>p+Math.floor(Math.random()*8+2)),120);return()=>clearInterval(iv);
  },[]);

  /* gradient cycle 3s / 800ms */
  useEffect(()=>{
    const root=document.documentElement;
    let cur=0,busy=false;
    const set=(a:number[],b:number[])=>{
      root.style.setProperty("--ga",r2h(a[0],a[1],a[2]));
      root.style.setProperty("--gb",r2h(b[0],b[1],b[2]));
      root.style.setProperty("--ga-rgb",a.map(Math.round).join(","));
      root.style.setProperty("--gb-rgb",b.map(Math.round).join(","));
    };
    const go=(fi:number,ti:number)=>{
      if(busy)return;busy=true;
      const fa=h2r(THEMES[fi].a),fb=h2r(THEMES[fi].b),ta=h2r(THEMES[ti].a),tb=h2r(THEMES[ti].b);
      const t0=performance.now();
      const step=(now:number)=>{
        const raw=Math.min((now-t0)/800,1),e=raw<.5?2*raw*raw:-1+(4-2*raw)*raw;
        set(fa.map((v,i)=>lerp(v,ta[i],e)),fb.map((v,i)=>lerp(v,tb[i],e)));
        if(raw<1){aref.current=requestAnimationFrame(step);}else busy=false;
      };aref.current=requestAnimationFrame(step);
    };
    set(h2r(THEMES[0].a),h2r(THEMES[0].b));
    const iv=setInterval(()=>{const n=(cur+1)%THEMES.length;go(cur,n);cur=n;},3000);
    return()=>{clearInterval(iv);if(aref.current)cancelAnimationFrame(aref.current);};
  },[]);

  /* typewriter */
  useEffect(()=>{
    const t=PROMPTS[promptIdx];let i=0;setTyped("");
    const iv=setInterval(()=>{
      if(i<t.length){setTyped(t.slice(0,i+1));i++;}
      else{clearInterval(iv);setTimeout(()=>setPIdx(p=>(p+1)%PROMPTS.length),2200);}
    },42);return()=>clearInterval(iv);
  },[promptIdx]);

  /* close dropdown */
  useEffect(()=>{
    const h=(e:MouseEvent)=>{if(dropRef.current&&!dropRef.current.contains(e.target as Node))setDrop(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);

  const goto=useCallback((id:string)=>{
    setMob(false);setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"}),80);
  },[]);

  /* ── shared style tokens ── */
  const gtext:CSSProperties={background:"linear-gradient(135deg,var(--ga),var(--gb))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"};
  const gbg:CSSProperties={background:"linear-gradient(135deg,var(--ga),var(--gb))"};
  const sec:CSSProperties={position:"relative",zIndex:1,padding:"clamp(64px,8vw,100px) 0"};
  const wrap:CSSProperties={width:"100%",maxWidth:1280,margin:"0 auto",padding:"0 clamp(20px,4vw,64px)"};
  const card:CSSProperties={background:"rgba(255,255,255,0.028)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:18,padding:"24px",transition:"all 0.3s ease"};

  return(
    <div style={{background:BG,color:WHITE,fontFamily:"system-ui,-apple-system,sans-serif",minHeight:"100vh",overflowX:"hidden"}}>

      {/* ── CSS: only gradient utilities + animations + keyframes ── */}
      <style>{`
        :root{--ga:#F5C542;--gb:#00D084;--ga-rgb:245,197,66;--gb-rgb:0,208,132;}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{overflow-x:hidden;background:#050505;}
        .gt{background:linear-gradient(135deg,var(--ga),var(--gb));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .gb{background:linear-gradient(135deg,var(--ga),var(--gb))!important;}
        .shine{position:relative;overflow:hidden;}
        .shine::after{content:'';position:absolute;top:-50%;left:-60%;width:40%;height:200%;background:linear-gradient(to right,transparent,rgba(255,255,255,.25),transparent);transform:skewX(-20deg);animation:shineL 3.5s ease-in-out infinite;}
        .ptcl{position:absolute;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(var(--ga-rgb),.4) 0%,transparent 70%);animation:pfloat var(--d,12s) ease-in-out infinite var(--dl,0s);}
        @keyframes shineL{0%{left:-60%;opacity:0}10%{opacity:1}40%{left:130%;opacity:1}41%{opacity:0}100%{left:130%;opacity:0}}
        @keyframes pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes gm1{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(3%,-3%)scale(1.05)}}
        @keyframes gm2{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(-4%,4%)scale(1.07)}}
        @keyframes gm3{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(4%,-2%)scale(1.04)}}
        @keyframes gl{0%,100%{opacity:.45}50%{opacity:.85}}
        @keyframes pfloat{0%,100%{transform:translate(0,0)scale(1);opacity:0}10%{opacity:.7}50%{transform:translate(var(--tx,30px),var(--ty,-60px))scale(1.3);opacity:.4}90%{opacity:.15}}
        @keyframes fl1{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes fl2{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes gridFade{0%,100%{opacity:.2}50%{opacity:.45}}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#080808;}::-webkit-scrollbar-thumb{background:rgba(var(--ga-rgb),.3);border-radius:4px;}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;}}
      `}</style>

      {/* ── Background ── */}
      <div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none"}}>
        <div style={{position:"absolute",top:"-5%",left:"-5%",width:"50vw",height:"50vw",borderRadius:"50%",filter:"blur(90px)",background:"radial-gradient(circle,rgba(var(--ga-rgb),.32) 0%,transparent 70%)",animation:"gm1 20s ease-in-out infinite,gl 9s ease-in-out infinite"}}/>
        <div style={{position:"absolute",top:"-10%",right:"-10%",width:"60vw",height:"60vw",borderRadius:"50%",filter:"blur(90px)",background:"radial-gradient(circle,rgba(var(--gb-rgb),.25) 0%,transparent 70%)",animation:"gm2 24s ease-in-out infinite,gl 11s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:"-10%",left:"20%",width:"55vw",height:"55vw",borderRadius:"50%",filter:"blur(90px)",background:"radial-gradient(circle,rgba(139,92,246,.16) 0%,transparent 70%)",animation:"gm3 22s ease-in-out infinite,gl 8s ease-in-out infinite"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px)",backgroundSize:"36px 36px",animation:"gridFade 10s ease-in-out infinite"}}/>
        {[
          {w:5,h:5,top:"14%",left:"8%",  d:"16s",dl:"0s",   tx:"40px", ty:"-80px"},
          {w:3,h:3,top:"32%",left:"91%", d:"20s",dl:"-7s",  tx:"-30px",ty:"-55px"},
          {w:7,h:7,top:"62%",left:"6%",  d:"22s",dl:"-3s",  tx:"55px", ty:"-90px"},
          {w:4,h:4,top:"78%",left:"82%", d:"14s",dl:"-10s", tx:"-25px",ty:"-45px"},
          {w:5,h:5,top:"45%",left:"50%", d:"18s",dl:"-5s",  tx:"28px", ty:"-70px"},
          {w:6,h:6,top:"20%",left:"68%", d:"24s",dl:"-12s", tx:"-38px",ty:"-85px"},
        ].map((p,i)=>(
          <div key={i} className="ptcl" style={{width:p.w,height:p.h,top:p.top,left:p.left,"--d":p.d,"--dl":p.dl,"--tx":p.tx,"--ty":p.ty} as CSSProperties}/>
        ))}
      </div>

      {/* ══════════ NAVBAR ══════════ */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:100,
        height:62,display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 clamp(16px,3vw,40px)",
        background:scrolled?"rgba(5,5,5,.97)":"rgba(5,5,5,.55)",
        borderBottom:scrolled?"1px solid rgba(255,255,255,.07)":"1px solid transparent",
        backdropFilter:"blur(28px)",transition:"all .3s ease",
      }}>
        {/* Logo */}
        <div ref={dropRef} style={{position:"relative",display:"flex",alignItems:"center"}}>
          <button onClick={e=>{e.stopPropagation();setDrop(v=>!v);}}
            style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0}}>
            <img src="/logo.png" alt="Krypton AI" style={{height:44,objectFit:"contain"}}/>
            <span style={{color:"#555",fontSize:10,transition:"transform .2s",display:"inline-block",transform:dropdown?"rotate(180deg)":"none"}}>▾</span>
          </button>
          {dropdown&&(
            <div style={{position:"absolute",top:54,left:0,background:"rgba(10,10,10,.98)",border:"1px solid rgba(255,255,255,.08)",borderRadius:18,padding:8,minWidth:230,zIndex:200,boxShadow:"0 24px 64px rgba(0,0,0,.9)",backdropFilter:"blur(20px)"}}>
              {[{icon:"🏠",label:"Home",path:"/landing"},{icon:"✨",label:"Features",cb:()=>goto("features")},{icon:"🖼️",label:"Templates",path:"/templates"},{icon:"💰",label:"Pricing",cb:()=>goto("pricing")},{icon:"❓",label:"FAQ",cb:()=>goto("faq")}].map(it=>(
                <button key={it.label} onClick={()=>{if((it as any).path)router.push((it as any).path);else(it as any).cb();setDrop(false);}}
                  style={{width:"100%",textAlign:"left",padding:"10px 12px",background:"none",border:"none",color:MUTED,fontSize:13,cursor:"pointer",borderRadius:10,display:"flex",alignItems:"center",gap:9,transition:"all .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="#1a1a1a";e.currentTarget.style.color=WHITE;}}
                  onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=MUTED;}}>
                  <span style={{fontSize:15}}>{it.icon}</span>{it.label}
                </button>
              ))}
              <div style={{height:1,background:"rgba(255,255,255,.06)",margin:"6px 0"}}/>
              <button onClick={()=>{router.push("/auth/signup");setDrop(false);}}
                className="gb"
                style={{width:"100%",textAlign:"left",padding:"10px 12px",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:9,marginTop:4,color:"#050505"}}>
                🟢 Get Started Free
              </button>
            </div>
          )}
        </div>

        {/* Center links — hidden on mobile via inline logic */}
        {isWide&&(
          <div style={{display:"flex",gap:32,position:"absolute",left:"50%",transform:"translateX(-50%)"}}>
            {NAV_LINKS.map(l=>(
              <button key={l} onClick={()=>goto(l.toLowerCase())}
                style={{background:"none",border:"none",color:MUTED,fontSize:13,cursor:"pointer",fontWeight:500,transition:"color .2s",padding:"4px 0"}}
                onMouseEnter={e=>e.currentTarget.style.color=WHITE}
                onMouseLeave={e=>e.currentTarget.style.color=MUTED}>
                {l}
              </button>
            ))}
          </div>
        )}

        {/* Right */}
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {isWide&&(
            <button onClick={()=>router.push("/auth/login")}
              style={{padding:"7px 18px",background:"none",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:MUTED,fontSize:13,cursor:"pointer",transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(var(--ga-rgb),.5)";e.currentTarget.style.color=WHITE;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,.1)";e.currentTarget.style.color=MUTED;}}>
              Login
            </button>
          )}
          <button className="gb shine" onClick={()=>router.push("/auth/signup")}
            style={{padding:"7px 18px",border:"none",borderRadius:10,color:"#050505",fontSize:13,fontWeight:700,cursor:"pointer",transition:"transform .15s,box-shadow .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(var(--ga-rgb),.35)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
            Get Started
          </button>
          {!isWide&&(
            <button onClick={()=>setMob(v=>!v)}
              style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,color:WHITE,fontSize:16,cursor:"pointer",padding:"6px 10px"}}>
              {mobMenu?"✕":"☰"}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile menu */}
      {mobMenu&&!isWide&&(
        <div style={{position:"fixed",top:62,left:0,right:0,background:"rgba(6,6,6,.98)",borderBottom:"1px solid rgba(255,255,255,.08)",padding:"16px 20px",zIndex:99,backdropFilter:"blur(20px)",display:"flex",flexDirection:"column",gap:4}}>
          {NAV_LINKS.map(l=>(
            <button key={l} onClick={()=>goto(l.toLowerCase())}
              style={{background:"none",border:"none",color:SUB,fontSize:15,cursor:"pointer",padding:"12px 0",textAlign:"left",fontWeight:500,borderBottom:"1px solid rgba(255,255,255,.05)"}}>
              {l}
            </button>
          ))}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>{router.push("/auth/login");setMob(false);}}
              style={{flex:1,background:"none",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:WHITE,fontSize:14,cursor:"pointer",padding:11}}>
              Login
            </button>
            <button className="gb shine" onClick={()=>{router.push("/auth/signup");setMob(false);}}
              style={{flex:1,border:"none",borderRadius:10,color:"#050505",fontSize:14,fontWeight:700,cursor:"pointer",padding:11}}>
              Sign Up Free
            </button>
          </div>
        </div>
      )}

      {/* ══════════ HERO ══════════ */}
      <section style={{position:"relative",zIndex:1,paddingTop:"clamp(96px,10vw,130px)",paddingBottom:"clamp(60px,7vw,90px)",overflow:"hidden"}}>
        <div style={{width:"100%",maxWidth:1400,margin:"0 auto",padding:"0 clamp(20px,4vw,64px)",display:"grid",gridTemplateColumns:isDesk?"1fr 1fr":"1fr",gap:48,alignItems:"center"}}>

          {/* LEFT */}
          <div style={{display:"flex",flexDirection:"column",alignItems:isDesk?"flex-start":"center",textAlign:isDesk?"left":"center"}}>

            {/* Badge */}
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(var(--ga-rgb),.09)",border:"1px solid rgba(var(--ga-rgb),.22)",borderRadius:24,padding:"6px 18px",marginBottom:22,fontSize:12,fontWeight:600,color:WHITE}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#00D084",display:"inline-block",animation:"pulse 2s infinite"}}/>
              <span style={gtext}>✨ Build Websites, Apps &amp; Games with AI</span>
            </div>

            {/* H1 */}
            <h1 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(34px,5vw,70px)",fontWeight:800,lineHeight:1.05,marginBottom:20,maxWidth:540,color:WHITE}}>
              Build{" "}
              <span style={gtext}>Websites,<br/>Apps &amp; Games</span>
              {" "}with AI.
            </h1>

            <p style={{color:SUB,fontSize:"clamp(15px,1.8vw,17px)",lineHeight:1.78,maxWidth:440,marginBottom:32,fontWeight:400}}>
              Describe what you want. Krypton AI builds it — complete, responsive, and ready to deploy in seconds.
            </p>

            {/* CTA Buttons */}
            <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:isDesk?"flex-start":"center",marginBottom:32}}>
              <button className="gb shine" onClick={()=>router.push("/auth/signup")}
                style={{display:"inline-flex",alignItems:"center",padding:"14px 32px",border:"none",borderRadius:12,color:"#050505",fontSize:15,fontWeight:700,cursor:"pointer",transition:"transform .2s,box-shadow .2s",whiteSpace:"nowrap"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(var(--ga-rgb),.38)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                Start Building Free →
              </button>
              <button onClick={()=>goto("examples")}
                style={{display:"inline-flex",alignItems:"center",padding:"14px 32px",border:"1px solid rgba(255,255,255,.14)",background:"rgba(255,255,255,.05)",borderRadius:12,color:WHITE,fontSize:15,fontWeight:600,cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.1)";e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)";e.currentTarget.style.transform="none";}}>
                See Examples
              </button>
            </div>

            {/* Social proof */}
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{display:"flex"}}>
                {["A","S","R","J"].map((l,i)=>(
                  <div key={i} style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,rgba(var(--ga-rgb),.4),rgba(var(--gb-rgb),.4))",border:"2px solid #050505",marginLeft:i===0?0:-9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:WHITE}}>
                    {l}
                  </div>
                ))}
              </div>
              <div>
                <div style={{fontSize:12,marginBottom:2}}>⭐⭐⭐⭐⭐</div>
                <p style={{color:MUTED,fontSize:12}}>Trusted by 12,000+ builders</p>
              </div>
            </div>
          </div>

          {/* RIGHT — Dashboard (desktop only) */}
          {isDesk&&(
            <div style={{position:"relative",height:460}}>
              {/* Main card */}
              <div style={{position:"absolute",inset:0,background:"rgba(10,10,10,.9)",border:"1px solid rgba(255,255,255,.1)",borderRadius:22,overflow:"hidden",backdropFilter:"blur(20px)",boxShadow:"0 32px 80px rgba(0,0,0,.7)"}}>
                {/* Title bar */}
                <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(255,255,255,.02)",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{display:"flex",gap:6}}>
                    {["#EF4444","#F59E0B","#10B981"].map(c=><div key={c} style={{width:10,height:10,borderRadius:"50%",background:c}}/>)}
                  </div>
                  <span style={{flex:1,textAlign:"center",fontSize:11,color:MUTED}}>kryptonai.tech — Live Editor</span>
                  <span style={{width:7,height:7,borderRadius:"50%",background:"#10B981",animation:"pulse 2s infinite"}}/>
                </div>
                {/* Prompt bar */}
                <div style={{margin:"14px 16px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(var(--ga-rgb),.18)",borderRadius:10,padding:"10px 14px"}}>
                  <p style={{color:"#444",fontSize:11,marginBottom:4}}>Describe your project:</p>
                  <p style={{color:"rgba(255,255,255,.75)",fontSize:13,fontFamily:"monospace",minHeight:18}}>
                    {typed}<span style={{display:"inline-block",width:2,height:13,background:"var(--ga)",marginLeft:2,verticalAlign:"middle",animation:"blink 1s infinite"}}/>
                  </p>
                </div>
                {/* Code area */}
                <div style={{margin:"0 16px",background:"rgba(0,0,0,.55)",borderRadius:12,padding:"12px 14px",height:180,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{fontSize:10,fontWeight:700,fontFamily:"monospace",color:"var(--ga)"}}>● GENERATING</span>
                    <span style={{fontSize:10,color:MUTED,fontFamily:"monospace"}}>{liveLines} lines</span>
                  </div>
                  {[{c:"#569CD6",t:"<!DOCTYPE html>"},{c:"#569CD6",t:'<html lang="en">'},{c:"#6A9955",t:"  {/* AI-generated */}"},{c:"#CE9178",t:'  <div class="app">'},{c:"#DCDCAA",t:'    <header>'},{c:"#4EC9B0",t:"      <KryptonAI />"},{c:"#DCDCAA",t:"    </header>"},{c:"#CE9178",t:"  </div>"}].map((l,i)=>(
                    <p key={i} style={{fontFamily:"monospace",fontSize:11,color:l.c,margin:"0 0 3px",opacity:i<5?1:.3}}>{l.t}</p>
                  ))}
                </div>
                {/* Stats */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,margin:"12px 16px"}}>
                  {[{v:"4.2s",l:"Build Time",c:"var(--ga)"},{v:`${liveLines}`,l:"Lines",c:"var(--gb)"},{v:"98%",l:"Quality",c:"#60A5FA"}].map(s=>(
                    <div key={s.l} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                      <p style={{color:s.c,fontSize:16,fontWeight:800,margin:"0 0 2px"}}>{s.v}</p>
                      <p style={{color:MUTED,fontSize:10,margin:0}}>{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Float cards */}
              <div style={{position:"absolute",top:16,right:16,background:"rgba(10,10,10,.95)",border:"1px solid rgba(var(--ga-rgb),.25)",borderRadius:14,padding:"12px 16px",backdropFilter:"blur(16px)",animation:"fl1 5s ease-in-out infinite",zIndex:10,minWidth:140,boxShadow:"0 16px 40px rgba(0,0,0,.5)"}}>
                <p style={{color:MUTED,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",margin:"0 0 4px"}}>Projects Today</p>
                <p style={{...gtext,fontSize:26,fontWeight:800,fontFamily:"'Syne',sans-serif",margin:"0 0 3px"}}>1,247</p>
                <p style={{color:"#10B981",fontSize:11,margin:0}}>▲ 18% yesterday</p>
              </div>
              <div style={{position:"absolute",bottom:16,left:16,background:"rgba(10,10,10,.95)",border:"1px solid rgba(var(--gb-rgb),.25)",borderRadius:14,padding:"10px 14px",backdropFilter:"blur(16px)",animation:"fl2 7s ease-in-out infinite 1s",zIndex:10,display:"flex",alignItems:"center",gap:10,boxShadow:"0 16px 40px rgba(0,0,0,.5)"}}>
                <div style={{width:34,height:34,borderRadius:10,background:"rgba(var(--gb-rgb),.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⚡</div>
                <div><p style={{fontSize:12,fontWeight:700,margin:"0 0 1px",color:WHITE}}>Instant Deploy</p><p style={{color:MUTED,fontSize:10,margin:0}}>Live in 8s</p></div>
              </div>
              <div style={{position:"absolute",bottom:88,right:16,background:"rgba(10,10,10,.95)",border:"1px solid rgba(139,92,246,.3)",borderRadius:14,padding:"10px 14px",backdropFilter:"blur(16px)",animation:"fl1 6s ease-in-out infinite 2s",zIndex:10,display:"flex",alignItems:"center",gap:8,boxShadow:"0 12px 32px rgba(0,0,0,.5)"}}>
                <span style={{fontSize:14}}>🤖</span>
                <div><p style={{fontSize:11,fontWeight:700,margin:0,color:"#C4B5FD"}}>Claude Sonnet</p><p style={{color:MUTED,fontSize:9,margin:0}}>Powering generations</p></div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══════════ MARQUEE ══════════ */}
      <div style={{overflow:"hidden",borderTop:"1px solid rgba(255,255,255,.06)",borderBottom:"1px solid rgba(255,255,255,.06)",padding:"13px 0",background:"rgba(6,6,6,.8)",position:"relative",zIndex:1}}>
        <div style={{display:"flex",animation:"marquee 24s linear infinite",width:"max-content"}}>
          {[...MARQUEE,...MARQUEE].map((it,i)=>(
            <span key={i} style={{padding:"0 32px",fontSize:13,color:MUTED,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:8}}>
              <span style={gtext}>{it}</span>
              <span style={{color:"rgba(255,255,255,.08)"}}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ══════════ STATS ══════════ */}
      <section style={sec}>
        <div style={{...wrap}}>
          <div style={{display:"grid",gridTemplateColumns:isWide?"repeat(4,1fr)":"repeat(2,1fr)",gap:1,background:"rgba(255,255,255,.06)",borderRadius:20,overflow:"hidden",border:"1px solid rgba(255,255,255,.07)"}}>
            {STATS.map(s=><Counter key={s.label} value={s.value} suffix={s.suffix} label={s.label}/>)}
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES ══════════ */}
      <section id="features" style={{...sec,scrollMarginTop:80,background:"rgba(255,255,255,.018)",borderTop:"1px solid rgba(255,255,255,.05)"}}>
        <div style={wrap}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}><span style={gtext}>What You Can Build</span></p>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(26px,4vw,48px)",fontWeight:800,textAlign:"center",marginBottom:48,color:WHITE}}>
            One AI. <span style={gtext}>Infinite Possibilities.</span>
          </h2>
          <div style={{display:"grid",gridTemplateColumns:isDesk?"repeat(4,1fr)":isWide?"repeat(2,1fr)":"1fr",gap:16}}>
            {FEATURES.map(f=>(
              <div key={f.title} style={{...card}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(var(--ga-rgb),.3)";e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 20px 48px rgba(0,0,0,.45)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,.09)";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                <div style={{width:46,height:46,borderRadius:13,background:"rgba(var(--ga-rgb),.1)",border:"1px solid rgba(var(--ga-rgb),.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:14}}>{f.icon}</div>
                <h3 style={{fontSize:16,fontWeight:700,marginBottom:8,color:WHITE}}><span style={gtext}>{f.title}</span></h3>
                <p style={{color:SUB,fontSize:14,lineHeight:1.7,margin:0}}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ EXAMPLES ══════════ */}
      <section id="examples" style={{...sec,scrollMarginTop:80}}>
        <div style={wrap}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}><span style={gtext}>Examples</span></p>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(26px,4vw,48px)",fontWeight:800,textAlign:"center",marginBottom:48,color:WHITE}}>
            See What&apos;s <span style={gtext}>Possible</span>
          </h2>
          <div style={{display:"grid",gridTemplateColumns:isDesk?"repeat(3,1fr)":isWide?"repeat(2,1fr)":"1fr",gap:16}}>
            {[{title:"SaaS Dashboard",tag:"Web App",emoji:"📊",acc:"245,197,66"},{title:"Portfolio Site",tag:"Website",emoji:"💼",acc:"0,208,132"},{title:"Snake Game",tag:"Game",emoji:"🎮",acc:"139,92,246"},{title:"Invoice Tool",tag:"Tool",emoji:"📋",acc:"59,130,246"},{title:"Fitness App",tag:"Web App",emoji:"💪",acc:"244,63,94"},{title:"E-Commerce",tag:"Website",emoji:"🛒",acc:"16,185,129"}].map(ex=>(
              <div key={ex.title}
                style={{background:`rgba(${ex.acc},.06)`,border:`1px solid rgba(${ex.acc},.15)`,borderRadius:18,overflow:"hidden",cursor:"pointer",transition:"all .3s"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow=`0 20px 48px rgba(${ex.acc},.14)`;e.currentTarget.style.borderColor=`rgba(${ex.acc},.35)`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";e.currentTarget.style.borderColor=`rgba(${ex.acc},.15)`;}}>
                <div style={{height:140,background:`linear-gradient(135deg,rgba(${ex.acc},.14),rgba(${ex.acc},.03))`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:44}}>{ex.emoji}</div>
                <div style={{padding:"16px 18px"}}>
                  <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:`rgba(${ex.acc},1)`}}>{ex.tag}</span>
                  <p style={{fontSize:15,fontWeight:600,margin:"5px 0 0",color:WHITE}}>{ex.title}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:40}}>
            <button className="gb shine" onClick={()=>router.push("/auth/signup")}
              style={{display:"inline-flex",alignItems:"center",padding:"13px 36px",border:"none",borderRadius:12,color:"#050505",fontSize:14,fontWeight:700,cursor:"pointer",transition:"transform .2s,box-shadow .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(var(--ga-rgb),.35)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
              Build Your Own →
            </button>
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS ══════════ */}
      <section style={{...sec,background:"rgba(255,255,255,.018)",borderTop:"1px solid rgba(255,255,255,.05)"}}>
        <div style={wrap}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}><span style={gtext}>Testimonials</span></p>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(26px,4vw,48px)",fontWeight:800,textAlign:"center",marginBottom:48,color:WHITE}}>
            Loved by <span style={gtext}>Builders</span>
          </h2>
          <div style={{display:"grid",gridTemplateColumns:isDesk?"repeat(3,1fr)":"1fr",gap:16}}>
            {TESTIMONIALS.map((t,i)=>(
              <div key={i} style={{...card,position:"relative",overflow:"hidden"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(var(--ga-rgb),.3)";e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 20px 48px rgba(0,0,0,.45)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,.09)";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                <div style={{position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"50%",background:"radial-gradient(circle,rgba(var(--ga-rgb),.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
                <div style={{fontSize:14,marginBottom:12}}>{"⭐".repeat(t.stars)}</div>
                <p style={{color:SUB,fontSize:14,lineHeight:1.75,marginBottom:20,fontStyle:"italic"}}>&ldquo;{t.text}&rdquo;</p>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,rgba(var(--ga-rgb),.3),rgba(var(--gb-rgb),.3))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,flexShrink:0,color:WHITE}}>{t.name[0]}</div>
                  <div><p style={{fontWeight:700,fontSize:14,margin:0,color:WHITE}}>{t.name}</p><p style={{color:MUTED,fontSize:12,margin:"2px 0 0"}}>{t.role}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ PRICING ══════════ */}
      <section id="pricing" style={{...sec,scrollMarginTop:80}}>
        <div style={wrap}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}><span style={gtext}>Pricing</span></p>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(26px,4vw,48px)",fontWeight:800,textAlign:"center",marginBottom:12,color:WHITE}}>
            Simple, <span style={gtext}>Transparent Pricing</span>
          </h2>
          <p style={{color:SUB,textAlign:"center",fontSize:16,marginBottom:32}}>Start free. Upgrade when you&apos;re ready.</p>
          <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:40}}>
            {(["m","y"] as const).map(b=>(
              <button key={b} onClick={()=>setBill(b)}
                style={{padding:"8px 22px",borderRadius:12,border:"1px solid",borderColor:billing===b?"rgba(var(--ga-rgb),.4)":"rgba(255,255,255,.08)",background:billing===b?"rgba(var(--ga-rgb),.1)":"transparent",color:billing===b?"var(--ga)":MUTED,fontWeight:600,fontSize:13,cursor:"pointer",transition:"all .2s"}}>
                {b==="m"?"Monthly":"Yearly"}{b==="y"&&<span style={{fontSize:10,marginLeft:4,color:"#10B981"}}> Save 20%</span>}
              </button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:isDesk?"repeat(4,1fr)":isWide?"repeat(2,1fr)":"1fr",gap:16}}>
            {PLANS.map(plan=>(
              <div key={plan.name}
                style={{background:plan.hot?"rgba(var(--ga-rgb),.05)":"rgba(13,13,13,.8)",border:plan.hot?"1px solid rgba(var(--ga-rgb),.35)":"1px solid rgba(255,255,255,.07)",borderRadius:20,padding:24,position:"relative",transition:"all .3s",boxShadow:plan.hot?"0 0 60px rgba(var(--ga-rgb),.08)":"none"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow=plan.hot?"0 20px 60px rgba(var(--ga-rgb),.15)":"0 20px 40px rgba(0,0,0,.4)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=plan.hot?"0 0 60px rgba(var(--ga-rgb),.08)":"none";}}>
                {plan.hot&&<div className="gb" style={{position:"absolute",top:-13,left:"50%",transform:"translateX(-50%)",color:"#050505",fontSize:11,fontWeight:700,padding:"4px 16px",borderRadius:20,whiteSpace:"nowrap"}}>✨ Most Popular</div>}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:18}}>{plan.emoji}</span><h3 style={{fontSize:18,fontWeight:700,color:WHITE}}><span style={gtext}>{plan.name}</span></h3></div>
                <p style={{color:"#10B981",fontSize:11,fontWeight:600,marginBottom:12}}>{plan.credits}</p>
                <div style={{marginBottom:18}}><span style={{...gtext,fontSize:36,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{billing==="m"?plan.m:plan.y}</span><span style={{color:MUTED,fontSize:13}}>/mo</span></div>
                {plan.inc.map(f=><div key={f} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8}}><span style={{...gtext,fontSize:12,flexShrink:0,fontWeight:700}}>✓</span><span style={{fontSize:13,color:SUB}}>{f}</span></div>)}
                {plan.off.map(f=><div key={f} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8}}><span style={{fontSize:12,flexShrink:0,color:"#2a2a2a"}}>✕</span><span style={{fontSize:13,color:"#333"}}>{f}</span></div>)}
                <button className={plan.hot?"gb shine":""} onClick={()=>router.push("/auth/signup")}
                  style={{width:"100%",marginTop:18,padding:12,background:plan.hot?undefined:"rgba(255,255,255,.04)",border:plan.hot?"none":"1px solid rgba(255,255,255,.08)",borderRadius:12,color:plan.hot?"#050505":WHITE,fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .2s"}}
                  onMouseEnter={e=>{if(!plan.hot){e.currentTarget.style.background="rgba(255,255,255,.08)";e.currentTarget.style.transform="translateY(-1px)";}}}
                  onMouseLeave={e=>{if(!plan.hot){e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.transform="none";}}}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section id="faq" style={{...sec,scrollMarginTop:80,background:"rgba(255,255,255,.018)",borderTop:"1px solid rgba(255,255,255,.05)"}}>
        <div style={{width:"100%",maxWidth:700,margin:"0 auto",padding:"0 clamp(20px,4vw,64px)"}}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}><span style={gtext}>FAQ</span></p>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(26px,4vw,48px)",fontWeight:800,textAlign:"center",marginBottom:40,color:WHITE}}>
            <span style={gtext}>Frequently Asked</span>
          </h2>
          {FAQS.map((item,i)=>(
            <div key={i} style={{borderBottom:"1px solid rgba(255,255,255,.06)"}}>
              <button onClick={()=>setFaq(openFaq===i?null:i)}
                style={{width:"100%",textAlign:"left",background:"none",border:"none",cursor:"pointer",padding:"20px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                <span style={{fontWeight:700,fontSize:15,color:WHITE}}><span style={gtext}>{item.q}</span></span>
                <span style={{color:MUTED,transition:"transform .3s",transform:openFaq===i?"rotate(45deg)":"none",display:"inline-block",fontSize:22,flexShrink:0,lineHeight:1}}>+</span>
              </button>
              {openFaq===i&&<p style={{color:SUB,fontSize:14,lineHeight:1.8,paddingBottom:20,margin:0}}>{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section style={{...sec,textAlign:"center",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"60vw",height:"60vw",maxWidth:600,maxHeight:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(var(--ga-rgb),.05) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{...wrap,position:"relative"}}>
          <div style={{width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,rgba(var(--ga-rgb),.2),rgba(var(--gb-rgb),.2))",border:"1px solid rgba(var(--ga-rgb),.2)",margin:"0 auto 32px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38}}>⚡</div>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(28px,4.5vw,58px)",fontWeight:800,lineHeight:1.08,marginBottom:20,maxWidth:640,margin:"0 auto 20px",color:WHITE}}>
            The future of building is{" "}<span style={gtext}>a sentence away.</span>
          </h2>
          <p style={{color:SUB,fontSize:17,lineHeight:1.75,maxWidth:480,margin:"0 auto 40px"}}>
            Join thousands of builders creating the web with Krypton AI.
          </p>
          <button className="gb shine" onClick={()=>router.push("/auth/signup")}
            style={{display:"inline-flex",alignItems:"center",padding:"16px 44px",border:"none",borderRadius:14,color:"#050505",fontSize:16,fontWeight:700,cursor:"pointer",transition:"transform .2s,box-shadow .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 16px 48px rgba(var(--ga-rgb),.4)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
            Start Free — No credit card required →
          </button>
          <p style={{color:MUTED,fontSize:12,marginTop:16}}>5 free generations every day. No card needed.</p>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{borderTop:"1px solid rgba(255,255,255,.06)",background:"rgba(4,4,4,.98)",position:"relative",zIndex:1}}>
        <div style={{...wrap,paddingTop:"clamp(48px,6vw,72px)",paddingBottom:"clamp(24px,3vw,40px)"}}>
          <div style={{display:"grid",gridTemplateColumns:isWide?"repeat(5,1fr)":"repeat(2,1fr)",gap:isWide?32:24,marginBottom:48}}>
            {[
              {title:"Product",  links:[{l:"Features",h:"/landing#features"},{l:"Pricing",h:"/landing#pricing"},{l:"Roadmap",h:"/landing#roadmap"},{l:"Examples",h:"/landing#examples"}]},
              {title:"Resources",links:[{l:"Documentation",h:"/docs"},{l:"Changelog",h:"/changelog"},{l:"Blog",h:"/blog"},{l:"Support",h:"/support"}]},
              {title:"Company",  links:[{l:"About",h:"/about"},{l:"Contact",h:"/contact"}]},
              {title:"Legal",    links:[{l:"Privacy Policy",h:"/privacy"},{l:"Terms of Service",h:"/terms"},{l:"Refund Policy",h:"/refund"}]},
              {title:"Social",   links:[{l:"X (Twitter)",h:"https://twitter.com/kryptonai"},{l:"LinkedIn",h:"https://linkedin.com/company/kryptonai"},{l:"GitHub",h:"https://github.com/jangeersinghktm-design/Magic-Krypton-ai-"}]},
            ].map(col=>(
              <div key={col.title}>
                <p style={{fontWeight:700,fontSize:13,marginBottom:14}}><span style={gtext}>{col.title}</span></p>
                {col.links.map(link=>(
                  <a key={link.l} href={link.h}
                    style={{display:"block",color:MUTED,fontSize:13,marginBottom:10,textDecoration:"none",transition:"color .2s"}}
                    onMouseEnter={e=>e.currentTarget.style.color=WHITE}
                    onMouseLeave={e=>e.currentTarget.style.color=MUTED}>
                    {link.l}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div style={{borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:24,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <img src="/logo.png" alt="Krypton AI" style={{height:42,objectFit:"contain"}}/>
            <p style={{color:MUTED,fontSize:12,margin:0}}>© 2026 Krypton AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
