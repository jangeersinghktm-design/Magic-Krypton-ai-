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
import dynamic from "next/dynamic";
const UpgradeModal = dynamic(() => import("@/components/UpgradeModal"), { ssr: false });
import ModeSelector, { type AIMode } from "@/components/ModeSelector";
import AttachmentMenu, { type Attachment } from "@/components/AttachmentMenu";

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
  designScore?: DesignScoreData; // AI Design Director's compact score summary
  gate?:    { dimensions:{dimension:string;score:number}[]; buildPass:boolean; validationPass:boolean; runtimePass:boolean; mobilePass:boolean; overallPass:boolean; repairAttempts:number };
  attachment?: { name:string; type:string; previewUrl?:string };
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

// ── Chat vs Build intent classifier ──────────────────────────────
// Real heuristic, not a stub: explicit build verbs ("build/create/make/
// generate/design a website/app/page...") always win, even if phrased
// as a question ("can you build me a CRM?"). Pure question-phrasing
// ("how should...", "compare X vs Y", ends in "?") with no build verb
// stays conversational. Anything ambiguous defaults to build, to match
// the product's existing generation-first behavior.
// ── Intent Engine — 4 explicit modes, deterministic decision tree ───
// (see conversation for the full tree). Real word-category dictionaries,
// combined with project-existence as an explicit context signal — not
// a single flat regex, and no extra AI call for classification itself.
type Intent = "BUILD" | "EDIT" | "EXPLAIN" | "CHAT";

const BUILD_VERBS   = /\b(build|create|generate|make|design|develop|start)\b/;
const EDIT_VERBS    = /\b(change|update|edit|modify|fix|add|remove|delete|replace|adjust|tweak|rename|move|resize|align|improve)\b/;
const EXPLAIN_VERBS = /\b(explain|why|how does|what does|describe|tell me about|walk me through|show me how)\b/;
const DISCUSS_WORDS = /\b(compare|should i|what do you think|recommend|suggest|pros and cons|\bvs\b|versus|better)\b/;
const PROJECT_NOUN  = /\b(website|site|app|page|landing|dashboard|store|crm|saas|tool|game|component|section|feature|form|button|navbar|footer|api)\b/;
const EXISTING_REF  = /\b(this|that|the|it|current|existing)\b/;
const NEW_SIGNAL    = /\b(new|another|different|start over|from scratch)\b/;
const UI_ELEMENTS   = /\b(navbar|header|footer|hero|button|section|color|font|image|text|title|price|pricing|card|form|logo|background|layout|menu|nav|link|icon)\b/;
const QUESTION_OPENER = /^(how|what|why|when|which|who|should|can|could|would|is|are|do|does|tell me|help me understand)\b/;

