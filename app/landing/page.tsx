"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import KryptonLogo from "@/components/branding/KryptonLogo";
import type { CSSProperties } from "react";
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

const BG="#07091A", CARD="#0D1230", WHITE="#F0F4FF", SUB="#8892A4", MUTED="#4A5568";

const PROMPTS = [
  "Build a restaurant website with online menu...",
  "Create a fitness tracking app with charts...",
  "Generate a CRM dashboard with kanban board...",
  "Build an ecommerce store with cart...",
  "Create a browser game like Snake...",
  "Design a portfolio website with animations...",
  "Build an invoice generator with PDF export...",
];

const NAV_LINKS = ["Features","Pricing","Examples","Roadmap"];

const FEATURES = [
  { icon:"🌐", title:"Websites",       desc:"Landing pages, portfolios, business sites — pixel-perfect and responsive." },
  { icon:"⚙️", title:"Web Apps",       desc:"Dashboards, CRM tools, productivity apps with full interactivity." },
  { icon:"🎮", title:"Browser Games",  desc:"Snake, 2048, puzzle games — fully playable in the browser." },
  { icon:"🧰", title:"Business Tools", desc:"Calculators, forms, trackers — tools that actually work." },
  { icon:"📊", title:"Dashboards",     desc:"Analytics panels, admin UIs, data visualisations that impress." },
  { icon:"🛒", title:"E-Commerce",     desc:"Full stores with product pages, carts and checkout flows." },
  { icon:"📱", title:"Mobile-First",   desc:"Every build is responsive — looks flawless on any device." },
  { icon:"🤖", title:"AI-Powered",     desc:"Krypton Intelligence Engine generates production-ready code in seconds." },
];

const STATS = [
  { value:12000, label:"Projects Generated", suffix:"+" },
  { value:98,    label:"Satisfaction Rate",   suffix:"%" },
  { value:8,     label:"Seconds to Build",    suffix:"s" },
  { value:22,    label:"Premium Templates",   suffix:"+" },
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
  { stars:5, text:"Generated my startup landing page in under 2 minutes. The quality was better than anything a freelancer delivered in a week.", name:"Alex R",  role:"Founder, TechFlow", company:"Y Combinator '25" },
  { stars:5, text:"Replaced our $8k/month dev spend. Now we prototype in hours. Krypton AI is genuinely the best product I've used this year.", name:"Sarah K", role:"Head of Product", company:"Designlab" },
  { stars:5, text:"Built a full CRM with kanban, filters and data export in one afternoon. My entire team was speechless. Total game changer.", name:"Raj M",   role:"Product Manager", company:"Stripe" },
];

const FAQS = [
  { q:"What can Krypton AI build?",  a:"Websites, web apps, browser games, dashboards, calculators, portfolios — all production-ready HTML output." },
  { q:"How does Krypton AI work?",   a:"Describe what you want in plain English. Our AI transforms your idea into a complete, responsive project in seconds." },
  { q:"Can I download the code?",    a:"Yes. Every project downloads as a complete HTML file, ready to deploy anywhere — Vercel, Netlify, GitHub Pages." },
  { q:"Do I need coding skills?",    a:"No. Just describe what you want and Krypton AI generates it instantly. Zero technical knowledge required." },
  { q:"What AI model powers this?",  a:"Krypton AI is powered by Claude Sonnet — one of the most capable and reliable models available today." },
  { q:"Is there a free plan?",       a:"Yes. You get 5 free generations every day with no credit card required. Upgrade anytime for more power." },
];

const STEPS = [
  { step:"01", icon:"✍️", title:"Describe Your Idea", desc:"Type what you want in plain English. The more detail, the better — but even a sentence is enough to start." },
  { step:"02", icon:"⚡", title:"AI Builds It", desc:"Krypton AI generates complete, responsive code in seconds. Watch it come to life in real time." },
  { step:"03", icon:"🚀", title:"Deploy Instantly", desc:"Preview, tweak and deploy with a single click. Share your project with the world immediately." },
];

function lerp(a:number,b:number,t:number){return a+(b-a)*t;}
function h2r(h:string){return[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));}
function r2h(r:number,g:number,b:number){return"#"+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join("");}

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
    <div ref={ref} style={{textAlign:"center",padding:"36px 16px",background:"rgba(13,18,48,0.8)",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 50% 0%,rgba(var(--ga-rgb),.04) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{fontSize:"clamp(36px,4vw,56px)",fontWeight:800,fontFamily:"'Syne',sans-serif",lineHeight:1,background:"linear-gradient(135deg,var(--ga),var(--gb))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",marginBottom:8}}>
        {n}{suffix}
      </div>
      <div style={{color:MUTED,fontSize:13,fontWeight:500,letterSpacing:"0.02em"}}>{label}</div>
    </div>
  );
}

