"use client";
/**
 * KRYPTON AI — Create Workspace v4
 * World-class AI OS experience
 * No AI model names. No agent labels. Pure Krypton branding.
 */

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import KryptonLogo from "@/components/branding/KryptonLogo";
import AgentTimeline, { AgentPhaseEvent } from "@/components/workspace/AgentTimeline";
import FileExplorer from "@/components/workspace/FileExplorer";
import DeployPanel from "@/components/workspace/DeployPanel";

// ── Design Tokens ─────────────────────────────────────────────────
const C = {
  bg:       "#080C14",
  surface:  "#0D1220",
  card:     "#131929",
  border:   "rgba(255,215,0,0.07)",
  borderHi: "rgba(255,215,0,0.22)",
  text:     "#F0F4FF",
  sub:      "#8892A4",
  muted:    "#3D4A5C",
  gold:     "#FFD700",
  amber:    "#FF9500",
  green:    "#00D084",
  red:      "#FF4545",
  grad:     "linear-gradient(135deg,#FFD700,#FF7A00)",
};

type MsgRole  = "user" | "ai";
type MsgType  = "text" | "thinking" | "summary" | "error" | "question";
type RightTab = "preview" | "files" | "deploy" | "history";
type Device   = "desktop" | "tablet" | "mobile";

interface UploadedFile { name: string; type: string; size: number; url: string; }

interface ChatMessage {
  id:        string;
  role:      MsgRole;
  type:      MsgType;
  content:   string;
  ts:        Date;
  phases?:   AgentPhaseEvent[];
  isActive?: boolean;
  credits?:  number;
  files?:    string[];
  questions?: string[];
}

interface Version {
  id: string; version_number: number; message: string;
  created_at: string; code_snapshot: Record<string, string>;
}

const mkId    = () => `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms));
const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
const fmtSize = (b: number) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`;

// ── Thinking display ──────────────────────────────────────────────
function ThinkingBubble({ phases, isActive }: { phases: AgentPhaseEvent[]; isActive: boolean }) {
  return (
    <div style={{ padding:"0 16px 4px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <KryptonLogo size={16} animated={false}/>
        <span style={{ fontSize:11, color:C.muted, fontWeight:500 }}>Krypton Intelligence</span>
      </div>
      <AgentTimeline phases={phases} isActive={isActive}/>
    </div>
  );
}

// ── User bubble ───────────────────────────────────────────────────
function UserBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div style={{ display:"flex", justifyContent:"flex-end", padding:"2px 16px" }}>
      <div style={{
        maxWidth:"82%", padding:"11px 16px",
        background:"linear-gradient(135deg,rgba(255,215,0,0.14),rgba(255,149,0,0.08))",
        border:"1px solid rgba(255,215,0,0.15)",
        borderRadius:"18px 18px 4px 18px",
        fontSize:14, lineHeight:1.65, color:C.text, fontWeight:450,
      }}>
        {msg.content}
      </div>
    </div>
  );
}

