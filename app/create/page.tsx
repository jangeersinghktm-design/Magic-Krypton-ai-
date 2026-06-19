"use client";
/**
 * KRYPTON AI — Create Workspace v5
 * 2-Panel: Chat | Preview
 * Dark Navy Premium Theme
 * Claude-style thinking panel
 * Icon tabs for Files/Deploy/History
 */

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import KryptonLogo from "@/components/branding/KryptonLogo";
import AgentTimeline, { AgentPhaseEvent } from "@/components/workspace/AgentTimeline";
import { detectGameType, buildGameMemory, formatGameMemoryForAI, type GameProjectMemory } from "@/lib/game-builder";
import { runProductionGate } from "@/lib/completion-engine";

// ── Design Tokens ─────────────────────────────────────────────────
const C = {
  bg:       "#050816",   // Deep Space
  surface:  "#0B1020",
  card:     "#11151F",   // Graphite
  border:   "rgba(255,255,255,0.08)",
  borderHi: "rgba(245,245,245,0.22)",
  text:     "#F5F5F5",   // Platinum
  sub:      "#9AA3AF",
  muted:    "#5B6472",
  gold:     "#F5F5F5",   // legacy key name, platinum value
  purple:   "#D9D9D9",   // legacy key name, silver value
  violet:   "#BFC5CC",   // legacy key name, accent-silver value
  green:    "#5FB88A",
  red:      "#E5736B",
  grad:     "linear-gradient(135deg,#F5F5F5,#BFC5CC)",
  gradP:    "linear-gradient(135deg,#D9D9D9,#9AA3AF)",
};

type MsgRole  = "user" | "ai";
type MsgType  = "text" | "thinking" | "summary" | "error";
type RightTab = "preview" | "files" | "deploy" | "history";
type Device   = "desktop" | "tablet" | "mobile";

interface ChatMessage {
  id:       string;
  role:     MsgRole;
  type:     MsgType;
  content:  string;
  ts:       Date;
  phases?:  AgentPhaseEvent[];
  isActive?:boolean;
  credits?: number;
  files?:   string[];
  gate?:    { dimensions:{dimension:string;score:number}[]; buildPass:boolean; validationPass:boolean; runtimePass:boolean; mobilePass:boolean; overallPass:boolean; repairAttempts:number };
}

interface Version {
  id: string; version_number: number; message: string;
  created_at: string; code_snapshot: Record<string, string>;
}

// ── Project Memory ────────────────────────────────────────────────
interface ProjectMemory {
  projectName: string; originalPrompt: string;
  colorSystem: string; fonts: string; sections: string;
  navigation: string; editHistory: string[]; codeLines: number;
  isDarkTheme: boolean; hasNavbar: boolean; hasFooter: boolean;
  // Phase 7 — Memory Engine: project blueprint from generation
  blueprint?: any;
}

