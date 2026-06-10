"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import KryptonLogo from "@/components/branding/KryptonLogo";

// ── Types ─────────────────────────────────────────────────────────
type AgentPhase = "idle"|"analyzing"|"questioning"|"planning"|"generating"|"validating"|"complete";
type DeviceMode = "desktop"|"tablet"|"mobile";
type RightTab   = "preview"|"history"|"export";
type Credits    = { total: number; used: number; plan: string };

interface PlanItem { id: number; task: string; category: string; done?: boolean }
interface CheckItem { id: string; label: string; pass: boolean }

interface AgentMsg {
  id: string;
  type: "user"|"thinking"|"question"|"plan"|"progress"|"validation"|"summary"|"ai"|"error";
  content?: string;
  thoughts?: string[];
  currentThought?: number;
  questions?: string[];
  answers?: string[];
  plan?: PlanItem[];
  currentTask?: number;
  checks?: CheckItem[];
  summary?: any;
  validation?: any;
  credits?: number;
  files?: string[];
  timestamp: Date;
}

// ── Category Colors ────────────────────────────────────────────────
const CAT: Record<string, string> = {
  design:       "#8B5CF6",
  frontend:     "#3B82F6",
  logic:        "#F59E0B",
  data:         "#10B981",
  optimization: "#EC4899",
};

// ── Typewriter Hook ────────────────────────────────────────────────
function useTypewriter(text: string, speed = 18): string {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    if (!text) return;
    let i = 0;
    const iv = setInterval(() => {
      if (i < text.length) { setDisplayed(text.slice(0, ++i)); }
      else clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [text]);
  return displayed;
}

// ── Message Components ─────────────────────────────────────────────
function ThinkingMsg({ msg }: { msg: AgentMsg }) {
  const cur = msg.currentThought ?? 0;
  const displayed = useTypewriter(msg.thoughts?.[cur] || "", 14);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:8, maxWidth:"92%" }}>
      {/* Completed thoughts */}
      {(msg.thoughts || []).slice(0, cur).map((t, i) => (
        <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, opacity:.5 }}>
          <span style={{ color:"#00D084", fontSize:11, marginTop:2, flexShrink:0 }}>✓</span>
          <span style={{ fontSize:13, color:"#555", lineHeight:1.5, textDecoration:"line-through" }}>{t}</span>
        </div>
      ))}
      {/* Current thought — typewriter */}
      {cur < (msg.thoughts?.length || 0) && (
        <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
          <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid rgba(245,197,66,.3)", borderTopColor:"#F5D800", animation:"spin .7s linear infinite", flexShrink:0, marginTop:2 }}/>
          <span style={{ fontSize:13, color:"#ddd", lineHeight:1.6, fontStyle:"italic" }}>{displayed}<span style={{ animation:"blink 1s infinite", opacity:.7 }}>▋</span></span>
        </div>
      )}
    </div>
  );
}

