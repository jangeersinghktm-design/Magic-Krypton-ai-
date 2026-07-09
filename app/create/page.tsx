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
import { runProductionGate } from "@/lib/completion-engine";
import { detectGameType, buildGameMemory, formatGameMemoryForAI, type GameProjectMemory } from "@/lib/game-builder";

// ── Design Tokens ─────────────────────────────────────────────────
const C = {
  bg:       "#040610",   // Deep Space
  surface:  "#080C18",
  card:     "#0D1121",   // Card
  border:   "rgba(255,255,255,0.07)",
  borderHi: "rgba(255,255,255,0.18)",
  text:     "#F0F2F5",   // Platinum
  sub:      "#8892A0",
  muted:    "#4A5568",
  text2:    "#8892A0",   // alias for sub — fixes C.text2 references
  gold:     "#E8E8E8",
  purple:   "#C8CDD4",
  violet:   "#A8B0BA",
  green:    "#4CAF8A",
  red:      "#E06B63",
  grad:     "linear-gradient(135deg,#E8E8E8,#A8B0BA)",
  gradP:    "linear-gradient(135deg,#C8CDD4,#8892A0)",
  accent:   "rgba(255,255,255,0.06)",
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
  plan?:    PlanData;          // niche intelligence — industry, sections, palette
  fileTree?:FilesData;         // file architecture being created
  review?:  ReviewCheck[];     // self-review checklist results
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
  // Primary color extracted directly — not just variable name
  primaryColor?: string;
  // Niche + template tracking for consistent edits
  niche?: string;
  templateUsed?: string;
  componentVariants?: string;
  // Phase 7 — Memory Engine: project blueprint from generation
  blueprint?: any;
}