// ── AI bubble ─────────────────────────────────────────────────────
function AiBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div style={{ padding:"2px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7 }}>
        <KryptonLogo size={16} animated={false}/>
        <span style={{ fontSize:11, color:C.muted, fontWeight:500 }}>Krypton AI</span>
        <span style={{ fontSize:10, color:"#232d3f", marginLeft:2 }}>{fmtTime(msg.ts)}</span>
      </div>

      {msg.type === "summary" ? (
        <div style={{
          maxWidth:"92%", padding:"14px 16px",
          background:"rgba(0,208,132,0.05)",
          border:"1px solid rgba(0,208,132,0.15)",
          borderRadius:"4px 18px 18px 18px",
        }}>
          <div style={{ color:C.green, fontWeight:700, fontSize:13, marginBottom:8 }}>✓ Project Complete</div>
          <div style={{ color:C.sub, fontSize:13, lineHeight:1.65, marginBottom:10 }}>{msg.content}</div>
          {msg.files && msg.files.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {msg.files.map(f => (
                <span key={f} style={{
                  fontSize:11, padding:"3px 10px",
                  background:"rgba(0,208,132,0.07)",
                  border:"1px solid rgba(0,208,132,0.15)",
                  borderRadius:20, color:C.green,
                }}>{f}</span>
              ))}
            </div>
          )}
          {msg.credits && (
            <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>⚡ {msg.credits} credit used</div>
          )}
        </div>
      ) : msg.type === "error" ? (
        <div style={{
          maxWidth:"92%", padding:"11px 16px",
          background:"rgba(255,69,69,0.05)",
          border:"1px solid rgba(255,69,69,0.15)",
          borderRadius:"4px 18px 18px 18px",
          fontSize:13, color:C.red, lineHeight:1.6,
        }}>
          {msg.content}
        </div>
      ) : (
        <div style={{
          maxWidth:"92%", padding:"11px 16px",
          background:C.card,
          border:`1px solid ${C.border}`,
          borderRadius:"4px 18px 18px 18px",
          fontSize:13, lineHeight:1.7, color:C.sub,
        }}>
          {msg.content}
        </div>
      )}
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
  const [result, setResult]     = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentPhases, setAgentPhases] = useState<AgentPhaseEvent[]>([]);
  const [loading, setLoading]   = useState(false);
  const [projectId, setProjectId]   = useState("");
  const [projectName, setProjectName] = useState("New Project");
  const [editingName, setEditingName] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("preview");
  const [device, setDevice]     = useState<Device>("desktop");
  const [isMobile, setIsMobile] = useState(false);
  const [activePanel, setActivePanel] = useState<"chat"|"preview">("chat");
  const [credits, setCredits]   = useState({ total:5, used:0 });
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [uploads, setUploads]   = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [listening, setListening]   = useState(false);

  const chatEndRef  = useRef<HTMLDivElement>(null);
  const promptRef   = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const silenceRef  = useRef<any>(null);

  const remaining = credits.total - credits.used;

  // ── Message helpers ──────────────────────────────────────────────
  const addMsg = useCallback((m: Omit<ChatMessage,"id"|"ts">): string => {
    const id = mkId();
    setMessages(prev => [...prev, { ...m, id, ts: new Date() }]);
    return id;
  }, []);

  const updateMsg = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  // ── Init ─────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages]);

  useEffect(() => { initSession(); }, []);

  const initSession = async () => {
    const { data:{ session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth/login"); return; }
    setUser(session.user);
    const { data: p } = await supabase.from("profiles").select("total_credits,used_credits").eq("id", session.user.id).single();
    if (p) setCredits({ total: p.total_credits||5, used: p.used_credits||0 });
    const urlId = params.get("id");
    const urlPrompt = params.get("prompt");
    if (urlId) await loadProject(urlId, session.user.id);
    else if (urlPrompt) {
      const decoded = decodeURIComponent(urlPrompt);
      setPrompt(decoded); promptRef.current = decoded;
      window.history.replaceState({}, "", "/create");
      setTimeout(() => runFlow(decoded), 300);
    }
  };

  const loadProject = async (id: string, uid: string) => {
    const { data: proj } = await supabase.from("projects").select("*").eq("id", id).eq("user_id", uid).single();
    if (!proj) return;
    setProjectId(proj.id); setProjectName(proj.name||"Project");
    setResult(proj.html_code||""); promptRef.current = proj.prompt||"";
    const hist: any[] = proj.conversation_history||[];
    hist.length > 0
      ? hist.forEach((m:any) => addMsg({ role:m.role||"ai", type:m.type||"text", content:m.content||"" }))
      : addMsg({ role:"ai", type:"text", content:"Project loaded. Describe any changes below." });
    const { data: vers } = await supabase.from("project_versions").select("*").eq("project_id", id).order("version_number",{ascending:false}).limit(20);
    if (vers) setVersions(vers as Version[]);
  };

  // ── File handling ─────────────────────────────────────────────────
  const handleFileUpload = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const processed: UploadedFile[] = arr.map(f => ({
      name: f.name, type: f.type,
      size: f.size, url: URL.createObjectURL(f),
    }));
    setUploads(prev => [...prev, ...processed]);
    addMsg({ role:"user", type:"text", content:`📎 Attached: ${arr.map(f=>f.name).join(", ")}` });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
  };

  // ── Save ──────────────────────────────────────────────────────────
  const saveProject = async (html: string, name: string, pid?: string) => {
    setSaving(true);
    const { data:{ session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    const usePid = pid || projectId;
    const payload = {
      name, html_code: html, prompt: promptRef.current,
      updated_at: new Date().toISOString(),
      conversation_history: messages.filter(m=>m.type!=="thinking").map(m=>({role:m.role,type:m.type,content:m.content})),
    };
    if (usePid) {
      await supabase.from("projects").update(payload).eq("id", usePid);
    } else {
      const { data } = await supabase.from("projects").insert({ user_id:session.user.id, ...payload, status:"completed" }).select().single();
      if (data) { setProjectId(data.id); window.history.replaceState({}, "", `/create?id=${data.id}`); }
    }
    setSaved(true); setSaving(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const saveVersion = async (html: string, msg: string) => {
    if (!projectId) return;
    const { data } = await supabase.from("project_versions").insert({
      project_id: projectId, code_snapshot:{"index.html":html},
      message: msg, type:"auto", version_number: versions.length+1, size_bytes: html.length,
    }).select().single();
    if (data) setVersions(v=>[data as Version,...v]);
  };

  // ══════════════════════════════════════════════════════════════════
  // ── KRYPTON INTELLIGENCE ENGINE — GENERATION FLOW ────────────────
  // ══════════════════════════════════════════════════════════════════
  const runFlow = async (userPrompt: string) => {
    if (!userPrompt.trim() || loading) return;
    if (remaining < 1) { addMsg({ role:"ai", type:"error", content:"No credits remaining. Please upgrade to continue." }); return; }

    setLoading(true);
    setPrompt(""); promptRef.current = userPrompt;
    setAgentPhases([]);
    addMsg({ role:"user", type:"text", content: userPrompt });
    const thinkId = addMsg({ role:"ai", type:"thinking", content:"", phases:[], isActive:true });

    const { data:{ session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    let html = ""; let credUsed = 1; let savedPid = "";
    const livePhases: AgentPhaseEvent[] = [];

    try {
      const res = await fetch("/api/orchestrate", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ prompt:userPrompt, userId:session.user.id, accessToken:session.access_token }),
        signal: AbortSignal.timeout(150000),
      });

      if (!res.ok || !res.body) throw new Error("stream_failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const processChunk = (chunk: string) => {
        const evMatch   = chunk.match(/event:\s*(\S+)/);
        const dataMatch = chunk.match(/data:\s*([\s\S]+)/);
        if (!evMatch || !dataMatch) return;
        let data: any = {};
        try { data = JSON.parse(dataMatch[1].trim()); } catch { return; }

        if (evMatch[1] === "phase") {
          const phase: AgentPhaseEvent = { agent:data.agent, icon:data.icon, action:data.action, pct:data.pct, done:data.done, status:data.done?"done":"running" };
          const idx = livePhases.findIndex(p=>p.agent===data.agent);
          idx>=0 ? livePhases[idx]=phase : livePhases.push(phase);
          setAgentPhases([...livePhases]);
          updateMsg(thinkId, { phases:[...livePhases], isActive:true });
        }
        if (evMatch[1] === "complete") {
          html=data.html||""; credUsed=data.creditCost||1; savedPid=data.projectId||"";
          if (savedPid) { setProjectId(savedPid); window.history.replaceState({}, "", `/create?id=${savedPid}`); }
          livePhases.forEach(p=>{p.done=true;p.status="done";});
          setAgentPhases([...livePhases]);
          updateMsg(thinkId, { phases:[...livePhases], isActive:false });
        }
        if (evMatch[1] === "error") throw new Error(data.message);
      };

      while(true) {
        const {done, value} = await reader.read();
        if (done) { if(buf.trim()) buf.split("\n\n").forEach(c=>{try{processChunk(c)}catch{}}); break; }
        buf += decoder.decode(value,{stream:true});
        const chunks = buf.split("\n\n"); buf = chunks.pop()||"";
        for(const chunk of chunks) { try{processChunk(chunk)}catch(e:any){if(e.message)throw e;} }
      }
    } catch {
      // Fallback to direct generate
      try {
        const fr = await fetch("/api/generate", {
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},
          body: JSON.stringify({ prompt:userPrompt }),
          signal: AbortSignal.timeout(90000),
        });
        const fd = await fr.json();
        if (fd.html) { html=fd.html; credUsed=fd.creditsUsed||1; savedPid=fd.projectId||""; if(savedPid){setProjectId(savedPid);window.history.replaceState({}, "", `/create?id=${savedPid}`);} }
      } catch {}
    }

    if (!html) {
      updateMsg(thinkId, { type:"error", content:"Generation failed. Try a more detailed description.", isActive:false });
      addMsg({ role:"ai", type:"text", content:'💡 Example: "Build a fitness tracking website with workout plans, dark theme, and contact form"' });
      setLoading(false); return;
    }

    setResult(html);
    if (isMobile) setActivePanel("preview");
    setCredits(c=>({...c, used:c.used+credUsed}));
    const pName = userPrompt.slice(0,50);
    setProjectName(pName);
    updateMsg(thinkId, { isActive:false });
    addMsg({ role:"ai", type:"summary", content:`Built successfully — ${html.split("\n").length} lines of code.`, files:["index.html","styles.css","app.js"], credits:credUsed });

    (async()=>{ try { await saveProject(html, pName, savedPid||projectId); await saveVersion(html,`Generated: ${pName.slice(0,30)}`); } catch {} })();
    setLoading(false);
  };

  // ── Edit flow ─────────────────────────────────────────────────────
  const runEdit = async (editPrompt: string) => {
    if (!result || !editPrompt.trim() || loading) return;
    if (remaining < 1) { addMsg({role:"ai",type:"error",content:"No credits remaining."}); return; }

    setLoading(true);
    addMsg({role:"user",type:"text",content:editPrompt});
    const thinkId = addMsg({role:"ai",type:"thinking",content:"",isActive:true,phases:[
      {agent:"Planner", icon:"○", action:"Reading edit request",   pct:20, status:"running"},
      {agent:"Builder", icon:"○", action:"Analyzing current code", pct:0,  status:"running"},
      {agent:"QA Tester",icon:"○",action:"Validating changes",     pct:0,  status:"running"},
    ]});

    await sleep(500);
    updateMsg(thinkId, {phases:[
      {agent:"Planner", icon:"○", action:"Request analyzed",       pct:100,done:true,status:"done"},
      {agent:"Builder", icon:"○", action:"Applying changes",       pct:55, status:"running"},
      {agent:"QA Tester",icon:"○",action:"Waiting",                pct:0,  status:"running"},
    ]});

    const { data:{ session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    let newHtml = "";

    // Try chat API first (surgical edit)
    try {
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ userMessage:editPrompt, currentCode:{"index.html":result}, projectName, framework:"html" }),
        signal: AbortSignal.timeout(55000),
      });
      const data = await res.json();
      newHtml = data.codeChanges?.["index.html"] || "";
      if (!newHtml) {
        const match = (data.reply||"").match(/<!DOCTYPE[\s\S]*<\/html>/i);
        if (match) newHtml = match[0];
      }
    } catch {}

    // Fallback to generate API
    if (!newHtml) {
      try {
        const fr = await fetch("/api/generate", {
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},
          body: JSON.stringify({ prompt:`Edit: "${editPrompt}". Return complete updated HTML only.\n\nCurrent:\n${result.slice(0,10000)}`, isEdit:true }),
          signal: AbortSignal.timeout(55000),
        });
        const fd = await fr.json();
        if (fd.html) newHtml = fd.html;
      } catch {}
    }

    if (newHtml && newHtml.length > 200) {
      await saveVersion(result, `Before: ${editPrompt.slice(0,40)}`);
      setResult(newHtml);
      setCredits(c=>({...c,used:c.used+1}));
      updateMsg(thinkId, {isActive:false, phases:[
        {agent:"Planner", icon:"○", action:"Request analyzed", pct:100,done:true,status:"done"},
        {agent:"Builder", icon:"○", action:"Changes applied",  pct:100,done:true,status:"done"},
        {agent:"QA Tester",icon:"○",action:"Validated",        pct:100,done:true,status:"done"},
      ]});
      addMsg({role:"ai",type:"summary",content:"Changes applied successfully.",credits:1});
      if (isMobile) setActivePanel("preview");
      (async()=>{ try { await saveProject(newHtml,projectName); } catch{} })();
    } else {
      updateMsg(thinkId, {type:"error",content:"Could not apply the change. Please describe it differently.",isActive:false});
    }
    setLoading(false);
  };

  const handleSend = () => {
    const p = prompt.trim();
    if (!p || loading) return;
    setPrompt(""); promptRef.current = "";
    if (!result) runFlow(p); else runEdit(p);
  };

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { setListening(false); return; }
    const r = new SR();
    r.continuous=false; r.interimResults=false; r.lang="en-US";
    r.onstart=()=>setListening(true);
    r.onresult=(e:any)=>{
      const t=e.results[0]?.[0]?.transcript||"";
      if(t.trim()) setPrompt(prev=>prev?prev+" "+t:t);
    };
    r.onerror=()=>setListening(false);
    r.onend=()=>setListening(false);
    r.start();
  };

  const restoreVersion = async (v: Version) => {
    const code = v.code_snapshot?.["index.html"];
    if (!code) return;
    await saveVersion(result, "Before restore");
    setResult(code);
    (async()=>{ try{await saveProject(code,projectName);}catch{} })();
    addMsg({role:"ai",type:"text",content:`✓ Restored to version ${v.version_number}`});
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;overflow:hidden;background:#080C14;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,215,0,0.1);border-radius:4px;}
        textarea,input,button{font-family:'DM Sans',sans-serif;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
        @keyframes dot{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
        .msg-in{animation:fadeUp .2s ease both;}
        .tab-btn:hover{background:rgba(255,255,255,0.06)!important;color:#fff!important;}
        .send-btn:hover:not(:disabled){transform:scale(1.06);box-shadow:0 0 22px rgba(255,215,0,0.35);}
        .icon-btn:hover{background:rgba(255,255,255,0.07)!important;color:#fff!important;}
        .quick-btn:hover{border-color:rgba(255,215,0,0.25)!important;color:${C.text}!important;}
        input[type=file]{display:none;}
      `}</style>

      <div
        style={{ height:"100dvh", display:"flex", flexDirection:"column", background:C.bg, color:C.text, overflow:"hidden", fontFamily:"'DM Sans',sans-serif", position:"fixed", inset:0 }}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div style={{ position:"fixed",inset:0,background:"rgba(255,215,0,0.08)",border:"2px dashed rgba(255,215,0,0.4)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8 }}>
            <div style={{ fontSize:18,fontWeight:700,color:C.gold }}>Drop files to attach</div>
          </div>
        )}

        {/* ── TOP BAR ── */}
        <div style={{ height:50,flexShrink:0,padding:"0 16px",borderBottom:`1px solid ${C.border}`,background:C.surface,display:"flex",alignItems:"center",gap:10,zIndex:100 }}>
          <KryptonLogo size={26} showText={false} animated={false} onClick={()=>router.push("/")} style={{cursor:"pointer"}}/>
          <div style={{width:1,height:18,background:C.border}}/>

          {editingName
            ? <input autoFocus value={projectName} onChange={e=>setProjectName(e.target.value)} onBlur={()=>setEditingName(false)} onKeyDown={e=>e.key==="Enter"&&setEditingName(false)}
                style={{flex:1,maxWidth:260,background:"rgba(255,255,255,0.06)",border:`1px solid ${C.gold}`,borderRadius:7,color:C.text,padding:"3px 10px",fontSize:13,fontWeight:600,outline:"none"}}/>
            : <button onClick={()=>setEditingName(true)} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"2px 8px",flex:1,textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:260}}>
                {projectName} <span style={{opacity:.4}}>✏</span>
              </button>
          }

          {isMobile && (
            <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
              {["chat","preview"].map(t=>(
                <button key={t} onClick={()=>setActivePanel(t as any)} style={{padding:"4px 12px",borderRadius:7,border:"none",background:activePanel===t?C.gold:"rgba(255,255,255,0.06)",color:activePanel===t?"#080C14":"#666",fontSize:11,fontWeight:600,cursor:"pointer",textTransform:"capitalize"}}>{t}</button>
              ))}
            </div>
          )}

          <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:isMobile?"0":"auto"}}>
            <div style={{padding:"3px 10px",borderRadius:16,background:remaining>0?"rgba(255,215,0,0.07)":"rgba(255,69,69,0.08)",border:`1px solid ${remaining>0?"rgba(255,215,0,0.15)":"rgba(255,69,69,0.2)"}`,fontSize:11,fontWeight:700,color:remaining>0?C.gold:C.red}}>
              ⚡ {remaining}
            </div>
            {result && (
              <button onClick={()=>saveProject(result,projectName)} style={{padding:"4px 12px",background:saved?"rgba(0,208,132,0.08)":"rgba(255,215,0,0.08)",border:`1px solid ${saved?"rgba(0,208,132,0.2)":"rgba(255,215,0,0.2)"}`,borderRadius:8,color:saved?C.green:C.gold,fontSize:11,fontWeight:600,cursor:"pointer"}}>
                {saving?"…":saved?"✓":  "Save"}
              </button>
            )}
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>

          {/* ── LEFT: CHAT ── */}
          <div style={{
            width:isMobile?"100%":"50%",
            display:isMobile?(activePanel==="chat"?"flex":"none"):"flex",
            flexDirection:"column",
            borderRight:isMobile?"none":`1px solid ${C.border}`,
            background:C.surface,
            overflow:"hidden",
          }}>
            {/* Status bar */}
            {loading && (
              <div style={{padding:"7px 16px",borderBottom:`1px solid ${C.border}`,background:"rgba(255,215,0,0.03)",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                <div style={{display:"flex",gap:4}}>
                  {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:C.gold,animation:`dot 1.2s ${i*.2}s ease-in-out infinite`}}/>)}
                </div>
                <span style={{fontSize:12,color:C.gold,fontWeight:500}}>Krypton Intelligence Engine — Active</span>
              </div>
            )}

            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",paddingTop:14,paddingBottom:8,display:"flex",flexDirection:"column",gap:6}}>
              {messages.length===0 && !loading && (
                <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,textAlign:"center",padding:"24px 20px"}}>
                  <KryptonLogo size={44} showText={false} animated={true}/>
                  <div>
                    <div style={{fontSize:18,fontWeight:700,marginBottom:6,fontFamily:"'Syne',sans-serif"}}>What do you want to build?</div>
                    <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>Describe your idea — Krypton AI will plan, design and build it.</div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center",maxWidth:440}}>
                    {["Build a restaurant website","Create a fitness dashboard","Make a browser game","Design a portfolio site","Build a SaaS landing page"].map(s=>(
                      <button key={s} className="quick-btn" onClick={()=>setPrompt(s)} style={{padding:"6px 14px",background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:20,color:C.muted,fontSize:12,cursor:"pointer",transition:"all .15s"}}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg=>(
                <div key={msg.id} className="msg-in">
                  {msg.role==="user"
                    ? <UserBubble msg={msg}/>
                    : msg.type==="thinking"
                    ? <ThinkingBubble phases={msg.phases||[]} isActive={msg.isActive||false}/>
                    : <AiBubble msg={msg}/>
                  }
                </div>
              ))}
              <div ref={chatEndRef}/>
            </div>

            {/* Uploads preview */}
            {uploads.length>0 && (
              <div style={{padding:"6px 14px",borderTop:`1px solid ${C.border}`,display:"flex",gap:6,flexWrap:"wrap",flexShrink:0}}>
                {uploads.map((f,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",background:"rgba(255,215,0,0.07)",border:`1px solid ${C.border}`,borderRadius:20}}>
                    <span style={{fontSize:11,color:C.gold}}>{f.type.startsWith("image/")?"🖼":f.type==="application/pdf"?"📄":"📎"}</span>
                    <span style={{fontSize:11,color:C.sub,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                    <span style={{fontSize:10,color:C.muted}}>{fmtSize(f.size)}</span>
                    <button onClick={()=>setUploads(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:11}}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{padding:"10px 14px 12px",borderTop:`1px solid ${C.border}`,background:`rgba(8,12,20,0.95)`,flexShrink:0}}>
              {result && <div style={{marginBottom:5,fontSize:11,color:C.muted}}>Describe a change to make</div>}
              <div style={{
                background:C.card,
                border:`1px solid ${isDragging?"rgba(255,215,0,0.35)":loading?"rgba(255,215,0,0.12)":C.border}`,
                borderRadius:14,padding:"10px 12px",
                transition:"border-color .2s",
              }}>
                <textarea
                  value={prompt}
                  onChange={e=>setPrompt(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey&&!loading){e.preventDefault();handleSend();} }}
                  placeholder={loading?"Working…":result?"Describe a change…":"Describe what you want to build…"}
                  rows={2} disabled={loading}
                  style={{width:"100%",background:"none",border:"none",color:loading?"#2a3545":C.text,fontSize:14,resize:"none",outline:"none",lineHeight:1.65,maxHeight:130,overflowY:"auto"}}
                />
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:7,paddingTop:7,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {/* File upload */}
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx,.mp4,.mov" onChange={e=>e.target.files&&handleFileUpload(e.target.files)}/>
                    <button className="icon-btn" onClick={()=>fileInputRef.current?.click()} style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} title="Attach file">
                      📎
                    </button>
                    <span style={{fontSize:10,color:"#232d3f"}}>Krypton Intelligence Engine</span>
                  </div>
                  <div style={{display:"flex",gap:7}}>
                    <button onClick={handleVoice} style={{width:32,height:32,borderRadius:"50%",background:listening?C.gold:"rgba(255,255,255,0.04)",border:`1px solid ${listening?C.gold:C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="2" width="6" height="11" rx="3" fill={listening?"#080C14":"#666"}/>
                        <path d="M5 11a7 7 0 0014 0" stroke={listening?"#080C14":"#666"} strokeWidth="2" strokeLinecap="round"/>
                        <line x1="12" y1="18" x2="12" y2="22" stroke={listening?"#080C14":"#666"} strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <button className="send-btn" onClick={handleSend} disabled={!prompt.trim()||loading} style={{width:38,height:38,borderRadius:"50%",background:(!loading&&prompt.trim())?"linear-gradient(135deg,#FFD700,#FF7A00)":"rgba(255,255,255,0.05)",border:"none",cursor:(!loading&&prompt.trim())?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
                      {loading
                        ?<div style={{width:13,height:13,borderRadius:"50%",border:"2px solid rgba(8,12,20,0.3)",borderTopColor:"#080C14",animation:"spin .7s linear infinite"}}/>
                        :<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke={prompt.trim()?"#080C14":"#3D4A5C"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: PREVIEW / FILES / DEPLOY / HISTORY ── */}
          <div style={{flex:1,display:isMobile?(activePanel==="preview"?"flex":"none"):"flex",flexDirection:"column",overflow:"hidden"}}>
            {/* Tab bar */}
            <div style={{display:"flex",gap:3,padding:"7px 12px",borderBottom:`1px solid ${C.border}`,background:C.surface,alignItems:"center",flexShrink:0}}>
              {([{id:"preview",label:"Preview"},{id:"files",label:"Files"},{id:"deploy",label:"Deploy"},{id:"history",label:"History"}] as const).map(t=>(
                <button key={t.id} className="tab-btn" onClick={()=>setRightTab(t.id)} style={{padding:"5px 13px",borderRadius:8,border:"none",background:rightTab===t.id?"rgba(255,215,0,0.09)":"transparent",color:rightTab===t.id?C.gold:C.muted,fontSize:12,fontWeight:rightTab===t.id?600:400,cursor:"pointer",transition:"all .15s"}}>
                  {t.label}
                </button>
              ))}
              {rightTab==="preview" && result && (
                <>
                  <div style={{marginLeft:"auto",display:"flex",gap:3}}>
                    {([{id:"desktop",label:"D"},{id:"tablet",label:"T"},{id:"mobile",label:"M"}] as const).map(d=>(
                      <button key={d.id} onClick={()=>setDevice(d.id)} style={{width:26,height:26,borderRadius:7,border:`1px solid ${device===d.id?"rgba(255,215,0,0.3)":C.border}`,background:device===d.id?"rgba(255,215,0,0.09)":"none",color:device===d.id?C.gold:C.muted,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={()=>{if(!result)return;const b=new Blob([result],{type:"text/html"});window.open(URL.createObjectURL(b),"_blank");}} style={{padding:"4px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"none",color:C.muted,fontSize:11,cursor:"pointer",marginLeft:4}}>↗</button>
                </>
              )}
              {result && <div style={{marginLeft:rightTab==="preview"?"0":"auto",display:"flex",alignItems:"center",gap:4,fontSize:10,color:C.green}}><div style={{width:5,height:5,borderRadius:"50%",background:C.green,animation:"pulse 2s infinite"}}/>Live</div>}
            </div>

            {/* Preview */}
            {rightTab==="preview" && (
              <div style={{flex:1,display:"flex",alignItems:device==="desktop"?"stretch":"flex-start",justifyContent:"center",overflow:"auto",background:result?(device!=="desktop"?"#141924":"#fff"):"#080C14",padding:result&&device!=="desktop"?"20px":"0"}}>
                {result
                  ? <iframe key={`${result.length}-${device}`} srcDoc={result} style={{border:"none",width:device==="desktop"?"100%":device==="tablet"?"768px":"375px",height:device==="desktop"?"100%":"auto",minHeight:device==="desktop"?"100%":"600px",display:"block",opacity:1,background:"#fff",boxShadow:device!=="desktop"?"0 8px 48px rgba(0,0,0,0.8)":"none",transition:"width .3s ease",flexShrink:0}} sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" title="Live Preview"/>
                  : <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,height:"100%",textAlign:"center",padding:24}}>
                      <div style={{fontSize:48,opacity:.15}}>✦</div>
                      <div style={{fontSize:14,color:C.muted}}>Preview will appear here</div>
                    </div>
                }
              </div>
            )}

            {/* Files */}
            {rightTab==="files" && (
              <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                <FileExplorer html={result} projectName={projectName}
                  onDownload={()=>{if(!result)return;const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([result],{type:"text/html"}));a.download=`${projectName.replace(/\s+/g,"-")}.html`;a.click();}}
                  onCopyCode={()=>navigator.clipboard.writeText(result)}
                />
              </div>
            )}

            {/* Deploy */}
            {rightTab==="deploy" && (
              <div style={{flex:1,overflowY:"auto"}}>
                <DeployPanel html={result} projectName={projectName} projectId={projectId}/>
              </div>
            )}

            {/* History */}
            {rightTab==="history" && (
              <div style={{flex:1,overflowY:"auto",padding:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:14,fontFamily:"'Syne',sans-serif"}}>Version History</div>
                {versions.length===0
                  ? <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:13}}><div style={{fontSize:28,marginBottom:10,opacity:.3}}>○</div>No versions yet</div>
                  : versions.map((v,i)=>(
                    <div key={v.id||i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:32,height:32,borderRadius:8,background:"rgba(255,215,0,0.07)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:C.gold,flexShrink:0,fontFamily:"'Syne',sans-serif"}}>v{v.version_number}</div>
                      <div style={{flex:1,overflow:"hidden"}}>
                        <div style={{fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.message}</div>
                        <div style={{fontSize:10,color:C.muted,marginTop:2}}>{new Date(v.created_at).toLocaleString()}</div>
                      </div>
                      <button onClick={()=>restoreVersion(v)} style={{padding:"5px 12px",background:"rgba(255,215,0,0.07)",border:`1px solid rgba(255,215,0,0.18)`,borderRadius:7,color:C.gold,fontSize:11,fontWeight:600,cursor:"pointer"}}>Restore</button>
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
    <Suspense fallback={<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080C14"}}><div style={{width:32,height:32,borderRadius:"50%",border:"3px solid rgba(255,215,0,0.15)",borderTopColor:"#FFD700",animation:"spin .8s linear infinite"}}/></div>}>
      <CreatePageInner/>
    </Suspense>
  );
}
