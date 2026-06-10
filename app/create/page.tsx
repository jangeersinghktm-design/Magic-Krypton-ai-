"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────
type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
  files?: string[];
  credits?: number;
  loading?: boolean;
  timestamp: Date;
};

type RightTab = "preview" | "history" | "export";
type DeviceMode = "desktop" | "tablet" | "mobile";
type Credits = { total: number; used: number; plan: string };

const CREDIT_COSTS = { new_project: 5, ai_edit: 1 };

// ── Credits Bar ────────────────────────────────────────────────────
function CreditsBar({ credits, onUpgrade }: { credits: Credits; onUpgrade: () => void }) {
  const remaining = credits.total - credits.used;
  const pct = Math.max(0, (remaining / credits.total) * 100);
  return (
    <div style={{ padding: "10px 14px", background: "rgba(245,197,66,0.05)", border: "1px solid rgba(245,197,66,0.12)", borderRadius: 10, margin: "0 12px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#666" }}>{credits.plan} Plan</span>
        <button onClick={onUpgrade} style={{ fontSize: 10, color: "#F5D800", background: "none", border: "1px solid rgba(245,197,66,0.3)", borderRadius: 4, padding: "1px 7px", cursor: "pointer" }}>Upgrade ⚡</button>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: pct > 30 ? "linear-gradient(90deg,#F5D800 0%,#AAEE00 45%,#00CC44 100%)" : "linear-gradient(90deg,#ef4444,#f59e0b)", borderRadius: 4, transition: "width 0.5s" }}/>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span style={{ fontSize: 10.5, color: "#555" }}>Used today: {credits.used}</span>
        <span style={{ fontSize: 10.5, color: remaining > 10 ? "#00D084" : "#ef4444", fontWeight: 700 }}>{remaining} left</span>
      </div>
    </div>
  );
}

