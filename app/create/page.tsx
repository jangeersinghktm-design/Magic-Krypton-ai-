"use client";
/**
 * KRYPTON AI — Create Page v3
 * Sprint 1: Agent Chat + File Explorer + Live Preview + Supabase Integration
 * 3-Panel Workspace: FileExplorer | AgentChat | Preview+Deploy
 */

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import KryptonLogo from "@/components/branding/KryptonLogo";
import FileExplorer from "@/components/workspace/FileExplorer";
import AgentTimeline, { AgentPhaseEvent } from "@/components/workspace/AgentTimeline";
import DeployPanel from "@/components/workspace/DeployPanel";

// ── Design Tokens ─────────────────────────────────────────────────
const C = {
  bg:      "#080808",
  surface: "#0C0C0C",
  card:    "#111111",
  border:  "rgba(255,215,0,0.08)",
  borderHi:"rgba(255,215,0,0.25)",
  text:    "#FFFFFF",
  sub:     "#94A3B8",
  muted:   "#4A5568",
  gold:    "#FFD700",
  green:   "#00D084",
  red:     "#EF4444",
  grad:    "linear-gradient(135deg,#FFD700,#FF7A00)",
};

// ── Types ─────────────────────────────────────────────────────────
type MsgRole  = "user" | "ai" | "system";
type MsgType  = "text" | "thinking" | "plan" | "summary" | "error";
type RightTab = "preview" | "deploy" | "history";
type Device   = "desktop" | "tablet" | "mobile";

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
}

interface Version {
  id:             string;
  version_number: number;
  message:        string;
  created_at:     string;
  code_snapshot:  Record<string, string>;
}