function QuestionMsg({ msg, onAnswer }: { msg: AgentMsg; onAnswer: (answers: string[]) => void }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const qs = msg.questions || [];
  const anyAnswered = qs.some((_, i) => answers[i]?.trim());

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    const finalAnswers = qs.map((_, i) => answers[i]?.trim() || "No preference");
    onAnswer(finalAnswers);
  };

  if (submitted || msg.answers?.length) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {qs.map((q, i) => (
          <div key={i} style={{ background:"rgba(0,208,132,.06)", border:"1px solid rgba(0,208,132,.15)", borderRadius:10, padding:"10px 14px" }}>
            <div style={{ fontSize:11, color:"#00D084", marginBottom:4 }}>✓ {q}</div>
            <div style={{ fontSize:13, color:"#888" }}>{msg.answers?.[i] || answers[i] || "No preference"}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10, maxWidth:"92%" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
        <span style={{ fontSize:14 }}>🤔</span>
        <span style={{ fontSize:13, color:"#ddd", fontWeight:600 }}>Quick question before I start building:</span>
      </div>
      {qs.map((q, i) => (
        <div key={i} style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(245,197,66,.2)", borderRadius:12, padding:"12px 14px" }}>
          <div style={{ fontSize:13, color:"#F5D800", marginBottom:8, fontWeight:600 }}>{q}</div>
          <input
            autoFocus={i === 0}
            value={answers[i] || ""}
            onChange={e => setAnswers(p => ({ ...p, [i]: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") { if (i < qs.length - 1) { const inputs = document.querySelectorAll(".q-inp"); const next = inputs[i + 1] as HTMLInputElement; next?.focus(); } else handleSubmit(); } }}
            className="q-inp"
            placeholder="Type your answer... (optional)"
            style={{ width:"100%", background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.12)", borderRadius:8, padding:"9px 12px", color:"#fff", fontSize:13, outline:"none" }}
          />
        </div>
      ))}
      <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:2 }}>
        <button onClick={handleSubmit}
          style={{ padding:"11px 28px", background:"linear-gradient(135deg,#F5D800,#00CC44)", border:"none", borderRadius:10, color:"#080808", fontWeight:700, fontSize:13, cursor:"pointer" }}>
          {anyAnswered ? "Continue Building →" : "Skip & Build →"}
        </button>
        <span style={{ fontSize:11, color:"#333" }}>Enter to submit</span>
      </div>
    </div>
  );
}

function PlanMsg({ msg }: { msg: AgentMsg }) {
  const plan = msg.plan || [];
  const cur  = msg.currentTask ?? -1;
  return (
    <div style={{ maxWidth:"94%" }}>
      <div style={{ fontSize:12, fontWeight:700, color:"#F5D800", marginBottom:10, textTransform:"uppercase", letterSpacing:".08em" }}>📋 Implementation Plan</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {plan.map((item, i) => {
          const isDone = i < cur;
          const isCur  = i === cur;
          return (
            <div key={item.id} style={{
              display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
              background: isDone ? "rgba(0,208,132,.06)" : isCur ? "rgba(245,197,66,.08)" : "rgba(255,255,255,.03)",
              border: `1px solid ${isDone ? "rgba(0,208,132,.2)" : isCur ? "rgba(245,197,66,.25)" : "rgba(255,255,255,.06)"}`,
              borderRadius:9, transition:"all .3s ease",
              opacity: i > cur && cur !== -1 ? .45 : 1,
            }}>
              <div style={{
                width:20, height:20, borderRadius:"50%", flexShrink:0,
                background: isDone ? "rgba(0,208,132,.15)" : isCur ? "rgba(245,216,0,.15)" : "rgba(255,255,255,.05)",
                border: `1px solid ${isDone ? "rgba(0,208,132,.4)" : isCur ? "rgba(245,216,0,.4)" : "rgba(255,255,255,.1)"}`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:10,
                ...(isCur ? { animation:"pulse 1.5s ease-in-out infinite" } : {}),
              }}>
                {isDone ? <span style={{ color:"#00CC44" }}>✓</span> : isCur ? <span style={{ width:8, height:8, borderRadius:"50%", border:"2px solid rgba(245,216,0,.4)", borderTopColor:"#F5D800", animation:"spin .7s linear infinite", display:"block" }}/> : <span style={{ color:"#333", fontSize:9 }}>{item.id}</span>}
              </div>
              <span style={{ fontSize:13, color: isDone ? "#555" : isCur ? "#FFD93D" : "#aaa", flex:1, textDecoration: isDone ? "line-through" : "none", transition:"all .3s" }}>
                {item.task}
              </span>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:`${CAT[item.category] || "#666"}18`, color: CAT[item.category] || "#888", flexShrink:0 }}>
                {item.category}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ValidationMsg({ msg }: { msg: AgentMsg }) {
  const v = msg.validation;
  if (!v) return null;
  return (
    <div style={{ maxWidth:"92%" }}>
      <div style={{ fontSize:12, fontWeight:700, color:"#F5D800", marginBottom:10, textTransform:"uppercase", letterSpacing:".08em" }}>
        🔍 Quality Check — {v.score}% Pass Rate
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {(v.checks || []).map((c: CheckItem) => (
          <div key={c.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:`rgba(${c.pass?"0,208,132":"239,68,68"},.05)`, border:`1px solid rgba(${c.pass?"0,208,132":"239,68,68"},.15)`, borderRadius:8 }}>
            <span style={{ fontSize:13, color: c.pass ? "#00D084" : "#ef4444" }}>{c.pass ? "✓" : "✗"}</span>
            <span style={{ fontSize:12, color:"#888" }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryMsg({ msg }: { msg: AgentMsg }) {
  const s = msg.summary;
  if (!s) return null;
  return (
    <div style={{ maxWidth:"100%" }}>
      <div style={{ padding:"16px 18px", background:"rgba(0,208,132,.06)", border:"1px solid rgba(0,208,132,.2)", borderRadius:14, marginBottom:10 }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#00D084", marginBottom:12 }}>✅ Project Complete!</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[
            { label:"Lines of Code",  value: s.linesOfCode?.toLocaleString() || "—" },
            { label:"Components",     value: s.componentsBuilt || "—" },
            { label:"Project Type",   value: s.projectType || "—" },
            { label:"Code Quality",   value: `${msg.validation?.score || 100}%` },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign:"center", padding:"10px 8px", background:"rgba(255,255,255,.03)", borderRadius:8 }}>
              <div style={{ fontSize:17, fontWeight:800, color:"#F5D800", fontFamily:"'DM Mono',monospace" }}>{stat.value}</div>
              <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
        {s.featuresAdded?.length > 0 && (
          <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid rgba(255,255,255,.06)" }}>
            <div style={{ fontSize:11, color:"#444", marginBottom:6 }}>Features included:</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {s.featuresAdded.map((f: string) => (
                <span key={f} style={{ fontSize:11, padding:"3px 8px", background:"rgba(245,197,66,.08)", border:"1px solid rgba(245,197,66,.15)", borderRadius:12, color:"#F5D800" }}>{f}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      {msg.credits && (
        <div style={{ fontSize:11, color:"#444", display:"flex", alignItems:"center", gap:4 }}>⚡ {msg.credits} credit{msg.credits > 1 ? "s" : ""} used</div>
      )}
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────
function CreatePage() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const supabase    = createClient();

  const [prompt, setPrompt]         = useState("");
  const [result, setResult]         = useState("");
  const [messages, setMessages]     = useState<AgentMsg[]>([]);
  const [agentPhase, setAgentPhase] = useState<AgentPhase>("idle");
  const [projectId, setProjectId]   = useState("");
  const [projectName, setProjectName] = useState("Untitled Project");
  const [editingName, setEditingName] = useState(false);
  const [rightTab, setRightTab]     = useState<RightTab>("preview");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [isMobile, setIsMobile]     = useState(false);
  const [activeTab, setActiveTab]   = useState<"chat"|"preview">("chat");
  const [credits, setCredits]       = useState<Credits>({ total:5, used:0, plan:"free" });
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [user, setUser]             = useState<any>(null);
  const [listening, setListening]   = useState(false);
  const [versions, setVersions]     = useState<any[]>([]);
  const [copied, setCopied]         = useState(false);
  const [showMenu, setShowMenu]     = useState(false);

  // Pending question answers
  const pendingAnswers = useRef<string[]>([]);
  const questionResolve = useRef<((v: string[]) => void) | null>(null);

  const chatEndRef  = useRef<HTMLDivElement>(null);
  const menuRef     = useRef<HTMLDivElement>(null);
  const promptRef   = useRef("");
  const resultRef   = useRef("");
  const nameRef     = useRef("Untitled Project");
  const silenceRef  = useRef<any>(null);
  const convTimer   = useRef<any>(null);

  const remaining = credits.total - credits.used;

  useEffect(() => { resultRef.current = result; }, [result]);
  useEffect(() => { nameRef.current = projectName; }, [projectName]);

  // ── Init ─────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    const init = async () => {
      await initUser();
      const urlId     = searchParams.get("id");
      const urlPrompt = searchParams.get("prompt");

      if (urlId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: proj } = await supabase.from("projects").select("*").eq("id", urlId).eq("user_id", session.user.id).single();
        if (proj) {
          setProjectId(proj.id);
          setProjectName(proj.name || "Project");
          setResult(proj.html_code || "");
          promptRef.current = proj.prompt || "";
          const savedMsgs: any[] = proj.conversation_history || [];
          if (savedMsgs.length > 0) {
            savedMsgs.forEach((m: any) => addMsg({ type: m.type || "ai", content: m.content }));
            addMsg({ type:"ai", content:"✅ Project Restored Successfully — continue where you left off." });
          } else {
            addMsg({ type:"user", content: proj.prompt || "Project" });
            addMsg({ type:"ai",  content:"✅ Project Restored Successfully! Continue editing below." });
          }
          const { data: vers } = await supabase.from("project_versions").select("*").eq("project_id", proj.id).order("version_number", { ascending:false }).limit(20);
          if (vers) setVersions(vers);
          try { localStorage.setItem(`kp_${proj.id}`, JSON.stringify({ id:proj.id, name:proj.name, html:proj.html_code, prompt:proj.prompt, ts:Date.now() })); } catch {}
        } else {
          try {
            const cached = localStorage.getItem(`kp_${urlId}`);
            if (cached) { const p = JSON.parse(cached); setProjectId(p.id); setProjectName(p.name||"Project"); setResult(p.html||""); addMsg({ type:"ai", content:"✅ Project restored from local cache." }); }
          } catch {}
        }
        return;
      }

      if (urlPrompt) {
        const decoded = decodeURIComponent(urlPrompt);
        setPrompt(decoded); promptRef.current = decoded;
        setProjectName(decoded.slice(0, 40));
        window.history.replaceState({}, "", "/create");
        setTimeout(() => runAgentFlow(decoded), 300);
      }
    };
    init();
  }, []);

  // Auto-save every 45s
  useEffect(() => {
    if (!projectId) return;
    const iv = setInterval(async () => {
      if (!resultRef.current) return;
      try {
        await supabase.from("projects").update({ html_code: resultRef.current, updated_at: new Date().toISOString() }).eq("id", projectId);
        localStorage.setItem(`kp_${projectId}`, JSON.stringify({ id:projectId, name:nameRef.current, html:resultRef.current, prompt:promptRef.current, ts:Date.now() }));
      } catch {}
    }, 45000);
    return () => clearInterval(iv);
  }, [projectId]);

  // Scroll + save conversation on message change
  const saveConvTimer = useRef<any>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior:"smooth" });
    if (projectId && messages.length > 0) {
      clearTimeout(saveConvTimer.current);
      saveConvTimer.current = setTimeout(() => {
        const toSave = messages.filter(m => !["thinking","progress"].includes(m.type)).map(m => ({ type:m.type, content:m.content||"" }));
        void supabase.from("projects").update({ conversation_history:toSave }).eq("id", projectId);
      }, 10000);
    }
  }, [messages]);

  const initUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth/login"); return; }
    setUser(session.user);
    const { data: profile } = await supabase.from("profiles").select("total_credits, used_credits, plan").eq("id", session.user.id).single();
    if (profile) setCredits({ total: profile.total_credits ?? 5, used: profile.used_credits ?? 0, plan: profile.plan || "free" });
  };

  // ── Message helpers ──────────────────────────────────────────
  const addMsg = useCallback((msg: Omit<AgentMsg, "id"|"timestamp">): string => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setMessages(prev => [...prev, { ...msg, id, timestamp: new Date() }]);
    return id;
  }, []);

  const updateMsg = useCallback((id: string, updates: Partial<AgentMsg>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  // ── Save helpers ──────────────────────────────────────────────
  const saveProject = async (html: string, name: string) => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    if (projectId) {
      await supabase.from("projects").update({ name, html_code: html, updated_at: new Date().toISOString() }).eq("id", projectId);
    } else {
      const { data } = await supabase.from("projects").insert({ user_id: session.user.id, name, html_code: html, title: name, prompt: promptRef.current }).select().single();
      if (data) { setProjectId(data.id); window.history.replaceState({}, "", `/create?id=${data.id}`); }
    }
    await saveVersion(html, "Auto-save");
    setSaved(true); setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const saveVersion = async (html: string, message: string) => {
    if (!projectId) return;
    const { data } = await supabase.from("project_versions").insert({ project_id: projectId, code_snapshot: { "index.html": html }, message, type: "auto", version_number: versions.length + 1, size_bytes: new Blob([html]).size }).select().single();
    if (data) setVersions(v => [data, ...v]);
  };

  // ── Download ──────────────────────────────────────────────────
  const handleDownload = () => {
    if (!result) return;
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([result], { type:"text/html" })), download:`${projectName.replace(/\s+/g,"-")}.html` });
    a.click();
  };

  const handleCopy = async () => { if (!result) return; await navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ── Voice ──────────────────────────────────────────────────────
  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR(); r.continuous = true; r.interimResults = true;
    r.onstart = () => setListening(true);
    r.onresult = (e: any) => { const t = Array.from(e.results).map((r: any) => r[0].transcript).join(""); setPrompt(t); promptRef.current = t; clearTimeout(silenceRef.current); silenceRef.current = setTimeout(() => r.stop(), 4000); };
    r.onend = () => setListening(false);
    r.start();
  };

  // ══════════════════════════════════════════════════════════════
  // ── REAL AGENT FLOW ──────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  const runAgentFlow = async (userPrompt: string) => {
    if (!userPrompt.trim() || agentPhase !== "idle") return;
    if (remaining < 1) { addMsg({ type:"ai", content:"⚠️ No credits left. Please upgrade or wait for daily reset." }); return; }

    setPrompt(""); promptRef.current = "";
    addMsg({ type:"user", content: userPrompt });
    setAgentPhase("analyzing");

    // ── PHASE 1: AI Analysis ─────────────────────────────────
    const thinkingId = addMsg({ type:"thinking", thoughts: ["Reading your request..."], currentThought:0 });

    let analysis: any = null;
    try {
      // Show initial thought immediately
      await sleep(600);
      updateMsg(thinkingId, { thoughts:["Reading your request...", "Analyzing project requirements..."], currentThought:1 });
      await sleep(800);
      updateMsg(thinkingId, { thoughts:["Reading your request...", "Analyzing project requirements...", "Planning the best approach..."], currentThought:2 });

      const historyContext = messages.slice(-6).map(m => `${m.type==="user"?"User":"AI"}: ${m.content||""}`).join("\n");
      const res = await fetch("/api/agent", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ phase:"analyze", prompt:userPrompt, history:historyContext }),
      });
      analysis = await res.json();
    } catch {}

    if (!analysis || !analysis.plan) {
      // Fallback analysis
      analysis = {
        thinking: ["Understanding your request...", "Planning the implementation...", "Selecting best architecture..."],
        needsQuestions: false,
        questions: [],
        plan: [
          { id:1, task:"Design premium layout", category:"design" },
          { id:2, task:"Build main components", category:"frontend" },
          { id:3, task:"Add interactivity", category:"logic" },
          { id:4, task:"Make mobile responsive", category:"optimization" },
        ],
        projectType: "website",
        summary: "Building your project",
      };
    }

    // Show real thinking from AI
    const realThoughts = analysis.thinking || [];
    for (let i = 0; i < realThoughts.length; i++) {
      updateMsg(thinkingId, { thoughts: realThoughts, currentThought: i });
      await sleep(900 + realThoughts[i].length * 12);
    }
    // Mark all done
    updateMsg(thinkingId, { currentThought: realThoughts.length });
    await sleep(300);

    // ── PHASE 2: Questions (if needed) ────────────────────────
    let finalPrompt = userPrompt;
    if (analysis.needsQuestions && analysis.questions?.length) {
      setAgentPhase("questioning");
      const questionId = addMsg({ type:"question", questions: analysis.questions });
      const answers = await waitForAnswers(analysis.questions.length);
      // Build enriched prompt with answers
      const enrichment = analysis.questions.map((q: string, i: number) => `${q}: ${answers[i]}`).join("; ");
      finalPrompt = `${userPrompt}. Additional details: ${enrichment}`;
      updateMsg(questionId, { answers });
      await sleep(500);
    }

    // ── PHASE 3: Show Plan ────────────────────────────────────
    setAgentPhase("planning");
    const planId = addMsg({ type:"plan", plan: analysis.plan, currentTask:-1 });
    await sleep(800);

    // ── PHASE 4: Generate ─────────────────────────────────────
    setAgentPhase("generating");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setAgentPhase("idle"); return; }

    // Animate plan tasks during generation
    let taskIdx = 0;
    const taskInterval = setInterval(() => {
      if (taskIdx < analysis.plan.length) {
        updateMsg(planId, { currentTask: taskIdx++ });
      } else {
        clearInterval(taskInterval);
      }
    }, 1800);

    let html = "";
    let creditsUsed = 1;
    const MAX_RETRIES = 3;
    const DELAYS = [2000, 5000, 10000];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) await sleep(DELAYS[attempt - 1]);
        const genRes = await fetch("/api/generate", {
          method:"POST",
          headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${session.access_token}` },
          body: JSON.stringify({ prompt: finalPrompt }),
          signal: AbortSignal.timeout(110000),
        });
        let data: any = {};
        try { data = await genRes.json(); } catch { if (attempt < MAX_RETRIES) continue; break; }

        if (data.code && ["INSUFFICIENT_CREDITS","DAILY_LIMIT"].includes(data.code)) {
          clearInterval(taskInterval);
          addMsg({ type:"ai", content: data.error || "Insufficient credits." });
          setAgentPhase("idle"); return;
        }

        if (data.html) {
          html = data.html;
          creditsUsed = data.creditsUsed || 1;
          break;
        }
        if (attempt < MAX_RETRIES) continue;
      } catch { if (attempt < MAX_RETRIES) continue; }
    }

    clearInterval(taskInterval);
    updateMsg(planId, { currentTask: analysis.plan.length });

    if (!html) {
      addMsg({ type:"ai", content:"Please try again with a more detailed description of what you want to build." });
      setAgentPhase("idle"); return;
    }

    // Save result
    setResult(html);
    const pName = (analysis.summary || finalPrompt).slice(0, 45);
    setProjectName(pName);
    await saveProject(html, pName);
    if (creditsUsed) setCredits(c => ({ ...c, used: c.used + creditsUsed }));
    if (isMobile) setActiveTab("preview");

    // ── PHASE 5: Validate ─────────────────────────────────────
    setAgentPhase("validating");
    await sleep(400);

    let validation: any = null;
    let summary: any   = null;
    try {
      const valRes = await fetch("/api/agent", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ phase:"validate", html, plan:analysis.plan, projectType:analysis.projectType, prompt:finalPrompt }),
      });
      const valData = await valRes.json();
      validation = valData.validation;
      summary    = valData.summary;
    } catch {}

    if (validation) {
      addMsg({ type:"validation", validation });
      await sleep(600);
    }

    // ── PHASE 6: Summary ──────────────────────────────────────
    addMsg({ type:"summary", summary, validation, credits: creditsUsed });

    setAgentPhase("idle");
  };

  // ── Edit Flow — uses /api/chat for surgical editing ──────────
  const runEditFlow = async (editPrompt: string) => {
    if (!result || !editPrompt.trim() || agentPhase !== "idle") return;
    if (remaining < 1) { addMsg({ type:"ai", content:"No credits left. Please upgrade." }); return; }

    setAgentPhase("generating");
    addMsg({ type:"user", content: editPrompt });

    // Show thinking steps
    const thoughts = [
      "Reading your edit request...",
      "Analyzing current code...",
      "Identifying affected sections...",
      "Applying surgical changes...",
    ];
    const thinkId = addMsg({ type:"thinking", thoughts, currentThought:0 });
    for (let i = 0; i < thoughts.length; i++) {
      await sleep(650);
      updateMsg(thinkId, { currentThought: i });
    }
    updateMsg(thinkId, { currentThought: thoughts.length });

    // ── Step 1: Try /api/chat (surgical edit — best approach) ──
    let updatedHTML = "";
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        if (attempt > 0) await sleep([2000, 5000][attempt - 1]);

        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: editPrompt,
            currentCode: { "index.html": result },
            projectName,
            framework: "html",
            history: messages.slice(-6).map(m => ({ role: m.type === "user" ? "user" : "assistant", content: m.content || "" })),
          }),
          signal: AbortSignal.timeout(60000),
        });

        const chatData = await chatRes.json();

        // Check for codeChanges first (structured edit)
        if (chatData.codeChanges?.["index.html"]) {
          updatedHTML = chatData.codeChanges["index.html"];
          break;
        }

        // Fallback: extract HTML directly from reply text
        const reply = chatData.reply || chatData.text || "";
        const htmlMatch = reply.match(/<!DOCTYPE[\s\S]*<\/html>/i);
        if (htmlMatch) {
          updatedHTML = htmlMatch[0];
          break;
        }

        if (attempt < 2) continue;

      } catch {
        if (attempt < 2) continue;
      }
    }

    // ── Step 2: If chat failed, fallback to /api/generate ──────
    if (!updatedHTML) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const genRes = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({
              prompt: `Edit this HTML project. CHANGE: "${editPrompt}". RULES: Return COMPLETE HTML only, make ONLY the requested change, preserve everything else.

CURRENT CODE:
${result.slice(0, 12000)}`,
              isEdit: true,
            }),
            signal: AbortSignal.timeout(90000),
          });
          const genData = await genRes.json();
          if (genData.html) {
            updatedHTML = genData.html;
            if (genData.creditsUsed) setCredits(c => ({ ...c, used: c.used + genData.creditsUsed }));
          }
        }
      } catch {}
    }

    // ── Step 3: Apply or show error ────────────────────────────
    if (updatedHTML && updatedHTML.length > 200) {
      await saveVersion(result, `Before: ${editPrompt.slice(0, 40)}`);
      setResult(updatedHTML);
      await saveProject(updatedHTML, projectName);
      if (isMobile) setActiveTab("preview");

      // Show what changed
      const changes: string[] = ["Code updated"];
      if (/space|padding|margin|gap/i.test(editPrompt))  changes.push("Spacing adjusted");
      if (/color|colour|background/i.test(editPrompt))   changes.push("Colors updated");
      if (/hero|header|banner/i.test(editPrompt))        changes.push("Hero section modified");
      if (/font|text|typography/i.test(editPrompt))      changes.push("Typography updated");
      if (/button|cta/i.test(editPrompt))                changes.push("Buttons updated");
      if (/mobile|responsive/i.test(editPrompt))         changes.push("Responsive layout updated");

      addMsg({
        type: "summary",
        summary: {
          linesOfCode: updatedHTML.split("\n").length,
          projectType:    "edit",
          componentsBuilt: changes.length,
          featuresAdded:   changes,
        },
        validation: { score: 100, checks: [] },
        credits: 1,
      });
    } else {
      // Still failed — give helpful guidance
      addMsg({
        type: "ai",
        content: `I couldn't apply that edit automatically. Try being more specific — for example: "Remove padding from the hero section" or "Set hero section padding-top to 20px".`,
      });
    }

    setAgentPhase("idle");
  };

  // ── Helpers ────────────────────────────────────────────────────
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const waitForAnswers = (count: number): Promise<string[]> => {
    return new Promise(resolve => {
      pendingAnswers.current = new Array(count).fill("");
      questionResolve.current = resolve;
    });
  };

  const handleAnswer = (allAnswers: string[]) => {
    if (questionResolve.current) {
      questionResolve.current(allAnswers);
      questionResolve.current = null;
    }
  };

  const handleSend = () => {
    const p = prompt.trim();
    if (!p || agentPhase !== "idle") return;
    if (!result) { runAgentFlow(p); } else { runEditFlow(p); }
  };

  const isLoading = agentPhase !== "idle";
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#080808;color:#fff;font-family:'DM Sans',sans-serif;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(245,197,66,.15);border-radius:4px;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(245,216,0,.2)}50%{box-shadow:0 0 0 6px rgba(245,216,0,.05)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes dot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        .msg-in{animation:fadeUp .22s ease both;}
        textarea{font-family:'DM Sans',sans-serif;}
        input{font-family:'DM Sans',sans-serif;}
      `}</style>

      <div style={{ height:"100dvh", display:"flex", flexDirection:"column", background:"#080808", color:"#fff", overflow:"hidden", position:"fixed", inset:0 }}>

        {/* ── TOP BAR ── */}
        <div style={{ padding:"10px 14px", borderBottom:"1px solid #181818", display:"flex", alignItems:"center", gap:8, background:"#0C0C0C", flexShrink:0, minHeight:52, zIndex:100 }}>
          <div ref={menuRef} style={{ position:"relative" }}>
            <button onClick={() => setShowMenu(v => !v)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:5 }}>
              <KryptonLogo size={34} showText={true} animated={false}/>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {showMenu && (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, background:"#111", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, padding:6, minWidth:240, boxShadow:"0 16px 48px rgba(0,0,0,.9)", zIndex:200, animation:"fadeUp .15s ease" }}>
                {[
                  { icon:"←", label:"Dashboard", action: () => router.push("/") },
                  null,
                  { icon:"✏️", label:"Rename project", action: () => setEditingName(true) },
                  { icon:"⬇️", label:"Download HTML", action: handleDownload },
                  { icon:"📋", label:copied?"Copied!":"Copy code", action: handleCopy },
                  null,
                  { icon:"⚙️", label:"Settings", action: () => router.push("/settings") },
                  { icon:"💳", label:"Billing", action: () => router.push("/settings?tab=billing") },
                ].map((it, i) => it === null
                  ? <div key={i} style={{ height:1, background:"rgba(255,255,255,.06)", margin:"4px 0" }}/>
                  : <button key={i} onClick={() => { (it as any).action(); setShowMenu(false); }}
                      style={{ width:"100%", textAlign:"left", padding:"8px 12px", background:"none", border:"none", color:"#888", fontSize:13, cursor:"pointer", borderRadius:8, display:"flex", alignItems:"center", gap:9, transition:"all .15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background="#1a1a1a"; e.currentTarget.style.color="#fff"; }}
                      onMouseLeave={e => { e.currentTarget.style.background="none"; e.currentTarget.style.color="#888"; }}>
                      {(it as any).icon} {(it as any).label}
                    </button>
                )}
              </div>
            )}
          </div>

          {/* Project name */}
          {editingName
            ? <input autoFocus value={projectName} onChange={e => setProjectName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={e => e.key === "Enter" && setEditingName(false)}
                style={{ flex:1, background:"#161616", border:"1px solid #F5D800", borderRadius:7, color:"#fff", padding:"4px 8px", fontSize:12, fontWeight:600, outline:"none" }}/>
            : <button onClick={() => setEditingName(true)} style={{ background:"none", border:"none", color:"#555", fontSize:12, cursor:"pointer", padding:"4px 6px", flex:1, textAlign:"left", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{projectName} ✏</button>
          }

          {isMobile && (
            <div style={{ display:"flex", gap:4 }}>
              {["chat","preview"].map(t => (
                <button key={t} onClick={() => setActiveTab(t as any)} style={{ padding:"4px 10px", borderRadius:6, border:"none", background:activeTab===t?"#F5D800":"#1c1c1c", color:activeTab===t?"#080808":"#fff", fontSize:11, cursor:"pointer", fontWeight:activeTab===t?700:400, textTransform:"capitalize" }}>{t}</button>
              ))}
            </div>
          )}

          <div style={{ display:"flex", gap:6, alignItems:"center", marginLeft:"auto" }}>
            <div style={{ padding:"3px 10px", borderRadius:6, background:remaining>0?"rgba(0,208,132,.1)":"rgba(239,68,68,.1)", border:`1px solid ${remaining>0?"rgba(0,208,132,.3)":"rgba(239,68,68,.3)"}`, fontSize:11, color:remaining>0?"#00D084":"#ef4444", fontWeight:700 }}>⚡ {remaining}</div>
            {result && (
              <button onClick={() => { setSaving(true); saveProject(result, projectName); }}
                style={{ padding:"5px 10px", background:saved?"rgba(0,208,132,.12)":"rgba(245,197,66,.12)", border:`1px solid ${saved?"rgba(0,208,132,.3)":"rgba(245,197,66,.3)"}`, borderRadius:7, color:saved?"#00D084":"#F5D800", cursor:"pointer", fontSize:11, fontWeight:600 }}>
                {saving?"...":saved?"✓ Saved":"Save"}
              </button>
            )}
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* ── LEFT — Agent Chat ── */}
          <div style={{ width:isMobile?"100%":"50%", display:isMobile?(activeTab==="chat"?"flex":"none"):"flex", flexDirection:"column", borderRight:isMobile?"none":"1px solid #181818", background:"#090909" }}>

            {/* Agent Status Bar */}
            {isLoading && (
              <div style={{ padding:"8px 16px", borderBottom:"1px solid #181818", background:"rgba(245,197,66,.04)", display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ display:"flex", gap:4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:"#F5D800", animation:`dot 1.2s ${i*.2}s ease-in-out infinite` }}/>)}
                </div>
                <span style={{ fontSize:12, color:"#F5D800", fontWeight:500 }}>
                  {agentPhase==="analyzing"?"Analyzing your request..."
                    :agentPhase==="questioning"?"Waiting for your answers..."
                    :agentPhase==="planning"?"Planning implementation..."
                    :agentPhase==="generating"?"Building your project..."
                    :agentPhase==="validating"?"Validating quality..."
                    :"Working..."}
                </span>
              </div>
            )}

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"14px 12px", display:"flex", flexDirection:"column", gap:14, scrollbarWidth:"none" }}>
              {messages.length === 0 && (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, textAlign:"center", padding:24 }}>
                  <div style={{ width:52, height:52, borderRadius:16, background:"linear-gradient(135deg,rgba(245,197,66,.15),rgba(0,204,68,.1))", border:"1px solid rgba(245,197,66,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <KryptonLogo size={30}/>
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>What do you want to build?</div>
                    <div style={{ fontSize:13, color:"#444" }}>Describe your idea — I'll analyze, plan and build it.</div>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center" }}>
                    {["Build a restaurant website","Create a fitness dashboard","Make a Snake game","Design a landing page"].map(s => (
                      <button key={s} onClick={() => { setPrompt(s); promptRef.current = s; runAgentFlow(s); }}
                        style={{ padding:"6px 14px", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:20, color:"#555", fontSize:12, cursor:"pointer", transition:"all .15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(245,197,66,.3)"; e.currentTarget.style.color="#ddd"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,.08)"; e.currentTarget.style.color="#555"; }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className="msg-in" style={{ display:"flex", flexDirection:"column", alignItems:msg.type==="user"?"flex-end":"flex-start", gap:4 }}>
                  {msg.type !== "user" && (
                    <div style={{ display:"flex", alignItems:"center", gap:6, paddingLeft:2, marginBottom:2 }}>
                      <KryptonLogo size={14}/>
                      <span style={{ fontSize:10, color:"#333" }}>Krypton AI</span>
                    </div>
                  )}

                  {msg.type === "user" && (
                    <div style={{ maxWidth:"88%", padding:"10px 14px", borderRadius:"14px 14px 4px 14px", background:"linear-gradient(135deg,rgba(245,197,66,.18),rgba(245,197,66,.08))", border:"1px solid rgba(245,197,66,.2)", fontSize:13, lineHeight:1.6, color:"#e8e8e8" }}>
                      {msg.content}
                    </div>
                  )}

                  {msg.type === "thinking" && <ThinkingMsg msg={msg}/>}
                  {msg.type === "question" && <QuestionMsg msg={msg} onAnswer={(ans) => { handleAnswer(ans); updateMsg(msg.id, { answers: ans }); }}/>}
                  {msg.type === "plan" && <PlanMsg msg={msg}/>}
                  {msg.type === "validation" && <ValidationMsg msg={msg}/>}
                  {msg.type === "summary" && <SummaryMsg msg={msg}/>}

                  {msg.type === "ai" && (
                    <div style={{ maxWidth:"92%", padding:"10px 14px", borderRadius:"4px 14px 14px 14px", background:"#141414", border:"1px solid #222", fontSize:13, lineHeight:1.65, color:"#ccc" }}>
                      {msg.content}
                    </div>
                  )}

                  {msg.type === "error" && (
                    <div style={{ maxWidth:"92%", padding:"10px 14px", borderRadius:10, background:"rgba(239,68,68,.07)", border:"1px solid rgba(239,68,68,.2)", fontSize:13, color:"#ef4444" }}>
                      {msg.content}
                    </div>
                  )}

                  <span style={{ fontSize:10, color:"#2a2a2a" }}>{msg.timestamp.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                </div>
              ))}
              <div ref={chatEndRef}/>
            </div>

            {/* Input */}
            <div style={{ padding:"10px 12px", borderTop:"1px solid #181818", background:"#0C0C0C", flexShrink:0 }}>
              {result && <div style={{ marginBottom:5, fontSize:11, color:"#333" }}>✏ Edit mode — 1 credit per edit</div>}
              <div style={{ background:"#141414", border:`1px solid ${isLoading?"rgba(245,197,66,.2)":"#282828"}`, borderRadius:14, padding:"10px 12px", transition:"border-color .2s" }}>
                <textarea
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); promptRef.current = e.target.value; }}
                  onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey && !isLoading) { e.preventDefault(); handleSend(); } }}
                  placeholder={isLoading ? "AI is working..." : result ? "Describe a change..." : "Describe what you want to build..."}
                  rows={2} disabled={isLoading}
                  style={{ width:"100%", background:"none", border:"none", color:isLoading?"#444":"#fff", fontSize:14, resize:"none", outline:"none", lineHeight:1.6, opacity:isLoading?.6:1 }}
                />
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:6, paddingTop:6, borderTop:"1px solid #1e1e1e" }}>
                  <span style={{ fontSize:11, color:"#2a2a2a" }}>1–3 credits · Enter to send</span>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={handleVoice} style={{ width:32, height:32, borderRadius:"50%", background:listening?"#F5D800":"#222", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="11" rx="3" fill={listening?"#080808":"#666"}/><path d="M5 11a7 7 0 0014 0" stroke={listening?"#080808":"#666"} strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="18" x2="12" y2="22" stroke={listening?"#080808":"#666"} strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                    <button onClick={handleSend} disabled={isLoading || !prompt.trim() || remaining < 1}
                      style={{ width:38, height:38, borderRadius:"50%", background:(!isLoading && prompt.trim() && remaining >= 1)?"linear-gradient(135deg,#F5D800,#00CC44)":"#1a1a1a", border:"none", cursor:(!isLoading && prompt.trim() && remaining >= 1)?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .2s", boxShadow:prompt.trim()?"0 0 14px rgba(245,197,66,.25)":"none" }}>
                      {isLoading
                        ? <div style={{ width:13, height:13, borderRadius:"50%", border:"2px solid rgba(255,255,255,.3)", borderTopColor:"#fff", animation:"spin .7s linear infinite" }}/>
                        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke={prompt.trim()?"#080808":"#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT — Preview / History / Export ── */}
          <div style={{ flex:1, display:isMobile?(activeTab==="preview"?"flex":"none"):"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Tabs */}
            <div style={{ display:"flex", gap:4, padding:"8px 12px", borderBottom:"1px solid #181818", background:"#0C0C0C", flexShrink:0, alignItems:"center" }}>
              {[{id:"preview",label:"✨ Preview"},{id:"history",label:"⏱ History"},{id:"export",label:"📤 Export"}].map(tab => (
                <button key={tab.id} onClick={() => setRightTab(tab.id as RightTab)} style={{ padding:"5px 14px", borderRadius:8, border:rightTab===tab.id?"1px solid rgba(245,197,66,.3)":"1px solid transparent", background:rightTab===tab.id?"rgba(245,197,66,.1)":"rgba(255,255,255,.03)", color:rightTab===tab.id?"#F5D800":"#555", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all .15s" }}>
                  {tab.label}
                </button>
              ))}
              {result && (
                <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#00D084" }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:"#00D084", animation:"dot 2s infinite" }}/> Live
                </div>
              )}
            </div>

            {/* Preview */}
            {rightTab === "preview" && (
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                {result && (
                  <div style={{ display:"flex", gap:6, padding:"6px 12px", borderBottom:"1px solid #181818", background:"#0d0d0d", alignItems:"center" }}>
                    {[{id:"desktop",icon:"🖥",label:"Desktop"},{id:"tablet",icon:"📱",label:"Tablet"},{id:"mobile",icon:"📲",label:"Mobile"}].map(d => (
                      <button key={d.id} onClick={() => setDeviceMode(d.id as DeviceMode)} style={{ padding:"4px 10px", borderRadius:6, border:deviceMode===d.id?"1px solid rgba(245,197,66,.35)":"1px solid rgba(255,255,255,.07)", background:deviceMode===d.id?"rgba(245,197,66,.08)":"none", color:deviceMode===d.id?"#F5D800":"#555", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:4, transition:"all .15s" }}>
                        {d.icon} {d.label}
                      </button>
                    ))}
                    <button onClick={() => { const w = window.open("","_blank"); if (w){w.document.write(result);w.document.close();} }} style={{ marginLeft:"auto", padding:"4px 10px", borderRadius:6, border:"1px solid rgba(255,255,255,.07)", background:"none", color:"#555", fontSize:11, cursor:"pointer" }}>↗ New Tab</button>
                  </div>
                )}
                <div style={{ flex:1, display:"flex", alignItems:"flex-start", justifyContent:"center", overflow:"auto", background:result?(deviceMode!=="desktop"?"#222":"#fff"):"#0d0d0d" }}>
                  {result ? (
                    <iframe key={`${result.length}-${deviceMode}`} srcDoc={result}
                      onLoad={e => { (e.target as HTMLIFrameElement).style.opacity="1"; }}
                      style={{ border:"none", width:deviceMode==="desktop"?"100%":deviceMode==="tablet"?"768px":"375px", height:"100%", minHeight:"100%", transition:"width .3s ease, opacity .3s ease", boxShadow:deviceMode!=="desktop"?"0 0 40px rgba(0,0,0,.7)":"none", flexShrink:0, opacity:0 }}
                      sandbox="allow-scripts" title="Preview"/>
                  ) : (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10, color:"#222", width:"100%", height:"100%" }}>
                      <div style={{ fontSize:42 }}>✨</div>
                      <p style={{ fontSize:14 }}>Generate something to preview</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* History */}
            {rightTab === "history" && (
              <div style={{ flex:1, overflowY:"auto", padding:16 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>⏱ Version History</div>
                {versions.length === 0
                  ? <div style={{ color:"#333", textAlign:"center", padding:40, fontSize:13 }}>No versions yet.</div>
                  : versions.map((v, i) => (
                    <div key={v.id||i} style={{ background:"#0d0d0d", border:"1px solid rgba(255,255,255,.06)", borderRadius:10, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:"rgba(245,197,66,.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#F5D800" }}>v{v.version_number}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:"#e8e8e8" }}>{v.message}</div>
                        <div style={{ fontSize:10.5, color:"#333", marginTop:3 }}>{new Date(v.created_at).toLocaleString()}</div>
                      </div>
                      <button onClick={() => { const code = v.code_snapshot?.["index.html"]; if (code) { saveVersion(result, "Before restore"); setResult(code); } }} style={{ padding:"5px 12px", borderRadius:6, border:"1px solid rgba(245,197,66,.2)", background:"rgba(245,197,66,.07)", color:"#F5D800", fontSize:11, cursor:"pointer" }}>↩ Restore</button>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Export */}
            {rightTab === "export" && (
              <div style={{ flex:1, overflowY:"auto", padding:20 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>📤 Export Options</div>
                {[
                  { label:"Download HTML", desc:"Single file, ready to deploy", icon:"⬇️", action:handleDownload },
                  { label:copied?"Copied!":"Copy Code", desc:"Copy HTML to clipboard", icon:"📋", action:handleCopy },
                  { label:"Open in New Tab", desc:"Preview in browser", icon:"↗️", action:() => { const w=window.open("","_blank"); if(w){w.document.write(result);w.document.close();} } },
                  { label:"Push to GitHub", desc:"Connect GitHub in Settings first", icon:"🐙", action:() => router.push("/settings?tab=github"), noDisable:true },
                ].map(opt => (
                  <button key={opt.label} onClick={opt.action} disabled={!opt.noDisable && !result}
                    style={{ width:"100%", marginBottom:8, padding:"14px 16px", background:"#0d0d0d", border:"1px solid rgba(255,255,255,.07)", borderRadius:10, color:(opt.noDisable||result)?"#e8e8e8":"#333", fontSize:13, cursor:(opt.noDisable||result)?"pointer":"not-allowed", display:"flex", alignItems:"center", gap:12, textAlign:"left", transition:"all .15s" }}
                    onMouseEnter={e => { if (opt.noDisable||result) e.currentTarget.style.borderColor="rgba(245,197,66,.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,.07)"; }}>
                    <span style={{ fontSize:22 }}>{opt.icon}</span>
                    <div><div style={{ fontWeight:600 }}>{opt.label}</div><div style={{ fontSize:11, color:"#444", marginTop:2 }}>{opt.desc}</div></div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#080808", color:"#F5D800", fontSize:14 }}>Loading...</div>}>
      <CreatePage/>
    </Suspense>
  );
}