// ── Files Display ──────────────────────────────────────────────────
function FilesDisplay({ files }: { files: string[] }) {
  if (!files.length) return null;
  return (
    <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(0,208,132,0.06)", border: "1px solid rgba(0,208,132,0.15)", borderRadius: 8 }}>
      <div style={{ fontSize: 10.5, color: "#00D084", fontWeight: 700, marginBottom: 5 }}>Modified:</div>
      {files.map(f => (
        <div key={f} style={{ fontSize: 11.5, color: "#888", display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
          <span style={{ color: "#00D084" }}>•</span> {f}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [prompt, setPrompt]             = useState("");
  const [result, setResult]             = useState("");
  const [loading, setLoading]           = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [projectId, setProjectId]       = useState<string>("");
  const [projectName, setProjectName]   = useState("Untitled Project");
  const [editingName, setEditingName]   = useState(false);
  const [rightTab, setRightTab]         = useState<RightTab>("preview");
  const [deviceMode, setDeviceMode]     = useState<DeviceMode>("desktop");
  const [isMobile, setIsMobile]         = useState(false);
  const [activeTab, setActiveTab]       = useState<"chat"|"preview">("chat");
  const [credits, setCredits]           = useState<Credits>({ total: 5, used: 0, plan: "free" })
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [listening, setListening]       = useState(false);
  const [error, setError]               = useState("");
  const [versions, setVersions]         = useState<any[]>([]);
  const [user, setUser]                 = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied]             = useState(false);

  const chatEndRef   = useRef<HTMLDivElement>(null);
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const silenceTimer = useRef<any>(null);
  const promptRef    = useRef("");

  const remaining   = credits.total - credits.used;
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const planLabel   = credits?.plan ? credits.plan.charAt(0).toUpperCase() + credits.plan.slice(1) : "Free";

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    initUser();
    const p = searchParams.get("prompt");
    if (p) {
      const decoded = decodeURIComponent(p);
      setPrompt(decoded);
      promptRef.current = decoded;
      setProjectName(decoded.slice(0, 40));
      setTimeout(() => triggerGenerate(decoded), 400);
    }
  }, []);

  useEffect(() => {
  const tab = searchParams.get("tab");
  if (tab === "history") setRightTab("history");
  if (tab === "export") setRightTab("export");
}, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth/login"); return; }
    setUser(session.user);
    const { data: profile } = await supabase.from("profiles").select("total_credits, used_credits, plan").eq("id", session.user.id).single();
    if (profile) setCredits({ 
  total: profile.total_credits ?? 5, 
  used: profile.used_credits ?? 0, 
  plan: profile.plan || "free" 
})
  };

  // ── Helpers ───────────────────────────────────────────────────
  const addMsg = useCallback((msg: Omit<Message, "id" | "timestamp">) => {
    const full: Message = { ...msg, id: Date.now().toString() + Math.random(), timestamp: new Date() };
    setMessages(prev => [...prev, full]);
    return full.id;
  }, []);

  const updateMsg = (id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const deductCredits = async (amount: number, description: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("profiles").update({ used_credits: credits.used + amount }).eq("id", session.user.id);
    await supabase.from("credit_transactions").insert({ user_id: session.user.id, amount: -amount, type: "usage", description, project_id: projectId || null });
    setCredits(c => ({ ...c, used: c.used + amount }));
  };

  const saveVersion = async (code: string, message: string, type = "auto") => {
    if (!projectId) return;
    const { data } = await supabase.from("project_versions").insert({ project_id: projectId, code_snapshot: { "index.html": code }, message, type, version_number: versions.length + 1, size_bytes: new Blob([code]).size }).select().single();
    if (data) setVersions(v => [data, ...v]);
  };

  const saveProject = async (html: string, name: string) => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    if (projectId) {
      await supabase.from("projects").update({ name, html_code: html, updated_at: new Date().toISOString() }).eq("id", projectId);
    } else {
      const { data } = await supabase.from("projects").insert({ user_id: session.user.id, name, html_code: html, title: name, prompt: promptRef.current }).select().single();
      if (data) setProjectId(data.id);
    }
    await saveVersion(html, "Auto-save", "auto");
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Download ──────────────────────────────────────────────────
  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── ZIP Download ──────────────────────────────────────────────
  const handleZipDownload = async () => {
    if (!result) return;
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      zip.file("index.html", result);
      zip.file("README.md", `# ${projectName}\n\nGenerated by Krypton AI\n\n## How to use\n1. Open index.html in browser\n2. Deploy to any static host\n`);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, "-")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // jszip not installed — fallback to HTML download
      handleDownload();
    }
  };

  // ── Copy Code ─────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Voice ─────────────────────────────────────────────────────
  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.onstart = () => setListening(true);
    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setPrompt(t);
      promptRef.current = t;
      clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => r.stop(), 5000);
    };
    r.onend = () => setListening(false);
    r.start();
  };

  // ── GENERATE ──────────────────────────────────────────────────
  const getThinkingSteps = (prompt: string) => {
  const lower = prompt.toLowerCase();
  if (lower.includes("game") || lower.includes("mario") || lower.includes("snake")) {
    return ["🎮 Understanding game mechanics...", "🗺 Planning game world...", "⚙️ Setting up game engine...", "🎯 Building player controls...", "👾 Creating enemies...", "💯 Adding score system...", "🎨 Designing game UI...", "✅ Build complete!"];
  }
  if (lower.includes("landing") || lower.includes("saas") || lower.includes("website")) {
    return ["📋 Reading requirements...", "🏗 Planning structure...", "🎨 Designing hero section...", "📦 Building features...", "💰 Creating pricing...", "📱 Mobile optimization...", "✨ Adding animations...", "✅ Build complete!"];
  }
  if (lower.includes("shop") || lower.includes("store") || lower.includes("ecommerce")) {
    return ["🛍 Planning store layout...", "📦 Designing product cards...", "🛒 Building cart system...", "💳 Creating checkout...", "🔍 Adding filters...", "📱 Mobile design...", "✅ Build complete!"];
  }
  return ["🔍 Understanding request...", "🧠 Planning structure...", "🎨 Designing layout...", "⚙️ Building features...", "✨ Adding animations...", "📱 Making responsive...", "✅ Build complete!"];
};

  // ── FRIENDLY MESSAGES (never show raw errors) ─────────────────
  const PROGRESS_MSGS = [
    "Analyzing your request...",
    "Planning the structure...",
    "Generating your project...",
    "Applying design system...",
    "Optimizing output...",
    "Running quality checks...",
    "Applying final improvements...",
    "Building preview...",
  ];

  const getProgressMsg = (attempt: number) => PROGRESS_MSGS[attempt % PROGRESS_MSGS.length];

  const isCreditError = (code: string) =>
    ["INSUFFICIENT_CREDITS", "DAILY_LIMIT"].includes(code);

  // ── GENERATE ──────────────────────────────────────────────────
  const triggerGenerate = async (overridePrompt?: string) => {
    const p = overridePrompt || promptRef.current;
    if (!p.trim() || loading) return;
    if (remaining < CREDIT_COSTS.new_project) { setError("Insufficient credits! Please upgrade."); return; }

    setLoading(true);
    setError("");
    const steps = getThinkingSteps(p);
    setThinkingSteps(steps);
    setCurrentStep(0);
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < steps.length - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 1200);
    if (isMobile) setActiveTab("preview");

    addMsg({ role: "user", content: p });
    const aiMsgId = addMsg({ role: "ai", content: "", loading: true });

    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [2000, 5000, 10000];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Show progress message on retries
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
          updateMsg(aiMsgId, { content: "", loading: true });
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setError("Please login again."); setLoading(false); clearInterval(stepInterval); return; }

        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ prompt: p }),
          signal: AbortSignal.timeout(110000),
        });

        let data: any = {};
        try {
          data = await response.json();
        } catch {
          // Non-JSON response — treat as retryable
          if (attempt < MAX_RETRIES) continue;
          throw new Error("retry");
        }

        // Credit/plan errors — show these (not retryable)
        if (data.code && isCreditError(data.code)) {
          updateMsg(aiMsgId, { content: data.error || "Insufficient credits.", loading: false });
          setError(data.error || "Insufficient credits.");
          clearInterval(stepInterval);
          setLoading(false);
          return;
        }

        // Success
        if (data.html) {
          clearInterval(stepInterval);
          setResult(data.html);
          const name = p.slice(0, 40) || "Untitled Project";
          setProjectName(name);
          await saveProject(data.html, name);
          await deductCredits(CREDIT_COSTS.new_project, `Generate: ${name}`);
          updateMsg(aiMsgId, { content: "✅ Your project is ready!", loading: false, files: ["index.html"], credits: CREDIT_COSTS.new_project });
          if (isMobile) setActiveTab("preview");
          setLoading(false);
          setPrompt("");
          promptRef.current = "";
          return;
        }

        // AI error but retryable — loop continues
        if (attempt < MAX_RETRIES) continue;

        // All retries exhausted — show friendly message only
        updateMsg(aiMsgId, { content: "Please try again with a different description.", loading: false });

      } catch (err: any) {
        if (attempt < MAX_RETRIES) continue;
        // Final failure — never show raw error
        updateMsg(aiMsgId, { content: "Please try again with a more detailed description.", loading: false });
      }
    }

    clearInterval(stepInterval);
    setLoading(false);
    setPrompt("");
    promptRef.current = "";
  };

  // ── AI EDIT ───────────────────────────────────────────────────
  const triggerEdit = async (editPrompt: string) => {
    if (!result || !editPrompt.trim() || loading) return;
    if (remaining < CREDIT_COSTS.ai_edit) { setError("Insufficient credits!"); return; }

    setLoading(true);
    setError("");
    addMsg({ role: "user", content: editPrompt });
    const aiMsgId = addMsg({ role: "ai", content: "", loading: true });

    const MAX_RETRIES = 2;
    const RETRY_DELAYS = [3000, 7000];
    const fullPrompt = `You are editing an existing HTML project.

CURRENT PROJECT CODE:
${result.slice(0, 6000)}

USER EDIT REQUEST: "${editPrompt}"

Instructions:
- Make ONLY the requested changes
- Return the COMPLETE updated HTML file
- Start with <!DOCTYPE html> and end with </html>
- No markdown, no backticks`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ prompt: fullPrompt, isEdit: true }),
          signal: AbortSignal.timeout(90000),
        });

        let data: any = {};
        try { data = await response.json(); } catch { if (attempt < MAX_RETRIES) continue; break; }

        if (data.html) {
          await saveVersion(result, `Before: ${editPrompt.slice(0, 40)}`, "pre-edit");
          setResult(data.html);
          await saveProject(data.html, projectName);
          await deductCredits(CREDIT_COSTS.ai_edit, `Edit: ${editPrompt.slice(0, 40)}`);
          const modifiedFiles = ["index.html"];
          if (/style|color|css/i.test(editPrompt)) modifiedFiles.push("styles.css");
          if (/hero|header|banner/i.test(editPrompt)) modifiedFiles.push("Hero section");
          if (/pricing/i.test(editPrompt)) modifiedFiles.push("Pricing section");
          updateMsg(aiMsgId, { content: "✅ Changes applied!", loading: false, files: modifiedFiles, credits: CREDIT_COSTS.ai_edit });
          if (isMobile) setActiveTab("preview");
          setLoading(false);
          setPrompt("");
          promptRef.current = "";
          return;
        }

        if (attempt < MAX_RETRIES) continue;
        updateMsg(aiMsgId, { content: "Please describe the change differently and try again.", loading: false });

      } catch {
        if (attempt < MAX_RETRIES) continue;
        updateMsg(aiMsgId, { content: "Please try again in a moment.", loading: false });
      }
    }

    setLoading(false);
    setPrompt("");
    promptRef.current = "";
  };

  const handleSend = () => {
    const p = prompt.trim();
    if (!p) return;
    if (!result) { triggerGenerate(p); } else { triggerEdit(p); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <style>{`
        @keyframes dot-pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1} }
        @keyframes dropIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .msg-enter { animation: fadeIn 0.25s ease; }
      `}</style>

      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#080808", color: "#fff", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", position: "fixed", inset: 0, width: "100%" }}>

        {/* ── TOP BAR ── */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #1c1c1c", display: "flex", alignItems: "center", gap: 8, background: "#0C0C0C", flexShrink: 0, minHeight: 52, position: "relative", zIndex: 100 }}>

          {/* Logo + Dropdown */}
          <div style={{ position: "relative" }} ref={dropdownRef}>
            <button onClick={() => setShowDropdown(!showDropdown)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <img src="/logo.png" alt="Kr" style={{ height: 36, width: "auto", objectFit: "contain" }} />
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>

            {showDropdown && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "6px", minWidth: 260, boxShadow: "0 16px 48px rgba(0,0,0,0.9)", animation: "dropIn 0.18s ease", maxHeight: "85vh", overflowY: "auto", scrollbarWidth: "none" }}>

                <button onClick={() => { router.push("/"); setShowDropdown(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: "#888", fontSize: 13, cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#888"; }}>
                  ← Go to Dashboard
                </button>

                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />

                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{displayName}</div>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 10px", borderRadius: 20, background: "linear-gradient(135deg,#F5D800,#00CC44)", color: "#000" }}>{planLabel.toUpperCase()}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "#555" }}>Credits</span>
                    <span onClick={() => { router.push("/settings?tab=billing"); setShowDropdown(false); }} style={{ fontSize: 12, color: "#00D084", fontWeight: 600, cursor: "pointer" }}>{remaining} left →</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(0, (remaining / (credits?.total || 5)) * 100)}%`, background: remaining > 20 ? "linear-gradient(90deg,#F5D800,#00CC44)" : "#ef4444", borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />

                {[
                  { icon: "⚡", label: "Get free credits", path: "/settings?tab=billing", gold: true },
                  { icon: "⚙️", label: "Settings", path: "/settings", shortcut: "Ctrl." },
                  { icon: "🔗", label: "Connectors", path: "/settings?tab=apikeys" },
                  { icon: "⭐", label: "Templates", path: "/templates" },
                  { icon: "📊", label: "Analytics", path: "/analytics" },
                  null,
                  { icon: "✏️", label: "Rename project", action: () => setEditingName(true) },
                  { icon: "⬇️", label: "Download HTML", action: handleDownload },
                  { icon: "📦", label: "Download ZIP", action: handleZipDownload },
                  null,
                  { icon: "🎨", label: "Appearance", path: "/settings?tab=theme", arrow: true },
                  null,
                  { icon: "❓", label: "Help", path: "/landing#faq" },
                ].map((item, i) => {
                  if (item === null) return <div key={i} style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />;
                  return (
                    <button key={(item as any).label}
                      onClick={() => { if ((item as any).path) router.push((item as any).path); if ((item as any).action) (item as any).action(); setShowDropdown(false); }}
                      style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", color: (item as any).gold ? "#F5D800" : "#888", fontSize: 13, cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = (item as any).gold ? "#F5D800" : "#fff"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = (item as any).gold ? "#F5D800" : "#888"; }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 9 }}>{(item as any).icon} {(item as any).label}</span>
                      <span style={{ fontSize: 11, color: "#444" }}>{(item as any).shortcut || ((item as any).arrow ? "›" : "")}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Project Name */}
          {editingName ? (
            <input autoFocus value={projectName} onChange={e => setProjectName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={e => e.key === "Enter" && setEditingName(false)}
              style={{ background: "#161616", border: "1px solid #F5D800", borderRadius: 7, color: "#fff", padding: "4px 8px", fontSize: 12, fontWeight: 600, outline: "none", flex: 1 }} />
          ) : (
            <button onClick={() => setEditingName(true)} style={{ background: "none", border: "none", color: "#888", fontSize: 12, fontWeight: 500, cursor: "pointer", padding: "4px 6px", borderRadius: 7, flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {projectName} ✏
            </button>
          )}

          {/* Mobile tabs */}
          {isMobile && (
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {["chat", "preview"].map(t => (
                <button key={t} onClick={() => setActiveTab(t as any)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: activeTab === t ? "#F5D800" : "#1c1c1c", color: activeTab === t ? "#080808" : "#fff", fontSize: 11, cursor: "pointer", fontWeight: activeTab === t ? 700 : 400, textTransform: "capitalize" }}>{t}</button>
              ))}
            </div>
          )}

          {/* Right */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginLeft: "auto" }}>
            <div style={{ padding: "4px 10px", borderRadius: 6, background: remaining > 20 ? "rgba(0,208,132,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${remaining > 20 ? "rgba(0,208,132,0.3)" : "rgba(239,68,68,0.3)"}`, fontSize: 11, color: remaining > 20 ? "#00D084" : "#ef4444", fontWeight: 700 }}>
              ⚡ {remaining}
            </div>
            {result && (
              <>
                <button onClick={() => { setSaving(true); saveProject(result, projectName); }} disabled={saving} style={{ padding: "5px 10px", background: saved ? "rgba(0,208,132,0.15)" : "rgba(245,197,66,0.15)", border: saved ? "1px solid rgba(0,208,132,0.3)" : "1px solid rgba(245,197,66,0.3)", borderRadius: 7, color: saved ? "#00D084" : "#F5D800", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                  {saving ? "..." : saved ? "✓ Saved" : "Save"}
                </button>
                {!isMobile && <button onClick={handleDownload} style={{ padding: "5px 10px", background: "#161616", border: "1px solid #1c1c1c", borderRadius: 7, color: "#9ca3af", cursor: "pointer", fontSize: 11 }}>Export</button>}
              </>
            )}
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── LEFT Chat ── */}
          <div style={{ width: isMobile ? "100%" : "50%", display: isMobile ? (activeTab === "chat" ? "flex" : "none") : "flex", flexDirection: "column", borderRight: isMobile ? "none" : "1px solid #1c1c1c", background: "#0A0A0A", flexShrink: 0 }}>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12, scrollbarWidth: "none" }}>
              {messages.length === 0 && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, opacity: 0.5, textAlign: "center", padding: 20 }}>
                  <img src="/logo.png" alt="Kr" style={{ width: 48, height: 48 }} />
                  <p style={{ color: "#555", fontSize: 13, margin: 0 }}>Describe what you want to build</p>
                  <p style={{ color: "#333", fontSize: 11, margin: 0 }}>Costs {CREDIT_COSTS.new_project} credits per generation</p>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className="msg-enter" style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 3 }}>
                  <div style={{ maxWidth: "90%", padding: "10px 12px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: msg.role === "user" ? "linear-gradient(135deg,rgba(245,197,66,0.2),rgba(245,197,66,0.1))" : "#161616", border: msg.role === "ai" ? "1px solid #222" : "1px solid rgba(245,197,66,0.2)", color: "#e8e8e8", fontSize: 13, lineHeight: 1.6 }}>
                    {msg.role === "ai" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <img src="/logo.png" alt="Kr" style={{ width: 16, height: 16 }} />
                        <span style={{ fontSize: 10, color: "#555" }}>Krypton AI</span>
                      </div>
                    )}
                    {msg.loading ? (
                     <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                     {/* Header */}
                     <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                     <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(245,197,66,0.2)", borderTopColor: "#F5D800", animation: "spin 0.8s linear infinite", flexShrink: 0 }}/>
                     <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Building your project...</span>
                    </div>
                    {/* Steps */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                     {thinkingSteps.map((step, i) => {
                      const isDone = i < currentStep;
                      const isCur = i === currentStep;
                      const isFut = i > currentStep;
                      return (
                       <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: isFut ? 0.2 : 1, transition: "opacity 0.5s ease" }}>
                        <div style={{
                         width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                         display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                         background: isDone ? "rgba(0,204,68,0.15)" : isCur ? "rgba(245,216,0,0.15)" : "rgba(255,255,255,0.04)",
                         border: isDone ? "1px solid rgba(0,204,68,0.4)" : isCur ? "1px solid rgba(245,216,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                         color: isDone ? "#00CC44" : "transparent",
                         transition: "all 0.3s ease",
                       }}>
                        {isDone ? "✓" : ""}
                       </div>
                       <span style={{
                        fontSize: 13, lineHeight: 1.4,
                        color: isDone ? "rgba(255,255,255,0.35)" : isCur ? "#FFD93D" : "rgba(255,255,255,0.2)",
                        fontWeight: isCur ? 600 : 400,
                        textDecoration: isDone ? "line-through" : "none",
                        transition: "all 0.3s ease",
                       }}>
                        {step}
                       </span>
                      </div>
                     );
                   })}
                 </div>
                </div>
              ) : (
                      <div>{msg.content}</div>
                    )}
                    {msg.files && <FilesDisplay files={msg.files} />}
                    {msg.credits && <div style={{ marginTop: 8, fontSize: 10.5, color: "#444", display: "flex", alignItems: "center", gap: 4 }}>⚡ {msg.credits} credits used</div>}
                  </div>
                  <span style={{ fontSize: 10, color: "#333" }}>{formatTime(msg.timestamp)}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {error && <div style={{ margin: "0 12px 8px", padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#ef4444", fontSize: 12 }}>⚠ {error}</div>}

            {/* Input */}
            <div style={{ padding: "10px 12px", borderTop: "1px solid #1c1c1c", background: "#0C0C0C", flexShrink: 0 }}>
              {result && <div style={{ marginBottom: 6, fontSize: 10.5, color: "#555" }}>✏ Edit mode — {CREDIT_COSTS.ai_edit} credit per edit</div>}
              <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 14, padding: "10px 12px" }}>
                {remaining <= 1 && (
                 <div
                  onClick={() => window.open("/billing", "_blank")}
                  style={{
                  padding: "8px 14px",
                  background: remaining === 0 ? "rgba(239,68,68,0.1)" : "rgba(245,197,66,0.08)",
                  border: `1px solid ${remaining === 0 ? "rgba(239,68,68,0.3)" : "rgba(245,197,66,0.2)"}`,
                  borderRadius: 8, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  margin: "0 12px 8px",
                 }}
                >
                 <span style={{ fontSize: 12, color: remaining === 0 ? "#ef4444" : "#F5D800" }}>
                 {remaining === 0
                  ? "⚠️ All credits used — Generate nahi kar sakte"
                  : `⚡ Sirf ${remaining} credit bacha hai!`}
                </span>
                <span style={{ fontSize: 11, color: "#F5D800", fontWeight: 700 }}>
                 Upgrade →
               </span>
              </div>
              )}
                <textarea value={prompt} onChange={e => { setPrompt(e.target.value); promptRef.current = e.target.value; }}
                  placeholder={result ? "Make hero section larger, add dark mode..." : "Describe what you want to build..."}
                  rows={3} onKeyDown={handleKeyDown} disabled={loading}
                  style={{ width: "100%", background: "none", border: "none", color: "#fff", fontSize: 14, resize: "none", outline: "none", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, boxSizing: "border-box", opacity: loading ? 0.5 : 1 }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingTop: 8, borderTop: "1px solid #1c1c1c" }}>
                  <input ref={fileInputRef} type="file" accept="image/*,.txt,.html" style={{ display: "none" }}
                    onChange={e => { const file = e.target.files?.[0]; if (file) { setPrompt(p => p + `\n[File: ${file.name}]`); promptRef.current = prompt + `\n[File: ${file.name}]`; } }}
                  />
                  <button onClick={() => fileInputRef.current?.click()} style={{ width: 34, height: 34, borderRadius: "50%", background: "#2a2a2a", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleVoice} style={{ width: 34, height: 34, borderRadius: "50%", background: listening ? "#F5D800" : "#2a2a2a", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="2" width="6" height="11" rx="3" fill={listening ? "#080808" : "#9ca3af"}/>
                        <path d="M5 11a7 7 0 0014 0" stroke={listening ? "#080808" : "#9ca3af"} strokeWidth="2" strokeLinecap="round"/>
                        <line x1="12" y1="18" x2="12" y2="22" stroke={listening ? "#080808" : "#9ca3af"} strokeWidth="2" strokeLinecap="round"/>
                        <line x1="8" y1="22" x2="16" y2="22" stroke={listening ? "#080808" : "#9ca3af"} strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <button onClick={handleSend} disabled={loading || !prompt.trim() || remaining < 1}
                      style={{ width: 40, height: 40, borderRadius: "50%", background: !loading && prompt.trim() && remaining >= 1 ? "linear-gradient(135deg,#F5D800,#00CC44)" : "#1a1a1a", border: "none", cursor: !loading && prompt.trim() && remaining >= 1 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", boxShadow: prompt.trim() ? "0 0 12px rgba(245,197,66,0.3)" : "none" }}>
                      {loading ? (
                        <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }}/>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M12 19V5M5 12l7-7 7 7" stroke={prompt.trim() ? "#080808" : "#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 10, color: "#2a2a2a", margin: "5px 0 0", textAlign: "center" }}>Enter to send · Shift+Enter new line</p>
            </div>
          </div>

          {/* ── RIGHT Preview / History / Export ── */}
          <div style={{ flex: 1, display: isMobile ? (activeTab === "preview" ? "flex" : "none") : "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: "1px solid #1c1c1c", background: "#0C0C0C", flexShrink: 0 }}>
              {[
                { id: "preview", label: "✨ Preview" },
                { id: "history", label: "⏱ History" },
                { id: "export",  label: "📤 Export"  },
              ].map(tab => (
                <button key={tab.id} onClick={() => setRightTab(tab.id as RightTab)} style={{ padding: "5px 14px", borderRadius: 8, border: rightTab === tab.id ? "1px solid rgba(245,197,66,0.3)" : "1px solid transparent", background: rightTab === tab.id ? "rgba(245,197,66,0.1)" : "rgba(255,255,255,0.04)", color: rightTab === tab.id ? "#F5D800" : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.18s" }}>
                  {tab.label}
                </button>
              ))}
              {result && (
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#00D084" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D084", animation: "dot-pulse 2s infinite" }}/>
                  Live
                </div>
              )}
            </div>

            {/* ── PREVIEW ── */}
            {rightTab === "preview" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                {/* Device Switcher */}
                {result && (
                  <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: "1px solid #1c1c1c", background: "#0d0d0d", alignItems: "center" }}>
                    {[
                      { id: "desktop", icon: "🖥", label: "Desktop" },
                      { id: "tablet",  icon: "📱", label: "Tablet"  },
                      { id: "mobile",  icon: "📲", label: "Mobile"  },
                    ].map(d => (
                      <button key={d.id} onClick={() => setDeviceMode(d.id as DeviceMode)} style={{ padding: "4px 12px", borderRadius: 6, border: deviceMode === d.id ? "1px solid rgba(245,197,66,0.4)" : "1px solid rgba(255,255,255,0.08)", background: deviceMode === d.id ? "rgba(245,197,66,0.1)" : "none", color: deviceMode === d.id ? "#F5D800" : "#555", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
                        {d.icon} {d.label}
                      </button>
                    ))}
                    <button onClick={() => { const w = window.open("", "_blank"); if (w) { w.document.write(result); w.document.close(); } }}
                      style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "none", color: "#555", fontSize: 11, cursor: "pointer" }}>
                      ↗ New Tab
                    </button>
                  </div>
                )}

                {/* iframe */}
                <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "auto", background: result ? (deviceMode !== "desktop" ? "#333" : "#fff") : "#111" }}>
                  {result ? (
                    <iframe
                      key={`${result.length}-${deviceMode}`}
                      srcDoc={result}
                      style={{
                        border: "none",
                        width: deviceMode === "desktop" ? "100%" : deviceMode === "tablet" ? "768px" : "375px",
                        height: "100%",
                        minHeight: "100%",
                        transition: "width 0.3s ease",
                        boxShadow: deviceMode !== "desktop" ? "0 0 40px rgba(0,0,0,0.6)" : "none",
                        flexShrink: 0,
                      }}
                      sandbox="allow-scripts allow-same-origin"
                      title="Preview"
                    />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#333", width: "100%", height: "100%" }}>
                      <div style={{ fontSize: 48 }}>✨</div>
                      <p style={{ fontSize: 14 }}>Generate something to preview</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── HISTORY ── */}
            {rightTab === "history" && (
              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 14 }}>⏱ Version History</div>
                {versions.length === 0 ? (
                  <div style={{ color: "#444", textAlign: "center", padding: 40, fontSize: 13 }}>No versions yet. Generate a project first!</div>
                ) : (
                  versions.map((v, i) => (
                    <div key={v.id || i} style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245,197,66,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#F5D800" }}>v{v.version_number}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#e8e8e8" }}>{v.message}</div>
                        <div style={{ fontSize: 10.5, color: "#444", marginTop: 3 }}>{new Date(v.created_at).toLocaleString()}</div>
                      </div>
                      <button onClick={() => { const code = v.code_snapshot?.["index.html"]; if (code) setResult(code); }}
                        style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(245,197,66,0.3)", background: "rgba(245,197,66,0.08)", color: "#F5D800", fontSize: 11.5, cursor: "pointer" }}>
                        ↩ Restore
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── EXPORT ── */}
            {rightTab === "export" && (
              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>📤 Export Options</div>

                {[
                  { label: "Download HTML", desc: "Single file, ready to deploy", icon: "⬇️", action: handleDownload },
                  { label: copied ? "Copied!" : "Copy Code", desc: "Copy HTML to clipboard", icon: "📋", action: handleCopy },
                  { label: "Download ZIP", desc: "Complete project package", icon: "📦", action: handleZipDownload },
                  { label: "Open in New Tab", desc: "Preview in browser", icon: "↗️", action: () => { const w = window.open("", "_blank"); if (w) { w.document.write(result); w.document.close(); } } },
                  { label: "Push to GitHub", desc: "Connect GitHub in Settings first", icon: "🐙", action: () => router.push("/settings?tab=github"), noDisable: true },
                ].map(opt => (
                  <button key={opt.label} onClick={opt.action}
                    disabled={!opt.noDisable && !result}
                    style={{ width: "100%", marginBottom: 10, padding: "14px 16px", background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, color: (opt.noDisable || result) ? "#e8e8e8" : "#444", fontSize: 13, cursor: (opt.noDisable || result) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 12, textAlign: "left", transition: "all 0.15s" }}
                    onMouseEnter={e => { if (opt.noDisable || result) e.currentTarget.style.borderColor = "rgba(245,197,66,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}>
                    <span style={{ fontSize: 24 }}>{opt.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{opt.desc}</div>
                    </div>
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
    <Suspense fallback={
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080808", color: "#F5D800" }}>
        Loading...
      </div>
    }>
      <CreatePage />
    </Suspense>
  );
}