// ── Helpers ────────────────────────────────────────────────────────
const mkId    = () => `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms));
const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });

// ── Message Components ─────────────────────────────────────────────
function UserBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div style={{ display:"flex", justifyContent:"flex-end", padding:"4px 16px" }}>
      <div style={{
        maxWidth:"80%", padding:"11px 15px",
        background:"linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,122,0,.08))",
        border:"1px solid rgba(255,215,0,.18)",
        borderRadius:"16px 16px 4px 16px",
        fontSize:13.5, lineHeight:1.65, color:C.text, fontWeight:500,
      }}>
        {msg.content}
      </div>
    </div>
  );
}

function ThinkingBubble({ phases, isActive }: { phases: AgentPhaseEvent[]; isActive: boolean }) {
  return (
    <div style={{ padding:"4px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <div style={{
          width:20, height:20, borderRadius:"50%",
          background:"rgba(255,215,0,.08)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <img src="/logo.svg" alt="" style={{ width:11, height:11, opacity:.8 }}/>
        </div>
        <span style={{ fontSize:11, color:C.muted }}>Krypton AI</span>
      </div>
      <AgentTimeline phases={phases} isActive={isActive}/>
    </div>
  );
}

function AiBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div style={{ padding:"4px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <div style={{
          width:20, height:20, borderRadius:"50%",
          background:"rgba(255,215,0,.08)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <img src="/logo.svg" alt="" style={{ width:11, height:11, opacity:.8 }}/>
        </div>
        <span style={{ fontSize:11, color:C.muted }}>Krypton AI</span>
        <span style={{ fontSize:10, color:"#2a2a2a" }}>{fmtTime(msg.ts)}</span>
      </div>
      <div style={{
        maxWidth:"90%", padding:"11px 15px",
        background:C.card,
        border:`1px solid ${C.border}`,
        borderRadius:"4px 16px 16px 16px",
        fontSize:13.5, lineHeight:1.7, color:C.sub,
      }}>
        {msg.type === "summary" ? (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ color:C.green, fontWeight:700, fontSize:13 }}>✅ Project Complete</div>
            <div style={{ color:"#ddd", fontSize:13 }}>{msg.content}</div>
            {msg.files && msg.files.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:4 }}>
                {msg.files.map(f => (
                  <span key={f} style={{
                    fontSize:11, padding:"3px 10px",
                    background:"rgba(0,208,132,.06)",
                    border:"1px solid rgba(0,208,132,.15)",
                    borderRadius:20, color:C.green,
                  }}>{f}</span>
                ))}
              </div>
            )}
            {msg.credits && (
              <div style={{ fontSize:11, color:C.muted }}>⚡ {msg.credits} credit{msg.credits>1?"s":""} used</div>
            )}
          </div>
        ) : msg.type === "error" ? (
          <div style={{ color:C.red }}>{msg.content}</div>
        ) : (
          msg.content
        )}
      </div>
    </div>
  );
}

// ── Main Create Page ───────────────────────────────────────────────
function CreatePageInner() {
  const router      = useRouter();
  const params      = useSearchParams();
  const supabase    = createClient();

  // State
  const [user, setUser]           = useState<any>(null);
  const [prompt, setPrompt]       = useState("");
  const [result, setResult]       = useState("");
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [agentPhases, setAgentPhases] = useState<AgentPhaseEvent[]>([]);
  const [loading, setLoading]     = useState(false);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("Untitled Project");
  const [editingName, setEditingName] = useState(false);
  const [rightTab, setRightTab]   = useState<RightTab>("preview");
  const [device, setDevice]       = useState<Device>("desktop");
  const [isMobile, setIsMobile]   = useState(false);
  const [activePanel, setActivePanel] = useState<"chat"|"preview">("chat");
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [credits, setCredits]     = useState({ total:5, used:0, plan:"free" });
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [versions, setVersions]   = useState<Version[]>([]);
  const [showMenu, setShowMenu]   = useState(false);
  const [listening, setListening] = useState(false);

  const chatEndRef  = useRef<HTMLDivElement>(null);
  const promptRef   = useRef("");
  const menuRef     = useRef<HTMLDivElement>(null);
  const silenceRef  = useRef<any>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const remaining = credits.total - credits.used;

  // ── Message helpers ──────────────────────────────────────────────
  const addMsg = useCallback((m: Omit<ChatMessage, "id"|"ts">): string => {
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
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, agentPhases]);

  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth/login"); return; }
    setUser(session.user);

    const { data: profile } = await supabase
      .from("profiles")
      .select("total_credits,used_credits,plan")
      .eq("id", session.user.id)
      .single();
    if (profile) setCredits({ total:profile.total_credits||5, used:profile.used_credits||0, plan:profile.plan||"free" });

    const urlId     = params.get("id");
    const urlPrompt = params.get("prompt");

    if (urlId) {
      await loadProject(urlId, session.user.id);
    } else if (urlPrompt) {
      const decoded = decodeURIComponent(urlPrompt);
      setPrompt(decoded);
      promptRef.current = decoded;
      window.history.replaceState({}, "", "/create");
      setTimeout(() => runAgentFlow(decoded), 300);
    }
  };

  // ── Load existing project ─────────────────────────────────────────
  const loadProject = async (id: string, uid: string) => {
    const { data: proj } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", uid)
      .single();

    if (!proj) return;

    setProjectId(proj.id);
    setProjectName(proj.name || proj.title || "Project");
    setResult(proj.html_code || "");
    promptRef.current = proj.prompt || "";

    // Restore chat history
    const history: any[] = proj.conversation_history || [];
    if (history.length > 0) {
      history.forEach((m: any) => addMsg({
        role:    m.role || "ai",
        type:    m.type || "text",
        content: m.content || "",
      }));
      addMsg({ role:"ai", type:"text", content:"✅ Project restored — continue editing below." });
    } else {
      addMsg({ role:"ai", type:"text", content:"✅ Project loaded. Describe any changes you'd like to make." });
    }

    // Load versions
    const { data: vers } = await supabase
      .from("project_versions")
      .select("*")
      .eq("project_id", id)
      .order("version_number", { ascending:false })
      .limit(20);
    if (vers) setVersions(vers as Version[]);
  };

  // ── Save project ──────────────────────────────────────────────────
  const saveProject = async (html: string, name: string) => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }

    const toSave = {
      user_id:   session.user.id,
      name,
      title:     name,
      html_code: html,
      prompt:    promptRef.current,
      updated_at: new Date().toISOString(),
      conversation_history: messages
        .filter(m => !["thinking"].includes(m.type))
        .map(m => ({ role:m.role, type:m.type, content:m.content })),
    };

    if (projectId) {
      await supabase.from("projects").update(toSave).eq("id", projectId);
    } else {
      const { data } = await supabase.from("projects")
        .insert({ ...toSave, status:"completed" })
        .select().single();
      if (data) {
        setProjectId(data.id);
        window.history.replaceState({}, "", `/create?id=${data.id}`);

        // Save to project_files table
        await supabase.from("project_files").insert({
          project_id: data.id,
          user_id:    session.user.id,
          filename:   "index.html",
          content:    html,
          language:   "html",
          is_entry:   true,
          size_bytes: html.length,
        }).catch(() => {});
      }
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Save version ─────────────────────────────────────────────────
  const saveVersion = async (html: string, msg: string) => {
    if (!projectId) return;
    const { data } = await supabase.from("project_versions").insert({
      project_id:     projectId,
      code_snapshot:  { "index.html": html },
      message:        msg,
      type:           "auto",
      version_number: versions.length + 1,
      size_bytes:     html.length,
    }).select().single();
    if (data) setVersions(v => [data as Version, ...v]);
  };

  // ══════════════════════════════════════════════════════════════════
  // ── AGENT FLOW — SSE Orchestration ───────────────────────────────
  // ══════════════════════════════════════════════════════════════════
  const runAgentFlow = async (userPrompt: string) => {
    if (!userPrompt.trim() || loading) return;
    if (remaining < 1) {
      addMsg({ role:"ai", type:"error", content:"⚡ No credits left. Please upgrade or wait for daily reset." });
      return;
    }

    setLoading(true);
    setPrompt("");
    promptRef.current = userPrompt;
    setAgentPhases([]);

    addMsg({ role:"user", type:"text", content:userPrompt });
    const thinkId = addMsg({ role:"ai", type:"thinking", content:"", phases:[], isActive:true });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    let html      = "";
    let savedPid  = "";
    let credUsed  = 2;
    const livePhases: AgentPhaseEvent[] = [];

    try {
      abortRef.current = new AbortController();

      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          prompt:      userPrompt,
          userId:      session.user.id,
          accessToken: session.access_token,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("stream_failed");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = "";

      const processChunk = (chunk: string) => {
        const evMatch   = chunk.match(/event:\s*(\S+)/);
        const dataMatch = chunk.match(/data:\s*([\s\S]+)/);
        if (!evMatch || !dataMatch) return;
        const eventType = evMatch[1];
        let   data: any = {};
        try { data = JSON.parse(dataMatch[1].trim()); } catch { return; }

        if (eventType === "phase") {
          const phase: AgentPhaseEvent = {
            agent:  data.agent,  icon:   data.icon,
            action: data.action, pct:    data.pct,
            done:   data.done,   status: data.done ? "done" : "running",
          };
          const existingIdx = livePhases.findIndex(p => p.agent === data.agent);
          if (existingIdx >= 0) livePhases[existingIdx] = phase;
          else livePhases.push(phase);
          setAgentPhases([...livePhases]);
          updateMsg(thinkId, { phases:[...livePhases], isActive:true });
        }

        if (eventType === "complete") {
          html     = data.html || "";
          credUsed = data.creditCost || 2;
          savedPid = data.projectId  || "";
          if (savedPid && !projectId) {
            setProjectId(savedPid);
            window.history.replaceState({}, "", `/create?id=${savedPid}`);
          }
          livePhases.forEach(p => { p.done = true; p.status = "done"; });
          setAgentPhases([...livePhases]);
          updateMsg(thinkId, { phases:[...livePhases], isActive:false });
        }

        if (eventType === "error") throw new Error(data.message || "Generation failed");
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // ✅ Process remaining buffer after stream closes
          if (buf.trim()) {
            buf.split("\n\n").forEach(chunk => { try { processChunk(chunk); } catch {} });
          }
          break;
        }
        buf += decoder.decode(value, { stream:true });

        const chunks = buf.split("\n\n");
        buf = chunks.pop() || "";

        for (const chunk of chunks) {
          const evMatch   = chunk.match(/event:\s*(\S+)/);
          const dataMatch = chunk.match(/data:\s*([\s\S]+)/);
          if (!evMatch || !dataMatch) continue;

          const eventType = evMatch[1];
          let   data: any = {};
          try { data = JSON.parse(dataMatch[1].trim()); } catch { continue; }

          // Use processChunk for consistency
          try { processChunk(chunk); } catch (e: any) {
            if (e.message?.includes("failed")) throw e;
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        updateMsg(thinkId, { isActive:false });
        setLoading(false);
        return;
      }

      // Fallback to /api/generate
      try {
        updateMsg(thinkId, { content:"Switching to backup generator...", isActive:true });
        const fallback = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type":"application/json", "Authorization":`Bearer ${session.access_token}` },
          body: JSON.stringify({ prompt: userPrompt }),
          signal: AbortSignal.timeout(90000),
        });
        const fd = await fallback.json();
        if (fd.html) {
          html     = fd.html;
          credUsed = fd.creditsUsed || 1;
          savedPid = fd.projectId   || "";
          if (savedPid && !projectId) {
            setProjectId(savedPid);
            window.history.replaceState({}, "", `/create?id=${savedPid}`);
          }
        }
      } catch {
        updateMsg(thinkId, { type:"error", content:"Generation failed. Please try again.", isActive:false });
        setLoading(false);
        return;
      }
    }

    if (!html) {
      updateMsg(thinkId, { type:"error", content:"Please try a more detailed description.", isActive:false });
      setLoading(false);
      return;
    }

    // ── Success ──────────────────────────────────────────────────
    setResult(html);
    if (isMobile) setActivePanel("preview");
    setCredits(c => ({ ...c, used: c.used + credUsed }));

    const pName = userPrompt.slice(0, 50);
    setProjectName(pName);

    // Save to Supabase in background — use savedPid directly (not stale closure)
    const pidToUse = savedPid || projectId;
    (async () => {
      try {
        const { data: { session: sess } } = await supabase.auth.getSession();
        if (!sess) return;
        if (pidToUse) {
          // Project already saved by backend — just update with full data
          await supabase.from("projects").update({
            name:     pName,
            html_code: html,
            conversation_history: [],
            updated_at: new Date().toISOString(),
          }).eq("id", pidToUse);
          // Save version
          const { data: ver } = await supabase.from("project_versions").insert({
            project_id:    pidToUse,
            code_snapshot: { "index.html": html },
            message:       `Generated: ${pName.slice(0,30)}`,
            type:          "auto",
            version_number: 1,
            size_bytes:    html.length,
          }).select().single();
          if (ver) setVersions([ver as Version]);
        } else {
          // No backend projectId — insert fresh
          const { data: proj } = await supabase.from("projects").insert({
            user_id:   sess.user.id,
            name:      pName, title: pName,
            html_code: html,
            prompt:    promptRef.current,
            status:    "completed",
          }).select().single();
          if (proj) {
            setProjectId(proj.id);
            window.history.replaceState({}, "", `/create?id=${proj.id}`);
          }
        }
      } catch {}
    })();

    // Add completion message
    addMsg({
      role:    "ai",
      type:    "summary",
      content: `Built successfully — ${html.split("\n").length} lines of production code.`,
      files:   ["index.html", "styles.css", "app.js"],
      credits: credUsed,
    });

    setLoading(false);
  };

  // ── Edit Flow ─────────────────────────────────────────────────────
  const runEditFlow = async (editPrompt: string) => {
    if (!result || !editPrompt.trim() || loading) return;
    if (remaining < 1) {
      addMsg({ role:"ai", type:"error", content:"No credits left." });
      return;
    }

    setLoading(true);
    addMsg({ role:"user", type:"text", content:editPrompt });
    const thinkId = addMsg({
      role:"ai", type:"thinking", content:"", isActive:true,
      phases:[
        { agent:"Planner",  icon:"🔍", action:"Reading edit request...",  pct:20, status:"running" },
        { agent:"Builder",  icon:"⚙️",  action:"Analyzing current code...", pct:0,  status:"running" },
        { agent:"QA Tester",icon:"🧪", action:"Validating changes...",    pct:0,  status:"running" },
      ],
    });

    await sleep(600);
    updateMsg(thinkId, { phases:[
      { agent:"Planner",  icon:"🔍", action:"Request analyzed",         pct:100, done:true, status:"done" },
      { agent:"Builder",  icon:"⚙️",  action:"Applying surgical edit...", pct:55,  status:"running" },
      { agent:"QA Tester",icon:"🧪", action:"Waiting...",               pct:0,   status:"running" },
    ]});

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // Use chat API for surgical edits
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          userMessage:  editPrompt,
          currentCode:  { "index.html": result },
          projectName,
          framework:    "html",
        }),
        signal: AbortSignal.timeout(60000),
      });

      const data = await res.json();
      let newHtml = data.codeChanges?.["index.html"] || "";

      // Fallback: extract HTML from text response
      if (!newHtml) {
        const match = (data.reply || data.text || "").match(/<!DOCTYPE[\s\S]*<\/html>/i);
        if (match) newHtml = match[0];
      }

      // If chat didn't return HTML, try generate with edit context
      if (!newHtml) {
        const genRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type":"application/json", "Authorization":`Bearer ${session.access_token}` },
          body: JSON.stringify({
            prompt: `Edit this project. Change: "${editPrompt}". Return COMPLETE updated HTML only.\n\nCURRENT:\n${result.slice(0, 12000)}`,
            isEdit: true,
          }),
          signal: AbortSignal.timeout(90000),
        });
        const gd = await genRes.json();
        if (gd.html) newHtml = gd.html;
      }

      if (newHtml && newHtml.length > 200) {
        await saveVersion(result, `Before: ${editPrompt.slice(0,40)}`);
        setResult(newHtml);
        setCredits(c => ({ ...c, used: c.used + 1 }));

        (async () => {
          try { await saveProject(newHtml, projectName); } catch {}
        })();

        updateMsg(thinkId, {
          isActive: false,
          phases: [
            { agent:"Planner",  icon:"🔍", action:"Request analyzed",  pct:100, done:true, status:"done" },
            { agent:"Builder",  icon:"⚙️",  action:"Edit applied",       pct:100, done:true, status:"done" },
            { agent:"QA Tester",icon:"🧪", action:"Changes validated",  pct:100, done:true, status:"done" },
          ],
        });

        addMsg({ role:"ai", type:"summary", content:"Edit applied successfully.", credits:1 });
        if (isMobile) setActivePanel("preview");
      } else {
        updateMsg(thinkId, { type:"error", content:"Please describe the change more specifically.", isActive:false });
      }
    } catch {
      updateMsg(thinkId, { type:"error", content:"Edit failed. Try again.", isActive:false });
    }

    setLoading(false);
  };

  // ── Send handler ──────────────────────────────────────────────────
  const handleSend = () => {
    const p = prompt.trim();
    if (!p || loading) return;
    setPrompt("");
    promptRef.current = "";
    if (!result) runAgentFlow(p);
    else         runEditFlow(p);
  };

  // ── Voice input ────────────────────────────────────────────────────
  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported in this browser"); return; }
    if (listening) { setListening(false); return; }
    const r = new SR();
    r.continuous      = false;  // Stop after one sentence — prevents garbage
    r.interimResults  = false;  // Only final results — no junk
    r.lang            = "en-US";
    r.maxAlternatives = 1;
    r.onstart = () => setListening(true);
    r.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript || "";
      if (transcript.trim()) {
        setPrompt(prev => prev ? prev + " " + transcript : transcript);
      }
    };
    r.onerror = () => setListening(false);
    r.onend   = () => setListening(false);
    r.start();
  };

  // ── Restore version ───────────────────────────────────────────────
  const restoreVersion = async (v: Version) => {
    const code = v.code_snapshot?.["index.html"];
    if (!code) return;
    await saveVersion(result, "Before restore");
    setResult(code);
    (async () => { try { await saveProject(code, projectName); } catch {} })();
    addMsg({ role:"ai", type:"text", content:`✅ Restored to version ${v.version_number}: "${v.message}"` });
  };

  // ══════════════════════════════════════════════════════════════════
  // ── RENDER ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  const displayName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "User";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;overflow:hidden;background:#080808;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,215,0,.12);border-radius:4px;}
        textarea,input{font-family:'DM Sans',sans-serif;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes dot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        .msg-in{animation:fadeUp .2s ease both;}
        .tab-btn:hover{color:#fff!important;}
        .send-btn:hover{transform:scale(1.06);box-shadow:0 0 20px rgba(255,215,0,.35);}
        .icon-btn:hover{background:rgba(255,255,255,.08)!important;color:#fff!important;}
      `}</style>

      <div style={{ height:"100dvh", display:"flex", flexDirection:"column", background:C.bg, color:C.text, overflow:"hidden", fontFamily:"'DM Sans',sans-serif" }}>

        {/* ── TOP BAR ──────────────────────────────────────────── */}
        <div style={{
          height:52, flexShrink:0,
          padding:"0 14px",
          borderBottom:`1px solid ${C.border}`,
          background:"rgba(8,8,8,.95)",
          backdropFilter:"blur(12px)",
          display:"flex", alignItems:"center", gap:10,
          zIndex:100,
        }}>
          {/* Logo */}
          <KryptonLogo size={28} showText={false} animated={false} onClick={() => router.push("/")} style={{ cursor:"pointer" }}/>

          {/* Separator */}
          <div style={{ width:1, height:20, background:C.border }}/>

          {/* Project name */}
          {editingName ? (
            <input
              autoFocus
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => e.key==="Enter" && setEditingName(false)}
              style={{
                flex:1, maxWidth:280,
                background:"#181818",
                border:`1px solid ${C.gold}`,
                borderRadius:7, color:C.text,
                padding:"3px 10px", fontSize:13,
                fontWeight:600, outline:"none",
              }}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              style={{
                background:"none", border:"none",
                color:C.muted, fontSize:13,
                cursor:"pointer", padding:"2px 6px",
                maxWidth:260, overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap",
                flex:1,
              }}
            >
              {projectName} ✏
            </button>
          )}

          {/* Mobile panel tabs */}
          {isMobile && (
            <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
              {["chat","preview"].map(t => (
                <button
                  key={t}
                  onClick={() => setActivePanel(t as any)}
                  style={{
                    padding:"4px 12px", borderRadius:7,
                    border:"none",
                    background:activePanel===t?"#FFD700":"#1c1c1c",
                    color:activePanel===t?"#080808":"#777",
                    fontSize:11, fontWeight:600,
                    cursor:"pointer", textTransform:"capitalize",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Right controls */}
          <div style={{ display:"flex", gap:6, alignItems:"center", marginLeft:isMobile?"0":"auto" }}>
            <div style={{
              padding:"3px 10px", borderRadius:16,
              background:remaining>0?"rgba(255,215,0,.06)":"rgba(239,68,68,.08)",
              border:`1px solid ${remaining>0?"rgba(255,215,0,.15)":"rgba(239,68,68,.2)"}`,
              fontSize:11, fontWeight:700,
              color:remaining>0?C.gold:C.red,
            }}>
              ⚡ {remaining}
            </div>
            {result && (
              <button
                onClick={() => { setSaving(true); saveProject(result, projectName); }}
                style={{
                  padding:"5px 12px",
                  background:saved?"rgba(0,208,132,.1)":"rgba(255,215,0,.08)",
                  border:`1px solid ${saved?"rgba(0,208,132,.25)":"rgba(255,215,0,.2)"}`,
                  borderRadius:8, color:saved?C.green:C.gold,
                  fontSize:11, fontWeight:700,
                  cursor:"pointer",
                }}
              >
                {saving?"...":saved?"✓ Saved":"Save"}
              </button>
            )}
          </div>
        </div>

        {/* ── MAIN 3-PANEL ─────────────────────────────────────── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* ── PANEL 1: FILE EXPLORER ── */}
          {!isMobile && showFileExplorer && (
            <div style={{ width:220, flexShrink:0, borderRight:`1px solid ${C.border}`, overflow:"hidden", display:"flex", flexDirection:"column" }}>
              <FileExplorer
                html={result}
                projectName={projectName}
                onDownload={() => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([result], { type:"text/html" }));
                  a.download = `${projectName.toLowerCase().replace(/\s+/g,"-")}.html`;
                  a.click();
                }}
                onCopyCode={() => navigator.clipboard.writeText(result)}
              />
            </div>
          )}

          {/* ── PANEL 2: AGENT CHAT ── */}
          <div style={{
            width: isMobile ? "100%" : showFileExplorer ? "calc(50% - 110px)" : "50%",
            display: isMobile ? (activePanel==="chat" ? "flex" : "none") : "flex",
            flexDirection:"column",
            borderRight: isMobile ? "none" : `1px solid ${C.border}`,
            background: C.surface,
            overflow:"hidden",
          }}>
            {/* Chat header */}
            <div style={{
              padding:"8px 14px",
              borderBottom:`1px solid ${C.border}`,
              display:"flex", alignItems:"center", gap:8,
              flexShrink:0,
            }}>
              {!isMobile && (
                <button
                  className="icon-btn"
                  onClick={() => setShowFileExplorer(v=>!v)}
                  style={{
                    width:28, height:28, borderRadius:7,
                    background:"rgba(255,255,255,.04)",
                    border:`1px solid ${C.border}`,
                    color:C.muted, fontSize:13, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}
                  title="Toggle file explorer"
                >
                  ☰
                </button>
              )}
              {loading && (
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ display:"flex", gap:3 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:C.gold, animation:`dot 1.2s ${i*.2}s ease-in-out infinite` }}/>
                    ))}
                  </div>
                  <span style={{ fontSize:11, color:C.gold }}>Agents working...</span>
                </div>
              )}
              {!loading && result && (
                <span style={{ fontSize:11, color:C.muted }}>✏ Edit mode — 1 credit per change</span>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", paddingTop:12, paddingBottom:8, display:"flex", flexDirection:"column", gap:4 }}>
              {messages.length === 0 && !loading && (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, textAlign:"center", padding:"24px 20px" }}>
                  <KryptonLogo size={40} showText={false} animated={false}/>
                  <div>
                    <div style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>What do you want to build?</div>
                    <div style={{ fontSize:13, color:C.muted, lineHeight:1.6 }}>Describe your idea — Krypton AI OS will plan, design and build it.</div>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7, justifyContent:"center", maxWidth:440 }}>
                    {["Build a restaurant website","Create a fitness dashboard","Make a Snake game","Design a portfolio","Build a SaaS landing page"].map(s => (
                      <button
                        key={s}
                        onClick={() => { setPrompt(s); }}
                        style={{
                          padding:"6px 14px",
                          background:"rgba(255,255,255,.03)",
                          border:`1px solid ${C.border}`,
                          borderRadius:20, color:C.muted,
                          fontSize:12, cursor:"pointer",
                          transition:"all .15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor=C.borderHi; e.currentTarget.style.color=C.text; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.muted; }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className="msg-in">
                  {msg.role === "user" ? (
                    <UserBubble msg={msg}/>
                  ) : msg.type === "thinking" ? (
                    <ThinkingBubble phases={msg.phases||[]} isActive={msg.isActive||false}/>
                  ) : (
                    <AiBubble msg={msg}/>
                  )}
                </div>
              ))}
              <div ref={chatEndRef}/>
            </div>

            {/* Input */}
            <div style={{
              padding:"10px 14px 12px",
              borderTop:`1px solid ${C.border}`,
              background:"rgba(8,8,8,.95)",
              flexShrink:0,
            }}>
              <div style={{
                background:C.card,
                border:`1px solid ${loading ? "rgba(255,215,0,.15)" : C.border}`,
                borderRadius:14,
                padding:"10px 12px",
                transition:"border-color .2s",
              }}>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key==="Enter"&&!e.shiftKey&&!loading) { e.preventDefault(); handleSend(); } }}
                  placeholder={loading ? "Agents working..." : result ? "Describe a change..." : "Describe what you want to build..."}
                  rows={2}
                  disabled={loading}
                  style={{
                    width:"100%", background:"none", border:"none",
                    color:loading?"#333":C.text, fontSize:14,
                    resize:"none", outline:"none", lineHeight:1.6,
                    maxHeight:120, overflowY:"auto",
                  }}
                />
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:7, paddingTop:7, borderTop:`1px solid rgba(255,255,255,.04)` }}>
                  <span style={{ fontSize:11, color:"#2a2a2a" }}>Claude · GPT-4o · Gemini cascade</span>
                  <div style={{ display:"flex", gap:7 }}>
                    <button
                      onClick={handleVoice}
                      style={{
                        width:33, height:33, borderRadius:"50%",
                        background:listening?"#FFD700":"rgba(255,255,255,.04)",
                        border:`1px solid ${listening?C.gold:C.border}`,
                        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="2" width="6" height="11" rx="3" fill={listening?"#080808":"#666"}/>
                        <path d="M5 11a7 7 0 0014 0" stroke={listening?"#080808":"#666"} strokeWidth="2" strokeLinecap="round"/>
                        <line x1="12" y1="18" x2="12" y2="22" stroke={listening?"#080808":"#666"} strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <button
                      className="send-btn"
                      onClick={handleSend}
                      disabled={!prompt.trim()||loading}
                      style={{
                        width:38, height:38, borderRadius:"50%",
                        background:(!loading&&prompt.trim())?"linear-gradient(135deg,#FFD700,#FF7A00)":"rgba(255,255,255,.06)",
                        border:"none",
                        cursor:(!loading&&prompt.trim())?"pointer":"not-allowed",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        transition:"all .2s",
                      }}
                    >
                      {loading
                        ? <div style={{ width:14,height:14,borderRadius:"50%",border:"2px solid rgba(5,5,5,.3)",borderTopColor:"#050505",animation:"spin .7s linear infinite" }}/>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke={prompt.trim()?"#050505":"#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── PANEL 3: PREVIEW + DEPLOY + HISTORY ── */}
          <div style={{
            flex:1,
            display:isMobile?(activePanel==="preview"?"flex":"none"):"flex",
            flexDirection:"column",
            overflow:"hidden",
          }}>
            {/* Tab bar */}
            <div style={{
              display:"flex", gap:4, padding:"6px 12px",
              borderBottom:`1px solid ${C.border}`,
              background:C.surface,
              alignItems:"center", flexShrink:0,
            }}>
              {([
                { id:"preview", label:"✨ Preview" },
                { id:"deploy",  label:"🚀 Deploy"  },
                { id:"history", label:"⏱ History" },
              ] as const).map(t => (
                <button
                  key={t.id}
                  className="tab-btn"
                  onClick={() => setRightTab(t.id)}
                  style={{
                    padding:"5px 14px", borderRadius:8,
                    border:rightTab===t.id?`1px solid rgba(255,215,0,.25)`:"1px solid transparent",
                    background:rightTab===t.id?"rgba(255,215,0,.08)":"transparent",
                    color:rightTab===t.id?C.gold:C.muted,
                    fontSize:12, fontWeight:rightTab===t.id?700:400,
                    cursor:"pointer", transition:"all .15s",
                  }}
                >
                  {t.label}
                </button>
              ))}

              {/* Device modes (preview only) */}
              {rightTab==="preview" && result && (
                <>
                  <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
                    {([
                      { id:"desktop", icon:"🖥" },
                      { id:"tablet",  icon:"📱" },
                      { id:"mobile",  icon:"📲" },
                    ] as const).map(d => (
                      <button
                        key={d.id}
                        onClick={() => setDevice(d.id)}
                        style={{
                          width:28, height:28, borderRadius:7,
                          border:device===d.id?`1px solid rgba(255,215,0,.25)`:`1px solid ${C.border}`,
                          background:device===d.id?"rgba(255,215,0,.08)":"none",
                          color:device===d.id?C.gold:C.muted,
                          fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                        }}
                      >
                        {d.icon}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      if (!result) return;
                      const b = new Blob([result], { type:"text/html" });
                      window.open(URL.createObjectURL(b), "_blank");
                    }}
                    style={{
                      padding:"4px 10px", borderRadius:7,
                      border:`1px solid ${C.border}`,
                      background:"none", color:C.muted,
                      fontSize:11, cursor:"pointer",
                    }}
                  >
                    ↗
                  </button>
                </>
              )}

              {result && <div style={{ marginLeft:rightTab==="preview"?"0":"auto", display:"flex", alignItems:"center", gap:4, fontSize:10, color:C.green }}><div style={{ width:5,height:5,borderRadius:"50%",background:C.green }}/>Live</div>}
            </div>

            {/* Preview */}
            {rightTab==="preview" && (
              <div style={{
                flex:1, display:"flex", alignItems:device==="desktop"?"stretch":"flex-start",
                justifyContent:"center", overflow:"auto",
                background:result?(device!=="desktop"?"#1a1a1a":"#fff"):"#080808",
                padding:result&&device!=="desktop"?"20px":"0",
              }}>
                {result ? (
                  <iframe
                    key={`${result.length}-${device}`}
                    srcDoc={result}
                    style={{
                      border:"none",
                      width:device==="desktop"?"100%":device==="tablet"?"768px":"375px",
                      height:device==="desktop"?"100%":"auto",
                      minHeight:device==="desktop"?"100%":"600px",
                      display:"block",
                      opacity:1,
                      background:"#fff",
                      boxShadow:device!=="desktop"?"0 8px 48px rgba(0,0,0,.8)":"none",
                      transition:"width .3s ease",
                    }}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                    title="Live Preview"
                  />
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, color:"#222", height:"100%", textAlign:"center", padding:24 }}>
                    <div style={{ fontSize:48, opacity:.2 }}>✨</div>
                    <div style={{ fontSize:14, color:"#444" }}>Preview will appear here</div>
                    <div style={{ fontSize:12, color:"#333" }}>Generate a project to see it live</div>
                  </div>
                )}
              </div>
            )}

            {/* Deploy */}
            {rightTab==="deploy" && (
              <div style={{ flex:1, overflowY:"auto" }}>
                <DeployPanel html={result} projectName={projectName} projectId={projectId}/>
              </div>
            )}

            {/* Version History */}
            {rightTab==="history" && (
              <div style={{ flex:1, overflowY:"auto", padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:14, color:C.text }}>⏱ Version History</div>
                {versions.length === 0 ? (
                  <div style={{ textAlign:"center", padding:40, color:C.muted, fontSize:13 }}>
                    <div style={{ fontSize:28, marginBottom:10, opacity:.3 }}>📭</div>
                    No versions saved yet
                  </div>
                ) : (
                  versions.map((v, i) => (
                    <div key={v.id||i} style={{
                      background:C.card,
                      border:`1px solid ${C.border}`,
                      borderRadius:10, padding:"12px 14px",
                      marginBottom:8, display:"flex",
                      alignItems:"center", gap:12,
                    }}>
                      <div style={{
                        width:32, height:32, borderRadius:8,
                        background:"rgba(255,215,0,.08)",
                        display:"flex", alignItems:"center",
                        justifyContent:"center", fontSize:11,
                        fontWeight:800, color:C.gold, flexShrink:0,
                      }}>v{v.version_number}</div>
                      <div style={{ flex:1, overflow:"hidden" }}>
                        <div style={{ fontSize:13, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.message}</div>
                        <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
                          {new Date(v.created_at).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => restoreVersion(v)}
                        style={{
                          padding:"5px 12px",
                          background:"rgba(255,215,0,.08)",
                          border:`1px solid rgba(255,215,0,.2)`,
                          borderRadius:7, color:C.gold,
                          fontSize:11, fontWeight:600,
                          cursor:"pointer",
                        }}
                      >
                        ↩ Restore
                      </button>
                    </div>
                  ))
                )}
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
    <Suspense fallback={
      <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#080808" }}>
        <div style={{ width:32, height:32, borderRadius:"50%", border:"3px solid rgba(255,215,0,.15)", borderTopColor:"#FFD700", animation:"spin .8s linear infinite" }}/>
      </div>
    }>
      <CreatePageInner/>
    </Suspense>
  );
}