const AFFIRM_FOLLOWUP = /^(yes|yeah|yep|sure|ok|okay|go ahead|do it|sounds good|let'?s do (it|that)|proceed|build it|build that)\b/;

function classifyIntent(text: string, hasProject: boolean, fileContent?: string, lastAiMessage?: string): Intent {
  const t = text.toLowerCase().trim();

  // Node 0 — Conversation-context signal: a short affirmative reply right
  // after the AI's last message was a Planning-mode response ("Here's a
  // plan...") means the user wants to proceed to BUILD, not re-classify
  // the affirmation itself via the other nodes (which would likely miss).
  if (AFFIRM_FOLLOWUP.test(t) && lastAiMessage && /roadmap|folder\/project structure|feature list|user flow/i.test(lastAiMessage)) {
    return "BUILD";
  }

  // Node 1 — EXPLAIN: explanation language + referencing something that exists
  if (EXPLAIN_VERBS.test(t) && EXISTING_REF.test(t)) return "EXPLAIN";

  // Node 2 — BUILD: explicit build verb + project noun, and either no
  // project exists yet or the user explicitly wants something new
  if (BUILD_VERBS.test(t) && PROJECT_NOUN.test(t) && (!hasProject || NEW_SIGNAL.test(t))) return "BUILD";

  // Node 3 — EDIT: a project exists AND (edit verb OR names a UI element
  // that GENUINELY appears in the current file — file-context signal,
  // not just keyword-matching the request text in isolation)
  if (hasProject) {
    const mentionsRealElement = fileContent
      ? UI_ELEMENTS.exec(t)?.[0] && fileContent.toLowerCase().includes(UI_ELEMENTS.exec(t)![0])
      : UI_ELEMENTS.test(t); // no file content available — fall back to text-only match, same as before
    if (EDIT_VERBS.test(t) || mentionsRealElement) return "EDIT";
  }

  // Node 4 — CHAT: discussion/question language
  if (DISCUSS_WORDS.test(t) || QUESTION_OPENER.test(t) || t.endsWith("?")) return "CHAT";

  // Node 5 — fallback: EDIT if continuing an existing project, otherwise
  // CHAT (never silently auto-generate a project from an ambiguous message)
  return hasProject ? "EDIT" : "CHAT";
}

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
interface DesignScoreData { overall:number; breakdown?:Record<string,number>; industry?:string; designLanguage?:string; }

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

  const fmtTime = (s:number) => s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;

  // ── Current step label ────────────────────────────────────────────
  const activePhase = phases.find(p => !p.done && isActive);
  const currentLabel = isDone ? "Complete" : (activePhase?.action || "Initializing...");

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
            <style>{`
              @keyframes km-fade-swap { from{opacity:0; transform:translateY(4px);} to{opacity:1; transform:translateY(0);} }
            `}</style>

            {/* ── LIVE THINKING — one active line, fades to the next ── */}
            {!isDone && (
              <div key={activePhase?.action || "init"} style={{
                fontSize:12, fontWeight:600, padding:"10px 0",
                color:"#F5D800", animation:"km-fade-swap .35s ease",
              }}>
                {activePhase?.action || "Initializing..."}
              </div>
            )}

            {/* ── AI BUILD SUMMARY — collapsible, built from what actually
                 happened (real phase events), never a fixed/fake list ──── */}
            {isDone && phases.length > 0 && (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:C.text, marginBottom:8 }}>
                  AI Build Summary
                </div>
                {phases.filter(p=>p.done).map((p,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"3px 0" }}>
                    <span style={{ color:C.green, fontSize:11, fontWeight:800, flexShrink:0 }}>✓</span>
                    <span style={{ fontSize:11, color:C.text }}>{p.action}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── SELF REVIEW — real validation results, kept as-is ─── */}
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
function FilesPanel({ html, projectName, extraFiles, onSelectPage, onSaveFile }: { html:string; projectName:string; extraFiles?:{name:string;content:string}[]; onSelectPage?:(name:string)=>void; onSaveFile?:(fileName:string, newContent:string, previousContent?:string)=>void }) {
  const [activeFile, setActiveFile] = useState("index.html");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const editableNames = new Set(["index.html", ...(extraFiles||[]).map(f=>f.name)]);
  const files = [
    ...extractFiles(html, projectName),
    ...(extraFiles||[]).map(f=>({ name:f.name, lang:"html", icon:"📄", content:f.content, size:`${(f.content.length/1024).toFixed(1)}KB` })),
  ];
  const active = files.find(f=>f.name===activeFile) || files[0];
  const isEditable = active ? editableNames.has(active.name) : false;

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
  const startEdit = () => { if (!active) return; setDraft(active.content); setEditing(true); };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => { if (!active) return; onSaveFile?.(active.name, draft, active.content); setEditing(false); };

  if (!html) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10, color:C.muted, fontSize:13 }}>
      <div style={{ fontSize:32, opacity:.2 }}>📁</div>
      <div>Generate a project to see files</div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:C.bg }}>
      {/* File tabs */}
      <div style={{ display:"flex", gap:2, padding:"8px 12px", borderBottom:`1px solid ${C.border}`, flexShrink:0, flexWrap:"wrap" }}>
        {files.map(f=>(
          <button key={f.name} onClick={()=>{setActiveFile(f.name); setEditing(false); if(f.name.endsWith(".html")) onSelectPage?.(f.name);}} style={{ padding:"5px 12px", borderRadius:8, border:"none", background:activeFile===f.name?"rgba(245,245,245,0.15)":"transparent", color:activeFile===f.name?C.purple:C.muted, fontSize:11.5, fontWeight:activeFile===f.name?600:400, cursor:"pointer", display:"flex", alignItems:"center", gap:5, transition:"all .15s" }}>
            <span>{f.icon}</span><span>{f.name}</span><span style={{opacity:.5,fontSize:10}}>{f.size}</span>
            {editing && activeFile===f.name && <span title="Unsaved draft" style={{width:6,height:6,borderRadius:"50%",background:"#F5D800",flexShrink:0}}/>}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          {isEditable && !editing && (
            <button onClick={startEdit} style={{ padding:"4px 10px", background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, borderRadius:7, color:C.text, fontSize:11, cursor:"pointer" }}>
              ✏️ Edit
            </button>
          )}
          {editing && (
            <>
              <button onClick={cancelEdit} style={{ padding:"4px 10px", background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, borderRadius:7, color:C.muted, fontSize:11, cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={saveEdit} style={{ padding:"4px 10px", background:C.grad, border:"none", borderRadius:7, color:"#050816", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                Save File
              </button>
            </>
          )}
          <button onClick={handleCopy} style={{ padding:"4px 10px", background:copied?"rgba(0,208,132,0.1)":"rgba(255,255,255,0.04)", border:`1px solid ${copied?"rgba(0,208,132,0.2)":C.border}`, borderRadius:7, color:copied?C.green:C.muted, fontSize:11, cursor:"pointer" }}>
            {copied?"✓ Copied":"Copy"}
          </button>
          <button onClick={handleDownload} style={{ padding:"4px 10px", background:C.grad, border:"none", borderRadius:7, color:"#050816", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            ↓ HTML
          </button>
        </div>
      </div>

      {!isEditable && !editing && active && (extractFiles(html,projectName).some(f=>f.name===active.name) && active.name!=="index.html") && (
        <div style={{ padding:"6px 16px", fontSize:10.5, color:C.muted, background:"rgba(255,255,255,0.02)", borderBottom:`1px solid ${C.border}` }}>
          Extracted view — this is pulled out of index.html for readability. Edit index.html directly to change styles/scripts.
        </div>
      )}

      {/* Code viewer / editor */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
        {editing ? (
          <textarea
            value={draft}
            onChange={e=>setDraft(e.target.value)}
            spellCheck={false}
            style={{ width:"100%", height:"100%", minHeight:300, margin:0, fontSize:11.5, lineHeight:1.6, color:C.text, background:"rgba(255,255,255,0.02)", border:`1px solid ${C.border}`, borderRadius:8, padding:12, fontFamily:"'JetBrains Mono',monospace", whiteSpace:"pre", resize:"vertical" }}
          />
        ) : (
          <pre style={{ margin:0, fontSize:11.5, lineHeight:1.6, color:"#9AA3AF", fontFamily:"'JetBrains Mono',monospace", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
            {active?.content||""}
          </pre>
        )}
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
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(()=>{ messagesRef.current = messages; },[messages]);
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
  const [upgradeModal, setUpgradeModal] = useState<{open:boolean; reason?:string; remainingCredits?:number}>({open:false});
  const [aiMode, setAiMode] = useState<AIMode>("auto");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [saveState, setSaveState] = useState<"idle"|"saving"|"saved"|"retrying"|"error">("idle");
  const [saveError, setSaveError] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const savingRef = useRef(false);
  useEffect(()=>{
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  },[hasUnsavedChanges]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [multiPageFiles, setMultiPageFiles] = useState<{name:string;content:string}[]>([]);
  const [pageBlobs, setPageBlobs] = useState<Record<string,string>>({});
  const [activePage, setActivePage] = useState<string>("index.html");
  const activeBlobsRef = useRef<string[]>([]);
  const pageHistoryRef = useRef<{stack:string[];idx:number}>({stack:["index.html"],idx:0});
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

  // ── Centralized HTTP 402 / upgrade-required handling ────────────
  // Single source of truth for all 3 generation routes — future-proofed
  // for both credit-based and subscription-based lock codes.
  const handleGeneration402 = useCallback((status:number, code?:string, message?:string): boolean => {
    const CREDIT_CODES = ["NO_CREDITS","INSUFFICIENT_CREDITS","DAILY_LIMIT"];
    const SUBSCRIPTION_CODES = ["SUBSCRIPTION_REQUIRED","PREMIUM_REQUIRED"];
    const isCreditIssue = CREDIT_CODES.includes(code||"");
    const isSubscriptionIssue = SUBSCRIPTION_CODES.includes(code||"");
    if (status!==402 && !isCreditIssue && !isSubscriptionIssue) return false;
    setUpgradeModal({
      open: true,
      reason: message || (isSubscriptionIssue ? "This feature requires a higher plan." : "Top up your credits to continue generating."),
      remainingCredits: isSubscriptionIssue ? undefined : 0,
    });
    setLoading(false);
    return true;
  }, []);

  // Read-only — never writes credits/subscription, only reflects current values.
  const refreshCreditsAndClose = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data: p } = await supabase.from("profiles").select("total_credits,used_credits,plan,daily_reset_date").eq("id",session.user.id).single();
    if (p) {
      setCredits({ total:p.total_credits||5, used:p.used_credits||0 });
      const remaining = Math.max(0,(p.total_credits||0)-(p.used_credits||0));
      if (remaining > 0) setUpgradeModal(m=>({...m, open:false}));
    }
  },[]);

  // While the modal is open: check on tab-focus (user returning from /billing)
  // AND poll every 7s as a fallback (e.g. payment webhook lands while tab stays
  // in the background). Both stop automatically the instant the modal closes.
  useEffect(()=>{
    if (!upgradeModal.open) return;
    window.addEventListener("focus", refreshCreditsAndClose);
    document.addEventListener("visibilitychange", refreshCreditsAndClose);
    const poll = setInterval(refreshCreditsAndClose, 7000);
    return () => {
      window.removeEventListener("focus", refreshCreditsAndClose);
      document.removeEventListener("visibilitychange", refreshCreditsAndClose);
      clearInterval(poll);
    };
  },[upgradeModal.open, refreshCreditsAndClose]);


  // ── Multi-page Preview Router ───────────────────────────────────
  // Builds one Blob URL per generated page. Works for any number of
  // pages (not hardcoded to about/pricing/contact) because it scans
  // for known filenames rather than a fixed list. Each page gets a
  // tiny injected script that intercepts clicks on <a href="X.html">
  // and asks the parent (this component) to switch pages — this
  // sidesteps the circular-reference problem of trying to rewrite
  // blob URLs into each other's HTML before all blobs exist.
  const buildPageBlobs = useCallback((pages:{name:string;content:string}[]) => {
    activeBlobsRef.current.forEach(u=>{ try{URL.revokeObjectURL(u);}catch{} });
    activeBlobsRef.current = [];
    if (!pages.length){ setPageBlobs({}); return; }
    const knownNames = pages.map(p=>p.name);
    const navScript = `<script>document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;var href=a.getAttribute("href");if(${JSON.stringify(knownNames)}.indexOf(href)>-1){e.preventDefault();parent.postMessage({type:"krypton-nav",page:href},"*");}});</script>`;
    const map:Record<string,string> = {};
    const urls:string[] = [];
    for (const p of pages){
      const injected = p.content.includes("</body>") ? p.content.replace("</body>", navScript+"</body>") : p.content+navScript;
      const url = URL.createObjectURL(new Blob([injected],{type:"text/html"}));
      map[p.name]=url; urls.push(url);
    }
    activeBlobsRef.current = urls;
    setPageBlobs(map);
    setActivePage("index.html");
    pageHistoryRef.current = {stack:["index.html"],idx:0};
  },[]);

  const navigateToPage = useCallback((page:string, pushHistory=true) => {
    setActivePage(page);
    if (pushHistory){
      const h = pageHistoryRef.current;
      h.stack = h.stack.slice(0,h.idx+1); h.stack.push(page); h.idx = h.stack.length-1;
      try{ window.history.pushState({krypton_page:page},"",window.location.href); }catch{}
    }
  },[]);

  // Real click-driven navigation from inside the preview iframe
  useEffect(()=>{
    const handler=(e:MessageEvent)=>{ if(e.data?.type==="krypton-nav" && pageBlobs[e.data.page]) navigateToPage(e.data.page); };
    window.addEventListener("message",handler);
    return ()=>window.removeEventListener("message",handler);
  },[pageBlobs,navigateToPage]);

  // Browser Back/Forward support for in-preview page switches — pushes
  // history entries without changing the URL, so it never navigates the
  // user away from /create; only affects pages we ourselves pushed.
  useEffect(()=>{
    const onPop=(e:PopStateEvent)=>{ if(e.state?.krypton_page && pageBlobs[e.state.krypton_page]) setActivePage(e.state.krypton_page); };
    window.addEventListener("popstate",onPop);
    return ()=>window.removeEventListener("popstate",onPop);
  },[pageBlobs]);

  useEffect(()=>()=>{ activeBlobsRef.current.forEach(u=>{ try{URL.revokeObjectURL(u);}catch{} }); },[]);


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
    const urlMode = (params.get("mode") as AIMode) || "auto";
    if (["auto","planning","build","edit","explain"].includes(urlMode)) setAiMode(urlMode);
    try {
      const pending = sessionStorage.getItem("krypton_pending_attachment");
      if (pending) { setAttachment(JSON.parse(pending)); sessionStorage.removeItem("krypton_pending_attachment"); }
    } catch {}
    const ft = params.get("forceType") || ""; setForceType(ft);
    if (urlId) await loadProject(urlId, session.user.id);
    else if (urlPrompt) {
      const dec = decodeURIComponent(urlPrompt);
      setPrompt(dec); promptRef.current = dec;
      window.history.replaceState({},"","/create");
      setTimeout(()=>dispatchMessage(dec, urlMode),300);
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
    const latestSnapshot = (vers as Version[]|null)?.[0]?.code_snapshot as Record<string,string>|undefined;
    if (latestSnapshot){
      const extra = Object.entries(latestSnapshot).filter(([n])=>n!=="index.html").map(([name,content])=>({name,content}));
      if (extra.length){
        setMultiPageFiles(extra);
        buildPageBlobs([{name:"index.html",content:html},...extra]);
      }
    }

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

  // ── Save reliability — isolated retry logic, no schema/library change ──
  function isRetryableError(error: any): boolean {
    if (!error) return false;

    const status = error.status ?? error.statusCode;
    const code = String(error.code || "");
    const name = String(error.name || "");
    const message = String(error.message || "").toLowerCase();

    if ([500, 502, 503, 504].includes(status)) return true;
    if ([400, 401, 403, 404].includes(status)) return false;

    if (code.startsWith("42") || code.startsWith("23") || code.startsWith("PGRST")) return false;

    if (name === "TypeError" || name === "AbortError") return true;

    if (message.includes("failed to fetch") || message.includes("network")
        || message.includes("timeout") || message.includes("aborted")) return true;

    return false;
  }

  async function withSaveRetry<T>(op: () => Promise<{ data: T; error: any; count?: number|null }>): Promise<{ data: T | null; error: any; count?: number|null }> {
    const delays = [1000, 2000, 4000]; // exponential backoff — 3 retries = 4 total attempts
    let lastError: any = null;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      const { data, error, count } = await op();
      if (!error) return { data, error: null, count };
      lastError = error;
      if (!isRetryableError(error) || attempt === delays.length) break;
      setSaveState("retrying");
      setSaveError(`Retrying (${attempt + 1}/${delays.length})...`);
      await new Promise(r => setTimeout(r, delays[attempt]));
    }
    return { data: null, error: lastError, count: undefined };
  }

  const saveProject = async (html:string, name:string, pid?:string) => {
    if (savingRef.current) return; // duplicate-save guard — synchronous, same pattern as the Razorpay payingRef
    savingRef.current = true;
    setSaveState("saving"); setSaveError("");

    try {
      const {data:{session}} = await supabase.auth.getSession();
      if (!session) { setSaveState("idle"); return; }
      const usePid = pid||projectId;
      // Serialize chat history for persistence — fixes bug where reopening
      // a project showed only the live preview but lost all prior chat messages.
      const historyPayload = messagesRef.current.map(m => ({ role:m.role, type:m.type, content:m.content }));

      let result;
      if (usePid) {
        result = await withSaveRetry(() => supabase.from("projects").update({ name, title:name, conversation_history:historyPayload, updated_at:new Date().toISOString() }, { count: "exact" }).eq("id",usePid) as any);
        if (!result.error && result.count === 0) {
          // UPDATE matched zero rows — deleted project, invalid id, or RLS-hidden.
          // Not retried again: retrying an UPDATE against a row that will never
          // match is wasted effort, not a transient condition.
          result = { data: null, error: { message: "No matching project was found to update.", code: "ZERO_ROWS_UPDATED" }, count: 0 };
        }
      } else {
        result = await withSaveRetry(() => supabase.from("projects").insert({ user_id:session.user.id, name, title:name, html_code:html, prompt:promptRef.current, conversation_history:historyPayload, status:"completed", created_at:new Date().toISOString(), updated_at:new Date().toISOString() }).select("id").single() as any);
        if ((result.data as any)?.id) {
          setProjectId((result.data as any).id);
          window.history.replaceState({},"",`/create?id=${(result.data as any).id}`);
        }
      }

      if (result.error) {
        setSaveState("error");
        setSaveError("Save failed. Your work is still here — click Save to retry.");
        addMsg({role:"ai",type:"error",content:"⚠️ Couldn't save your latest changes after retrying. Your work is still safe here — click Save to try again."});
        return; // preview/chat/files/prompt untouched — only saveState changed
      }

      setSaveState("saved"); setHasUnsavedChanges(false);
      setTimeout(()=>setSaveState(s => s === "saved" ? "idle" : s), 2500);
    } catch {
      // Any unexpected exception (e.g. a raw network throw that slipped past
      // withSaveRetry) becomes the same non-blocking error state — this
      // function must never throw, since not every caller wraps it in try/catch.
      setSaveState("error");
      setSaveError("Save failed. Your work is still here — click Save to retry.");
    } finally {
      savingRef.current = false;
    }
  };

  const saveVersion = async (html:string, msg:string) => {
    if (!projectId) return;
    try {
      const { data, error } = await withSaveRetry(() => supabase.from("project_versions").insert({ project_id:projectId, code_snapshot:{"index.html":html}, message:msg, type:"auto", version_number:versions.length+1, size_bytes:html.length }).select().single() as any);
      if (error) { setSaveState("error"); setSaveError("Version snapshot failed to save."); return; }
      if (data) setVersions(v=>[data as Version,...v]);
    } catch {
      setSaveState("error"); setSaveError("Version snapshot failed to save.");
    }
  };

  // ── Manual per-file edit from the File Explorer ─────────────────
  // Reuses the exact same save pipeline as everything else (saveProject,
  // buildPageBlobs) — no new/parallel save mechanism introduced.
  const handleSaveFile = (fileName: string, newContent: string, previousContent?: string) => {
    setHasUnsavedChanges(true);
    if (previousContent !== undefined) saveVersion(previousContent, `Before manual edit: ${fileName}`);
    if (fileName === "index.html") {
      setResult(newContent);
      buildPageBlobs([{name:"index.html",content:newContent}, ...multiPageFiles]);
      saveProject(newContent, projectName);
    } else {
      const updated = multiPageFiles.map(f => f.name===fileName ? {...f, content:newContent} : f);
      setMultiPageFiles(updated);
      buildPageBlobs([{name:"index.html",content:result}, ...updated]);
      saveProject(result, projectName); // conversation_history/updated_at refresh; code_snapshot picked up via extraFiles on next version save
    }
    addMsg({role:"ai",type:"text",content:`✓ Updated ${fileName}`});
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
        if (em[1]==="designScore") { updateMsg(thinkId, { designScore: data as DesignScoreData, isActive:true }); }
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
          if (handleGeneration402(0, data.code, data.message)) return;
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
        // ── Recovery check — did orchestrate actually finish server-side
        // despite the client losing the stream (network drop, idle-timeout)?
        // Read-only query against the existing projects table — no new
        // table/column, no write, zero risk to generation/billing logic.
        const { data: recent } = await supabase
          .from("projects")
          .select("id, html_code")
          .eq("user_id", session.user.id)
          .eq("prompt", userPrompt)
          .gte("created_at", new Date(Date.now() - 3*60*1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recent?.html_code) {
          html = recent.html_code;
          savedPid = recent.id;
          credUsed = 0; // already deducted by the orchestrate attempt that actually succeeded — don't double-count
        } else {
          const fr=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({prompt:userPrompt}),signal:AbortSignal.timeout(280000)});
          const fd=await fr.json();
          if(fd.html){html=fd.html;credUsed=fd.creditsUsed||1;savedPid=fd.projectId||"";receivedProjectType=fd.projectType||"";}
          if(handleGeneration402(fr.status, fd.code, fd.error)) return;
        }
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
          if (extraFiles.length){
            credUsed += 2;
            buildPageBlobs([{name:"index.html",content:html},...extraFiles]);
          }
        } else {
          handleGeneration402(mpRes.status, mpData?.code, mpData?.error);
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
        const historyPayload = messagesRef.current.map(m=>({role:m.role,type:m.type,content:m.content}));
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
  const runEdit = async (editPrompt:string, targetFile?:string) => {
    if (!result||!editPrompt.trim()||loading) return;
    const editFileName = targetFile || "index.html";
    const sourceContent = editFileName==="index.html" ? result : (multiPageFiles.find(f=>f.name===editFileName)?.content ?? result);
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
    const codeLines=sourceContent.split("\n").length;
    const isLarge=codeLines>1500; // raised from 600 — Component Library output is 600-1200 lines normally
    const gCtx=isGameProject&&gameMemory?formatGameMemoryForAI(gameMemory):formatMemoryForAI(projectMemory);
    try {
      // Strategy 1: Chat API (game-aware surgical edit) — targets whichever
      // file the user is actually looking at (index.html by default, or a
      // specific multi-page file), instead of always overwriting index.html.
      const codeForChat=isLarge&&isGameProject
        ?sourceContent.slice(0,5000)+"\n\n/* ... MIDDLE SECTION PRESERVED ... */\n\n"+sourceContent.slice(-3000)
        :sourceContent;
      const r1=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userMessage:editPrompt,currentCode:{[editFileName]:codeForChat},projectName,framework:isGameProject?"game":"html",projectContext:gCtx,gameMemory:gameMemory||undefined}),signal:AbortSignal.timeout(110000)});
      const d1=await r1.json();
      newHtml=d1.codeChanges?.[editFileName]||"";
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

      // Strategy 3: Generate API (websites only) — index.html fallback only,
      // since this endpoint has no concept of multiple named files.
      if(!newHtml&&!isGameProject){
        const ctx=isLarge?sourceContent.slice(0,6000)+"\n\n[...]\n\n"+sourceContent.slice(-3000):sourceContent.slice(0,10000);
        const r3=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({prompt:`Apply ONLY: "${editPrompt}"\nPreserve design.\nCODE:\n${ctx}`,isEdit:true}),signal:AbortSignal.timeout(110000)});
        const d3=await r3.json();if(d3.html)newHtml=d3.html;
      }

      if(newHtml&&newHtml.length>500){
        if (editFileName === "index.html") {
          await saveVersion(result,`Before: ${editPrompt.slice(0,40)}`);
          setResult(newHtml);
        } else {
          await saveVersion(result,`Before: ${editPrompt.slice(0,40)}`);
          const updatedFiles = multiPageFiles.map(f=>f.name===editFileName?{...f,content:newHtml}:f);
          setMultiPageFiles(updatedFiles);
          buildPageBlobs([{name:"index.html",content:result},...updatedFiles]);
        }
        let editedGameMem: GameProjectMemory|undefined;
        let editedProjMem: ProjectMemory|undefined;
        if (editFileName === "index.html") {
        if(isGameProject&&gameMemory){
          const det={isGame:true,gameType:gameMemory.gameType,theme:gameMemory.theme,genre:gameMemory.genre,techStack:gameMemory.techStack};
          editedGameMem = buildGameMemory(newHtml,editPrompt,det,gameMemory);
          setGameMemory(editedGameMem);
        } else {
          editedProjMem = buildProjectMemory(newHtml,projectName,projectMemory?.originalPrompt||editPrompt,messages,projectMemory);
          setProjectMemory(editedProjMem);
        }
        }
        // Priority 1 — persist updated memory so edit context survives reopen
        persistMemory(projectId, editedProjMem||null, editedGameMem||null);
        setCredits(cv=>({...cv,used:cv.used+1}));
        // Use log from chat route to show real intent + target
        const editLog = d1?.log;
        const targetSection = editLog?.target || (editLog?.intent?.replace("_EDIT","").toLowerCase() || "page-level") + " edit";
        const providerLabel = editLog?.provider === "claude" ? "Claude" : editLog?.provider === "openai" ? "OpenAI" : "AI";
        updateMsg(thinkId,{isActive:false,phases:[
          {agent:"Reading",    icon:"○", action:`Intent: ${editLog?.intent||"STYLE_EDIT"}`,    pct:100, done:true, status:"done"},
          {agent:"Targeting",  icon:"○", action:`Target: ${targetSection}${editLog?.fileName?` (${editLog.fileName})`:""}`, pct:100, done:true, status:"done"},
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
        setHasUnsavedChanges(true);
        setTimeout(()=>{(async()=>{try{await saveProject(newHtml,projectName);}catch{}})();},50);
      } else {
        updateMsg(thinkId,{type:"error",content:isGameProject?"Be specific: 'Add pause button top-right' or 'Change snake color to neon blue'":"Be specific: 'Change header to dark blue' or 'Add contact form'",isActive:false});
      }
    } catch {
      updateMsg(thinkId,{type:"error",content:"Edit timed out. Try a smaller change.",isActive:false});
    }
    setLoading(false);
  };

  // ── Single dispatch point — explicit modes bypass the Intent Engine
  // entirely; only "auto" ever calls classifyIntent(). Shared by the
  // Send button and the URL-triggered first message (from Home page).
  const dispatchMessage = (p:string, mode:AIMode) => {
    const targetFile = (activePage && activePage!=="index.html" && multiPageFiles.some(f=>f.name===activePage)) ? activePage : "index.html";

    if (mode === "planning") { runPlanning(p); return; }
    if (mode === "build")    { runFlow(p); return; }
    if (mode === "edit") {
      if (!result) { addMsg({role:"ai",type:"text",content:"Nothing to edit yet — describe what you'd like to build first, or switch to Build/Auto mode."}); return; }
      runEdit(p, targetFile==="index.html" ? undefined : targetFile);
      return;
    }
    if (mode === "explain") { runExplain(p, targetFile); return; }

    // mode === "auto" — the ONLY path that uses the Intent Engine
    const currentFileContent = targetFile==="index.html" ? result : (multiPageFiles.find(f=>f.name===targetFile)?.content ?? result);
    const lastAiMsg = [...messagesRef.current].reverse().find(m=>m.role==="ai")?.content;
    const intent = classifyIntent(p, !!result, currentFileContent, lastAiMsg);
    if (intent === "BUILD")   { runFlow(p); return; }
    if (intent === "EDIT")    { runEdit(p, targetFile==="index.html" ? undefined : targetFile); return; }
    if (intent === "EXPLAIN") { runExplain(p, targetFile); return; }
    runChatOnly(p); // CHAT
  };

  const handleSend=()=>{
    const p=prompt.trim();
    if(!p||loading) return;
    if(loading){ addMsg({role:"ai",type:"text",content:"⏳ Please wait — generation in progress."}); return; }
    setPrompt(""); promptRef.current="";
    dispatchMessage(p, aiMode);
  };

  // ── Pure conversational reply — no project generated/edited ─────
  const runChatOnly = async (message:string) => {
    addMsg({role:"user",type:"text",content:message, attachment: attachment ? {name:attachment.name, type:attachment.type, previewUrl:attachment.previewUrl} : undefined});
    setAttachment(null);
    setLoading(true);
    const thinkId = addMsg({role:"ai",type:"thinking",content:"",isActive:true,phases:[
      {agent:"Reading",icon:"○",action:"Thinking...",pct:50,status:"running"},
    ]});
    try {
      const {data:{session}} = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const history = messagesRef.current.slice(-8).map(m=>({role:m.role,content:m.content}));
      const res = await fetch("/api/chat-assistant", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},
        body:JSON.stringify({message, history, attachment}),
        signal:AbortSignal.timeout(60000),
      });
      const data = await res.json();
      updateMsg(thinkId,{isActive:false,phases:[{agent:"Reading",icon:"○",action:"Answered",pct:100,done:true,status:"done"}]});
      addMsg({role:"ai",type:"text",content: data.reply || data.error || "Sorry, I couldn't get a response."});
    } catch {
      updateMsg(thinkId,{isActive:false});
      addMsg({role:"ai",type:"error",content:"Couldn't get a response right now. Please try again."});
    } finally {
      setLoading(false);
    }
  };

  // ── EXPLAIN mode — same conversational endpoint, but grounded in the
  // ACTUAL content of whichever file the user is looking at, so the
  // answer describes what's really there instead of generic advice.
  const runExplain = async (message:string, targetFile:string) => {
    addMsg({role:"user",type:"text",content:message, attachment: attachment ? {name:attachment.name, type:attachment.type, previewUrl:attachment.previewUrl} : undefined});
    setLoading(true);
    setAttachment(null);
    const thinkId = addMsg({role:"ai",type:"thinking",content:"",isActive:true,phases:[
      {agent:"Reading",icon:"○",action:`Reading ${targetFile}...`,pct:50,status:"running"},
    ]});
    try {
      const {data:{session}} = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const fileContent = targetFile==="index.html" ? result : (multiPageFiles.find(f=>f.name===targetFile)?.content ?? result);
      const history = messagesRef.current.slice(-8).map(m=>({role:m.role,content:m.content}));
      const res = await fetch("/api/chat-assistant", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},
        body:JSON.stringify({message, history, mode:"explain", fileName:targetFile, fileContent:fileContent.slice(0,12000), attachment}),
        signal:AbortSignal.timeout(60000),
      });
      const data = await res.json();
      updateMsg(thinkId,{isActive:false,phases:[{agent:"Reading",icon:"○",action:"Answered",pct:100,done:true,status:"done"}]});
      addMsg({role:"ai",type:"text",content: data.reply || data.error || "Sorry, I couldn't get a response."});
    } catch {
      updateMsg(thinkId,{isActive:false});
      addMsg({role:"ai",type:"error",content:"Couldn't get a response right now. Please try again."});
    } finally {
      setLoading(false);
    }
  };

  // ── PLANNING mode — never generates a project or touches files/preview.
  // Uses credits/behavior identical to plain chat (just a different
  // system prompt server-side), matching the "chat/planning behaviour only" spec.
  const runPlanning = async (message:string) => {
    addMsg({role:"user",type:"text",content:message, attachment: attachment ? {name:attachment.name, type:attachment.type, previewUrl:attachment.previewUrl} : undefined});
    setAttachment(null);
    setLoading(true);
    const thinkId = addMsg({role:"ai",type:"thinking",content:"",isActive:true,phases:[
      {agent:"Reading",icon:"○",action:"Planning...",pct:50,status:"running"},
    ]});
    try {
      const {data:{session}} = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const history = messagesRef.current.slice(-8).map(m=>({role:m.role,content:m.content}));
      const res = await fetch("/api/chat-assistant", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},
        body:JSON.stringify({message, history, mode:"planning", attachment}),
        signal:AbortSignal.timeout(60000),
      });
      const data = await res.json();
      updateMsg(thinkId,{isActive:false,phases:[{agent:"Reading",icon:"○",action:"Plan ready",pct:100,done:true,status:"done"}]});
      addMsg({role:"ai",type:"text",content: data.reply || data.error || "Sorry, I couldn't put a plan together."});
    } catch {
      updateMsg(thinkId,{isActive:false});
      addMsg({role:"ai",type:"error",content:"Couldn't get a response right now. Please try again."});
    } finally {
      setLoading(false);
    }
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
  const restoreVersion=async(v:Version)=>{ const code=v.code_snapshot?.["index.html"];if(!code)return;await saveVersion(result,`Before restore`);setResult(code);setHasUnsavedChanges(true);(async()=>{try{await saveProject(code,projectName);}catch{}})();addMsg({role:"ai",type:"text",content:`✓ Restored to v${v.version_number}`}); };

  // ── Render ─────────────────────────────────────────────────────
  const RIGHT_TABS = [
    { id:"preview" as RightTab, icon:"✨", label:"Preview" },
    { id:"files"   as RightTab, icon:"📁", label:"Files" },
    { id:"deploy"  as RightTab, icon:"🚀", label:"Deploy" },
    { id:"history" as RightTab, icon:"⏱", label:"History" },
  ];

  return (
    <>
      <UpgradeModal
        isOpen={upgradeModal.open}
        onClose={()=>setUpgradeModal(m=>({...m, open:false}))}
        reason={upgradeModal.reason}
        remainingCredits={upgradeModal.remainingCredits}
        totalCredits={credits.total}
        onPaymentSuccess={refreshCreditsAndClose}
      />
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
            <iframe {...(pageBlobs["index.html"] ? {src:pageBlobs[activePage]||pageBlobs["index.html"]} : {srcDoc:result})}
              style={{border:"none",width:device==="desktop"?"100%":device==="tablet"?"min(768px,92vw)":"min(390px,88vw)",height:device==="desktop"?"100%":"min(100%,84vh)",minHeight:device==="desktop"?"100%":undefined,background:"#fff",
                boxShadow:device!=="desktop"?"0 0 0 10px #11151F,0 20px 60px rgba(0,0,0,0.8)":"none",
                borderRadius:device==="mobile"?"36px":device==="tablet"?"16px":"0",flexShrink:0,margin:device!=="desktop"?"16px 0":0}}
              sandbox="allow-scripts allow-forms allow-modals allow-popups" title="Fullscreen Preview"/>
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
              <button onClick={()=>saveProject(result,projectName)} title={saveState==="error"?saveError:undefined}
                style={{padding:"5px 14px",
                  background: saveState==="saved" ? "rgba(76,175,138,0.1)" : saveState==="error" ? "rgba(229,115,107,0.1)" : "rgba(255,255,255,0.07)",
                  border:`1px solid ${saveState==="saved"?"rgba(76,175,138,0.25)":saveState==="error"?"rgba(229,115,107,0.3)":"rgba(255,255,255,0.12)"}`,
                  borderRadius:8, color: saveState==="saved"?C.green:saveState==="error"?"#E5736B":C.sub,
                  fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s",display:"flex",alignItems:"center",gap:5}}>
                {saveState==="saving"?"Saving…":saveState==="retrying"?saveError:saveState==="saved"?"✓ Saved":saveState==="error"?"⚠ Save failed":"Save"}
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
                        {msg.attachment && (
                          <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.08)",borderRadius:8,padding:"5px 9px",marginBottom:7}}>
                            {msg.attachment.previewUrl ? (
                              <img src={msg.attachment.previewUrl} alt="" style={{width:22,height:22,borderRadius:5,objectFit:"cover"}}/>
                            ) : (
                              <span style={{fontSize:13}}>{msg.attachment.type==="pdf"?"📄":msg.attachment.type==="code"?"💻":"📎"}</span>
                            )}
                            <span style={{fontSize:11,opacity:0.85,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{msg.attachment.name}</span>
                          </div>
                        )}
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
                        <div style={{maxWidth:"92%",padding:"10px 14px",background:"rgba(0,208,132,0.05)",border:"1px solid rgba(0,208,132,0.15)",borderRadius:"4px 18px 18px 18px"}}>
                          <div
                            onClick={()=>setExpandedSummaries(prev=>{const next=new Set(prev);next.has(msg.id)?next.delete(msg.id):next.add(msg.id);return next;})}
                            style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",gap:8}}
                          >
                            <div style={{color:C.green,fontWeight:700,fontSize:13}}>✓ Project Complete</div>
                            <span style={{fontSize:11,color:C.muted,userSelect:"none"}}>{expandedSummaries.has(msg.id)?"▲ Hide details":"▼ View details"}</span>
                          </div>
                          {expandedSummaries.has(msg.id) && (
                          <>
                          <div style={{color:C.sub,fontSize:13,lineHeight:1.65,marginTop:7,marginBottom:9}}>{msg.content}</div>
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
                          </>
                          )}
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
                {attachment && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, borderRadius:10, padding:"6px 10px", marginBottom:10 }}>
                    {attachment.previewUrl ? (
                      <img src={attachment.previewUrl} alt="" style={{ width:26, height:26, borderRadius:6, objectFit:"cover" }}/>
                    ) : (
                      <span style={{ fontSize:15 }}>{attachment.type==="pdf"?"📄":attachment.type==="code"?"💻":"📎"}</span>
                    )}
                    <span style={{ fontSize:11.5, color:C.text, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{attachment.name}</span>
                    <button onClick={()=>setAttachment(null)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13, padding:"2px 6px" }}>✕</button>
                  </div>
                )}
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
                    <ModeSelector mode={aiMode} onChange={setAiMode}/>
                    <AttachmentMenu onAttach={setAttachment}/>
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
                  ? <iframe key={`${result.length}-${device}-${activePage}`} {...(pageBlobs["index.html"] ? {src:pageBlobs[activePage]||pageBlobs["index.html"]} : {srcDoc:result})} style={{
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
                    }} sandbox="allow-scripts allow-forms allow-modals allow-popups" title="Live Preview"/>
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
            {rightTab==="files"&&<FilesPanel html={result} projectName={projectName} extraFiles={multiPageFiles} onSelectPage={(name)=>{navigateToPage(name);setRightTab("preview");}} onSaveFile={handleSaveFile}/>}

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
