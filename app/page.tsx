"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import KryptonLogo from "@/components/branding/KryptonLogo";

const GRAD = "linear-gradient(135deg,#F5F5F5 0%,#D9D9D9 50%,#BFC5CC 100%)";
const C = {
  bg:"#050816", card:"#0B1020", border:"rgba(255,255,255,0.08)",
  borderHi:"rgba(245,245,245,0.18)", text:"#F5F5F5", sub:"#9CA3AF",
  muted:"#5B6472", gold:"#D9D9D9",
};

const PLACEHOLDERS = [
  "Build a premium SaaS landing page...",
  "Create a fitness tracking dashboard...",
  "Build a restaurant website with menu...",
  "Create an e-commerce store...",
  "Build a portfolio website...",
  "Design a crypto dashboard...",
  "Create a productivity tool...",
];

const BUILD_TYPES = ["Website","Landing Page","App","Dashboard","Tool","E-Commerce","Portfolio"];

export default function HomePage() {
  const router  = useRouter();
  const supabase = createClient();

  const [user, setUser]       = useState<any>(null);
  const [prompt, setPrompt]   = useState("");
  const [buildType, setBuildType]     = useState("Website");
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const [pidx, setPidx]       = useState(0);
  const [typed, setTyped]     = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [listening, setListening] = useState(false);
  const [credits, setCredits] = useState({ total:5, used:0 });
  const silenceRef = useRef<any>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/landing"); return; }
      setUser(session.user);
      fetchProjects(session.user.id);
      fetchCredits(session.user.id);
    })();
  }, []);

  // Close type menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) setShowTypeMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const fetchProjects = async (uid: string) => {
    setLoadingProjects(true);
    // Try updated_at sort first, fallback to created_at
    const { data } = await supabase
      .from("projects")
      .select("id, title, name, prompt, html_code, created_at, updated_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(8);
    // Filter client-side to show only projects with content
    setProjects((data || []).filter((p: any) => p.html_code || p.title || p.name));
    setLoadingProjects(false);
  };

  const fetchCredits = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("total_credits,used_credits").eq("id", uid).single();
    if (data) setCredits({ total: data.total_credits || 5, used: data.used_credits || 0 });
  };

  // Typewriter placeholder
  useEffect(() => {
    const target = PLACEHOLDERS[pidx];
    let i = 0; setTyped("");
    const iv = setInterval(() => {
      if (i < target.length) { setTyped(target.slice(0, ++i)); }
      else { clearInterval(iv); setTimeout(() => setPidx(p => (p+1)%PLACEHOLDERS.length), 2200); }
    }, 42);
    return () => clearInterval(iv);
  }, [pidx]);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    const fullPrompt = buildType !== "Website" ? `Build a ${buildType}: ${prompt}` : prompt;
    const typeParam = buildType.toLowerCase().replace(/ /g,"-");
    window.open(`/create?prompt=${encodeURIComponent(fullPrompt)}&forceType=${encodeURIComponent(typeParam)}`, "_blank");
  };

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR(); r.continuous = true; r.interimResults = true;
    r.onstart = () => setListening(true);
    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setPrompt(t);
      clearTimeout(silenceRef.current);
      silenceRef.current = setTimeout(() => r.stop(), 4000);
    };
    r.onend = () => setListening(false);
    r.start();
  };

  const remaining = credits.total - credits.used;
  const firstName = user?.user_metadata?.first_name || user?.email?.split("@")[0] || "there";

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif", overflowY:"auto", minHeight:"100vh", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,215,0,.15);border-radius:4px;}
        @keyframes gm1{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(3%,-3%)scale(1.05)}}
        @keyframes gm2{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(-3%,3%)scale(1.08)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .proj-btn:hover{border-color:rgba(255,215,0,.35)!important;background:rgba(255,215,0,.04)!important;}
        .proj-btn:hover .proj-arrow{color:#D9D9D9!important;}
        .send-btn:hover{transform:scale(1.06);box-shadow:0 0 20px rgba(255,215,0,.4);}
      `}</style>

      {/* Background glows */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-10%", left:"-10%", width:"55vw", height:"55vw", borderRadius:"50%", filter:"blur(100px)", background:"radial-gradient(circle,rgba(255,215,0,.22) 0%,transparent 70%)", animation:"gm1 18s ease-in-out infinite" }}/>
        <div style={{ position:"absolute", bottom:"-10%", right:"-10%", width:"50vw", height:"50vw", borderRadius:"50%", filter:"blur(100px)", background:"radial-gradient(circle,rgba(255,138,0,.15) 0%,transparent 70%)", animation:"gm2 22s ease-in-out infinite" }}/>
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(255,215,0,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,215,0,.015) 1px,transparent 1px)", backgroundSize:"48px 48px" }}/>
      </div>

      {/* Top bar */}
      <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, background:"rgba(5,5,5,.85)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10 }}>
        <span style={{ fontSize:12, color:C.muted }}>Home</span>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <div style={{ padding:"4px 12px", borderRadius:20, background:"rgba(255,215,0,.08)", border:`1px solid ${C.border}`, fontSize:11, color:C.gold, fontWeight:600 }}>
            ⚡ {remaining} credits
          </div>
          <button onClick={() => window.open("/create","_blank")} style={{ padding:"6px 16px", background:GRAD, border:"none", borderRadius:8, color:"#050505", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ New</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"clamp(32px,6vw,64px) 20px 48px", position:"relative", zIndex:1 }}>
        <div style={{ width:"100%", maxWidth:640 }}>

          {/* ── Heading ── */}
          <div style={{ textAlign:"center", marginBottom:36, animation:"fadeUp .5s ease" }}>
            <h1 style={{
              fontFamily:"'Inter',system-ui,sans-serif",
              fontSize:"clamp(22px,5.5vw,48px)",
              fontWeight:800,
              lineHeight:1.2,
              letterSpacing:"-0.02em",
              marginBottom:10,
              color:C.text,
              maxWidth:"100%",
              overflowWrap:"break-word",
              wordBreak:"break-word",
              padding:"0 8px",
            }}>
              Got an idea,{" "}
              <span style={{ background:GRAD, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", overflowWrap:"break-word", wordBreak:"break-word" }}>
                {firstName}?
              </span>
            </h1>
            <p style={{ color:C.sub, fontSize:"clamp(14px,2vw,16px)", lineHeight:1.6, fontWeight:400 }}>
              Describe your idea and Krypton AI will build it instantly.
            </p>
          </div>

          {/* ── Prompt Box ── */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:18, padding:"16px 18px", boxShadow:"0 0 48px rgba(245,245,245,.04)", marginBottom:56, animation:"fadeUp .5s .1s ease both" }}>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              placeholder={typed || "Describe what you want to build..."}
              rows={3}
              style={{ width:"100%", background:"none", border:"none", color:C.text, fontSize:15, resize:"none", outline:"none", fontFamily:"'DM Sans',sans-serif", lineHeight:1.65, caretColor:C.gold }}
            />
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
              {/* Build type selector */}
              <div ref={typeMenuRef} style={{ position:"relative" }}>
                <button onClick={() => setShowTypeMenu(v => !v)}
                  style={{ padding:"6px 14px", background:"#1a1a1a", border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                  {buildType} <span style={{ fontSize:9, opacity:.6 }}>▾</span>
                </button>
                {showTypeMenu && (
                  <div style={{ position:"absolute", bottom:44, left:0, background:"#111", border:`1px solid ${C.border}`, borderRadius:12, padding:6, zIndex:50, minWidth:140, boxShadow:"0 16px 40px rgba(0,0,0,.8)" }}>
                    {BUILD_TYPES.map(t => (
                      <button key={t} onClick={() => { setBuildType(t); setShowTypeMenu(false); }}
                        style={{ width:"100%", textAlign:"left", padding:"8px 12px", background:"none", border:"none", color:t===buildType?C.gold:C.muted, fontSize:13, cursor:"pointer", borderRadius:8, fontWeight:t===buildType?600:400 }}
                        onMouseEnter={e => { e.currentTarget.style.background="#1e1e1e"; e.currentTarget.style.color=C.text; }}
                        onMouseLeave={e => { e.currentTarget.style.background="none"; e.currentTarget.style.color=t===buildType?C.gold:C.muted; }}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button onClick={handleVoice}
                  style={{ width:34, height:34, borderRadius:"50%", background:listening?C.gold:"#1e1e1e", border:`1px solid ${listening?C.gold:C.border}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="2" width="6" height="11" rx="3" fill={listening?"#050505":"#666"}/>
                    <path d="M5 11a7 7 0 0014 0" stroke={listening?"#050505":"#666"} strokeWidth="2" strokeLinecap="round"/>
                    <line x1="12" y1="18" x2="12" y2="22" stroke={listening?"#050505":"#666"} strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                <button onClick={handleGenerate} disabled={!prompt.trim()} className="send-btn"
                  style={{ width:40, height:40, borderRadius:"50%", background:prompt.trim()?GRAD:"#1a1a1a", border:"none", cursor:prompt.trim()?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .2s" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path d="M12 19V5M5 12l7-7 7 7" stroke={prompt.trim()?"#050505":"#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── Recent Projects ── */}
          <div style={{ animation:"fadeUp .5s .2s ease both" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <p style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".1em" }}>Recent Projects</p>
              <button onClick={() => router.push("/dashboard")} style={{ fontSize:11, color:C.gold, background:"none", border:"none", cursor:"pointer", fontWeight:500 }}>
                All projects →
              </button>
            </div>

            {loadingProjects && (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ height:54, borderRadius:12, background:C.card, border:`1px solid ${C.border}`, opacity:.5 }}/>
                ))}
              </div>
            )}

            {!loadingProjects && projects.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 20px", background:C.card, border:`1px solid ${C.border}`, borderRadius:16 }}>
                <div style={{ fontSize:32, marginBottom:10 }}>✨</div>
                <div style={{ fontSize:14, color:C.sub, marginBottom:4 }}>No projects yet</div>
                <div style={{ fontSize:12, color:C.muted }}>Describe your idea above and press Enter to start building!</div>
              </div>
            )}

            {!loadingProjects && projects.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
                {projects.map(p => {
                  const name = p.title || p.name || p.prompt?.slice(0,40) || "Untitled Project";
                  const date = new Date(p.updated_at || p.created_at);
                  const timeAgo = formatTimeAgo(date);
                  const pType = p.project_type || "website";
                  const typeConfig: Record<string,{icon:string;color:string;label:string}> = {
                    website:   {icon:"◇", color:"#F5F5F5", label:"Website"},
                    landing:   {icon:"◆", color:"#D9D9D9", label:"Landing"},
                    app:       {icon:"▣", color:"#BFC5CC", label:"App"},
                                        dashboard: {icon:"◈", color:"#F5F5F5", label:"Dashboard"},
                    ecommerce: {icon:"🛒", color:"#F97316", label:"Store"},
                    portfolio: {icon:"💼", color:"#8B5CF6", label:"Portfolio"},
                    tool:      {icon:"🔧", color:"#64748B", label:"Tool"},
                  };
                  const tc = typeConfig[pType] || typeConfig.website;
                  return (
                    <div key={p.id} style={{
                      background:C.card, border:`1px solid ${C.border}`, borderRadius:16,
                      overflow:"hidden", cursor:"pointer", transition:"all 0.25s ease",
                      display:"flex", flexDirection:"column",
                    }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(255,215,0,0.3)";(e.currentTarget as HTMLElement).style.transform="translateY(-3px)";(e.currentTarget as HTMLElement).style.boxShadow="0 12px 40px rgba(0,0,0,0.4)";}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.border;(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.boxShadow="";}}
                    >
                      {/* Thumbnail — real live preview of generated site */}
                      <div style={{
                        height:140, background:p.html_code?"#fff":`linear-gradient(135deg,${tc.color}22,${tc.color}08)`,
                        borderBottom:`1px solid ${C.border}`, position:"relative", overflow:"hidden",
                      }}>
                        {p.html_code ? (
                          <div style={{
                            width:"400%", height:"400%", transform:"scale(0.25)",
                            transformOrigin:"top left", pointerEvents:"none",
                          }}>
                            <iframe
                              srcDoc={p.html_code}
                              style={{width:"100%", height:"100%", border:"none", display:"block"}}
                              sandbox="allow-scripts allow-same-origin"
                              loading="lazy"
                              title={name}
                            />
                          </div>
                        ) : (
                          <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <div style={{fontSize:40, opacity:0.4}}>{tc.icon}</div>
                          </div>
                        )}
                        {/* Type badge */}
                        <div style={{
                          position:"absolute", top:10, left:10,
                          background:`${tc.color}dd`, border:`1px solid ${tc.color}`,
                          color:"#fff", fontSize:10, fontWeight:700, padding:"2px 8px",
                          borderRadius:20, letterSpacing:"0.05em", boxShadow:"0 2px 8px rgba(0,0,0,0.3)",
                        }}>{tc.label}</div>
                        {/* Quality score if available */}
                        {p.quality_score && (
                          <div style={{
                            position:"absolute", top:10, right:10,
                            background:"rgba(16,185,129,0.9)", border:"1px solid rgba(16,185,129,1)",
                            color:"#fff", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20,
                            boxShadow:"0 2px 8px rgba(0,0,0,0.3)",
                          }}>{p.quality_score}%</div>
                        )}
                      </div>
                      {/* Info */}
                      <div style={{padding:"12px 14px", flex:1}}>
                        <div style={{fontWeight:600, fontSize:13, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{name}</div>
                        <div style={{fontSize:11, color:C.muted}}>{timeAgo}</div>
                      </div>
                      {/* Actions */}
                      <div style={{display:"flex", borderTop:`1px solid ${C.border}`}}>
                        <button onClick={(e)=>{
                          e.stopPropagation();
                          if (!p.html_code) { router.push(`/create?id=${p.id}`); return; }
                          const win = window.open("", "_blank");
                          if (win) { win.document.write(p.html_code); win.document.close(); }
                        }}
                          style={{flex:1, padding:"8px 0", background:"none", border:"none", color:C.gold,
                            fontSize:12, fontWeight:600, cursor:"pointer", transition:"background 0.15s"}}
                           onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,215,0,0.06)")}
                          onMouseLeave={e=>(e.currentTarget.style.background="none")}>
                          Open ↗
                        </button>
                        <div style={{width:1, background:C.border}}/>
                        <button onClick={(e)=>{e.stopPropagation();router.push(`/create?id=${p.id}`);}}
                          style={{flex:1, padding:"8px 0", background:"none", border:"none", color:C.muted,
                            fontSize:12, cursor:"pointer", transition:"background 0.15s"}}
                          onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.04)")}
                          onMouseLeave={e=>(e.currentTarget.style.background="none")}>
                          Edit ✏️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)    return "Just now";
  if (mins < 60)   return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days < 7)    return `${days}d ago`;
  return date.toLocaleDateString();
}