export default function LandingPage(){
  const router=useRouter();
  const[promptIdx,setPIdx]=useState(0);
  const[typed,setTyped]=useState("");
  const[promptInput,setPromptInput]=useState("");
  const[dropdown,setDrop]=useState(false);
  const[mobMenu,setMob]=useState(false);
  const[billing,setBill]=useState<"m"|"y">("m");
  const[openFaq,setFaq]=useState<number|null>(null);
  const[scrolled,setScrolled]=useState(false);
  const[isWide,setIsWide]=useState(false);
  const[isDesk,setIsDesk]=useState(false);
  const[liveLines,setLines]=useState(847);
  const[mousePos,setMousePos]=useState({x:0,y:0});
  const[hoverCard,setHoverCard]=useState<number|null>(null);
  const dropRef=useRef<HTMLDivElement>(null);
  const containerRef=useRef<HTMLDivElement>(null);
  const aref=useRef<number>();

  useEffect(()=>{
    const check=()=>{setIsWide(window.innerWidth>=768);setIsDesk(window.innerWidth>=1200);};
    check();window.addEventListener("resize",check);return()=>window.removeEventListener("resize",check);
  },[]);

  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    const h=()=>setScrolled(el.scrollTop>20);
    el.addEventListener("scroll",h,{passive:true});return()=>el.removeEventListener("scroll",h);
  },[]);

  /* mouse glow */
  useEffect(()=>{
    const h=(e:MouseEvent)=>setMousePos({x:e.clientX,y:e.clientY});
    window.addEventListener("mousemove",h,{passive:true});
    return()=>window.removeEventListener("mousemove",h);
  },[]);

  useEffect(()=>{
    const iv=setInterval(()=>setLines(p=>p+Math.floor(Math.random()*8+2)),120);return()=>clearInterval(iv);
  },[]);

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
    const iv=setInterval(()=>{const n=(cur+1)%THEMES.length;go(cur,n);cur=n;},8000);
    return()=>{clearInterval(iv);if(aref.current)cancelAnimationFrame(aref.current);};
  },[]);

  /* typewriter */
  useEffect(()=>{
    const t=PROMPTS[promptIdx];let i=0;setTyped("");
    const iv=setInterval(()=>{
      if(i<t.length){setTyped(t.slice(0,i+1));i++;}
      else{clearInterval(iv);setTimeout(()=>setPIdx(p=>(p+1)%PROMPTS.length),2000);}
    },40);return()=>clearInterval(iv);
  },[promptIdx]);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{if(dropRef.current&&!dropRef.current.contains(e.target as Node))setDrop(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);

  const goto=useCallback((id:string)=>{
    setMob(false);
    setTimeout(()=>{
      const el=document.getElementById(id);
      if(el&&containerRef.current){
        const top=el.offsetTop-70;
        containerRef.current.scrollTo({top,behavior:"smooth"});
      }
    },80);
  },[]);

  const handlePromptSubmit=()=>{
    if(promptInput.trim()){
      router.push(`/auth/signup?prompt=${encodeURIComponent(promptInput)}`);
    } else {
      router.push("/auth/signup");
    }
  };

  const gtext:CSSProperties={background:"linear-gradient(135deg,var(--ga),var(--gb))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"};
  const gbg:CSSProperties={background:"linear-gradient(135deg,var(--ga),var(--gb))"};
  const sec:CSSProperties={padding:"clamp(72px,9vw,112px) 0"};
  const wrap:CSSProperties={width:"100%",maxWidth:1280,margin:"0 auto",padding:"0 clamp(20px,4vw,64px)"};
  const card:CSSProperties={background:"rgba(255,255,255,0.028)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:20,padding:"28px",transition:"all 0.3s ease"};

  return(
    <div ref={containerRef} style={{
      position:"fixed",inset:0,zIndex:9999,
      background:`linear-gradient(135deg, #07091A 0%, #0A0F2E 50%, #07091A 100%)`,color:WHITE,
      fontFamily:"'DM Sans',system-ui,-apple-system,sans-serif",
      overflowY:"auto",overflowX:"hidden",
    }}>

      {/* Mouse glow */}
      <div style={{
        position:"fixed",
        left:mousePos.x-300,top:mousePos.y-300,
        width:600,height:600,
        borderRadius:"50%",
        background:"radial-gradient(circle,rgba(var(--ga-rgb),.07) 0%,transparent 70%)",
        pointerEvents:"none",zIndex:0,
        transition:"left 0.15s ease,top 0.15s ease",
      }}/>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');
        :root{--ga:#F5C542;--gb:#00D084;--ga-rgb:245,197,66;--gb-rgb:0,208,132;}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{overflow-x:hidden;background:#050505;}
        .gt{background:linear-gradient(135deg,var(--ga),var(--gb));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .gb{background:linear-gradient(135deg,var(--ga),var(--gb))!important;}
        .shine{position:relative;overflow:hidden;}
        .shine::after{content:'';position:absolute;top:-50%;left:-60%;width:40%;height:200%;background:linear-gradient(to right,transparent,rgba(255,255,255,.25),transparent);transform:skewX(-20deg);animation:shineL 3.5s ease-in-out infinite;}
        .card-hover{transition:all 0.3s ease;}
        .card-hover:hover{transform:translateY(-6px);border-color:rgba(var(--ga-rgb),.3)!important;box-shadow:0 24px 56px rgba(0,0,0,.5);}
        .ptcl{position:absolute;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(var(--ga-rgb),.4) 0%,transparent 70%);animation:pfloat var(--d,12s) ease-in-out infinite var(--dl,0s);}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @media(max-width:640px){
          h1{font-size:clamp(20px,6.5vw,32px)!important;line-height:1.12!important;}
          h2{font-size:clamp(18px,5vw,28px)!important;}
          .hero-sub{font-size:14px!important;}
        }
        @media(min-width:641px)and(max-width:1024px){
          h1{font-size:clamp(28px,4vw,48px)!important;}
        }
        @keyframes shineL{0%{left:-60%;opacity:0}10%{opacity:1}40%{left:130%;opacity:1}41%{opacity:0}100%{left:130%;opacity:0}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes gm1{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(3%,-3%)scale(1.05)}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes gm2{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(-4%,4%)scale(1.07)}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes gm3{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(4%,-2%)scale(1.04)}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes gl{0%,100%{opacity:.45}50%{opacity:.85}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes pfloat{0%,100%{transform:translate(0,0)scale(1);opacity:0}10%{opacity:.7}50%{transform:translate(var(--tx,30px),var(--ty,-60px))scale(1.3);opacity:.4}90%{opacity:.15}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes fl1{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes fl2{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes gridFade{0%,100%{opacity:.15}50%{opacity:.35}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes stepGlow{0%,100%{box-shadow:0 0 0 0 rgba(var(--ga-rgb),0)}50%{box-shadow:0 0 0 8px rgba(var(--ga-rgb),.1)}}
        .prompt-box:focus-within{border-color:rgba(var(--ga-rgb),.5)!important;box-shadow:0 0 0 3px rgba(var(--ga-rgb),.08),0 20px 60px rgba(0,0,0,.4)!important;}
        .prompt-box:focus-within .prompt-glow{opacity:1!important;}
        input::placeholder{color:#444;}
        input:focus{outline:none;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#080808;}::-webkit-scrollbar-thumb{background:rgba(var(--ga-rgb),.3);border-radius:4px;}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;}}
      `}</style>

      {/* ── Background ── */}
      <div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none"}}>
        <div style={{position:"absolute",top:"-5%",left:"-5%",width:"55vw",height:"55vw",borderRadius:"50%",filter:"blur(100px)",background:"radial-gradient(circle,rgba(var(--ga-rgb),.28) 0%,transparent 70%)",animation:"gm1 20s ease-in-out infinite,gl 9s ease-in-out infinite"}}/>
        <div style={{position:"absolute",top:"-10%",right:"-10%",width:"60vw",height:"60vw",borderRadius:"50%",filter:"blur(100px)",background:"radial-gradient(circle,rgba(var(--gb-rgb),.22) 0%,transparent 70%)",animation:"gm2 24s ease-in-out infinite,gl 11s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:"-10%",left:"20%",width:"55vw",height:"55vw",borderRadius:"50%",filter:"blur(100px)",background:"radial-gradient(circle,rgba(139,92,246,.14) 0%,transparent 70%)",animation:"gm3 22s ease-in-out infinite,gl 8s ease-in-out infinite"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(255,255,255,.04) 1px,transparent 1px)",backgroundSize:"40px 40px",animation:"gridFade 10s ease-in-out infinite"}}/>
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
        position:"sticky",top:0,left:0,right:0,zIndex:100,
        height:64,display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 clamp(16px,3vw,40px)",
        background:scrolled?"rgba(5,5,5,.97)":"rgba(5,5,5,.5)",
        borderBottom:scrolled?"1px solid rgba(255,255,255,.07)":"1px solid transparent",
        backdropFilter:"blur(32px)",transition:"all .3s ease",
      }}>
        <div ref={dropRef} style={{position:"relative",display:"flex",alignItems:"center"}}>
          <button onClick={e=>{e.stopPropagation();setDrop(v=>!v);}}
            style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0}}>
            <KryptonLogo size={36} showText={true} animated={false}/>
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

        {isWide&&(
          <div style={{display:"flex",gap:32,position:"absolute",left:"50%",transform:"translateX(-50%)"}}>
            {NAV_LINKS.map(l=>(
              <button key={l} onClick={()=>goto(l.toLowerCase())}
                style={{background:"none",border:"none",color:MUTED,fontSize:13,cursor:"pointer",fontWeight:500,transition:"color .2s",padding:"4px 0",letterSpacing:"0.01em"}}
                onMouseEnter={e=>e.currentTarget.style.color=WHITE}
                onMouseLeave={e=>e.currentTarget.style.color=MUTED}>
                {l}
              </button>
            ))}
          </div>
        )}

        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {isWide&&(
            <button onClick={()=>router.push("/auth/login")}
              style={{padding:"7px 18px",background:"none",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:MUTED,fontSize:13,cursor:"pointer",transition:"all .2s",fontWeight:500}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(var(--ga-rgb),.5)";e.currentTarget.style.color=WHITE;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,.1)";e.currentTarget.style.color=MUTED;}}>
              Login
            </button>
          )}
          <button className="gb shine" onClick={()=>router.push("/auth/signup")}
            style={{padding:"8px 20px",border:"none",borderRadius:10,color:"#050505",fontSize:13,fontWeight:700,cursor:"pointer",transition:"transform .15s,box-shadow .15s",letterSpacing:"0.01em"}}
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

      {mobMenu&&!isWide&&(
        <div style={{position:"fixed",top:64,left:0,right:0,background:"rgba(6,6,6,.98)",borderBottom:"1px solid rgba(255,255,255,.08)",padding:"16px 20px",zIndex:99,backdropFilter:"blur(20px)",display:"flex",flexDirection:"column",gap:4}}>
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
      <section style={{position:"relative",zIndex:1,paddingTop:"clamp(80px,10vw,130px)",paddingBottom:"clamp(60px,7vw,90px)"}}>
        <div style={{width:"100%",maxWidth:900,margin:"0 auto",padding:"0 clamp(20px,4vw,64px)",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center"}}>

          {/* Badge */}
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(var(--ga-rgb),.08)",border:"1px solid rgba(var(--ga-rgb),.2)",borderRadius:24,padding:"6px 18px",marginBottom:28,fontSize:12,fontWeight:600,animation:"fadeUp .6s ease both"}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#00D084",display:"inline-block",animation:"pulse 2s infinite"}}/>
            <span style={gtext}>✨ Build Websites, Apps &amp; Games with AI</span>
          </div>

          {/* H1 — premium typography */}
          <h1 style={{
            fontFamily:"'Syne',system-ui,sans-serif",
            fontSize:"clamp(22px,4.5vw,64px)",
            fontWeight:800,
            lineHeight:1.08,
            letterSpacing:"-0.03em",
            marginBottom:24,
            color:WHITE,
            animation:"fadeUp .6s .1s ease both",
            maxWidth:800,
            whiteSpace:"normal",
          }}>
            Build <span style={gtext}>Websites, Apps & Games</span> with AI.
          </h1>

          <p className="hero-sub" style={{
            color:SUB,
            fontSize:"clamp(14px,1.6vw,17px)",
            lineHeight:1.7,
            maxWidth:520,
            marginBottom:40,
            fontWeight:400,
            letterSpacing:"0.01em",
            animation:"fadeUp .6s .2s ease both",
          }}>
            Describe what you want. Krypton AI builds it — complete,
            responsive, and ready to deploy in seconds.
          </p>

          {/* ── AI Prompt Box ── */}
          <div style={{width:"100%",maxWidth:680,marginBottom:36,animation:"fadeUp .6s .3s ease both",position:"relative"}}>
            {/* Glow behind box */}
            <div className="prompt-glow" style={{
              position:"absolute",inset:-2,borderRadius:22,
              background:"linear-gradient(135deg,var(--ga),var(--gb))",
              opacity:0,transition:"opacity .3s ease",filter:"blur(8px)",zIndex:0,
            }}/>
            <div className="prompt-box" style={{
              position:"relative",zIndex:1,
              background:"rgba(12,12,12,.95)",
              border:"1px solid rgba(255,255,255,.1)",
              borderRadius:20,
              backdropFilter:"blur(24px)",
              boxShadow:"0 8px 40px rgba(0,0,0,.4)",
              transition:"all .3s ease",
              overflow:"hidden",
            }}>
              {/* Top bar */}
              <div style={{padding:"10px 16px 0",display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:16}}>🤖</span>
                <span style={{fontSize:11,color:MUTED,fontWeight:500,letterSpacing:"0.05em"}}>DESCRIBE YOUR PROJECT</span>
              </div>
              {/* Input row */}
              <div style={{display:"flex",alignItems:"center",padding:"10px 16px 14px",gap:12}}>
                <input
                  value={promptInput}
                  onChange={e=>setPromptInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&handlePromptSubmit()}
                  placeholder={typed||"What do you want to build?"}
                  style={{
                    flex:1,background:"none",border:"none",
                    color:WHITE,fontSize:"clamp(14px,1.8vw,17px)",
                    fontFamily:"'Inter',sans-serif",fontWeight:400,
                    caretColor:"var(--ga)",
                    minWidth:0,
                  }}
                />
                {!promptInput&&(
                  <span style={{display:"inline-block",width:2,height:18,background:"var(--ga)",borderRadius:1,animation:"blink 1s infinite",flexShrink:0,marginLeft:-8}}/>
                )}
                <button
                  className="gb shine"
                  onClick={handlePromptSubmit}
                  style={{
                    flexShrink:0,padding:"10px 22px",border:"none",borderRadius:12,
                    color:"#050505",fontSize:14,fontWeight:700,cursor:"pointer",
                    transition:"transform .15s,box-shadow .15s",whiteSpace:"nowrap",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(var(--ga-rgb),.4)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                  Build it →
                </button>
              </div>
              {/* Prompt chips */}
              <div style={{
                display:"flex",gap:6,padding:"0 16px 14px",
                overflowX:"auto",flexWrap:isWide?"wrap":"nowrap",
              }}>
                {["Restaurant website","Fitness app","CRM dashboard","Browser game"].map(chip=>(
                  <button key={chip}
                    onClick={()=>{setPromptInput(chip);}}
                    style={{
                      flexShrink:0,padding:"5px 12px",background:"rgba(255,255,255,.05)",
                      border:"1px solid rgba(255,255,255,.09)",borderRadius:20,
                      color:MUTED,fontSize:12,cursor:"pointer",fontWeight:500,
                      transition:"all .2s",whiteSpace:"nowrap",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(var(--ga-rgb),.08)";e.currentTarget.style.borderColor="rgba(var(--ga-rgb),.25)";e.currentTarget.style.color=WHITE;}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)";e.currentTarget.style.borderColor="rgba(255,255,255,.09)";e.currentTarget.style.color=MUTED;}}>
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Social proof row */}
          <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap",justifyContent:"center",animation:"fadeUp .6s .4s ease both"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{display:"flex"}}>
                {["A","S","R","J"].map((l,i)=>(
                  <div key={i} style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,rgba(var(--ga-rgb),.4),rgba(var(--gb-rgb),.4))",border:"2px solid #050505",marginLeft:i===0?0:-10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:WHITE}}>
                    {l}
                  </div>
                ))}
              </div>
              <div>
                <div style={{fontSize:13,marginBottom:1}}>⭐⭐⭐⭐⭐ <span style={{color:WHITE,fontWeight:700}}>4.9/5</span></div>
                <p style={{color:MUTED,fontSize:12}}>Trusted by 12,000+ creators</p>
              </div>
            </div>
            <div style={{width:1,height:32,background:"rgba(255,255,255,.08)"}}/>
            <div style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center"}}>
              {["No coding required","Free to start","Deploy in seconds"].map(t=>(
                <span key={t} style={{display:"flex",alignItems:"center",gap:5,fontSize:13,color:MUTED}}>
                  <span style={gtext}>✓</span> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ MARQUEE ══════════ */}
      <div style={{overflow:"hidden",borderTop:"1px solid rgba(255,255,255,.05)",borderBottom:"1px solid rgba(255,255,255,.05)",padding:"14px 0",background:"rgba(6,6,6,.8)",position:"relative",zIndex:1}}>
        <div style={{display:"flex",animation:"marquee 24s linear infinite",width:"max-content"}}>
          {[...MARQUEE,...MARQUEE].map((it,i)=>(
            <span key={i} style={{padding:"0 28px",fontSize:13,color:MUTED,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:8}}>
              <span style={gtext}>{it}</span>
              <span style={{color:"rgba(255,255,255,.06)"}}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ══════════ STATS ══════════ */}
      <section style={sec}>
        <div style={wrap}>
          <div style={{display:"grid",gridTemplateColumns:isWide?"repeat(4,1fr)":"repeat(2,1fr)",gap:1,background:"rgba(255,255,255,.05)",borderRadius:22,overflow:"hidden",border:"1px solid rgba(255,255,255,.07)"}}>
            {STATS.map(s=><Counter key={s.label} value={s.value} suffix={s.suffix} label={s.label}/>)}
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section style={{...sec,background:"rgba(255,255,255,.018)",borderTop:"1px solid rgba(255,255,255,.05)",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
        <div style={wrap}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}><span style={gtext}>How It Works</span></p>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(24px,3.5vw,44px)",fontWeight:800,textAlign:"center",marginBottom:16,color:WHITE,letterSpacing:"-0.02em"}}>
            From Idea to <span style={gtext}>Live App</span>
          </h2>
          <p style={{color:SUB,fontSize:17,textAlign:"center",maxWidth:480,margin:"0 auto 56px",lineHeight:1.6}}>
            Three steps. No code. No waiting. Just results.
          </p>
          <div style={{display:"grid",gridTemplateColumns:isDesk?"repeat(3,1fr)":"1fr",gap:24,position:"relative"}}>
            {isDesk&&(
              <div style={{position:"absolute",top:48,left:"20%",right:"20%",height:1,background:"linear-gradient(90deg,transparent,rgba(var(--ga-rgb),.3),transparent)",pointerEvents:"none"}}/>
            )}
            {STEPS.map((step,i)=>(
              <div key={i} style={{
                background:"rgba(255,255,255,.028)",
                border:"1px solid rgba(255,255,255,.09)",
                borderRadius:20,padding:"36px 28px",
                position:"relative",overflow:"hidden",
                transition:"all .3s ease",textAlign:"center",
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(var(--ga-rgb),.3)";e.currentTarget.style.transform="translateY(-6px)";e.currentTarget.style.boxShadow="0 24px 56px rgba(0,0,0,.5)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,.09)";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,rgba(var(--ga-rgb),.4),transparent)"}}/>
                <div style={{
                  width:64,height:64,borderRadius:18,
                  background:"rgba(var(--ga-rgb),.08)",
                  border:"1px solid rgba(var(--ga-rgb),.15)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:26,margin:"0 auto 20px",
                  animation:"stepGlow 3s ease-in-out infinite",
                }}>{step.icon}</div>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:".1em",marginBottom:10,fontFamily:"'Syne',sans-serif"}}><span style={gtext}>{step.step}</span></div>
                <h3 style={{fontSize:20,fontWeight:700,marginBottom:12,color:WHITE,fontFamily:"'Syne',sans-serif"}}>{step.title}</h3>
                <p style={{color:SUB,fontSize:15,lineHeight:1.7,margin:0}}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES ══════════ */}
      <section id="features" style={{...sec,scrollMarginTop:80}}>
        <div style={wrap}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}><span style={gtext}>What You Can Build</span></p>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(24px,3.5vw,44px)",fontWeight:800,textAlign:"center",marginBottom:16,color:WHITE,letterSpacing:"-0.02em"}}>
            One AI. <span style={gtext}>Infinite Possibilities.</span>
          </h2>
          <p style={{color:SUB,fontSize:17,textAlign:"center",maxWidth:480,margin:"0 auto 52px",lineHeight:1.6}}>
            Whatever you can describe, Krypton AI can build.
          </p>
          <div style={{display:"grid",gridTemplateColumns:isDesk?"repeat(4,1fr)":isWide?"repeat(2,1fr)":"1fr",gap:16}}>
            {FEATURES.map((f,i)=>(
              <div key={f.title}
                className="card-hover"
                style={{...card,position:"relative",overflow:"hidden"}}
                onMouseEnter={()=>setHoverCard(i)}
                onMouseLeave={()=>setHoverCard(null)}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(var(--ga-rgb),.3),transparent)",opacity:hoverCard===i?1:0,transition:"opacity .3s"}}/>
                <div style={{
                  width:52,height:52,borderRadius:14,
                  background:"rgba(var(--ga-rgb),.08)",
                  border:"1px solid rgba(var(--ga-rgb),.13)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:22,marginBottom:18,
                  transition:"all .3s",
                  ...(hoverCard===i?{background:"rgba(var(--ga-rgb),.15)",transform:"scale(1.08)"}:{}),
                }}>{f.icon}</div>
                <h3 style={{fontSize:16,fontWeight:700,marginBottom:10,fontFamily:"'Syne',sans-serif"}}><span style={gtext}>{f.title}</span></h3>
                <p style={{color:SUB,fontSize:14,lineHeight:1.75,margin:0}}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ EXAMPLES ══════════ */}
      <section id="examples" style={{...sec,scrollMarginTop:80,background:"rgba(255,255,255,.018)",borderTop:"1px solid rgba(255,255,255,.05)"}}>
        <div style={wrap}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}><span style={gtext}>Examples</span></p>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(24px,3.5vw,44px)",fontWeight:800,textAlign:"center",marginBottom:16,color:WHITE,letterSpacing:"-0.02em"}}>
            See What&apos;s <span style={gtext}>Possible</span>
          </h2>
          <p style={{color:SUB,fontSize:17,textAlign:"center",maxWidth:480,margin:"0 auto 52px",lineHeight:1.6}}>
            Real projects built with Krypton AI in seconds.
          </p>
          <div style={{display:"grid",gridTemplateColumns:isDesk?"repeat(3,1fr)":isWide?"repeat(2,1fr)":"1fr",gap:16}}>
            {[{title:"SaaS Dashboard",tag:"Web App",emoji:"📊",acc:"245,197,66"},{title:"Portfolio Site",tag:"Website",emoji:"💼",acc:"0,208,132"},{title:"Snake Game",tag:"Game",emoji:"🎮",acc:"139,92,246"},{title:"Invoice Tool",tag:"Tool",emoji:"📋",acc:"59,130,246"},{title:"Fitness App",tag:"Web App",emoji:"💪",acc:"244,63,94"},{title:"E-Commerce Store",tag:"Website",emoji:"🛒",acc:"16,185,129"}].map(ex=>(
              <div key={ex.title}
                style={{background:`rgba(${ex.acc},.05)`,border:`1px solid rgba(${ex.acc},.12)`,borderRadius:20,overflow:"hidden",cursor:"pointer",transition:"all .3s"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-6px)";e.currentTarget.style.boxShadow=`0 24px 56px rgba(${ex.acc},.15)`;e.currentTarget.style.borderColor=`rgba(${ex.acc},.3)`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";e.currentTarget.style.borderColor=`rgba(${ex.acc},.12)`;}}
                onClick={()=>router.push("/auth/signup")}>
                <div style={{height:150,background:`linear-gradient(135deg,rgba(${ex.acc},.14),rgba(${ex.acc},.03))`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:48,position:"relative",overflow:"hidden"}}>
                  {ex.emoji}
                  <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,rgba(${ex.acc},.4),transparent)`}}/>
                </div>
                <div style={{padding:"18px 20px"}}>
                  <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:`rgba(${ex.acc},1)`}}>{ex.tag}</span>
                  <p style={{fontSize:16,fontWeight:600,margin:"6px 0 4px",color:WHITE,fontFamily:"'Syne',sans-serif"}}>{ex.title}</p>
                  <p style={{fontSize:12,color:MUTED}}>Built in under 10 seconds →</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:44}}>
            <button className="gb shine" onClick={()=>router.push("/auth/signup")}
              style={{display:"inline-flex",alignItems:"center",padding:"14px 40px",border:"none",borderRadius:14,color:"#050505",fontSize:15,fontWeight:700,cursor:"pointer",transition:"transform .2s,box-shadow .2s",letterSpacing:"0.01em"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 16px 40px rgba(var(--ga-rgb),.35)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
              Build Your Own →
            </button>
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS ══════════ */}
      <section style={{...sec,scrollMarginTop:80}}>
        <div style={wrap}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}><span style={gtext}>Testimonials</span></p>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(24px,3.5vw,44px)",fontWeight:800,textAlign:"center",marginBottom:16,color:WHITE,letterSpacing:"-0.02em"}}>
            Loved by <span style={gtext}>Builders</span>
          </h2>
          <p style={{color:SUB,fontSize:17,textAlign:"center",maxWidth:480,margin:"0 auto 52px",lineHeight:1.6}}>
            Join thousands of creators shipping faster with AI.
          </p>
          <div style={{display:"grid",gridTemplateColumns:isDesk?"repeat(3,1fr)":"1fr",gap:20}}>
            {TESTIMONIALS.map((t,i)=>(
              <div key={i}
                className="card-hover"
                style={{...card,position:"relative",overflow:"hidden",padding:"32px"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,var(--ga),var(--gb))",opacity:.4}}/>
                <div style={{position:"absolute",top:0,right:0,width:100,height:100,borderRadius:"50%",background:"radial-gradient(circle,rgba(var(--ga-rgb),.06) 0%,transparent 70%)",pointerEvents:"none"}}/>
                <div style={{fontSize:15,marginBottom:16,letterSpacing:".05em"}}>⭐⭐⭐⭐⭐</div>
                <p style={{color:"rgba(255,255,255,.85)",fontSize:15,lineHeight:1.8,marginBottom:24,fontStyle:"italic",fontWeight:400}}>&ldquo;{t.text}&rdquo;</p>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,rgba(var(--ga-rgb),.3),rgba(var(--gb-rgb),.3))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,flexShrink:0,color:WHITE,fontFamily:"'Syne',sans-serif"}}>{t.name[0]}</div>
                  <div>
                    <p style={{fontWeight:700,fontSize:14,margin:0,color:WHITE}}>{t.name}</p>
                    <p style={{color:MUTED,fontSize:12,margin:"2px 0 0"}}>{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ PRICING ══════════ */}
      <section id="pricing" style={{...sec,scrollMarginTop:80,background:"rgba(255,255,255,.018)",borderTop:"1px solid rgba(255,255,255,.05)"}}>
        <div style={wrap}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}><span style={gtext}>Pricing</span></p>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(24px,3.5vw,44px)",fontWeight:800,textAlign:"center",marginBottom:12,color:WHITE,letterSpacing:"-0.02em"}}>
            Simple, <span style={gtext}>Transparent Pricing</span>
          </h2>
          <p style={{color:SUB,textAlign:"center",fontSize:17,marginBottom:36,lineHeight:1.6}}>Start free. Upgrade when you&apos;re ready.</p>
          <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:44}}>
            {(["m","y"] as const).map(b=>(
              <button key={b} onClick={()=>setBill(b)}
                style={{padding:"9px 24px",borderRadius:12,border:"1px solid",borderColor:billing===b?"rgba(var(--ga-rgb),.4)":"rgba(255,255,255,.08)",background:billing===b?"rgba(var(--ga-rgb),.1)":"transparent",color:billing===b?"var(--ga)":MUTED,fontWeight:600,fontSize:13,cursor:"pointer",transition:"all .2s",fontFamily:"'Inter',sans-serif"}}>
                {b==="m"?"Monthly":"Yearly"}{b==="y"&&<span style={{fontSize:10,marginLeft:6,color:"#10B981",fontWeight:700}}>Save 20%</span>}
              </button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:isDesk?"repeat(4,1fr)":isWide?"repeat(2,1fr)":"1fr",gap:16}}>
            {PLANS.map(plan=>(
              <div key={plan.name}
                style={{background:plan.hot?"rgba(var(--ga-rgb),.04)":"rgba(13,13,13,.8)",border:plan.hot?"1px solid rgba(var(--ga-rgb),.3)":"1px solid rgba(255,255,255,.07)",borderRadius:22,padding:28,position:"relative",transition:"all .3s",boxShadow:plan.hot?"0 0 60px rgba(var(--ga-rgb),.08)":"none"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-6px)";e.currentTarget.style.boxShadow=plan.hot?"0 24px 64px rgba(var(--ga-rgb),.16)":"0 24px 48px rgba(0,0,0,.4)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=plan.hot?"0 0 60px rgba(var(--ga-rgb),.08)":"none";}}>
                {plan.hot&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,var(--ga),var(--gb))",borderRadius:"22px 22px 0 0"}}/>}
                {plan.hot&&<div className="gb" style={{position:"absolute",top:-13,left:"50%",transform:"translateX(-50%)",color:"#050505",fontSize:11,fontWeight:700,padding:"4px 16px",borderRadius:20,whiteSpace:"nowrap"}}>✨ Most Popular</div>}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:18}}>{plan.emoji}</span><h3 style={{fontSize:18,fontWeight:700,color:WHITE,fontFamily:"'Syne',sans-serif"}}><span style={gtext}>{plan.name}</span></h3></div>
                <p style={{color:"#10B981",fontSize:11,fontWeight:600,marginBottom:16,letterSpacing:"0.03em"}}>{plan.credits}</p>
                <div style={{marginBottom:20}}><span style={{...gtext,fontSize:40,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{billing==="m"?plan.m:plan.y}</span><span style={{color:MUTED,fontSize:13}}>/mo</span></div>
                {plan.inc.map(f=><div key={f} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:9}}><span style={{...gtext,fontSize:12,flexShrink:0,fontWeight:700}}>✓</span><span style={{fontSize:13,color:SUB,lineHeight:1.5}}>{f}</span></div>)}
                {plan.off.map(f=><div key={f} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:9}}><span style={{fontSize:12,flexShrink:0,color:"#2a2a2a"}}>✕</span><span style={{fontSize:13,color:"#2f2f2f"}}>{f}</span></div>)}
                <button className={plan.hot?"gb shine":""} onClick={()=>router.push("/auth/signup")}
                  style={{width:"100%",marginTop:20,padding:13,background:plan.hot?undefined:"rgba(255,255,255,.04)",border:plan.hot?"none":"1px solid rgba(255,255,255,.08)",borderRadius:12,color:plan.hot?"#050505":WHITE,fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .2s",fontFamily:"'Inter',sans-serif"}}
                  onMouseEnter={e=>{if(!plan.hot){e.currentTarget.style.background="rgba(255,255,255,.08)";e.currentTarget.style.transform="translateY(-1px)";}}}
                  onMouseLeave={e=>{if(!plan.hot){e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.transform="none";}}}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
          <p style={{color:MUTED,textAlign:"center",fontSize:13,marginTop:28}}>All plans include a 14-day money-back guarantee. No credit card required to start.</p>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section id="faq" style={{...sec,scrollMarginTop:80}}>
        <div style={{width:"100%",maxWidth:700,margin:"0 auto",padding:"0 clamp(20px,4vw,64px)"}}>
          <p style={{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}><span style={gtext}>FAQ</span></p>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(24px,3.5vw,44px)",fontWeight:800,textAlign:"center",marginBottom:16,color:WHITE,letterSpacing:"-0.02em"}}>
            <span style={gtext}>Common Questions</span>
          </h2>
          <p style={{color:SUB,fontSize:17,textAlign:"center",marginBottom:48,lineHeight:1.6}}>Everything you need to know.</p>
          {FAQS.map((item,i)=>(
            <div key={i} style={{borderBottom:"1px solid rgba(255,255,255,.06)"}}>
              <button onClick={()=>setFaq(openFaq===i?null:i)}
                style={{width:"100%",textAlign:"left",background:"none",border:"none",cursor:"pointer",padding:"22px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}>
                <span style={{fontWeight:600,fontSize:16,color:WHITE,fontFamily:"'Syne',sans-serif",lineHeight:1.4}}>{item.q}</span>
                <span style={{color:"var(--ga)",transition:"transform .3s",transform:openFaq===i?"rotate(45deg)":"none",display:"inline-block",fontSize:24,flexShrink:0,lineHeight:1}}>+</span>
              </button>
              {openFaq===i&&<p style={{color:SUB,fontSize:15,lineHeight:1.8,paddingBottom:22,margin:0}}>{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section style={{...sec,textAlign:"center",overflow:"hidden",background:"rgba(255,255,255,.018)",borderTop:"1px solid rgba(255,255,255,.05)"}}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"70vw",height:"70vw",maxWidth:700,maxHeight:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(var(--ga-rgb),.05) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{...wrap,position:"relative"}}>
          <div style={{
            width:80,height:80,borderRadius:24,
            background:"rgba(var(--ga-rgb),.1)",
            border:"1px solid rgba(var(--ga-rgb),.2)",
            margin:"0 auto 32px",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,
          }}>⚡</div>
          <h2 style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:"clamp(32px,5vw,66px)",fontWeight:800,lineHeight:1.06,letterSpacing:"-0.02em",maxWidth:680,margin:"0 auto 20px",color:WHITE}}>
            The future of building is{" "}<span style={gtext}>a sentence away.</span>
          </h2>
          <p style={{color:SUB,fontSize:18,lineHeight:1.75,maxWidth:500,margin:"0 auto 44px",fontWeight:400}}>
            Join thousands of builders creating the web with Krypton AI. No coding. No waiting. Just results.
          </p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:20}}>
            <button className="gb shine" onClick={()=>router.push("/auth/signup")}
              style={{display:"inline-flex",alignItems:"center",padding:"16px 48px",border:"none",borderRadius:14,color:"#050505",fontSize:16,fontWeight:700,cursor:"pointer",transition:"transform .2s,box-shadow .2s",letterSpacing:"0.01em"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 20px 56px rgba(var(--ga-rgb),.4)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
              Start Free — No credit card →
            </button>
            <button onClick={()=>goto("examples")}
              style={{display:"inline-flex",alignItems:"center",padding:"16px 32px",border:"1px solid rgba(255,255,255,.14)",background:"rgba(255,255,255,.05)",borderRadius:14,color:WHITE,fontSize:16,fontWeight:600,cursor:"pointer",transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.1)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)";}}>
              See Examples
            </button>
          </div>
          <p style={{color:MUTED,fontSize:13}}>5 free generations every day. No card needed.</p>
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
              {title:"Legal",    links:[{l:"Privacy Policy",h:"/privacy"},{l:"Terms of Service",h:"/privacy/terms"},{l:"Refund Policy",h:"/refund"}]},
              {title:"Social",   links:[{l:"X (Twitter)",h:"https://twitter.com/kryptonai"},{l:"LinkedIn",h:"https://linkedin.com/company/kryptonai"},{l:"GitHub",h:"https://github.com/jangeersinghktm-design/Magic-Krypton-ai-"}]},
            ].map(col=>(
              <div key={col.title}>
                <p style={{fontWeight:700,fontSize:13,marginBottom:16,fontFamily:"'Syne',sans-serif"}}><span style={gtext}>{col.title}</span></p>
                {col.links.map(link=>(
                  <a key={link.l} href={link.h}
                    style={{display:"block",color:MUTED,fontSize:13,marginBottom:11,textDecoration:"none",transition:"color .2s"}}
                    onMouseEnter={e=>e.currentTarget.style.color=WHITE}
                    onMouseLeave={e=>e.currentTarget.style.color=MUTED}>
                    {link.l}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div style={{borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:24,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <KryptonLogo size={36} showText={true} animated={false}/>
            <p style={{color:MUTED,fontSize:12,margin:0}}>© 2026 Krypton AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