function buildProjectMemory(html:string, name:string, prompt:string, msgs:ChatMessage[], prev?:ProjectMemory|null, blueprint?:any): ProjectMemory {
  if (!html) return prev || { projectName:name, originalPrompt:prompt, colorSystem:"", fonts:"", sections:"", navigation:"", editHistory:[], codeLines:0, isDarkTheme:true, hasNavbar:false, hasFooter:false, blueprint };
  const cssVars = (html.match(/--[\w-]+\s*:\s*[^;}{]+/g)||[]).slice(0,20).join("; ").slice(0,500);
  const fontMatches = html.match(/family=([^&"'\s)]+)/g)||[];
  const fonts = [...new Set(fontMatches.map(f=>f.replace("family=","").split(":")[0].replace(/\+/g," ")))].join(", ")||"System";
  const h2s = (html.match(/<h2[^>]*>([^<]+)<\/h2>/gi)||[]).map(h=>h.replace(/<[^>]+>/g,"")).slice(0,6);
  const h1s = (html.match(/<h1[^>]*>([^<]+)<\/h1>/gi)||[]).map(h=>h.replace(/<[^>]+>/g,"")).slice(0,2);
  const navLinks = (html.match(/<a[^>]*>([^<]{2,25})<\/a>/gi)||[]).map(a=>a.replace(/<[^>]+>/g,"").trim()).filter(t=>t.length>2).slice(0,8);
  const edits = msgs.filter(m=>m.role==="user"&&m.type==="text").map(m=>m.content).slice(-8);
  return { projectName:name, originalPrompt:prompt, colorSystem:cssVars, fonts, sections:[...h1s,...h2s].join("|").slice(0,200), navigation:navLinks.join(", ").slice(0,150), editHistory:edits, codeLines:html.split("\n").length, isDarkTheme:/#0[0-2]/.test(html.slice(0,3000)), hasNavbar:/<nav/.test(html), hasFooter:/<footer/.test(html), blueprint: blueprint||prev?.blueprint };
}

function formatMemoryForAI(mem:ProjectMemory|null): string {
  if (!mem||!mem.colorSystem) return "";
  const blueprintLine = mem.blueprint
    ? `║ Pages/Sections: ${(mem.blueprint.pages||[]).join(", ").slice(0,150)}\n║ Components: ${(mem.blueprint.components||[]).join(", ").slice(0,150)}\n`
    : "";
  return `╔═ KRYPTON PROJECT MEMORY ════════════════╗
║ Project: ${mem.projectName}
║ Theme: ${mem.isDarkTheme?"Dark":"Light"} | ${mem.codeLines} lines
║ Fonts: ${mem.fonts}
║ CSS Variables: ${mem.colorSystem.slice(0,250)}
║ Sections: ${mem.sections.slice(0,150)}
${blueprintLine}╠═ PRESERVE EXACTLY ══════════════════════╣
║ Colors, fonts, layout, existing sections
║ Only change what user requested
╠═ EDIT HISTORY ══════════════════════════╣
${mem.editHistory.map((e,i)=>`║ ${i+1}. ${e.slice(0,70)}`).join("\n")||"║ First edit"}
╚═════════════════════════════════════════╝`;
}

// ── File extractor ────────────────────────────────────────────────
interface VFile { name:string; lang:string; icon:string; content:string; size:string; }
function extractFiles(html:string, name:string): VFile[] {
  if (!html) return [];
  const files:VFile[] = [{ name:"index.html", lang:"html", icon:"🌐", content:html, size:`${(html.length/1024).toFixed(1)}KB` }];
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi)||[]).map(s=>s.replace(/<\/?style[^>]*>/gi,"").trim()).join("\n").trim();
  const js  = (html.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi)||[]).map(s=>s.replace(/<\/?script[^>]*>/gi,"").trim()).filter(s=>s.length>10).join("\n").trim();
  if (css.length>20) files.push({ name:"styles.css", lang:"css", icon:"🎨", content:css, size:`${(css.length/1024).toFixed(1)}KB` });
  if (js.length>20)  files.push({ name:"app.js",     lang:"js",  icon:"⚡", content:js,  size:`${(js.length/1024).toFixed(1)}KB` });
  return files;
}

const mkId    = ()=>  `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const sleep   = (ms:number)=>new Promise(r=>setTimeout(r,ms));
const fmtTime = (d:Date)=>d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});

// ── Claude-style Thinking Panel ───────────────────────────────────
function ThinkingPanel({ phases, isActive }: { phases:AgentPhaseEvent[]; isActive:boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const isDone = !isActive && phases.filter(p=>p.done).length > 0;

  const STATES = ["Reading Request","Understanding Goal","Creating Plan","Building Project","Validating Output","Optimizing Result","Finalizing"];
  const MAP:Record<string,string> = { Reading:"Reading Request", Understanding:"Understanding Goal", Planning:"Creating Plan", Building:"Building Project", Validating:"Validating Output", Optimizing:"Optimizing Result", Finalizing:"Finalizing", Planner:"Reading Request", Builder:"Building Project", Validator:"Validating Output" };

  const stateStatus: Record<string,{done:boolean;active:boolean;pct:number}> = {};
  phases.forEach(p=>{ const label=MAP[p.agent]; if(label) stateStatus[label]={done:!!p.done,active:!p.done&&isActive,pct:p.pct||0}; });

  const currentStep = STATES.find(s=>stateStatus[s]?.active) || (isDone ? "Complete" : "Initializing...");

  return (
    <div style={{ padding:"0 16px 4px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <div style={{ width:18, height:18, borderRadius:"50%", background:`rgba(245,245,245,0.1)`, border:`1px solid rgba(245,245,245,0.3)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <img src="/logo.svg" width={10} height={10} alt="" style={{ opacity:.8 }}/>
        </div>
        <span style={{ fontSize:11, color:C.muted, fontWeight:500 }}>Krypton Intelligence</span>
      </div>

      <div style={{ background:"rgba(245,245,245,0.04)", border:`1px solid rgba(245,245,245,0.12)`, borderRadius:12, overflow:"hidden" }}>
        {/* Thinking header */}
        <button
          onClick={()=>setCollapsed(v=>!v)}
          style={{ width:"100%", padding:"10px 14px", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:10, textAlign:"left" }}
        >
          {isDone ? (
            <span style={{ color:C.green, fontSize:12 }}>✓</span>
          ) : (
            <div style={{ width:7, height:7, borderRadius:"50%", background:C.purple, animation:"pulse 1.4s ease-in-out infinite", flexShrink:0 }}/>
          )}
          <span style={{ fontSize:12, fontWeight:600, color:isDone?C.green:C.purple, flex:1 }}>
            {isDone ? "Completed" : `${currentStep}...`}
          </span>
          <span style={{ fontSize:10, color:C.muted }}>{collapsed?"▶":"▼"}</span>
        </button>

        {/* Progress bar */}
        {!isDone && !collapsed && (
          <div style={{ height:1.5, background:"rgba(255,255,255,0.06)", marginBottom:8 }}>
            <div style={{ height:"100%", width:`${Math.round((phases.filter(p=>p.done).length/7)*100)}%`, background:C.gradP, transition:"width .5s ease" }}/>
          </div>
        )}

        {/* Steps */}
        {!collapsed && (
          <div style={{ padding:"0 14px 12px" }}>
            {STATES.map((label,i)=>{
              const info = stateStatus[label];
              const isDoneS = info?.done||false;
              const isActiveS = info?.active||false;
              const notReached = !info;
              return (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:10, padding:"4px 0", opacity:notReached?0.25:1, transition:"opacity .3s" }}>
                  <div style={{ width:14, height:14, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                    background:isDoneS?"rgba(0,208,132,0.1)":isActiveS?"rgba(245,245,245,0.12)":"rgba(255,255,255,0.04)",
                    border:`1px solid ${isDoneS?"rgba(0,208,132,0.35)":isActiveS?"rgba(245,245,245,0.4)":"rgba(255,255,255,0.07)"}`,
                  }}>
                    {isDoneS ? <span style={{color:C.green,fontSize:7,fontWeight:800}}>✓</span>
                    :isActiveS ? <div style={{width:5,height:5,borderRadius:"50%",border:"1.5px solid rgba(245,245,245,0.3)",borderTopColor:C.purple,animation:"spin .7s linear infinite"}}/>
                    : <div style={{width:3,height:3,borderRadius:"50%",background:"rgba(255,255,255,0.15)"}}/>}
                  </div>
                  <span style={{ fontSize:12, color:isDoneS?"rgba(255,255,255,0.2)":isActiveS?C.purple:C.sub, textDecoration:isDoneS?"line-through":"none", textDecorationColor:"rgba(255,255,255,0.1)", fontWeight:isActiveS?600:400 }}>
                    {label}
                  </span>
                  {isActiveS && info.pct>0 && <span style={{fontSize:10,color:"rgba(245,245,245,0.5)",marginLeft:"auto"}}>{info.pct}%</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── File Explorer Panel ───────────────────────────────────────────
function FilesPanel({ html, projectName }: { html:string; projectName:string }) {
  const [activeFile, setActiveFile] = useState("index.html");
  const [copied, setCopied] = useState(false);
  const files = extractFiles(html, projectName);
  const active = files.find(f=>f.name===activeFile) || files[0];

  const handleCopy = async () => {
    if (!active) return;
    await navigator.clipboard.writeText(active.content);
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };
  const handleDownload = () => {
    if (!html) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html],{type:"text/html"}));
    a.download = `${projectName.replace(/\s+/g,"-").toLowerCase()}.html`;
    a.click();
  };

  if (!html) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10, color:C.muted, fontSize:13 }}>
      <div style={{ fontSize:32, opacity:.2 }}>📁</div>
      <div>Generate a project to see files</div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:C.bg }}>
      {/* File tabs */}
      <div style={{ display:"flex", gap:2, padding:"8px 12px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {files.map(f=>(
          <button key={f.name} onClick={()=>setActiveFile(f.name)} style={{ padding:"5px 12px", borderRadius:8, border:"none", background:activeFile===f.name?"rgba(245,245,245,0.15)":"transparent", color:activeFile===f.name?C.purple:C.muted, fontSize:11.5, fontWeight:activeFile===f.name?600:400, cursor:"pointer", display:"flex", alignItems:"center", gap:5, transition:"all .15s" }}>
            <span>{f.icon}</span><span>{f.name}</span><span style={{opacity:.5,fontSize:10}}>{f.size}</span>
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          <button onClick={handleCopy} style={{ padding:"4px 10px", background:copied?"rgba(0,208,132,0.1)":"rgba(255,255,255,0.04)", border:`1px solid ${copied?"rgba(0,208,132,0.2)":C.border}`, borderRadius:7, color:copied?C.green:C.muted, fontSize:11, cursor:"pointer" }}>
            {copied?"✓ Copied":"Copy"}
          </button>
          <button onClick={handleDownload} style={{ padding:"4px 10px", background:C.grad, border:"none", borderRadius:7, color:"#050816", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            ↓ HTML
          </button>
        </div>
      </div>

      {/* Code viewer */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
        <pre style={{ margin:0, fontSize:11.5, lineHeight:1.6, color:"#9AA3AF", fontFamily:"'JetBrains Mono',monospace", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
          {active?.content||""}
        </pre>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
function CreatePageInner() {
  const router   = useRouter();
  const params   = useSearchParams();
  const supabase = createClient();

  const [user, setUser]         = useState<any>(null);
  const [prompt, setPrompt]     = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [urlAnalyzing, setUrlAnalyzing]   = useState(false);
  const [result, setResult]     = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading]   = useState(false);
  const [projectId, setProjectId]     = useState("");
  const [projectName, setProjectName] = useState("New Project");
  const [editingName, setEditingName] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("preview");
  const [device, setDevice]     = useState<Device>("desktop");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceType, setForceType] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"chat"|"preview">("chat");
  const [credits, setCredits]   = useState({ total:5, used:0 });
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [projectMemory, setProjectMemory] = useState<ProjectMemory|null>(null);
  const [gameMemory, setGameMemory]       = useState<GameProjectMemory|null>(null);
  // Production Gate score — state (not just a runFlow-local) so runEdit's
  // post-edit gate re-check (A3) can read/update it across calls.
  const [completenessScore, setCompletenessScore] = useState<number|null>(null);
  const [isGameProject, setIsGameProject] = useState(false);
  const [listening, setListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const chatEndRef   = useRef<HTMLDivElement>(null);
  const promptRef    = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = credits.total - credits.used;

  const addMsg = useCallback((m:Omit<ChatMessage,"id"|"ts">):string=>{
    const id = mkId();
    setMessages(prev=>[...prev,{...m,id,ts:new Date()}]);
    return id;
  },[]);

  const updateMsg = useCallback((id:string,updates:Partial<ChatMessage>)=>{
    setMessages(prev=>prev.map(m=>m.id===id?{...m,...updates}:m));
  },[]);

  useEffect(()=>{ const c=()=>setIsMobile(window.innerWidth<900); c(); window.addEventListener("resize",c); return()=>window.removeEventListener("resize",c); },[]);
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);
  useEffect(()=>{ initSession(); },[]);

  const initSession = async () => {
    const {data:{session}} = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth/login"); return; }
    setUser(session.user);
    const {data:p} = await supabase.from("profiles").select("total_credits,used_credits,plan,daily_reset_date").eq("id",session.user.id).single();
    if (p) {
      // Daily reset check
      const today = new Date().toISOString().split("T")[0];
      if (p.plan === "free" && p.daily_reset_date !== today) {
        await supabase.from("profiles").update({ used_credits:0, daily_reset_date:today }).eq("id",session.user.id);
        setCredits({total:p.total_credits||5, used:0});
      } else {
        setCredits({total:p.total_credits||5, used:p.used_credits||0});
      }
    }
    const urlId = params.get("id");
    const urlPrompt  = params.get("prompt");
    const ft = params.get("forceType") || ""; setForceType(ft);
    if (urlId) await loadProject(urlId, session.user.id);
    else if (urlPrompt) {
      const dec = decodeURIComponent(urlPrompt);
      setPrompt(dec); promptRef.current = dec;
      window.history.replaceState({},"","/create");
      setTimeout(()=>runFlow(dec),300);
    }
  };

  const loadProject = async (id:string, uid:string) => {
    const {data:proj} = await supabase.from("projects").select("*").eq("id",id).eq("user_id",uid).single();
    if (!proj) return;
    setProjectId(proj.id); setProjectName(proj.name||"Project");
    const html = proj.html_code||"";
    setResult(html); promptRef.current=proj.prompt||"";

    // ── Priority 1: Project Memory V2 — restore on reopen ──────────
    const detected = detectGameType(proj.prompt||"");
    const storedGameMemory: GameProjectMemory|null = proj.game_memory||null;
    const storedProjectMemory: ProjectMemory|null   = proj.project_memory||null;
    const isGame = !!storedGameMemory || detected.isGame;
    if (isGame) setIsGameProject(true);

    // Fallback-derive for rows saved before this column existed (memory-on-reopen fix)
    let restoredGameMemory = storedGameMemory;
    let restoredProjectMemory = storedProjectMemory;
    if (html) {
      if (isGame && !restoredGameMemory) {
        restoredGameMemory = buildGameMemory(html, proj.prompt||"", detected, null);
      }
      if (!restoredProjectMemory) {
        restoredProjectMemory = buildProjectMemory(html, proj.name||"Project", proj.prompt||"", [], null);
      }
    }
    if (restoredGameMemory)    setGameMemory(restoredGameMemory);
    if (restoredProjectMemory) setProjectMemory(restoredProjectMemory);

    // Restore Production Gate score so the next edit's quality-delta (A3)
    // compares against the real current score, not null.
    if (html) {
      try {
        const gateKind = isGame ? "game" : "website";
        const gateSubtype = isGame
          ? (restoredGameMemory?.gameType || detected.gameType || "arcade")
          : (restoredProjectMemory?.blueprint?.projectType || "website");
        setCompletenessScore(runProductionGate(html, gateKind, gateSubtype).score);
      } catch {}
    }

    const hist:any[]=proj.conversation_history||[];
    hist.length>0 ? hist.forEach((m:any)=>addMsg({role:m.role||"ai",type:m.type||"text",content:m.content||""}))
                  : addMsg({role:"ai",type:"text",content:"Project loaded. Describe changes below."});
    const {data:vers} = await supabase.from("project_versions").select("*").eq("project_id",id).order("version_number",{ascending:false}).limit(20);
    if (vers) setVersions(vers as Version[]);

    // Backfill DB for old rows that had no stored memory at all
    if (!storedGameMemory && !storedProjectMemory && (restoredGameMemory || restoredProjectMemory)) {
      persistMemory(id, restoredProjectMemory, restoredGameMemory);
    }
  };

  // Priority 1 — Project Memory V2: fire-and-forget persistence.
  // Wrapped so a missing migration / transient error never affects
  // generation or editing (memory just won't persist that round).
  const persistMemory = (pid:string|null|undefined, projMem?:ProjectMemory|null, gMem?:GameProjectMemory|null) => {
    if (!pid || (!projMem && !gMem)) return;
    const payload:Record<string,any> = {};
    if (projMem) payload.project_memory = projMem;
    if (gMem)    payload.game_memory    = gMem;
    try {
      supabase.from("projects").update(payload).eq("id",pid).then(()=>{},()=>{});
    } catch {}
  };

  const saveProject = async (html:string, name:string, pid?:string) => {
    setSaving(true);
    const {data:{session}} = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    const usePid = pid||projectId;
    if (usePid) {
      await supabase.from("projects").update({ name, title:name, updated_at:new Date().toISOString() }).eq("id",usePid);
    } else {
      const {data} = await supabase.from("projects").insert({ user_id:session.user.id, name, title:name, html_code:html, prompt:promptRef.current, status:"completed", created_at:new Date().toISOString(), updated_at:new Date().toISOString() }).select("id").single();
      if (data?.id) { setProjectId(data.id); window.history.replaceState({},"",`/create?id=${data.id}`); }
    }
    setSaved(true); setSaving(false); setTimeout(()=>setSaved(false),2500);
  };

  const saveVersion = async (html:string, msg:string) => {
    if (!projectId) return;
    const {data} = await supabase.from("project_versions").insert({ project_id:projectId, code_snapshot:{"index.html":html}, message:msg, type:"auto", version_number:versions.length+1, size_bytes:html.length }).select().single();
    if (data) setVersions(v=>[data as Version,...v]);
  };

  // ══════════════════════════════════════════════════════
  // GENERATION FLOW
  // ══════════════════════════════════════════════════════
  const runFlow = async (userPrompt:string) => {
    if (!userPrompt.trim()||loading) return;
    if (remaining<1) {
      addMsg({role:"ai",type:"error",content:"⚡ No credits remaining. Free plan resets daily at midnight. Tap ⚡ to upgrade for unlimited access."});
      router.push("/billing");
      return;
    }
    setLoading(true); setPrompt(""); promptRef.current=userPrompt;
    addMsg({role:"user",type:"text",content:userPrompt});
    const thinkId = addMsg({role:"ai",type:"thinking",content:"",phases:[],isActive:true});

    const {data:{session}} = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    // ── Route to Game Builder if game detected ──────────────────
    const rawDetected = detectGameType(userPrompt);
    const forcedToGame = forceType === "game";
    const forcedAwayFromGame = forceType !== "" && forceType !== "game";
    const detected = {
      ...rawDetected,
      isGame: forcedAwayFromGame ? false : (forcedToGame ? true : rawDetected.isGame),
    };
    if (detected.isGame) {
      setIsGameProject(true);
    }

    let html=""; let credUsed=1; let savedPid="";
    let completenessScore:number|null=null; let auditFailed:string[]=[];
    let receivedBlueprint:any=null;
    let gateResult:any=null;
    const livePhases:AgentPhaseEvent[]=[];

    // Use game API for games, orchestrate for everything else  
    const apiEndpoint = detected.isGame ? "/api/game" : "/api/orchestrate";

    try {
      const res = await fetch(apiEndpoint,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:userPrompt,userId:session.user.id,accessToken:session.access_token,forceType:forceType||undefined,competitorUrl:competitorUrl?.trim()||undefined}),
        signal:AbortSignal.timeout(55000),
      });
      if (!res.ok||!res.body) throw new Error("stream_failed");

      const reader=res.body.getReader(); const decoder=new TextDecoder(); let buf="";
      const process=(chunk:string)=>{
        const em=chunk.match(/event:\s*(\S+)/); const dm=chunk.match(/data:\s*([\s\S]+)/);
        if (!em||!dm) return;
        let data:any={}; try{data=JSON.parse(dm[1].trim());}catch{return;}
        if (em[1]==="phase"){
          const p:AgentPhaseEvent={agent:data.agent,icon:data.icon,action:data.action,pct:data.pct,done:data.done,status:data.done?"done":"running"};
          const idx=livePhases.findIndex(x=>x.agent===data.agent);
          idx>=0?livePhases[idx]=p:livePhases.push(p);
          updateMsg(thinkId,{phases:[...livePhases],isActive:true});
        }
        if (em[1]==="complete"){
          html=data.html||""; credUsed=data.creditCost||1; savedPid=data.projectId||"";
          completenessScore = typeof data.completenessScore === "number" ? data.completenessScore : null;
          auditFailed = Array.isArray(data.auditFailed) ? data.auditFailed : [];
          receivedBlueprint = data.blueprint || null;
          if (Array.isArray(data.dimensions)) {
            gateResult = {
              dimensions: data.dimensions,
              buildPass: !!data.buildPass, validationPass: !!data.validationPass,
              runtimePass: !!data.runtimePass, mobilePass: !!data.mobilePass,
              overallPass: !!data.overallPass, repairAttempts: data.repairAttempts||0,
            };
          }
          if (savedPid){setProjectId(savedPid);window.history.replaceState({},"",`/create?id=${savedPid}`);}
          livePhases.forEach(p=>{p.done=true;p.status="done";});
          updateMsg(thinkId,{phases:[...livePhases],isActive:false});
        }
        if (em[1]==="error"){
          if (data.code==="NO_CREDITS"){
            updateMsg(thinkId,{type:"error",content:"⚡ No credits. Free plan resets daily. Tap ⚡ to upgrade.",isActive:false});
            setLoading(false); return;
          }
          throw new Error(data.message);
        }
      };
      while(true){
        const {done,value}=await reader.read();
        if(done){if(buf.trim())buf.split("\n\n").forEach(c=>{try{process(c)}catch{}});break;}
        buf+=decoder.decode(value,{stream:true});
        const chunks=buf.split("\n\n");buf=chunks.pop()||"";
        for(const c of chunks){try{process(c)}catch(e:any){if(e?.message)throw e;}}
      }
    } catch {
      try {
        const fr=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({prompt:userPrompt}),signal:AbortSignal.timeout(55000)});
        const fd=await fr.json();
        if(fd.html){html=fd.html;credUsed=fd.creditsUsed||1;savedPid=fd.projectId||"";}
        if(fd.code==="NO_CREDITS"){updateMsg(thinkId,{type:"error",content:"⚡ No credits remaining. Upgrade to continue.",isActive:false});setLoading(false);return;}
      } catch {}
    }

    if (!html){
      updateMsg(thinkId,{type:"error",content:"Generation failed. Try a more detailed description.",isActive:false});
      setLoading(false); return;
    }

    setResult(html);
    if (isMobile) setMobilePanel("preview");
    setCredits(c=>({...c,used:c.used+credUsed}));
    const pName=userPrompt.slice(0,50);
    setProjectName(pName);
    const newProjMem = buildProjectMemory(html,pName,userPrompt,messages,projectMemory,receivedBlueprint);
    setProjectMemory(newProjMem);
    // Update game memory if this is a game
    let newGameMem: GameProjectMemory|undefined;
    if (detected.isGame) {
      newGameMem = buildGameMemory(html, userPrompt, detected, gameMemory, receivedBlueprint);
      setGameMemory(newGameMem);
    }
    // Priority 1 — persist ProjectMemory + GameMemory for this project
    persistMemory(savedPid||projectId, newProjMem, newGameMem||null);
    updateMsg(thinkId,{isActive:false});
    const qualityBadge = completenessScore!==null
      ? ` • Quality: ${completenessScore}/100${completenessScore>=90?" ✅":""}`
      : "";
    addMsg({role:"ai",type:"summary",content:`Built — ${html.split("\n").length} lines of code.${qualityBadge}`,files:["index.html","styles.css","app.js"],credits:credUsed,gate:gateResult||undefined});
    if (completenessScore!==null && completenessScore<90 && auditFailed.length>0){
      addMsg({role:"ai",type:"text",content:`⚠️ A few features may need polish: ${auditFailed.slice(0,4).join(", ")}${auditFailed.length>4?", …":""}. Describe what's not working and I'll fix it.`});
    }

    const pidToUse=savedPid||projectId;
    (async()=>{
      try{
        const {data:{session:s}}=await supabase.auth.getSession(); if(!s) return;
        let finalPid=pidToUse;
        if(!finalPid){
          const {data:proj}=await supabase.from("projects").insert({user_id:s.user.id,name:pName,title:pName,html_code:html,prompt:promptRef.current,status:"completed",created_at:new Date().toISOString(),updated_at:new Date().toISOString()}).select("id").single();
          if(proj?.id){finalPid=proj.id;setProjectId(proj.id);window.history.replaceState({},"",`/create?id=${proj.id}`);}
        }
        if(finalPid){
          const {data:ver}=await supabase.from("project_versions").insert({project_id:finalPid,code_snapshot:{"index.html":html},message:`Generated: ${pName.slice(0,30)}`,type:"auto",version_number:1,size_bytes:html.length}).select().single();
          if(ver)setVersions([ver as Version]);
        }
      }catch{}
    })();
    setLoading(false);
  };

  // ── Edit Flow ──────────────────────────────────────────────────
  const runEdit = async (editPrompt:string) => {
    if (!result||!editPrompt.trim()||loading) return;
    if (remaining<1){
      addMsg({role:"ai",type:"error",content:"⚡ No credits remaining. Free plan resets daily at midnight."});
      router.push("/billing");
      return;
    }
    setLoading(true);
    addMsg({role:"user",type:"text",content:editPrompt});
    const thinkId=addMsg({role:"ai",type:"thinking",content:"",isActive:true,phases:[
      {agent:"Reading",icon:"○",action:"Reading your request",pct:20,status:"running"},
      {agent:"Building",icon:"○",action:"Applying changes",pct:0,status:"running"},
      {agent:"Validating",icon:"○",action:"Validating",pct:0,status:"running"},
    ]});
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){setLoading(false);return;}

    // Pre-analyze competitor URL before generation (result cached in DB)
    if (competitorUrl.trim()) {
      try {
        await fetch("/api/reverse-engineer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: competitorUrl.trim(), accessToken: session.access_token, depth: "quick" }),
          signal: AbortSignal.timeout(20000),
        });
      } catch {}
    }
    updateMsg(thinkId,{phases:[
      {agent:"Reading",icon:"○",action:"Request understood",pct:100,done:true,status:"done"},
      {agent:"Building",icon:"○",action:"Applying changes...",pct:55,status:"running"},
      {agent:"Validating",icon:"○",action:"Waiting",pct:0,status:"running"},
    ]});
    let newHtml="";
    const codeLines=result.split("\n").length;
    const isLarge=codeLines>600;
    const gCtx=isGameProject&&gameMemory?formatGameMemoryForAI(gameMemory):formatMemoryForAI(projectMemory);
    try {
      // Strategy 1: Chat API (game-aware surgical edit)
      const codeForChat=isLarge&&isGameProject
        ?result.slice(0,5000)+"\n\n/* ... MIDDLE SECTION PRESERVED ... */\n\n"+result.slice(-3000)
        :result;
      const r1=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userMessage:editPrompt,currentCode:{"index.html":codeForChat},projectName,framework:isGameProject?"game":"html",projectContext:gCtx,gameMemory:gameMemory||undefined}),signal:AbortSignal.timeout(55000)});
      const d1=await r1.json();
      newHtml=d1.codeChanges?.["index.html"]||"";
      if(!newHtml){const m=(d1.reply||"").match(/<!DOCTYPE[\s\S]*<\/html>/i);if(m)newHtml=m[0];}

      // Strategy 2: Game API regenerate with memory (games only)
      if(!newHtml&&isGameProject){
        const r2=await fetch("/api/game",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:editPrompt+" (EDIT: preserve all existing mechanics)",userId:session.user.id,accessToken:session.access_token,gameMemory}),signal:AbortSignal.timeout(55000)});
        if(r2.ok&&r2.body){
          const reader=r2.body.getReader();const dec=new TextDecoder();let buf="";
          while(true){
            const{done,value}=await reader.read();if(done)break;
            buf+=dec.decode(value,{stream:true});
            for(const chunk of buf.split("\n\n")){
              const dm=chunk.match(/data:\s*([\s\S]+)/);const em=chunk.match(/event:\s*(\S+)/);
              if(dm&&em){try{const d=JSON.parse(dm[1].trim());if(em[1]==="complete"&&d.html)newHtml=d.html;}catch{}}
            }
            buf=buf.split("\n\n").pop()||"";
          }
        }
      }

      // Strategy 3: Generate API (websites only)
      if(!newHtml&&!isGameProject){
        const ctx=isLarge?result.slice(0,6000)+"\n\n[...]\n\n"+result.slice(-3000):result.slice(0,10000);
        const r3=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({prompt:`Apply ONLY: "${editPrompt}"\nPreserve design.\nCODE:\n${ctx}`,isEdit:true}),signal:AbortSignal.timeout(55000)});
        const d3=await r3.json();if(d3.html)newHtml=d3.html;
      }

      if(newHtml&&newHtml.length>500){
        await saveVersion(result,`Before: ${editPrompt.slice(0,40)}`);
        setResult(newHtml);
        let editedGameMem: GameProjectMemory|undefined;
        let editedProjMem: ProjectMemory|undefined;
        if(isGameProject&&gameMemory){
          const det={isGame:true,gameType:gameMemory.gameType,theme:gameMemory.theme,genre:gameMemory.genre,techStack:gameMemory.techStack};
          editedGameMem = buildGameMemory(newHtml,editPrompt,det,gameMemory);
          setGameMemory(editedGameMem);
        } else {
          editedProjMem = buildProjectMemory(newHtml,projectName,projectMemory?.originalPrompt||editPrompt,messages,projectMemory);
          setProjectMemory(editedProjMem);
        }
        // Priority 1 — persist updated memory so edit context survives reopen
        persistMemory(projectId, editedProjMem||null, editedGameMem||null);
        setCredits(cv=>({...cv,used:cv.used+1}));
        (async()=>{try{await saveProject(newHtml,projectName);}catch{}})();
        updateMsg(thinkId,{isActive:false,phases:[
          {agent:"Reading",icon:"○",action:"Understood",pct:100,done:true,status:"done"},
          {agent:"Building",icon:"○",action:"Applied",pct:100,done:true,status:"done"},
          {agent:"Validating",icon:"○",action:"Done",pct:100,done:true,status:"done"},
        ]});

        // A3 — Post-edit Production Gate re-check (client-side, pure-function)
        let editGate:any=undefined; let qualityDelta="";
        try{
          const gateKind = isGameProject ? "game" : "website";
          const gateSubtype = isGameProject ? (gameMemory?.gameType||"arcade") : (projectMemory?.blueprint?.projectType||"website");
          const g = runProductionGate(newHtml, gateKind, gateSubtype);
          editGate = { dimensions:g.dimensions, buildPass:g.buildPass, validationPass:g.validationPass, runtimePass:g.runtimePass, mobilePass:g.mobilePass, overallPass:g.overallPass, repairAttempts:0 };
          if(completenessScore!==null){
            const before = completenessScore;
            if(g.score < before - 5) qualityDelta = ` • Quality: ${before}→${g.score} ⚠️ (dropped — review the change)`;
            else if(g.score > before) qualityDelta = ` • Quality: ${before}→${g.score} ✅`;
            else qualityDelta = ` • Quality: ${g.score}/100${g.score>=90?" ✅":""}`;
          } else {
            qualityDelta = ` • Quality: ${g.score}/100${g.score>=90?" ✅":""}`;
          }
          setCompletenessScore(g.score);
          if(!g.overallPass && g.failedFeatures.length>0 && (completenessScore===null || g.score < completenessScore)){
            addMsg({role:"ai",type:"text",content:`⚠️ After this edit, some items still need attention: ${g.failedFeatures.slice(0,3).map((f:any)=>f.label).join(", ")}${g.failedFeatures.length>3?", …":""}.`});
          }
        }catch{}

        addMsg({role:"ai",type:"summary",content:`Changes applied.${qualityDelta}`,credits:1,gate:editGate});
        if(isMobile)setMobilePanel("preview");
      } else {
        updateMsg(thinkId,{type:"error",content:isGameProject?"Be specific: 'Add pause button top-right' or 'Change snake color to neon blue'":"Be specific: 'Change header to dark blue' or 'Add contact form'",isActive:false});
      }
    } catch {
      updateMsg(thinkId,{type:"error",content:"Edit timed out. Try a smaller change.",isActive:false});
    }
    setLoading(false);
  };

  const handleSend=()=>{
    const p=prompt.trim();
    if(!p||loading) return;
    if(loading){ addMsg({role:"ai",type:"text",content:"⏳ Please wait — generation in progress."}); return; }
    setPrompt(""); promptRef.current="";
    if(!result) runFlow(p); else runEdit(p);
  };
  const handleVoice=()=>{ const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition; if(!SR)return; if(listening){setListening(false);return;} const r=new SR(); r.continuous=false;r.interimResults=false;r.lang="en-US"; r.onstart=()=>setListening(true); r.onresult=(e:any)=>{const t=e.results[0]?.[0]?.transcript||"";if(t.trim())setPrompt(prev=>prev?prev+" "+t:t);}; r.onerror=()=>setListening(false); r.onend=()=>setListening(false); r.start(); };
  const restoreVersion=async(v:Version)=>{ const code=v.code_snapshot?.["index.html"];if(!code)return;await saveVersion(result,`Before restore`);setResult(code);(async()=>{try{await saveProject(code,projectName);}catch{}})();addMsg({role:"ai",type:"text",content:`✓ Restored to v${v.version_number}`}); };

  // ── Render ─────────────────────────────────────────────────────
  const RIGHT_TABS = [
    { id:"preview" as RightTab, icon:"✨", label:"Preview" },
    { id:"files"   as RightTab, icon:"📁", label:"Files" },
    { id:"deploy"  as RightTab, icon:"🚀", label:"Deploy" },
    { id:"history" as RightTab, icon:"⏱", label:"History" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;overflow:hidden;background:#050816;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(245,245,245,0.2);border-radius:4px;}
        textarea,input,button{font-family:'DM Sans',sans-serif;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.35;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .msg-in{animation:fadeUp .22s ease both;}
        .send-btn:hover:not(:disabled){transform:scale(1.07);box-shadow:0 0 20px rgba(245,245,245,0.45);}
        .tab-icon:hover{background:rgba(255,255,255,0.07)!important;color:#fff!important;}
        .quick-btn:hover{border-color:rgba(245,245,245,0.4)!important;color:${C.text}!important;}
      `}</style>

      <div
        style={{height:"100dvh",display:"flex",flexDirection:"column",background:C.bg,color:C.text,overflow:"hidden",fontFamily:"'DM Sans',sans-serif",position:"fixed",inset:0}}
        onDragOver={e=>{e.preventDefault();setIsDragging(true);}}
        onDragLeave={()=>setIsDragging(false)}
        onDrop={e=>{e.preventDefault();setIsDragging(false);}}
      >
        {/* Fullscreen Preview Overlay */}
      {isFullscreen && result && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"#fff",display:"flex",flexDirection:"column"}}>
          <div style={{height:44,background:"#0a0a0a",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",flexShrink:0}}>
            <div style={{display:"flex",gap:6}}>
              {[{id:"desktop",icon:"🖥️"},{id:"tablet",icon:"⬜"},{id:"mobile",icon:"📱"}].map(d=>(
                <button key={d.id} onClick={()=>setDevice(d.id as any)}
                  style={{height:28,padding:"0 10px",borderRadius:6,border:`1px solid ${device===d.id?"rgba(245,245,245,0.5)":"rgba(255,255,255,0.08)"}`,background:device===d.id?"rgba(245,245,245,0.15)":"none",color:device===d.id?"#D9D9D9":"#666",fontSize:12,fontWeight:device===d.id?700:400,cursor:"pointer"}}>
                  {d.icon}
                </button>
              ))}
            </div>
            <button onClick={()=>setIsFullscreen(false)}
              style={{height:28,padding:"0 14px",borderRadius:6,border:"1px solid rgba(255,255,255,0.1)",background:"none",color:"#999",fontSize:12,cursor:"pointer"}}>
              Exit Fullscreen ✕
            </button>
          </div>
          <div style={{flex:1,display:"flex",alignItems:device==="desktop"?"stretch":"center",justifyContent:"center",background:device==="desktop"?"#fff":"#050816",overflow:"auto"}}>
            <iframe srcDoc={result}
              style={{border:"none",width:device==="desktop"?"100%":device==="tablet"?"768px":"390px",height:"100%",minHeight:"100%",background:"#fff",
                boxShadow:device!=="desktop"?"0 0 0 12px #11151F,0 20px 60px rgba(0,0,0,0.8)":"none",
                borderRadius:device==="mobile"?"40px":device==="tablet"?"16px":"0",flexShrink:0}}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" title="Fullscreen Preview"/>
          </div>
        </div>
      )}

      {/* Drag overlay */}
        {isDragging&&<div style={{position:"fixed",inset:0,background:"rgba(245,245,245,0.08)",border:"2px dashed rgba(245,245,245,0.4)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8}}><div style={{fontSize:18,fontWeight:700,color:C.purple}}>Drop files to attach</div></div>}

        {/* ── TOP BAR ── */}
        <div style={{height:50,flexShrink:0,padding:"0 14px",borderBottom:`1px solid ${C.border}`,background:C.surface,display:"flex",alignItems:"center",gap:10,zIndex:100}}>
          <KryptonLogo size={26} showText={false} animated={false} onClick={()=>router.push("/")} style={{cursor:"pointer"}}/>
          <div style={{width:1,height:18,background:C.border}}/>

          {editingName
            ? <input autoFocus value={projectName} onChange={e=>setProjectName(e.target.value)} onBlur={()=>setEditingName(false)} onKeyDown={e=>e.key==="Enter"&&setEditingName(false)}
                style={{flex:1,maxWidth:260,background:"rgba(245,245,245,0.08)",border:`1px solid ${C.purple}`,borderRadius:7,color:C.text,padding:"3px 10px",fontSize:13,fontWeight:600,outline:"none"}}/>
            : <button onClick={()=>setEditingName(true)} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"2px 8px",flex:1,textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:240}}>
                {projectName} <span style={{opacity:.4}}>✏</span>
              </button>
          }
          {isGameProject && <span style={{padding:"2px 8px",borderRadius:10,background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.2)",fontSize:10,fontWeight:700,color:C.gold,flexShrink:0}}>🎮 GAME</span>}

          {isMobile&&(
            <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
              {["chat","preview"].map(t=>(
                <button key={t} onClick={()=>setMobilePanel(t as any)} style={{padding:"4px 12px",borderRadius:7,border:"none",background:mobilePanel===t?C.purple:"rgba(255,255,255,0.06)",color:mobilePanel===t?"#fff":"#666",fontSize:11,fontWeight:600,cursor:"pointer",textTransform:"capitalize"}}>{t}</button>
              ))}
            </div>
          )}

          <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:isMobile?"0":"auto"}}>
            <div onClick={()=>remaining===0?router.push("/billing"):undefined} style={{padding:"3px 10px",borderRadius:16,background:remaining>0?"rgba(255,215,0,0.07)":"rgba(255,69,69,0.12)",border:`1px solid ${remaining>0?"rgba(255,215,0,0.18)":"rgba(255,69,69,0.35)"}`,fontSize:11,fontWeight:700,color:remaining>0?C.gold:C.red,cursor:remaining===0?"pointer":"default",userSelect:"none"}} title={remaining===0?"Click to upgrade":"Credits remaining"}>
              ⚡ {remaining>0?remaining:"0 — Upgrade"}
            </div>
            {result&&<button onClick={()=>saveProject(result,projectName)} style={{padding:"4px 12px",background:saved?"rgba(0,208,132,0.08)":"rgba(245,245,245,0.08)",border:`1px solid ${saved?"rgba(0,208,132,0.2)":"rgba(245,245,245,0.2)"}`,borderRadius:8,color:saved?C.green:C.purple,fontSize:11,fontWeight:600,cursor:"pointer"}}>{saving?"…":saved?"✓":"Save"}</button>}
          </div>
        </div>

        {/* ── MAIN 2-PANEL ── */}
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>

          {/* ── LEFT: CHAT ── */}
          <div style={{width:isMobile?"100%":"340px",minWidth:isMobile?"100%":"280px",maxWidth:isMobile?"100%":"380px",display:isMobile?(mobilePanel==="chat"?"flex":"none"):"flex",flexDirection:"column",borderRight:isMobile?"none":`1px solid ${C.border}`,background:C.surface,overflow:"hidden",flexShrink:0}}>
            {/* Loading indicator */}
            {loading&&<div style={{padding:"6px 16px",borderBottom:`1px solid ${C.border}`,background:"rgba(245,245,245,0.04)",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <div style={{display:"flex",gap:3}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:C.purple,animation:`pulse 1.2s ${i*.2}s ease-in-out infinite`}}/>)}</div>
              <span style={{fontSize:12,color:C.purple,fontWeight:500}}>Krypton Intelligence Engine — Active</span>
            </div>}

            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",paddingTop:14,paddingBottom:8,display:"flex",flexDirection:"column",gap:8}}>
              {messages.length===0&&!loading&&(
                <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:18,textAlign:"center",padding:"24px 20px"}}>
                  <KryptonLogo size={48} showText={false} animated={true}/>
                  <div>
                    <div style={{fontSize:19,fontWeight:800,marginBottom:6,fontFamily:"'Syne',sans-serif",background:"linear-gradient(135deg,#F5F5F5,#9AA3AF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>What do you want to build?</div>
                    <div style={{fontSize:13,color:C.muted,lineHeight:1.65}}>Describe your idea — Krypton AI will build it.</div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center",maxWidth:430}}>
                    {["Build a restaurant website","Make a Snake game","Create a Space Shooter","Build a SaaS landing page","Create a Racing game","Make a Zombie Survival game","Design a portfolio","Create Tetris game","Build a Platformer"].map(s=>(
                      <button key={s} className="quick-btn" onClick={()=>setPrompt(s)} style={{padding:"6px 14px",background:"rgba(245,245,245,0.06)",border:`1px solid rgba(245,245,245,0.15)`,borderRadius:20,color:C.muted,fontSize:12,cursor:"pointer",transition:"all .15s"}}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg=>(
                <div key={msg.id} className="msg-in">
                  {msg.role==="user" ? (
                    <div style={{display:"flex",justifyContent:"flex-end",padding:"2px 16px"}}>
                      <div style={{maxWidth:"82%",padding:"11px 16px",background:"linear-gradient(135deg,rgba(245,245,245,0.18),rgba(109,40,217,0.1))",border:"1px solid rgba(245,245,245,0.2)",borderRadius:"18px 18px 4px 18px",fontSize:14,lineHeight:1.65,color:C.text,fontWeight:450}}>
                        {msg.content}
                      </div>
                    </div>
                  ) : msg.type==="thinking" ? (
                    <ThinkingPanel phases={msg.phases||[]} isActive={msg.isActive||false}/>
                  ) : (
                    <div style={{padding:"2px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
                        <div style={{width:18,height:18,borderRadius:"50%",background:"rgba(245,245,245,0.1)",border:"1px solid rgba(245,245,245,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}><img src="/logo.svg" width={10} height={10} alt=""/></div>
                        <span style={{fontSize:11,color:C.muted,fontWeight:500}}>Krypton AI</span>
                        <span style={{fontSize:10,color:"#161B26"}}>{fmtTime(msg.ts)}</span>
                      </div>
                      {msg.type==="summary" ? (
                        <div style={{maxWidth:"92%",padding:"13px 16px",background:"rgba(0,208,132,0.05)",border:"1px solid rgba(0,208,132,0.15)",borderRadius:"4px 18px 18px 18px"}}>
                          <div style={{color:C.green,fontWeight:700,fontSize:13,marginBottom:7}}>✓ Project Complete</div>
                          <div style={{color:C.sub,fontSize:13,lineHeight:1.65,marginBottom:9}}>{msg.content}</div>
                          {msg.files&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{msg.files.map(f=><span key={f} style={{fontSize:11,padding:"2px 9px",background:"rgba(0,208,132,0.07)",border:"1px solid rgba(0,208,132,0.15)",borderRadius:20,color:C.green}}>{f}</span>)}</div>}
                          {msg.gate&&(
                            <div style={{marginBottom:8}}>
                              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
                                {([["Build",msg.gate.buildPass],["Validation",msg.gate.validationPass],["Runtime",msg.gate.runtimePass],["Mobile",msg.gate.mobilePass]] as [string,boolean][]).map(([label,pass])=>(
                                  <span key={label} style={{fontSize:10,padding:"2px 8px",borderRadius:10,fontWeight:600,background:pass?"rgba(0,208,132,0.10)":"rgba(255,69,69,0.10)",border:`1px solid ${pass?"rgba(0,208,132,0.25)":"rgba(255,69,69,0.25)"}`,color:pass?C.green:C.red}}>
                                    {pass?"✓":"✗"} {label}
                                  </span>
                                ))}
                                {msg.gate.repairAttempts>0&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"rgba(245,245,245,0.10)",border:"1px solid rgba(245,245,245,0.25)",color:"#D9D9D9"}}>↻ {msg.gate.repairAttempts} repair{msg.gate.repairAttempts>1?"es":""}</span>}
                              </div>
                              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:4}}>
                                {msg.gate.dimensions.map(d=>(
                                  <div key={d.dimension} style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:C.muted}}>
                                    <span style={{width:62,flexShrink:0}}>{d.dimension}</span>
                                    <div style={{flex:1,height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
                                      <div style={{width:`${d.score}%`,height:"100%",background:d.score>=90?C.green:d.score>=70?"#D9D9D9":C.red,borderRadius:2}}/>
                                    </div>
                                    <span style={{width:28,textAlign:"right",flexShrink:0}}>{d.score}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {msg.credits&&<div style={{fontSize:11,color:C.muted}}>⚡ {msg.credits} credit used</div>}
                        </div>
                      ) : msg.type==="error" ? (
                        <div style={{maxWidth:"92%",padding:"11px 16px",background:"rgba(255,69,69,0.05)",border:"1px solid rgba(255,69,69,0.15)",borderRadius:"4px 18px 18px 18px",fontSize:13,color:C.red,lineHeight:1.6}}>{msg.content}</div>
                      ) : (
                        <div style={{maxWidth:"92%",padding:"11px 16px",background:C.card,border:`1px solid ${C.border}`,borderRadius:"4px 18px 18px 18px",fontSize:13,lineHeight:1.7,color:C.sub}}>{msg.content}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef}/>
            </div>

            {/* Input */}
            <div style={{padding:"10px 14px 12px",borderTop:`1px solid ${C.border}`,background:`rgba(7,9,26,0.95)`,flexShrink:0}}>
              {/* Competitor URL input */}
              {!result && (
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"rgba(255,255,255,0.02)",borderRadius:8,border:`1px solid ${C.border}`}}>
                    <span style={{fontSize:13,flexShrink:0}}>🔗</span>
                    <input type="url" value={competitorUrl} onChange={e=>setCompetitorUrl(e.target.value)}
                      placeholder="Competitor URL (optional): https://stripe.com"
                      style={{flex:1,background:"none",border:"none",outline:"none",color:"#9AA3AF",fontSize:12,fontFamily:"inherit"}}/>
                    {competitorUrl.trim()&&<button onClick={()=>setCompetitorUrl("")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:12}}>✕</button>}
                  </div>
                </div>
              )}
              {/* Quick engineering actions — show only when project exists */}
              {result && !loading && (
                <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                  {[
                    {label:"🐛 Debug",  action:"[debug] Find and fix all errors and issues in this project"},
                    {label:"⬆️ Upgrade", action:"[upgrade] Add premium animations, interactions, and missing sections"},
                    {label:"📱 Mobile",  action:"Fix all mobile and responsive issues in this project"},
                    {label:"⚡ Speed",   action:"Optimize performance: lazy loading, clean CSS, faster animations"},
                    {label:"🔍 SEO",     action:"Add proper meta tags, structured data, and semantic HTML for SEO"},
                  ].map(btn => (
                    <button key={btn.label} onClick={()=>{ setPrompt(btn.action); }}
                      style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:"rgba(255,255,255,0.04)",
                        border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",transition:"all .15s",whiteSpace:"nowrap"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(245,245,245,0.4)";e.currentTarget.style.color="#fff";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}
                    >{btn.label}</button>
                  ))}
                </div>
              )}
              <div style={{background:C.card,border:`1px solid ${loading?"rgba(245,245,245,0.25)":C.border}`,borderRadius:14,padding:"10px 12px",transition:"border-color .2s"}}>
                <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!loading){e.preventDefault();handleSend();}}}
                  placeholder={loading?"Working on it…":result?"Describe a change to make…":"Describe what you want to build…"}
                  rows={2} disabled={loading}
                  style={{width:"100%",background:"none",border:"none",color:loading?"#161B26":C.text,fontSize:14,resize:"none",outline:"none",lineHeight:1.65,maxHeight:130,overflowY:"auto"}}
                />
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:7,paddingTop:7,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt" style={{display:"none"}} onChange={e=>{if(e.target.files?.length)addMsg({role:"user",type:"text",content:`📎 Attached: ${Array.from(e.target.files).map(f=>f.name).join(", ")}`});}}/>
                    <button onClick={()=>fileInputRef.current?.click()} style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} title="Attach file">📎</button>
                    <span style={{fontSize:10,color:"#11151F"}}>Krypton Intelligence Engine</span>
                  </div>
                  <div style={{display:"flex",gap:7}}>
                    <button onClick={handleVoice} style={{width:32,height:32,borderRadius:"50%",background:listening?"rgba(245,245,245,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${listening?"rgba(245,245,245,0.4)":C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="11" rx="3" fill={listening?C.purple:"#666"}/><path d="M5 11a7 7 0 0014 0" stroke={listening?C.purple:"#666"} strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="18" x2="12" y2="22" stroke={listening?C.purple:"#666"} strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                    <button className="send-btn" onClick={handleSend} disabled={!prompt.trim()||loading} style={{width:38,height:38,borderRadius:"50%",background:(!loading&&prompt.trim())?C.gradP:"rgba(255,255,255,0.05)",border:"none",cursor:(!loading&&prompt.trim())?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
                      {loading?<div style={{width:13,height:13,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.2)",borderTopColor:"#fff",animation:"spin .7s linear infinite"}}/>
                      :<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke={prompt.trim()?"#fff":"#5B6472"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: PREVIEW / FILES / DEPLOY / HISTORY ── */}
          <div style={{flex:1,display:isMobile?(mobilePanel==="preview"?"flex":"none"):"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
            {/* Icon tab bar */}
            <div style={{display:"flex",alignItems:"center",padding:"0 8px",borderBottom:`1px solid ${C.border}`,background:C.surface,flexShrink:0,height:44}}>
              {RIGHT_TABS.map(t=>(
                <button key={t.id} className="tab-icon" onClick={()=>setRightTab(t.id)} title={t.label} style={{width:36,height:36,borderRadius:9,border:"none",background:rightTab===t.id?"rgba(245,245,245,0.15)":"transparent",color:rightTab===t.id?C.purple:C.muted,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",marginRight:2}} >
                  {t.icon}
                </button>
              ))}

              {/* Device buttons (preview only) */}
              {rightTab==="preview"&&result&&(
                <div style={{display:"flex",gap:3,marginLeft:"auto",alignItems:"center"}}>
                  {([{id:"desktop",icon:"🖥"},{id:"tablet",icon:"📱"},{id:"mobile",icon:"📲"}] as const).map(d=>(
                    <button key={d.id} onClick={()=>setDevice(d.id)} style={{width:26,height:26,borderRadius:7,border:`1px solid ${device===d.id?"rgba(245,245,245,0.35)":C.border}`,background:device===d.id?"rgba(245,245,245,0.12)":"none",color:device===d.id?C.purple:C.muted,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{d.icon}</button>
                  ))}
                  <button onClick={()=>{if(!result)return;const b=new Blob([result],{type:"text/html"});window.open(URL.createObjectURL(b),"_blank");}} style={{width:26,height:26,borderRadius:7,border:`1px solid ${C.border}`,background:"none",color:C.muted,fontSize:11,cursor:"pointer",marginLeft:3}}>↗</button>
                </div>
              )}

              {result&&<div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:C.green,marginLeft:rightTab==="preview"?"0":"auto"}}><div style={{width:5,height:5,borderRadius:"50%",background:C.green,animation:"pulse 2s infinite"}}/>Live</div>}
            </div>

            {/* Tab name strip */}
            <div style={{padding:"5px 12px 4px",borderBottom:`1px solid ${C.border}`,background:C.surface,fontSize:11,color:C.muted,flexShrink:0}}>
              {RIGHT_TABS.find(t=>t.id===rightTab)?.label}
            </div>

            {/* Preview */}
            {rightTab==="preview"&&(
              <div style={{flex:1,display:"flex",alignItems:device==="desktop"?"stretch":"flex-start",justifyContent:"center",overflow:"auto",background:device==="desktop"?"#fff":device==="tablet"?"#0B1020":"#050816",padding:device==="desktop"?"0":device==="tablet"?"32px auto":"40px auto"}}>
                {result
                  ? <iframe key={`${result.length}-${device}`} srcDoc={result} style={{
                      border:"none",
                      width:device==="desktop"?"100%":device==="tablet"?"768px":"390px",
                      height:device==="desktop"?"100%":"100%",
                      minHeight:"100%",
                      display:"block",
                      background:"#fff",
                      boxShadow:device!=="desktop"?"0 0 0 12px #11151F,0 0 0 14px #1A1F2B,0 20px 60px rgba(0,0,0,0.8)":"none",
                      borderRadius:device==="mobile"?"40px":device==="tablet"?"16px":"0",
                      transition:"width .3s cubic-bezier(0.16,1,0.3,1),border-radius .3s ease",
                      flexShrink:0,
                    }} sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" title="Live Preview"/>
                  : <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,height:"100%",textAlign:"center",padding:24}}>
                      <div style={{fontSize:48,opacity:.1}}>✦</div>
                      <div style={{fontSize:14,color:C.muted}}>Preview will appear here</div>
                    </div>
                }
              </div>
            )}

            {/* Files */}
            {rightTab==="files"&&<FilesPanel html={result} projectName={projectName}/>}

            {/* Deploy */}
            {rightTab==="deploy"&&(
              <div style={{flex:1,overflowY:"auto",padding:20}}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:16,fontFamily:"'Syne',sans-serif"}}>Deploy Project</div>
                {[{icon:"▲",label:"Deploy to Vercel",sub:"Instant global CDN",color:"#fff"},{icon:"◆",label:"Deploy to Netlify",sub:"Free hosting",color:"#5FB88A"}].map(d=>(
                  <div key={d.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:36,height:36,borderRadius:10,background:`rgba(255,255,255,0.04)`,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:d.color,flexShrink:0}}>{d.icon}</div>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.text}}>{d.label}</div><div style={{fontSize:11,color:C.muted}}>{d.sub}</div></div>
                    <button disabled={!result} style={{padding:"7px 14px",background:result?C.grad:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,color:result?"#050816":C.muted,fontSize:12,fontWeight:700,cursor:result?"pointer":"not-allowed"}}>Deploy</button>
                  </div>
                ))}
                <button disabled={!result} onClick={()=>{if(!result)return;const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([result],{type:"text/html"}));a.download=`${projectName.replace(/\s+/g,"-")}.html`;a.click();}} style={{width:"100%",padding:"11px",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,color:C.sub,fontSize:13,fontWeight:600,cursor:result?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  ⬇ Download HTML
                </button>
              </div>
            )}

            {/* History */}
            {rightTab==="history"&&(
              <div style={{flex:1,overflowY:"auto",padding:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:14,fontFamily:"'Syne',sans-serif"}}>Version History</div>
                {versions.length===0
                  ? <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:13}}><div style={{fontSize:28,marginBottom:10,opacity:.2}}>○</div>No versions yet</div>
                  : versions.map((v,i)=>(
                    <div key={v.id||i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:32,height:32,borderRadius:8,background:"rgba(245,245,245,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:C.purple,flexShrink:0,fontFamily:"'Syne',sans-serif"}}>v{v.version_number}</div>
                      <div style={{flex:1,overflow:"hidden"}}>
                        <div style={{fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.message}</div>
                        <div style={{fontSize:10,color:C.muted,marginTop:2}}>{new Date(v.created_at).toLocaleString()}</div>
                      </div>
                      <button onClick={()=>restoreVersion(v)} style={{padding:"5px 12px",background:"rgba(245,245,245,0.08)",border:`1px solid rgba(245,245,245,0.2)`,borderRadius:7,color:C.purple,fontSize:11,fontWeight:600,cursor:"pointer"}}>Restore</button>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#050816"}}><div style={{width:32,height:32,borderRadius:"50%",border:"3px solid rgba(245,245,245,0.15)",borderTopColor:"#D9D9D9",animation:"spin .8s linear infinite"}}/></div>}>
      <CreatePageInner/>
    </Suspense>
  );
}