function buildProjectMemory(html:string, name:string, prompt:string, msgs:ChatMessage[], prev?:ProjectMemory|null, blueprint?:any): ProjectMemory {
  if (!html) return prev || { projectName:name, originalPrompt:prompt, colorSystem:"", fonts:"", sections:"", navigation:"", editHistory:[], codeLines:0, isDarkTheme:true, hasNavbar:false, hasFooter:false, blueprint };
  // Capture full CSS variable definitions (name + value) — up to 800 chars
  const cssVars = (html.match(/--[\w-]+\s*:\s*[^;}{]+/g)||[]).slice(0,25).join("; ").slice(0,800);
  // Extract primary color hex value directly for reliable palette tracking
  const primaryColorMatch = html.match(/--primary\s*:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/);
  const primaryColor = primaryColorMatch?.[1] || prev?.primaryColor || "";
  const fontMatches = html.match(/family=([^&"'\s)]+)/g)||[];
  const fonts = [...new Set(fontMatches.map(f=>f.replace("family=","").split(":")[0].replace(/\+/g," ")))].join(", ")||"System";
  const h2s = (html.match(/<h2[^>]*>([^<]+)<\/h2>/gi)||[]).map(h=>h.replace(/<[^>]+>/g,"")).slice(0,8);
  const h1s = (html.match(/<h1[^>]*>([^<]+)<\/h1>/gi)||[]).map(h=>h.replace(/<[^>]+>/g,"")).slice(0,3);
  const navLinks = (html.match(/<a[^>]*>([^<]{2,25})<\/a>/gi)||[]).map(a=>a.replace(/<[^>]+>/g,"").trim()).filter(t=>t.length>2).slice(0,10);
  // Keep last 12 edits (was 8 — more context for long sessions)
  const edits = msgs.filter(m=>m.role==="user"&&m.type==="text").map(m=>m.content).slice(-12);
  return {
    projectName:name, originalPrompt:prompt, colorSystem:cssVars,
    primaryColor, fonts,
    sections:[...h1s,...h2s].join("|").slice(0,300),
    navigation:navLinks.join(", ").slice(0,200),
    editHistory:edits,
    codeLines:html.split("\n").length,
    isDarkTheme:/#0[0-2]/.test(html.slice(0,3000)),
    hasNavbar:/<nav/.test(html),
    hasFooter:/<footer/.test(html),
    // Preserve niche/template from previous memory or blueprint
    niche: prev?.niche || blueprint?.niche || "",
    templateUsed: prev?.templateUsed || blueprint?.templateUsed || "",
    componentVariants: prev?.componentVariants || "",
    blueprint: blueprint||prev?.blueprint
  };
}

function formatMemoryForAI(mem:ProjectMemory|null): string {
  if (!mem||!mem.colorSystem) return "";
  const blueprintLine = mem.blueprint
    ? `║ Pages/Sections: ${(mem.blueprint.pages||[]).join(", ").slice(0,200)}\n║ Components: ${(mem.blueprint.components||[]).join(", ").slice(0,200)}\n`
    : "";
  const nicheLine = (mem.niche||mem.templateUsed)
    ? `║ Niche/Template: ${mem.niche||""}${mem.templateUsed?" | "+mem.templateUsed:""}\n`
    : "";
  const primaryLine = mem.primaryColor
    ? `║ Primary Color: ${mem.primaryColor}\n`
    : "";
  return `╔═ KRYPTON PROJECT MEMORY ════════════════╗
║ Project: ${mem.projectName}
║ Theme: ${mem.isDarkTheme?"Dark":"Light"} | ${mem.codeLines} lines | ${mem.hasNavbar?"Has Navbar":"No Navbar"} | ${mem.hasFooter?"Has Footer":"No Footer"}
${primaryLine}║ Fonts: ${mem.fonts}
${nicheLine}║ CSS Design System: ${mem.colorSystem.slice(0,800)}
║ Sections: ${mem.sections.slice(0,300)}
║ Navigation: ${mem.navigation.slice(0,200)}
${blueprintLine}╠═ CRITICAL — PRESERVE EXACTLY ═══════════╣
║ Primary color: ${mem.primaryColor||"from CSS vars"}
║ All existing fonts, layout, sections
║ Only modify what user explicitly requests
╠═ RECENT EDITS (last ${mem.editHistory.length}) ══════════════════╣
${mem.editHistory.map((e,i)=>`║ ${i+1}. ${e.slice(0,80)}`).join("\n")||"║ First edit"}
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

// ── Premium Thinking Panel ──────────────────────────────────────────
// Inspired by Emergent / Lovable — shows live intelligence, not just status.
// Receives: phases (agent events), plan (niche data), files (file list),
// review (self-review checks). All populated from streaming orchestrate events.
interface PlanData {
  projectType?:string; industry?:string; businessType?:string;
  marketLevel?:string; tone?:string; conversionGoal?:string;
  sections?:string[]; sectionCount?:number; pageCount?:number;
  componentCount?:number; primaryColor?:string; heading?:string;
}
interface ReviewCheck { label:string; pass:boolean; }
interface FilesData { files?:string[]; total?:number; }

function ThinkingPanel({
  phases, isActive, plan, files, review
}: {
  phases: AgentPhaseEvent[];
  isActive: boolean;
  plan?: PlanData;
  files?: FilesData;
  review?: ReviewCheck[];
}) {
  const [collapsed,  setCollapsed]  = useState(false);
  const [elapsed,    setElapsed]    = useState(0);
  const [filesDone,  setFilesDone]  = useState(0);
  const isDone   = !isActive && phases.length > 0;
  const doneCount = phases.filter(p=>p.done).length;
  const totalSteps = 7;

  // ── Elapsed timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isActive]);

  // ── Animate file creation ─────────────────────────────────────────
  useEffect(() => {
    if (!files?.files?.length) return;
    setFilesDone(0);
    const total = files.files.length;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setFilesDone(i);
      if (i >= total) clearInterval(t);
    }, 180);
    return () => clearInterval(t);
  }, [files?.total]);

  const fmtTime = (s:number) => s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;

  // ── Current step label ────────────────────────────────────────────
  const activePhase = phases.find(p => !p.done && isActive);
  const currentLabel = isDone
    ? (plan?.industry ? `${plan.industry} — Complete` : "Complete")
    : activePhase ? activePhase.action
    : "Initializing...";

  const TYPE_ICONS:Record<string,string> = {
    website:"🌐", landing:"🚀", saas:"⚡", dashboard:"📊",
    ecommerce:"🛒", portfolio:"💼", app:"📱", blog:"📝", default:"🔧",
  };
  const typeIcon = TYPE_ICONS[plan?.projectType||""] || TYPE_ICONS.default;

  return (
    <div style={{ padding:"0 16px 4px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <div style={{ width:18, height:18, borderRadius:"50%", background:"rgba(245,245,245,0.1)",
          border:"1px solid rgba(245,245,245,0.3)", display:"flex", alignItems:"center",
          justifyContent:"center", flexShrink:0 }}>
          <img src="/logo.svg" width={10} height={10} alt="" style={{ opacity:.8 }}/>
        </div>
        <span style={{ fontSize:11, color:C.muted, fontWeight:500 }}>Krypton Intelligence</span>
        {isActive && <span style={{ fontSize:10, color:C.muted, marginLeft:"auto" }}>{fmtTime(elapsed)}</span>}
        {isDone && <span style={{ fontSize:10, color:C.muted, marginLeft:"auto" }}>Completed in {fmtTime(elapsed)}</span>}
      </div>

      <div style={{ background:"rgba(245,245,245,0.04)", border:"1px solid rgba(245,245,245,0.1)",
        borderRadius:12, overflow:"hidden" }}>

        {/* ── Status header ─────────────────────────────────────── */}
        <button onClick={()=>setCollapsed(v=>!v)} style={{ width:"100%", padding:"11px 14px",
          background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center",
          gap:10, textAlign:"left" }}>
          {isDone ? (
            <span style={{ color:C.green, fontSize:13 }}>✓</span>
          ) : (
            <div style={{ width:7, height:7, borderRadius:"50%", background:C.purple, flexShrink:0,
              animation:"pulse 1.4s ease-in-out infinite" }}/>
          )}
          <span style={{ fontSize:12, fontWeight:600, flex:1,
            color: isDone ? C.green : C.purple }}>
            {currentLabel}
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {!isDone && <span style={{ fontSize:10, color:C.muted }}>{doneCount}/{totalSteps}</span>}
            {isDone && files?.total && (
              <span style={{ fontSize:9, color:C.muted }}>
                {files.total} files · {fmtTime(elapsed)} ago
              </span>
            )}
            {isDone && !files?.total && elapsed > 0 && (
              <span style={{ fontSize:9, color:C.muted }}>{fmtTime(elapsed)}</span>
            )}
          </div>
          <span style={{ fontSize:10, color:C.muted }}>{collapsed?"▶":"▼"}</span>
        </button>

        {/* ── Progress bar ──────────────────────────────────────── */}
        {!isDone && (
          <div style={{ height:2, background:"rgba(255,255,255,0.05)", margin:"0 14px 10px" }}>
            <div style={{ height:"100%", borderRadius:1,
              width:`${Math.round((doneCount/totalSteps)*100)}%`,
              background:C.gradP, transition:"width .6s ease" }}/>
          </div>
        )}

        {!collapsed && (
          <div style={{ padding:"0 14px 14px" }}>

            {/* ── PLAN CARD ─────────────────────────────────────── */}
            {plan?.industry && (
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
                borderRadius:8, padding:"10px 12px", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                  <span style={{ fontSize:14 }}>{typeIcon}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:C.text,
                    textTransform:"uppercase", letterSpacing:"0.06em" }}>
                    {plan.projectType || "Website"} Plan
                  </span>
                  {plan.primaryColor && (
                    <div style={{ width:10, height:10, borderRadius:"50%",
                      background:plan.primaryColor, marginLeft:"auto", flexShrink:0 }}/>
                  )}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px 12px" }}>
                  {[
                    ["Industry",    plan.industry],
                    ["Market",      plan.marketLevel],
                    ["Pages",       plan.pageCount ? `${plan.pageCount}` : undefined],
                    ["Sections",    plan.sectionCount ? `${plan.sectionCount}` : undefined],
                    ["Components",  plan.componentCount ? `~${plan.componentCount}` : undefined],
                    ["Goal",        plan.conversionGoal],
                  ].filter(([,v])=>!!v).map(([k,v])=>(
                    <div key={k as string} style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                      <span style={{ fontSize:10, color:C.muted, flexShrink:0 }}>{k}:</span>
                      <span style={{ fontSize:10, color:C.text, fontWeight:600,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {v as string}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Section chips */}
                {plan.sections && plan.sections.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:8 }}>
                    {plan.sections.slice(0,8).map(s=>(
                      <span key={s} style={{ fontSize:9, padding:"2px 7px", borderRadius:20,
                        background:"rgba(255,255,255,0.06)", color:C.muted,
                        textTransform:"capitalize" }}>
                        {s.replace(/-/g," ")}
                      </span>
                    ))}
                    {(plan.sections.length > 8) && (
                      <span style={{ fontSize:9, color:C.muted }}>+{plan.sections.length-8} more</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── PHASE STEPS ───────────────────────────────────── */}
            {["Reading Request","Understanding Goal","Creating Plan","Building Project",
              "Validating Output","Optimizing Result","Finalizing"].map((label,i)=>{
              const MAP:Record<string,string> = {
                Reading:"Reading Request", Understanding:"Understanding Goal",
                Planning:"Creating Plan", Building:"Building Project",
                Validating:"Validating Output", Optimizing:"Optimizing Result",
                Finalizing:"Finalizing"
              };
              const phase = phases.find(p => MAP[p.agent]===label);
              const isDoneS = !!phase?.done;
              const isActiveS = !!phase && !phase.done && isActive;
              const notReached = !phase;
              return (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"4px 0", opacity:notReached?0.22:1, transition:"opacity .35s" }}>
                  <div style={{ width:14, height:14, borderRadius:"50%", flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background: isDoneS?"rgba(0,208,132,0.1)":isActiveS?"rgba(245,245,245,0.1)":"rgba(255,255,255,0.04)",
                    border:`1px solid ${isDoneS?"rgba(0,208,132,0.35)":isActiveS?"rgba(245,245,245,0.35)":"rgba(255,255,255,0.07)"}` }}>
                    {isDoneS ? <span style={{color:C.green,fontSize:7,fontWeight:800}}>✓</span>
                    : isActiveS ? <div style={{width:5,height:5,borderRadius:"50%",
                        border:"1.5px solid rgba(245,245,245,0.2)",borderTopColor:C.purple,
                        animation:"spin .7s linear infinite"}}/>
                    : <div style={{width:3,height:3,borderRadius:"50%",background:"rgba(255,255,255,0.12)"}}/>}
                  </div>
                  <span style={{ fontSize:11, color: isDoneS?C.text:isActiveS?C.text:C.muted, flex:1 }}>
                    {phase?.action || label}
                  </span>
                  {isDoneS && <span style={{fontSize:9,color:C.green}}>✓</span>}
                </div>
              );
            })}

            {/* ── FILE CREATION LOG ─────────────────────────────── */}
            {files?.files && files.files.length > 0 && (
              <div style={{ marginTop:10, background:"rgba(0,0,0,0.2)", borderRadius:6,
                padding:"8px 10px", fontFamily:"monospace" }}>
                <div style={{ fontSize:9, color:C.muted, marginBottom:5,
                  textTransform:"uppercase", letterSpacing:"0.08em" }}>
                  File Architecture
                </div>
                {files.files.slice(0, filesDone).map((f,i)=>(
                  <div key={f} style={{ display:"flex", alignItems:"center", gap:6,
                    padding:"2px 0", animation:"fadeIn .2s ease" }}>
                    <span style={{ color:C.green, fontSize:9 }}>+</span>
                    <span style={{ fontSize:10, color:"rgba(255,255,255,0.55)" }}>{f}</span>
                  </div>
                ))}
                {filesDone < (files.total||0) && (
                  <div style={{ fontSize:9, color:C.muted }}>
                    {filesDone}/{files.total} files...
                  </div>
                )}
                {filesDone >= (files.total ?? 0) && (files.total ?? 0) > 0 && (
                  <div style={{ fontSize:9, color:C.green, marginTop:3 }}>
                    ✓ {files.total} files created
                  </div>
                )}
              </div>
            )}

            {/* ── SELF REVIEW ───────────────────────────────────── */}
            {review && review.length > 0 && (
              <div style={{ marginTop:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                    Self Review
                  </span>
                  {(review as any).score !== undefined && (
                    <span style={{ fontSize:9, fontWeight:700, color:
                      (review as any).score >= 90 ? C.green :
                      (review as any).score >= 70 ? C.purple : "#EF4444" }}>
                      {(review as any).score}/100
                    </span>
                  )}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 8px" }}>
                  {review.map((c: ReviewCheck)=>(
                    <div key={c.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ fontSize:9, color: c.pass ? C.green : "#EF4444", flexShrink:0 }}>
                        {c.pass ? "✓" : "✗"}
                      </span>
                      <span style={{ fontSize:10, color: c.pass ? C.text : C.muted }}>{c.label}</span>
                    </div>
                  ))}
                </div>
                {review.filter((c: ReviewCheck) => !c.pass).length > 0 && (
                  <div style={{ marginTop:6, fontSize:9, color:"#EF4444", opacity:0.7 }}>
                    {review.filter((c: ReviewCheck) => !c.pass).length} issue(s) detected
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

// ── File Explorer Panel ───────────────────────────────────────────
function FilesPanel({ html, projectName, extraFiles }: { html:string; projectName:string; extraFiles?:{name:string;content:string}[] }) {
  const [activeFile, setActiveFile] = useState("index.html");
  const [copied, setCopied] = useState(false);
  const files = [
    ...extractFiles(html, projectName),
    ...(extraFiles||[]).map(f=>({ name:f.name, lang:"html", icon:"📄", content:f.content, size:`${(f.content.length/1024).toFixed(1)}KB` })),
  ];
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
  const [isGameProject, setIsGameProject] = useState(false);
  const [gameMemory, setGameMemory]       = useState<GameProjectMemory|null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("preview");
  const [device, setDevice]     = useState<Device>("desktop");
  // Screenshot Vision states
  const [visionReviewing, setVisionReviewing] = useState(false);
  const [visionReview, setVisionReview] = useState<{score:number;issues:string[];passed:string[];autoFixInstructions:string}|null>(null);
  const [visionError, setVisionError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Smart resize: "chat" = 50/50, "preview" = 35/65 default
  const [panelFocus, setPanelFocus] = useState<"chat"|"preview">("preview");
  const [forceType, setForceType] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"chat"|"preview">("chat");
  const [credits, setCredits]   = useState({ total:5, used:0 });
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [multiPageFiles, setMultiPageFiles] = useState<{name:string;content:string}[]>([]);
  const [projectMemory, setProjectMemory] = useState<ProjectMemory|null>(null);
    // Production Gate score — state (not just a runFlow-local) so runEdit's
  // post-edit gate re-check (A3) can read/update it across calls.
  const [completenessScore, setCompletenessScore] = useState<number|null>(null);
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
    // Serialize chat history for persistence — fixes bug where reopening
    // a project showed only the live preview but lost all prior chat messages.
    const historyPayload = messages.map(m => ({ role:m.role, type:m.type, content:m.content }));
    if (usePid) {
      await supabase.from("projects").update({ name, title:name, conversation_history:historyPayload, updated_at:new Date().toISOString() }).eq("id",usePid);
    } else {
      const {data} = await supabase.from("projects").insert({ user_id:session.user.id, name, title:name, html_code:html, prompt:promptRef.current, conversation_history:historyPayload, status:"completed", created_at:new Date().toISOString(), updated_at:new Date().toISOString() }).select("id").single();
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
  // ── Screenshot Vision Review ──────────────────────────────────────
  const runVisionReview = async () => {
    if (!result || visionReviewing) return;
    setVisionReviewing(true);
    setVisionError("");
    setVisionReview(null);
    try {
      const iframe = document.querySelector("iframe[title=\"Live Preview\"]") as HTMLIFrameElement;
      if (!iframe?.contentWindow) throw new Error("Preview not ready");
      await new Promise<void>((resolve) => {
        const script = iframe.contentDocument!.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = () => resolve();
        script.onerror = () => resolve(); // fallback
        iframe.contentDocument!.head.appendChild(script);
        setTimeout(resolve, 5000);
      });
      await new Promise(r => setTimeout(r, 600));
      const screenshot: string = await new Promise((resolve, reject) => {
        const h2c = (iframe.contentWindow as any).html2canvas;
        if (!h2c) return reject(new Error("html2canvas not loaded"));
        h2c(iframe.contentDocument!.body, {
          scale: 0.5, useCORS: true, allowTaint: true,
          backgroundColor: "#050816", width: 1280, height: 720,
          windowWidth: 1280, windowHeight: 720,
        }).then((canvas: HTMLCanvasElement) => resolve(canvas.toDataURL("image/png"))).catch(reject);
      });
      const {data:{session}} = await supabase.auth.getSession();
      const res = await fetch("/api/screenshot-review", {
        method: "POST",
        headers: {"Content-Type":"application/json","Authorization":`Bearer ${session?.access_token}`},
        body: JSON.stringify({screenshot, html: result}),
        signal: AbortSignal.timeout(300000),
      });
      const data = await res.json();
      if (!res.ok || !data.review) throw new Error(data.error || "Review failed");
      setVisionReview(data.review);
    } catch (err: any) {
      setVisionError(err.message || "Vision review failed. Try again.");
    } finally {
      setVisionReviewing(false);
    }
  };

  // ── Client-side instant intent detection (mirrors orchestrate logic) ──
  const detectTypeLocal = (p: string): string => {
    const s = p.toLowerCase();
    if (/landing page|landing site|squeeze page|opt.?in page/.test(s)) return "Landing Page";
    if (/admin panel|back.?office|internal tool|erp/.test(s)) return "Dashboard";
    if (/crm|lead manag|sales pipeline/.test(s)) return "Dashboard";
    if (/ai tool|ai app|ai platform|chatbot|ai assistant/.test(s)) return "AI Tool";
    if (/docs|documentation|knowledge base/.test(s)) return "Blog";
    if (/saas|subscription platform|b2b platform/.test(s)) return "SaaS";
    if (/shop|store|ecommerce|marketplace|product catalog/.test(s)) return "E-commerce";
    if (/dashboard|analytics|metrics|reporting/.test(s)) return "Dashboard";
    if (/web app|tool|tracker|calculator|manager|planner/.test(s)) return "App";
    if (/portfolio|showcase|resume site|personal site/.test(s)) return "Portfolio";
    if (/blog|news site|magazine/.test(s)) return "Blog";
    if (/landing|waitlist|coming soon/.test(s)) return "Landing Page";
    return "Website";
  };

  const runFlow = async (userPrompt:string) => {
    if (!userPrompt.trim()||loading) return;
    if (remaining<1) {
      addMsg({role:"ai",type:"error",content:"⚡ No credits remaining. Free plan resets daily at midnight. Tap ⚡ to upgrade for unlimited access."});
      router.push("/billing");
      return;
    }
    setLoading(true); setPrompt(""); promptRef.current=userPrompt;
    addMsg({role:"user",type:"text",content:userPrompt});
    // ── Instant planning (0ms) — shown BEFORE first API byte ───────────
    const detectedType = detectTypeLocal(userPrompt);
    const thinkId = addMsg({role:"ai",type:"thinking",content:"",isActive:true,phases:[
      {agent:"Reading",     icon:"○", action:`Detected: ${detectedType} project`, pct:8,  status:"done",    done:true},
      {agent:"Planning",    icon:"○", action:"Planning project structure...",      pct:15, status:"running"},
      {agent:"Understanding",icon:"○",action:"Analyzing requirements...",          pct:22, status:"running"},
      {agent:"Building",    icon:"○", action:"Building...",                        pct:40, status:"running"},
    ]});

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
    let receivedProjectType=""; let extraFiles:{name:string;content:string}[]=[];
    let gateResult:any=null;
    const livePhases:AgentPhaseEvent[]=[];

    // Use game API for games, orchestrate for everything else  
    const apiEndpoint = detected.isGame ? "/api/game" : "/api/orchestrate";

    try {
      const res = await fetch(apiEndpoint,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:userPrompt,userId:session.user.id,accessToken:session.access_token,forceType:forceType||undefined,competitorUrl:competitorUrl?.trim()||undefined}),
        signal:AbortSignal.timeout(300000),
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
        // ── New intelligence events ────────────────────────────────────
        if (em[1]==="plan")   { updateMsg(thinkId, { plan: data as PlanData, isActive:true }); }
        if (em[1]==="files")  { updateMsg(thinkId, { fileTree: data as FilesData, isActive:true }); }
        if (em[1]==="review") { updateMsg(thinkId, { review: data.checks as ReviewCheck[], isActive:true }); }
        if (em[1]==="complete"){
          html=data.html||""; credUsed=data.creditCost||1; savedPid=data.projectId||"";
          receivedProjectType = data.projectType||"";
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
        const fr=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({prompt:userPrompt}),signal:AbortSignal.timeout(280000)});
        const fd=await fr.json();
        if(fd.html){html=fd.html;credUsed=fd.creditsUsed||1;savedPid=fd.projectId||"";}
        if(fd.code==="NO_CREDITS"){updateMsg(thinkId,{type:"error",content:"⚡ No credits remaining. Upgrade to continue.",isActive:false});setLoading(false);return;}
      } catch {}
    }

    if (!html){
      updateMsg(thinkId,{type:"error",content:"Generation failed. Try a more detailed description.",isActive:false});
      setLoading(false); return;
    }

    // ── Automatic multi-page generation — same rule orchestrate already
    // uses for its own pageCount stat (projectType!=="landing" → 3 pages).
    // Non-blocking on failure: single-page result is already valid either way.
    if (receivedProjectType && receivedProjectType!=="landing"){
      try{
        const mpRes=await fetch("/api/multipage",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({homeHtml:html,prompt:userPrompt,accessToken:session.access_token,userId:session.user.id,responseFormat:"json"}),
          signal:AbortSignal.timeout(280000),
        });
        const mpData=await mpRes.json().catch(()=>null);
        if (mpRes.ok && Array.isArray(mpData?.files)){
          extraFiles = mpData.files.filter((f:any)=>f?.name && f.name!=="index.html");
          setMultiPageFiles(extraFiles);
          if (extraFiles.length) credUsed += 2;
        }
      }catch{}
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
    // Deferred slightly so the addMsg calls above have been queued before
    // we snapshot `messages` for conversation_history (avoids stale closure
    // missing the just-added summary/warning messages on first generation).
    setTimeout(()=>{(async()=>{
      try{
        const {data:{session:s}}=await supabase.auth.getSession(); if(!s) return;
        let finalPid=pidToUse;
        const historyPayload = messages.map(m=>({role:m.role,type:m.type,content:m.content}));
        if(!finalPid){
          const {data:proj}=await supabase.from("projects").insert({user_id:s.user.id,name:pName,title:pName,html_code:html,prompt:promptRef.current,conversation_history:historyPayload,status:"completed",created_at:new Date().toISOString(),updated_at:new Date().toISOString()}).select("id").single();
          if(proj?.id){finalPid=proj.id;setProjectId(proj.id);window.history.replaceState({},"",`/create?id=${proj.id}`);}
        } else {
          await supabase.from("projects").update({conversation_history:historyPayload}).eq("id",finalPid);
        }
        if(finalPid){
          const {data:ver}=await supabase.from("project_versions").insert({project_id:finalPid,code_snapshot:{"index.html":html,...Object.fromEntries(extraFiles.map(f=>[f.name,f.content]))},message:`Generated: ${pName.slice(0,30)}`,type:"auto",version_number:1,size_bytes:html.length}).select().single();
          if(ver)setVersions([ver as Version]);
        }
      }catch{}
    })();},50);
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
      {agent:"Reading",    icon:"○", action:"Analyzing edit request...", pct:15, status:"running"},
      {agent:"Targeting",  icon:"○", action:"Resolving target section...", pct:0, status:"running"},
      {agent:"Building",   icon:"○", action:"Applying patch...",          pct:0, status:"running"},
      {agent:"Validating", icon:"○", action:"Validating changes...",      pct:0, status:"running"},
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
    const isLarge=codeLines>1500; // raised from 600 — Component Library output is 600-1200 lines normally
    const gCtx=isGameProject&&gameMemory?formatGameMemoryForAI(gameMemory):formatMemoryForAI(projectMemory);
    try {
      // Strategy 1: Chat API (game-aware surgical edit)
      const codeForChat=isLarge&&isGameProject
        ?result.slice(0,5000)+"\n\n/* ... MIDDLE SECTION PRESERVED ... */\n\n"+result.slice(-3000)
        :result;
      const r1=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userMessage:editPrompt,currentCode:{"index.html":codeForChat},projectName,framework:isGameProject?"game":"html",projectContext:gCtx,gameMemory:gameMemory||undefined}),signal:AbortSignal.timeout(110000)});
      const d1=await r1.json();
      newHtml=d1.codeChanges?.["index.html"]||"";
      if(!newHtml){const m=(d1.reply||"").match(/<!DOCTYPE[\s\S]*<\/html>/i);if(m)newHtml=m[0];}

      // Strategy 2: Game API regenerate with memory (games only)
      if(!newHtml&&isGameProject){
        const r2=await fetch("/api/game",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:editPrompt+" (EDIT: preserve all existing mechanics)",userId:session.user.id,accessToken:session.access_token,gameMemory}),signal:AbortSignal.timeout(110000)});
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
        const r3=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({prompt:`Apply ONLY: "${editPrompt}"\nPreserve design.\nCODE:\n${ctx}`,isEdit:true}),signal:AbortSignal.timeout(110000)});
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
        // Use log from chat route to show real intent + target
        const editLog = d1?.log;
        const targetSection = editLog?.intent?.replace("_EDIT","").toLowerCase() || "section";
        const providerLabel = editLog?.provider === "claude" ? "Claude" : editLog?.provider === "openai" ? "OpenAI" : "AI";
        updateMsg(thinkId,{isActive:false,phases:[
          {agent:"Reading",    icon:"○", action:`Intent: ${editLog?.intent||"STYLE_EDIT"}`,    pct:100, done:true, status:"done"},
          {agent:"Targeting",  icon:"○", action:`Target resolved: ${targetSection}`,            pct:100, done:true, status:"done"},
          {agent:"Building",   icon:"○", action:`Patch applied via ${providerLabel}`,          pct:100, done:true, status:"done"},
          {agent:"Validating", icon:"○", action:`Validated — ${editLog?.validation?.valid?"passed":"repaired"}`, pct:100, done:true, status:"done"},
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
        // Save AFTER all messages for this turn are queued — avoids stale-closure
        // bug where saveProject's `messages` snapshot misses the latest reply.
        setTimeout(()=>{(async()=>{try{await saveProject(newHtml,projectName);}catch{}})();},50);
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
  const recognitionRef = useRef<any>(null);
  const handleVoice=()=>{
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR){ addMsg({role:"ai",type:"error",content:"Voice input isn't supported in this browser. Try Chrome or Edge."}); return; }
    if(listening){ recognitionRef.current?.stop(); setListening(false); return; }
    const r=new SR();
    // Upgraded recognition settings — continuous, interim results for real-time feedback,
    // higher alternative count for better accuracy, auto-detect Hindi-English mixed speech.
    r.continuous=true;
    r.interimResults=true;
    r.maxAlternatives=3;
    r.lang="en-IN"; // en-IN handles Hindi-English (Hinglish) code-switching far better than en-US
    let finalTranscript="";
    let silenceTimer:any=null;

    r.onstart=()=>setListening(true);
    r.onresult=(e:any)=>{
      let interim="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        const transcript=e.results[i][0].transcript;
        if(e.results[i].isFinal){
          // Basic punctuation cleanup: capitalize first letter, ensure single trailing period
          let clean=transcript.trim();
          if(clean) clean=clean.charAt(0).toUpperCase()+clean.slice(1);
          finalTranscript+=(finalTranscript?" ":"")+clean;
        } else {
          interim=transcript;
        }
      }
      const combined=(finalTranscript+(interim?" "+interim:"")).trim();
      if(combined) setPrompt(combined);

      // Auto-stop after 2.5s of silence (no new results) — avoids endless listening
      if(silenceTimer) clearTimeout(silenceTimer);
      silenceTimer=setTimeout(()=>{ r.stop(); }, 2500);
    };
    r.onerror=(e:any)=>{
      setListening(false);
      if(e.error==="no-speech") return; // silent timeout, not a real error
      addMsg({role:"ai",type:"error",content:"Voice recognition error. Please try again."});
    };
    r.onend=()=>{ setListening(false); if(silenceTimer) clearTimeout(silenceTimer); };
    recognitionRef.current=r;
    r.start();
  };
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
        html,body{height:100%;overflow:hidden;background:#040610;}
        ::-webkit-scrollbar{width:2px;height:2px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:4px;}
        ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.22);}
        textarea,input,button{font-family:'DM Sans',sans-serif;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.88)}50%{opacity:1;transform:scale(1.12)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes shimmer{0%{opacity:.5}50%{opacity:1}100%{opacity:.5}}
        .kr-preview-bg{background-image:radial-gradient(circle,rgba(255,255,255,0.025) 1px,transparent 1px);background-size:24px 24px;}
        .msg-in{animation:fadeUp .2s cubic-bezier(0.16,1,0.3,1) both;}
        .send-btn:hover:not(:disabled){transform:scale(1.05);box-shadow:0 0 24px rgba(255,255,255,0.35);}
        .tab-icon:hover{background:rgba(255,255,255,0.08)!important;color:#fff!important;}
        .quick-btn:hover{border-color:rgba(255,255,255,0.35)!important;color:#F0F2F5!important;background:rgba(255,255,255,0.06)!important;}
        .msg-bubble-user{background:linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06));border:1px solid rgba(255,255,255,0.14);}
        .nav-link-item:hover{background:rgba(255,255,255,0.06)!important;color:#F0F2F5!important;}
        .version-card:hover{border-color:rgba(255,255,255,0.18)!important;background:rgba(255,255,255,0.04)!important;}
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
              {[{id:"desktop",icon:"🖥️"},{id:"tablet",icon:"📲"},{id:"mobile",icon:"📱"}].map(d=>(
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
          <div className="kr-preview-bg" style={{flex:1,display:"flex",alignItems:device==="desktop"?"stretch":"center",justifyContent:"center",background:"#050816",overflow:"auto"}}>
            <iframe srcDoc={result}
              style={{border:"none",width:device==="desktop"?"100%":device==="tablet"?"min(768px,92vw)":"min(390px,88vw)",height:device==="desktop"?"100%":"min(100%,84vh)",minHeight:device==="desktop"?"100%":undefined,background:"#fff",
                boxShadow:device!=="desktop"?"0 0 0 10px #11151F,0 20px 60px rgba(0,0,0,0.8)":"none",
                borderRadius:device==="mobile"?"36px":device==="tablet"?"16px":"0",flexShrink:0,margin:device!=="desktop"?"16px 0":0}}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" title="Fullscreen Preview"/>
          </div>
        </div>
      )}

      {/* Drag overlay */}
        {isDragging&&<div style={{position:"fixed",inset:0,background:"rgba(245,245,245,0.08)",border:"2px dashed rgba(245,245,245,0.4)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8}}><div style={{fontSize:18,fontWeight:700,color:C.purple}}>Drop files to attach</div></div>}

        {/* ── TOP BAR — Premium ── */}
        <div style={{height:52,flexShrink:0,padding:"0 16px",borderBottom:`1px solid ${C.border}`,background:C.surface,display:"flex",alignItems:"center",gap:10,zIndex:100,backdropFilter:"blur(8px)"}}>
          {/* Logo */}
          <KryptonLogo size={24} showText={true} animated={false} onClick={()=>router.push("/")} style={{cursor:"pointer",flexShrink:0}}/>
          <div style={{width:1,height:18,background:"rgba(255,255,255,0.08)",flexShrink:0}}/>

          {/* Project Name */}
          {editingName
            ? <input autoFocus value={projectName} onChange={e=>setProjectName(e.target.value)} onBlur={()=>setEditingName(false)} onKeyDown={e=>e.key==="Enter"&&setEditingName(false)}
                style={{flex:1,maxWidth:280,background:"rgba(255,255,255,0.07)",border:`1px solid rgba(255,255,255,0.2)`,borderRadius:8,color:C.text,padding:"4px 10px",fontSize:13,fontWeight:600,outline:"none"}}/>
            : <button onClick={()=>setEditingName(true)} title="Click to rename" style={{background:"none",border:"none",color:C.sub,fontSize:13,cursor:"pointer",padding:"3px 8px",borderRadius:6,flex:1,textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:250,transition:"color .15s"}}>
                {projectName}
                <span style={{opacity:.35,marginLeft:5,fontSize:11}}>✏</span>
              </button>
          }
          {isGameProject && (
            <span style={{padding:"2px 9px",borderRadius:20,background:"rgba(255,215,0,0.07)",border:"1px solid rgba(255,215,0,0.18)",fontSize:10,fontWeight:700,color:"#F5D800",flexShrink:0,letterSpacing:"0.04em"}}>🎮 GAME</span>
          )}

          {/* Mobile panel toggle */}
          {isMobile&&(
            <div style={{display:"flex",gap:3,marginLeft:"auto",background:"rgba(255,255,255,0.04)",borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
              {["chat","preview"].map(t=>(
                <button key={t} onClick={()=>setMobilePanel(t as any)}
                  style={{padding:"3px 12px",borderRadius:6,border:"none",background:mobilePanel===t?"rgba(255,255,255,0.12)":"transparent",color:mobilePanel===t?C.text:C.muted,fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .15s",textTransform:"capitalize"}}>{t}</button>
              ))}
            </div>
          )}

          {/* Right actions */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginLeft:isMobile?"0":"auto"}}>
            {/* Credits badge */}
            <div
              onClick={()=>remaining===0?router.push("/billing"):undefined}
              style={{display:"flex",alignItems:"center",gap:5,padding:"4px 11px",borderRadius:20,background:remaining>3?"rgba(255,255,255,0.05)":remaining>0?"rgba(245,158,11,0.08)":"rgba(229,115,107,0.10)",border:`1px solid ${remaining>3?"rgba(255,255,255,0.10)":remaining>0?"rgba(245,158,11,0.25)":"rgba(229,115,107,0.30)"}`,fontSize:11,fontWeight:700,color:remaining>3?C.sub:remaining>0?"#F59E0B":C.red,cursor:remaining===0?"pointer":"default",userSelect:"none",transition:"all .2s"}}
              title={remaining===0?"Upgrade for more credits":`${remaining} credits remaining`}
            >
              <span style={{fontSize:12}}>⚡</span>
              <span>{remaining>0?remaining:"Upgrade"}</span>
            </div>
            {/* Save button */}
            {result&&(
              <button onClick={()=>saveProject(result,projectName)}
                style={{padding:"5px 14px",background:saved?"rgba(76,175,138,0.1)":"rgba(255,255,255,0.07)",border:`1px solid ${saved?"rgba(76,175,138,0.25)":"rgba(255,255,255,0.12)"}`,borderRadius:8,color:saved?C.green:C.sub,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s",display:"flex",alignItems:"center",gap:5}}>
                {saving?"…":saved?"✓ Saved":"Save"}
              </button>
            )}
          </div>
        </div>

        {/* ── MAIN 2-PANEL ── */}
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>

          {/* ── LEFT: CHAT ── */}
          <div onClick={()=>!isMobile&&setPanelFocus("chat")}
          style={{width:isMobile?"100%":(panelFocus==="chat"?"50%":"35%"),display:isMobile?(mobilePanel==="chat"?"flex":"none"):"flex",flexDirection:"column",borderRight:isMobile?"none":`1px solid ${C.border}`,background:C.surface,overflow:"hidden",flexShrink:0,transition:isMobile?"none":"width .35s cubic-bezier(0.16,1,0.3,1)"}}>
            {/* Loading indicator */}
            {loading&&<div style={{padding:"6px 16px",borderBottom:`1px solid ${C.border}`,background:"rgba(255,255,255,0.02)",display:"flex",alignItems:"center",gap:10,flexShrink:0,backdropFilter:"blur(4px)"}}>
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                {[0,1,2].map(i=><div key={i} style={{width:4,height:4,borderRadius:"50%",background:C.sub,animation:`pulse 1.4s ${i*.18}s ease-in-out infinite`}}/>)}
              </div>
              <span style={{fontSize:11,color:C.sub,fontWeight:500,letterSpacing:"0.04em"}}>Krypton AI — Generating</span>
            </div>}

            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",paddingTop:14,paddingBottom:8,display:"flex",flexDirection:"column",gap:8}}>
              {messages.length===0&&!loading&&(
                <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,textAlign:"center",padding:"32px 20px"}}>
                  {/* Animated logo */}
                  <div style={{position:"relative"}}>
                    <div style={{position:"absolute",inset:-16,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,255,255,0.04),transparent)",animation:"shimmer 3s ease-in-out infinite"}}/>
                    <KryptonLogo size={52} showText={false} animated={true}/>
                  </div>
                  {/* Heading */}
                  <div>
                    <div style={{fontSize:20,fontWeight:800,marginBottom:8,fontFamily:"'Syne',sans-serif",background:"linear-gradient(135deg,#F0F2F5 30%,#8892A0)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"-0.01em"}}>
                      What do you want to build?
                    </div>
                    <div style={{fontSize:13,color:C.muted,lineHeight:1.6,maxWidth:280,margin:"0 auto"}}>
                      Describe your idea — Krypton AI builds it instantly.
                    </div>
                  </div>
                  {/* Category row */}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",maxWidth:400}}>
                    {[
                      {label:"🌐 Website",prompt:"Build a modern SaaS landing page"},
                      {label:"🛒 Store",prompt:"Create a luxury perfume store"},
                      {label:"📊 Dashboard",prompt:"Build an analytics dashboard"},
                      {label:"📱 App",prompt:"Create a task manager kanban app"},
                      {label:"🎨 Portfolio",prompt:"Design a creative portfolio"},
                    ].map(s=>(
                      <button key={s.label} className="quick-btn" onClick={()=>setPrompt(s.prompt)}
                        style={{padding:"6px 14px",background:"rgba(255,255,255,0.05)",border:`1px solid rgba(255,255,255,0.10)`,borderRadius:20,color:C.sub,fontSize:12,cursor:"pointer",transition:"all .15s",fontWeight:500}}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {/* Examples */}
                  <div style={{width:"100%",maxWidth:340}}>
                    <div style={{fontSize:11,color:C.muted,marginBottom:8,letterSpacing:"0.06em",textTransform:"uppercase"}}>Popular prompts</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {["Build a restaurant website with menu","Create a SaaS landing page","Create a fitness coaching landing page","Build a real estate agency website"].map(s=>(
                        <button key={s} onClick={()=>setPrompt(s)}
                          style={{padding:"8px 12px",background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:8,color:C.sub,fontSize:12,cursor:"pointer",textAlign:"left",transition:"all .15s",display:"flex",alignItems:"center",gap:8}}>
                          <span style={{opacity:.4,fontSize:10}}>→</span>{s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.map(msg=>(
                <div key={msg.id} className="msg-in">
                  {msg.role==="user" ? (
                    <div style={{display:"flex",justifyContent:"flex-end",padding:"2px 16px"}}>
                      <div className="msg-bubble-user" style={{maxWidth:"80%",padding:"10px 15px",borderRadius:"16px 16px 3px 16px",fontSize:13.5,lineHeight:1.65,color:C.text,fontWeight:450}}>
                        {msg.content}
                      </div>
                    </div>
                  ) : msg.type==="thinking" ? (
                    <ThinkingPanel
                phases={msg.phases||[]}
                isActive={msg.isActive||false}
                plan={msg.plan}
                files={msg.fileTree}
                review={msg.review}
              />
                  ) : (
                    <div style={{padding:"2px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
                        <div style={{width:20,height:20,borderRadius:"50%",background:"linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.05))",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <img src="/logo.svg" width={11} height={11} alt="Krypton AI"/>
                        </div>
                        <span style={{fontSize:11,color:C.sub,fontWeight:600,letterSpacing:"0.02em"}}>Krypton AI</span>
                        <span style={{fontSize:10,color:C.muted}}>{fmtTime(msg.ts)}</span>
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
              {/* Detected URL chip — auto-extracted from prompt text, no separate input field */}
              {!result && competitorUrl.trim() && (
                <div style={{marginBottom:8,display:"flex",alignItems:"center",gap:6,padding:"5px 10px",background:"rgba(245,245,245,0.04)",borderRadius:20,border:`1px solid ${C.border}`,width:"fit-content"}}>
                  <span style={{fontSize:11}}>🔗</span>
                  <span style={{fontSize:11,color:"#9AA3AF",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{competitorUrl}</span>
                  <button onClick={()=>setCompetitorUrl("")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:11,padding:0}}>✕</button>
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
              <div style={{background:C.card,border:`1px solid ${loading?"rgba(255,255,255,0.18)":C.border}`,borderRadius:16,padding:"12px 14px",transition:"border-color .25s",boxShadow:loading?"0 0 0 3px rgba(255,255,255,0.04)":"none"}}>
                <textarea value={prompt} onChange={e=>{
                    const v=e.target.value; setPrompt(v);
                    const urlMatch=v.match(/https?:\/\/[^\s]+/);
                    if(urlMatch) setCompetitorUrl(urlMatch[0]); else if(competitorUrl) setCompetitorUrl("");
                  }} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!loading){e.preventDefault();handleSend();}}}
                  placeholder={loading?"Building your project…":result?"Describe a change to make…":"Describe what you want to build…"}
                  rows={2} disabled={loading}
                  style={{width:"100%",background:"none",border:"none",color:loading?C.muted:C.text,fontSize:14,resize:"none",outline:"none",lineHeight:1.7,maxHeight:140,overflowY:"auto",caretColor:C.text}}
                />
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:`1px solid rgba(255,255,255,0.05)`}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt" style={{display:"none"}} onChange={e=>{if(e.target.files?.length)addMsg({role:"user",type:"text",content:`📎 Attached: ${Array.from(e.target.files).map(f=>f.name).join(", ")}`});}}/>
                    <button onClick={()=>fileInputRef.current?.click()}
                      style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}
                      title="Attach file" onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.2)"} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                      📎
                    </button>
                    <span style={{fontSize:11,color:C.muted,letterSpacing:"0.04em",userSelect:"none"}}>Krypton AI</span>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {/* Voice button */}
                    <button onClick={handleVoice}
                      title={listening?"Stop listening":"Voice input"}
                      style={{width:32,height:32,borderRadius:10,background:listening?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.04)",border:`1px solid ${listening?"rgba(255,255,255,0.3)":C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",position:"relative"}}>
                      {listening&&<div style={{position:"absolute",inset:-3,borderRadius:13,border:"2px solid rgba(255,255,255,0.2)",animation:"pulse 1.5s ease-in-out infinite"}}/>}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="2" width="6" height="11" rx="3" fill={listening?"#F0F2F5":"#5B6472"}/>
                        <path d="M5 11a7 7 0 0014 0" stroke={listening?"#F0F2F5":"#5B6472"} strokeWidth="2" strokeLinecap="round"/>
                        <line x1="12" y1="18" x2="12" y2="22" stroke={listening?"#F0F2F5":"#5B6472"} strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                    {/* Send button */}
                    <button className="send-btn" onClick={handleSend} disabled={!prompt.trim()||loading}
                      style={{width:36,height:36,borderRadius:10,background:(!loading&&prompt.trim())?"linear-gradient(135deg,#E8E8E8,#A8B0BA)":"rgba(255,255,255,0.05)",border:"none",cursor:(!loading&&prompt.trim())?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .25s"}}>
                      {loading
                        ?<div style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.15)",borderTopColor:"rgba(255,255,255,0.8)",animation:"spin .7s linear infinite"}}/>
                        :<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke={prompt.trim()?"#050816":"#5B6472"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: PREVIEW / FILES / DEPLOY / HISTORY ── */}
          <div onClick={()=>!isMobile&&setPanelFocus("preview")} style={{flex:1,display:isMobile?(mobilePanel==="preview"?"flex":"none"):"flex",flexDirection:"column",overflow:"hidden",position:"relative",transition:isMobile?"none":"all .35s cubic-bezier(0.16,1,0.3,1)"}}>
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
                  {([{id:"desktop",icon:"🖥️"},{id:"tablet",icon:"📲"},{id:"mobile",icon:"📱"}] as const).map(d=>(
                    <button key={d.id} onClick={()=>setDevice(d.id)} style={{width:26,height:26,borderRadius:7,border:`1px solid ${device===d.id?"rgba(245,245,245,0.35)":C.border}`,background:device===d.id?"rgba(245,245,245,0.12)":"none",color:device===d.id?C.purple:C.muted,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{d.icon}</button>
                  ))}
                  <button onClick={()=>{if(!result)return;const b=new Blob([result],{type:"text/html"});window.open(URL.createObjectURL(b),"_blank");}} style={{width:26,height:26,borderRadius:7,border:`1px solid ${C.border}`,background:"none",color:C.muted,fontSize:11,cursor:"pointer",marginLeft:3}}>↗</button>
                  {/* Screenshot Vision Review Button */}
                  <button
                    onClick={runVisionReview}
                    disabled={visionReviewing || !result}
                    title="AI Vision Review — Claude will screenshot and review your website"
                    style={{height:26,padding:"0 8px",borderRadius:7,border:`1px solid ${visionReview ? (visionReview.score>=7?"rgba(95,184,138,0.5)":"rgba(239,115,107,0.5)") : C.border}`,background:visionReviewing?"rgba(245,245,245,0.05)":visionReview?"rgba(245,245,245,0.08)":"none",color:visionReviewing?C.muted:visionReview?(visionReview.score>=7?"#5FB88A":"#E5736B"):C.muted,fontSize:10,fontWeight:600,cursor:visionReviewing||!result?"default":"pointer",marginLeft:3,display:"flex",alignItems:"center",gap:4,letterSpacing:"0.05em"}}
                  >
                    {visionReviewing ? "👁 Reviewing..." : visionReview ? `👁 ${visionReview.score}/10` : "👁 AI Review"}
                  </button>
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
              <div className="kr-preview-bg" style={{flex:1,display:"flex",alignItems:device==="desktop"?"stretch":"flex-start",justifyContent:"center",overflow:"auto",background:device==="desktop"?"#050816":device==="tablet"?"#0B1020":"#050816",padding:device==="desktop"?"0":device==="tablet"?"32px auto":"40px auto"}}>
                {result
                  ? <iframe key={`${result.length}-${device}`} srcDoc={result} style={{
                      border:"none",
                      width:device==="desktop"?"100%":device==="tablet"?"min(768px,100%)":"min(390px,100%)",
                      height:device==="desktop"?"100%":"auto",
                      minHeight:device==="desktop"?"100%":"600px",
                      maxHeight:device!=="desktop"?"82vh":undefined,
                      display:"block",
                      background:"#fff",
                      boxShadow:device!=="desktop"?"0 0 0 10px #11151F,0 0 0 12px #1A1F2B,0 20px 60px rgba(0,0,0,0.8)":"none",
                      borderRadius:device==="mobile"?"36px":device==="tablet"?"16px":"0",
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

            {/* Screenshot Vision Results Panel */}
            {(visionReview || visionError) && rightTab==="preview" && (
              <div style={{borderTop:`1px solid ${C.border}`,background:C.surface,padding:"12px 16px",flexShrink:0,maxHeight:220,overflowY:"auto"}}>
                {visionError && (
                  <div style={{color:"#E5736B",fontSize:12}}>{visionError}</div>
                )}
                {visionReview && (
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <span style={{fontWeight:700,fontSize:13,color:C.text}}>👁 AI Vision Review</span>
                      <span style={{
                        background:visionReview.score>=8?"rgba(95,184,138,0.15)":visionReview.score>=6?"rgba(245,158,11,0.15)":"rgba(229,115,107,0.15)",
                        color:visionReview.score>=8?"#5FB88A":visionReview.score>=6?"#F59E0B":"#E5736B",
                        border:`1px solid ${visionReview.score>=8?"rgba(95,184,138,0.3)":visionReview.score>=6?"rgba(245,158,11,0.3)":"rgba(229,115,107,0.3)"}`,
                        borderRadius:999,padding:"2px 10px",fontSize:11,fontWeight:700
                      }}>{visionReview.score}/10</span>
                      <button onClick={()=>{setVisionReview(null);setVisionError("");}} style={{marginLeft:"auto",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>×</button>
                    </div>
                    {visionReview.issues.length > 0 && (
                      <div style={{marginBottom:8}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#E5736B",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.08em"}}>Issues Found</div>
                        {visionReview.issues.map((issue,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:4}}>
                            <span style={{color:"#E5736B",fontSize:11,flexShrink:0}}>✗</span>
                            <span style={{fontSize:12,color:C.muted}}>{issue}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {visionReview.passed.length > 0 && (
                      <div>
                        <div style={{fontSize:11,fontWeight:600,color:"#5FB88A",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.08em"}}>Looking Good</div>
                        {visionReview.passed.map((p,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:4}}>
                            <span style={{color:"#5FB88A",fontSize:11,flexShrink:0}}>✓</span>
                            <span style={{fontSize:12,color:C.muted}}>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Files */}
            {rightTab==="files"&&<FilesPanel html={result} projectName={projectName} extraFiles={multiPageFiles}/>}

            {/* Deploy */}
            {rightTab==="deploy"&&(
              <div style={{flex:1,overflowY:"auto",padding:20}}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:4,fontFamily:"'Syne',sans-serif"}}>Deploy Project</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:20}}>Export your website and deploy anywhere</div>

                {/* Download — primary CTA */}
                <button disabled={!result} onClick={()=>{
                  if(!result)return;
                  const a=document.createElement("a");
                  a.href=URL.createObjectURL(new Blob([result],{type:"text/html"}));
                  a.download=`${projectName.replace(/\s+/g,"-")}.html`;
                  a.click();
                }}
                  style={{width:"100%",padding:"14px 16px",background:result?"linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))":"rgba(255,255,255,0.03)",border:`1px solid ${result?"rgba(255,255,255,0.2)":C.border}`,borderRadius:12,color:result?C.text:C.muted,fontSize:13,fontWeight:700,cursor:result?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:16,transition:"all .2s"}}>
                  <span style={{fontSize:18}}>⬇</span>
                  <div style={{textAlign:"left"}}><div style={{fontWeight:700}}>Download HTML File</div><div style={{fontSize:11,fontWeight:400,opacity:.7,marginTop:1}}>Single file, works offline</div></div>
                </button>

                {/* Hosting options */}
                <div style={{fontSize:11,color:C.muted,marginBottom:10,letterSpacing:"0.06em",textTransform:"uppercase"}}>Deploy to hosting</div>
                {[
                  {icon:"◆",label:"Netlify Drop",sub:"Drag & drop your HTML — live in seconds",url:"https://app.netlify.com/drop",color:"#4CAF8A"},
                  {icon:"▲",label:"Vercel",sub:"Import GitHub repo or deploy via CLI",url:"https://vercel.com/new",color:"#F0F2F5"},
                  {icon:"🌐",label:"GitHub Pages",sub:"Free hosting for public repos",url:"https://pages.github.com",color:"#8892A0"},
                ].map(d=>(
                  <a key={d.label} href={result?d.url:"#"} target="_blank" rel="noopener noreferrer"
                    style={{display:"flex",alignItems:"center",gap:12,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,textDecoration:"none",opacity:result?1:0.4,transition:"all .2s",cursor:result?"pointer":"not-allowed"}}
                    onMouseEnter={e=>{if(result)e.currentTarget.style.borderColor="rgba(255,255,255,0.18)";}}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                    <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:d.color,flexShrink:0,fontWeight:700}}>{d.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:C.text}}>{d.label}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:2}}>{d.sub}</div>
                    </div>
                    <span style={{fontSize:11,color:C.muted}}>→</span>
                  </a>
                ))}
              </div>
            )}

            {/* History */}
            {rightTab==="history"&&(
              <div style={{flex:1,overflowY:"auto",padding:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:14,fontFamily:"'Syne',sans-serif"}}>Version History</div>
                {versions.length===0
                  ? (
                    <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
                      <div style={{fontSize:32,marginBottom:12,opacity:.15}}>⏱</div>
                      <div style={{fontSize:13,marginBottom:6}}>No versions yet</div>
                      <div style={{fontSize:11,opacity:.6}}>Versions are saved automatically when you edit</div>
                    </div>
                  )
                  : versions.map((v,i)=>(
                    <div key={v.id||i} className="version-card" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:7,display:"flex",alignItems:"center",gap:12,transition:"all .15s"}}>
                      <div style={{width:34,height:34,borderRadius:9,background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:C.sub,flexShrink:0,fontFamily:"'Syne',sans-serif",letterSpacing:"-0.02em"}}>
                        v{v.version_number}
                      </div>
                      <div style={{flex:1,overflow:"hidden"}}>
                        <div style={{fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{v.message}</div>
                        <div style={{fontSize:10,color:C.muted,marginTop:3}}>{new Date(v.created_at).toLocaleString()}</div>
                      </div>
                      <button onClick={()=>restoreVersion(v)}
                        style={{padding:"5px 12px",background:"rgba(255,255,255,0.06)",border:`1px solid rgba(255,255,255,0.12)`,borderRadius:7,color:C.sub,fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0,transition:"all .15s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.10)";e.currentTarget.style.color=C.text;}}
                        onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color=C.sub;}}>
                        Restore
                      </button>
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
