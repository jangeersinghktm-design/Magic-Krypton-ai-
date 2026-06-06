"use client";

// app/create/page.tsx
// Krypton AI — Complete Workspace with Generation Timeline + Project Chat

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────
type Stage = {
  id: string;
  icon: string;
  label: string;
  status: "pending" | "active" | "done";
};

type Message = {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  stages?: Stage[];
  files?: string[];
  credits?: number;
  timestamp: Date;
};

type RightTab = "preview" | "history" | "export";
type Credits = { total: number; used: number; plan: string };

// ── Generation Stages ──────────────────────────────────────────────
const GEN_STAGES: Omit<Stage, "status">[] = [
  { id: "think",    icon: "🧠", label: "Thinking..."           },
  { id: "read",     icon: "📖", label: "Reading Files..."       },
  { id: "analyze",  icon: "🔍", label: "Analyzing Project..."   },
  { id: "edit",     icon: "✏️",  label: "Editing Components..."  },
  { id: "generate", icon: "⚡", label: "Generating Code..."     },
  { id: "check",    icon: "✅", label: "Running Checks..."      },
];

const EDIT_STAGES: Omit<Stage, "status">[] = [
  { id: "think",    icon: "🧠", label: "Thinking..."           },
  { id: "read",     icon: "📖", label: "Reading Project..."     },
  { id: "analyze",  icon: "🔍", label: "Analyzing Files..."     },
  { id: "plan",     icon: "📋", label: "Planning Changes..."    },
  { id: "edit",     icon: "✏️",  label: "Editing Components..."  },
  { id: "style",    icon: "🎨", label: "Updating Styles..."     },
  { id: "generate", icon: "⚡", label: "Generating Code..."     },
  { id: "check",    icon: "✅", label: "Updated Successfully"   },
];

// ── Credit Costs ───────────────────────────────────────────────────
const CREDIT_COSTS = {
  new_project:  5,
  major_regen:  3,
  ai_edit:      1,
  analysis:     1,
  premium_template: 2,
};

 // ── Stage Animator ─────────────────────────────────────────────────
function animateStages(
  stageList: Omit<Stage, "status">[],
  onUpdate: (stages: Stage[]) => void,
  onComplete: () => void,
  delay = 1500
) {
  const stages: Stage[] = stageList.map(s => ({ ...s, status: "pending" }));
  let i = 0;

  const next = () => {
    if (i >= stages.length) { onComplete(); return; }
    stages[i] = { ...stages[i], status: "active" };
    onUpdate([...stages]);
    setTimeout(() => {
      stages[i] = { ...stages[i], status: "done" };
      onUpdate([...stages]);
      i++;
      setTimeout(next, delay * 0.4);
    }, delay);
  };
  next();
}

// ── Stage Display Component ────────────────────────────────────────
 
 function StageDisplay({ stages }: { stages: Stage[] }) {
  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
      {stages.map((s) => (
        <div key={s.id} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "3px 0",
          opacity: s.status === "pending" ? 0.3 : 1,
          transition: "opacity 0.3s ease",
        }}>
          {/* Icon */}
          <span style={{ fontSize: 13 }}>{s.icon}</span>

          {/* Label */}
          <span style={{
            fontSize: 12.5,
            color: s.status === "done"
              ? "#fff"
              : s.status === "active"
              ? "#F5C542"
              : "#666",
            fontWeight: s.status === "active" ? 600 : 400,
          }}>
            {s.label}
          </span>

          {/* Right side */}
          <span style={{ marginLeft: "auto" }}>
            {s.status === "done" && (
              <span style={{ color: "#00D084", fontSize: 12 }}>✓</span>
            )}
            {s.status === "active" && (
              <span style={{ display: "flex", gap: 3 }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{
                    width: 3, height: 3, borderRadius: "50%",
                    background: "#F5C542", display: "inline-block",
                    animation: `dot-pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }}/>
                ))}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
 }

// ── Modified Files Display ─────────────────────────────────────────
function FilesDisplay({ files }: { files: string[] }) {
  if (!files.length) return null;
  return (
    <div style={{
      marginTop: 8, padding: "8px 10px",
      background: "rgba(0,208,132,0.06)",
      border: "1px solid rgba(0,208,132,0.15)",
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 10.5, color: "#00D084", fontWeight: 700, marginBottom: 5, letterSpacing: 0.5 }}>
        Modified:
      </div>
      {files.map(f => (
        <div key={f} style={{
          fontSize: 11.5, color: "#888", display: "flex", alignItems: "center", gap: 6,
          padding: "2px 0",
        }}>
          <span style={{ color: "#00D084" }}>•</span> {f}
        </div>
      ))}
    </div>
  );
}

// ── Credits Bar ────────────────────────────────────────────────────
function CreditsBar({ credits, onUpgrade }: { credits: Credits; onUpgrade: () => void }) {
  const remaining = credits.total - credits.used;
  const pct = Math.max(0, (remaining / credits.total) * 100);

  return (
    <div style={{
      padding: "10px 14px",
      background: "rgba(245,197,66,0.05)",
      border: "1px solid rgba(245,197,66,0.12)",
      borderRadius: 10, margin: "0 12px 10px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#666" }}>
          {credits.plan} Plan
        </span>
        <button onClick={onUpgrade} style={{
          fontSize: 10, color: "const T = {
          gold: "#F5D800", background: "none",
          border: "1px solid rgba(245,197,66,0.3)",
          borderRadius: 4, padding: "1px 7px", cursor: "pointer",
        }}>
          Upgrade ⚡
        </button>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: pct > 30
            ? "linear-gradient(90deg,#F5D800 0%, #AAEE00 45%, #00CC44 100%)"
            : "linear-gradient(90deg,#ef4444,#f59e0b)",
          borderRadius: 4, transition: "width 0.5s",
        }}/>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span style={{ fontSize: 10.5, color: "#555" }}>
          Used today: {credits.used}
        </span>
        <span style={{ fontSize: 10.5, color: remaining > 10 ? "#00D084" : "#ef4444", fontWeight: 700 }}>
          {remaining} left
        </span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [prompt, setPrompt]           = useState("");
  const [result, setResult]           = useState("");
  const [loading, setLoading]         = useState(false);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [projectId, setProjectId]     = useState<string>("");
  const [projectName, setProjectName] = useState("Untitled Project");
  const [editingName, setEditingName] = useState(false);
  const [rightTab, setRightTab]       = useState<RightTab>("preview");
  const [isMobile, setIsMobile]       = useState(false);
  const [activeTab, setActiveTab]     = useState<"chat"|"preview">("chat");
  const [credits, setCredits]         = useState<Credits>({ total: 100, used: 0, plan: "Free" });
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [listening, setListening]     = useState(false);
  const [error, setError]             = useState("");
  const [versions, setVersions]       = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const chatEndRef   = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const silenceTimer = useRef<any>(null);
  const promptRef    = useRef("");
  
  // ── Init ──────────────────────────────────────────────────────
   useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 768);
  check();
  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}, []);

useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (dropdownRef.current &&
      !dropdownRef.current.contains(e.target as Node)) {
      setShowDropdown(false);
    }
  };
  document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}, []); 

  const remaining = credits.total - credits.used;
  const displayName = user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] || "User";
  const planLabel = credits?.plan
    ? credits.plan.charAt(0).toUpperCase() + credits.plan.slice(1)
    : "Free";

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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth/login"); return; }
    setUser(session.user); //

    // Load credits from DB
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_credits, used_credits, plan")
      .eq("id", session.user.id)
      .single();

    if (profile) {
      setCredits({
        total: profile.total_credits || 100,
        used: profile.used_credits || 0,
        plan: profile.plan || "Free",
      });
    }
  };

  // ── Deduct Credits ─────────────────────────────────────────────
  const deductCredits = async (amount: number, description: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from("profiles")
      .update({ used_credits: credits.used + amount })
      .eq("id", session.user.id);

    await supabase.from("credit_transactions").insert({
      user_id: session.user.id,
      amount: -amount,
      type: "usage",
      description,
      project_id: projectId || null,
    });

    setCredits(c => ({ ...c, used: c.used + amount }));
  };

  // ── Add message to chat ────────────────────────────────────────
  const addMsg = useCallback((msg: Omit<Message, "id" | "timestamp">) => {
    const full: Message = {
      ...msg,
      id: Date.now().toString() + Math.random(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, full]);
    return full.id;
  }, []);

  // ── Update message stages ──────────────────────────────────────
  const updateMsgStages = (id: string, stages: Stage[]) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, stages } : m));
  };

  const updateMsgContent = (id: string, content: string, extra?: Partial<Message>) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, content, ...extra } : m
    ));
  };

  // ── Save version ───────────────────────────────────────────────
  const saveVersion = async (code: string, message: string, type = "auto") => {
    if (!projectId) return;
    const { data } = await supabase.from("project_versions").insert({
      project_id: projectId,
      code_snapshot: { "index.html": code },
      message,
      type,
      version_number: versions.length + 1,
      size_bytes: new Blob([code]).size,
    }).select().single();

    if (data) setVersions(v => [data, ...v]);
  };

  // ── Save project ───────────────────────────────────────────────
  const saveProject = async (html: string, name: string) => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (projectId) {
      // Update existing
      await supabase.from("projects")
        .update({ name, html_code: html, updated_at: new Date().toISOString() })
        .eq("id", projectId);
    } else {
      // Create new
      const { data } = await supabase.from("projects")
        .insert({ user_id: session.user.id, name, html_code: html, title: name, prompt: promptRef.current })
        .select().single();
      if (data) setProjectId(data.id);
    }

    await saveVersion(html, "Auto-save", "auto");
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Save chat message to DB ────────────────────────────────────
  const saveChatToDB = async (role: string, content: string, credits_used = 0) => {
    if (!projectId) return;
    await supabase.from("project_chats").insert({
      project_id: projectId,
      role,
      content,
      tokens_used: credits_used,
    });
  };

  // ── GENERATE (new project) ─────────────────────────────────────
  const triggerGenerate = async (overridePrompt?: string) => {
    const p = overridePrompt || promptRef.current;
    if (!p.trim() || loading) return;

    // Check credits
    if (credits.total - credits.used < CREDIT_COSTS.new_project) {
      setError("Insufficient credits! Please upgrade your plan.");
      return;
    }

    setLoading(true);
    setError("");
    if (isMobile) setActiveTab("preview");

    // User message
    addMsg({ role: "user", content: p });

    // AI message with stages
    const aiMsgId = addMsg({
      role: "ai",
      content: "",
      stages: GEN_STAGES.map(s => ({ ...s, status: "pending" })),
    });

    // Animate stages
    await new Promise<void>(resolve => {
      animateStages(
        GEN_STAGES,
        (stages) => updateMsgStages(aiMsgId, stages),
        resolve,
        1500,
      );
    });

    // Call API
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });

      const data = await response.json();

      if (data.html) {
        setResult(data.html);
        const name = p.slice(0, 40) || "Untitled Project";
        setProjectName(name);

        // Save project
        await saveProject(data.html, name);

        // Deduct credits
        await deductCredits(CREDIT_COSTS.new_project, `Generate: ${name}`);

        // Update AI message
        updateMsgContent(aiMsgId, "✅ Project generated successfully!", {
          stages: GEN_STAGES.map(s => ({ ...s, status: "done" })),
          files: ["index.html"],
          credits: CREDIT_COSTS.new_project,
        });

        await saveChatToDB("assistant", "Project generated successfully!", CREDIT_COSTS.new_project);

        if (isMobile) setActiveTab("preview");
      } else {
        updateMsgContent(aiMsgId, `❌ Generation failed: ${data.error || "Unknown error"}`);
        setError(data.error || "Generation failed");
      }
    } catch (err: any) {
      updateMsgContent(aiMsgId, `❌ Error: ${err.message}`);
      setError(err.message);
    } finally {
      setLoading(false);
      setPrompt("");
      promptRef.current = "";
    }
  };

  // ── AI EDIT (existing project) ─────────────────────────────────
  const triggerEdit = async (editPrompt: string) => {
    if (!result || !editPrompt.trim() || loading) return;

    if (credits.total - credits.used < CREDIT_COSTS.ai_edit) {
      setError("Insufficient credits!");
      return;
    }

    setLoading(true);
    setError("");

    addMsg({ role: "user", content: editPrompt });

    const aiMsgId = addMsg({
      role: "ai",
      content: "",
      stages: EDIT_STAGES.map(s => ({ ...s, status: "pending" })),
    });

    // Animate edit stages
    await new Promise<void>(resolve => {
      animateStages(
        EDIT_STAGES,
        (stages) => updateMsgStages(aiMsgId, stages),
        resolve,
        1500,
      );
    });

    try {
      // Build edit prompt with context
      const fullPrompt = `You are editing an existing HTML project.

CURRENT PROJECT CODE:
${result.slice(0, 6000)}

USER EDIT REQUEST: "${editPrompt}"

Instructions:
- Make ONLY the requested changes
- Keep everything else exactly the same
- Return the COMPLETE updated HTML file
- Start with <!DOCTYPE html> and end with </html>
- No markdown, no backticks`;

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt }),
      });

      const data = await response.json();

      if (data.html) {
        // Save version before applying
        await saveVersion(result, `Before: ${editPrompt.slice(0, 40)}`, "pre-edit");

        setResult(data.html);

        // Auto save
        await saveProject(data.html, projectName);

        // Deduct credits
        await deductCredits(CREDIT_COSTS.ai_edit, `Edit: ${editPrompt.slice(0, 40)}`);

        // Determine modified files
        const modifiedFiles = ["index.html"];
        if (editPrompt.toLowerCase().includes("style") || editPrompt.toLowerCase().includes("color")) {
          modifiedFiles.push("styles.css");
        }
        if (editPrompt.toLowerCase().includes("component") || editPrompt.toLowerCase().includes("hero")) {
          modifiedFiles.push("Hero.tsx");
        }
        if (editPrompt.toLowerCase().includes("pricing")) {
          modifiedFiles.push("Pricing.tsx");
        }

        updateMsgContent(aiMsgId, "✅ Changes applied successfully!", {
          stages: EDIT_STAGES.map(s => ({ ...s, status: "done" })),
          files: modifiedFiles,
          credits: CREDIT_COSTS.ai_edit,
        });

        await saveChatToDB("assistant", `Applied: ${editPrompt}`, CREDIT_COSTS.ai_edit);

        if (isMobile) setActiveTab("preview");
      } else {
        updateMsgContent(aiMsgId, `❌ Edit failed: ${data.error}`);
      }
    } catch (err: any) {
      updateMsgContent(aiMsgId, `❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
      setPrompt("");
      promptRef.current = "";
    }
  };

  // ── Handle send ───────────────────────────────────────────────
  const handleSend = () => {
    const p = prompt.trim();
    if (!p) return;
    if (!result) {
      triggerGenerate(p);
    } else {
      triggerEdit(p);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
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

  // ── Download ──────────────────────────────────────────────────
  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <style>{`
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px) } to { opacity:1 } }
        .msg-enter { animation: fadeIn 0.25s ease; }
      `}</style>

      <div style={{
        height: "100dvh", display: "flex", flexDirection: "column",
        background: "#080808", color: "#fff",
        fontFamily: "'DM Sans', sans-serif",
        overflow: "hidden", position: "fixed", inset: 0, width: "100%",
      }}>

        {/* ── TOP BAR ── */}
<div style={{
  padding: "10px 14px", borderBottom: "1px solid #1c1c1c",
  display: "flex", alignItems: "center", gap: 8,
  background: "#0C0C0C", flexShrink: 0, minHeight: 52,
  position: "relative", zIndex: 100,
}}>

  {/* ── Logo + Lovable Style Dropdown ── */}
  <div style={{ position: "relative" }} ref={dropdownRef}>
    <button onClick={() => setShowDropdown(!showDropdown)} style={{
      display: "flex", alignItems: "center", gap: 6,
      background: "none", border: "none", cursor: "pointer", padding: 0,
    }}>
      <img src="/logo.png" alt="Kr"
        style={{ height: 52, width: "auto", objectFit: "contain" }} />
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="#555" strokeWidth="2.5">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </button>

    {/* ── DROPDOWN ── */}
    {showDropdown && (
      <div style={{
        position: "absolute", top: "calc(100% + 8px)", left: 0,
        background: "#111",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 14, padding: "6px", minWidth: 260,
        boxShadow: "0 16px 48px rgba(0,0,0,0.9)",
        animation: "dropIn 0.18s ease",
        maxHeight: "85vh", overflowY: "auto",
        scrollbarWidth: "none",
      }}>
        <style>{`
          @keyframes dropIn {
            from { opacity:0; transform:translateY(-6px); }
            to   { opacity:1; transform:translateY(0);    }
          }
        `}</style>

        {/* Go to Dashboard */}
        <button
          onClick={() => { router.push("/"); setShowDropdown(false); }}
          style={{
            width: "100%", textAlign: "left", padding: "9px 12px",
            background: "none", border: "none", color: "#888",
            fontSize: 13, cursor: "pointer", borderRadius: 8,
            display: "flex", alignItems: "center", gap: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#888"; }}
        >
          ← Go to Dashboard
        </button>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />

        {/* User + Plan */}
        <div style={{ padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              {displayName}
            </div>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "2px 10px",
              borderRadius: 20,
              background: "linear-gradient(135deg,#F5C542,#00D084)",
              color: "#000",
            }}>
              {planLabel.toUpperCase()}
            </span>
          </div>

          {/* Credits */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginTop: 8,
          }}>
            <span style={{ fontSize: 12, color: "#555" }}>Credits</span>
            <span
              onClick={() => { router.push("/settings?tab=billing"); setShowDropdown(false); }}
              style={{ fontSize: 12, color: "#00D084", fontWeight: 600, cursor: "pointer" }}
            >
              {remaining} left →
            </span>
          </div>
          <div style={{
            height: 3, background: "rgba(255,255,255,0.06)",
            borderRadius: 3, marginTop: 6, overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.max(0, (remaining / (credits?.total || 100)) * 100)}%`,
              background: remaining > 20
                ? "linear-gradient(90deg,#F5C542,#00D084)"
                : "#ef4444",
              borderRadius: 3, transition: "width 0.5s",
            }} />
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />

        {/* Menu Items */}
        {[
          { icon: "⚡", label: "Get free credits",  path: "/settings?tab=billing", gold: true  },
          { icon: "⚙️", label: "Settings",          path: "/settings",             shortcut: "Ctrl." },
          { icon: "🔗", label: "Connectors",        path: "/settings?tab=apikeys" },
          { icon: "⭐", label: "Templates",          path: "/templates" },
          { icon: "📊", label: "Analytics",          path: "/analytics" },
          null,
          { icon: "🔀", label: "Remix this project", action: () => {} },
          { icon: "👤", label: "Publish to profile", action: () => {} },
          { icon: "✏️", label: "Rename project",     action: () => setEditingName(true) },
          { icon: "⭐", label: "Star project",        action: () => {} },
          { icon: "📁", label: "Move to folder",     action: () => {} },
          { icon: "ℹ️", label: "Details",            action: () => {} },
          null,
          { icon: "🎨", label: "Appearance",         path: "/settings?tab=theme", arrow: true },
          null,
          { icon: "❓", label: "Help",               path: "/landing#faq" },
        ].map((item, i) => {
          if (item === null) {
            return (
              <div key={i} style={{
                height: 1, background: "rgba(255,255,255,0.07)",
                margin: "4px 0",
              }} />
            );
          }
          return (
            <button key={item.label}
              onClick={() => {
                if ((item as any).path) router.push((item as any).path);
                if ((item as any).action) (item as any).action();
                setShowDropdown(false);
              }}
              style={{
                width: "100%", textAlign: "left",
                padding: "8px 12px", background: "none", border: "none",
                color: (item as any).gold ? "#F5C542" : "#888",
                fontSize: 13, cursor: "pointer", borderRadius: 8,
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "#1a1a1a";
                e.currentTarget.style.color = (item as any).gold ? "#F5C542" : "#fff";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.color = (item as any).gold ? "#F5C542" : "#888";
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                {item.icon} {item.label}
              </span>
              <span style={{ fontSize: 11, color: "#444" }}>
                {(item as any).shortcut || ((item as any).arrow ? "›" : "")}
              </span>
            </button>
          );
        })}
      </div>
    )}
  </div>

  {/* ── Project Name ── */}
  {editingName ? (
    <input autoFocus value={projectName}
      onChange={e => setProjectName(e.target.value)}
      onBlur={() => setEditingName(false)}
      onKeyDown={e => e.key === "Enter" && setEditingName(false)}
      style={{
        background: "#161616", border: "1px solid #F5C542",
        borderRadius: 7, color: "#fff", padding: "4px 8px",
        fontSize: 12, fontWeight: 600, outline: "none", flex: 1,
      }}
    />
  ) : (
    <button onClick={() => setEditingName(true)} style={{
      background: "none", border: "none", color: "#888",
      fontSize: 12, fontWeight: 500, cursor: "pointer",
      padding: "4px 6px", borderRadius: 7, flex: 1,
      textAlign: "left", overflow: "hidden",
      textOverflow: "ellipsis", whiteSpace: "nowrap",
    }}>
      {projectName} ✏
    </button>
  )}

  {/* ── Mobile Chat/Preview Tabs ── */}
  {isMobile && (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      {["chat", "preview"].map(t => (
        <button key={t} onClick={() => setActiveTab(t as any)} style={{
          padding: "4px 10px", borderRadius: 6, border: "none",
          background: activeTab === t ? "#F5C542" : "#1c1c1c",
          color: activeTab === t ? "#080808" : "#fff",
          fontSize: 11, cursor: "pointer",
          fontWeight: activeTab === t ? 700 : 400,
          textTransform: "capitalize",
        }}>{t}</button>
      ))}
    </div>
  )}

  {/* ── Right Side ── */}
  <div style={{
    display: "flex", gap: 6, alignItems: "center",
    flexShrink: 0, marginLeft: "auto",
  }}>
    {/* Credits badge */}
    <div style={{
      padding: "4px 10px", borderRadius: 6,
      background: remaining > 20
        ? "rgba(0,208,132,0.1)"
        : "rgba(239,68,68,0.1)",
      border: `1px solid ${remaining > 20
        ? "rgba(0,208,132,0.3)"
        : "rgba(239,68,68,0.3)"}`,
      fontSize: 11,
      color: remaining > 20 ? "#00D084" : "#ef4444",
      fontWeight: 700,
    }}>
      ⚡ {remaining}
    </div>

    {result && (
      <>
        <button
          onClick={() => { setSaving(true); saveProject(result, projectName); }}
          disabled={saving}
          style={{
            padding: "5px 10px",
            background: saved
              ? "rgba(0,208,132,0.15)"
              : "rgba(245,197,66,0.15)",
            border: saved
              ? "1px solid rgba(0,208,132,0.3)"
              : "1px solid rgba(245,197,66,0.3)",
            borderRadius: 7,
            color: saved ? "#00D084" : "#F5C542",
            cursor: "pointer", fontSize: 11, fontWeight: 600,
          }}
        >
          {saving ? "..." : saved ? "✓ Saved" : "Save"}
        </button>
        {!isMobile && (
          <button onClick={handleDownload} style={{
            padding: "5px 10px", background: "#161616",
            border: "1px solid #1c1c1c", borderRadius: 7,
            color: "#9ca3af", cursor: "pointer", fontSize: 11,
          }}>Export</button>
        )}
      </>
    )}
  </div>
</div>
        
  
        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── LEFT — Chat ── */}
          <div style={{
            width: isMobile ? "100%" : "50%",
            display: isMobile ? (activeTab === "chat" ? "flex" : "none") : "flex",
            flexDirection: "column",
            borderRight: isMobile ? "none" : "1px solid #1c1c1c",
            background: "#0A0A0A", flexShrink: 0,
          }}>

            {/* Credits bar */}
            <CreditsBar credits={credits} onUpgrade={() => router.push("/settings?tab=billing")} />

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: "auto", padding: 12,
              display: "flex", flexDirection: "column", gap: 12,
              scrollbarWidth: "none",
            }}>
              {messages.length === 0 && (
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 12, opacity: 0.5, textAlign: "center", padding: 20,
                }}>
                  <img src="/logo.png" alt="Kr" style={{ width: 48, height: 48 }} />
                  <p style={{ color: "#555", fontSize: 13, margin: 0 }}>
                    Describe what you want to build
                  </p>
                  <p style={{ color: "#333", fontSize: 11, margin: 0 }}>
                    Costs {CREDIT_COSTS.new_project} credits per generation
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className="msg-enter" style={{
                  display: "flex", flexDirection: "column",
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  gap: 3,
                }}>
                  {/* Bubble */}
                  <div style={{
                    maxWidth: "90%",
                    padding: msg.role === "ai" ? "10px 12px" : "9px 13px",
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: msg.role === "user"
                      ? "linear-gradient(135deg,rgba(245,197,66,0.2),rgba(245,197,66,0.1))"
                      : "#161616",
                    border: msg.role === "ai" ? "1px solid #222" : "1px solid rgba(245,197,66,0.2)",
                    color: "#e8e8e8", fontSize: 13, lineHeight: 1.6,
                  }}>
                    {msg.role === "ai" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <img src="/logo.png" alt="Kr" style={{ width: 16, height: 16 }} />
                        <span style={{ fontSize: 10, color: "#555" }}>Krypton AI</span>
                      </div>
                    )}

                    {msg.content && <div>{msg.content}</div>}

                    {/* Stages */}
                    {msg.stages && <StageDisplay stages={msg.stages} />}

                    {/* Modified files */}
                    {msg.files && <FilesDisplay files={msg.files} />}

                    {/* Credits used */}
                    {msg.credits && (
                      <div style={{
                        marginTop: 8, fontSize: 10.5, color: "#444",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        ⚡ {msg.credits} credits used
                      </div>
                    )}
                  </div>

                  <span style={{ fontSize: 10, color: "#333" }}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              ))}

              <div ref={chatEndRef} />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                margin: "0 12px 8px", padding: "8px 12px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 8, color: "#ef4444", fontSize: 12,
              }}>
                ⚠ {error}
              </div>
            )}

            {/* Input */}
            <div style={{
              padding: "10px 12px", borderTop: "1px solid #1c1c1c",
              background: "#0C0C0C", flexShrink: 0,
            }}>
              {result && (
                <div style={{
                  marginBottom: 6, fontSize: 10.5, color: "#555",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  ✏ Edit mode — {CREDIT_COSTS.ai_edit} credit per edit
                </div>
              )}
              <div style={{
                background: "#161616", border: "1px solid #2a2a2a",
                borderRadius: 14, padding: "10px 12px",
              }}>
                <textarea
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); promptRef.current = e.target.value; }}
                  placeholder={result
                    ? "Make hero section larger, add dark mode..."
                    : "Describe what you want to build..."}
                  rows={3}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  style={{
                    width: "100%", background: "none", border: "none",
                    color: "#fff", fontSize: 14, resize: "none",
                    outline: "none", fontFamily: "'DM Sans', sans-serif",
                    lineHeight: 1.6, boxSizing: "border-box",
                    opacity: loading ? 0.5 : 1,
                  }}
                />
                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", marginTop: 6,
                  paddingTop: 8, borderTop: "1px solid #1c1c1c",
                }}>
                  <input ref={fileInputRef} type="file" accept="image/*,.txt,.html"
                    style={{ display: "none" }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPrompt(p => p + `\n[File: ${file.name}]`);
                        promptRef.current = prompt + `\n[File: ${file.name}]`;
                      }
                    }}
                  />
                  <button onClick={() => fileInputRef.current?.click()} style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: "#2a2a2a", border: "none", color: "#9ca3af",
                    fontSize: 20, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>+</button>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleVoice} style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: listening ? "#F5C542" : "#2a2a2a",
                      border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="2" width="6" height="11" rx="3"
                          fill={listening ? "#080808" : "#9ca3af"}/>
                        <path d="M5 11a7 7 0 0014 0" stroke={listening ? "#080808" : "#9ca3af"}
                          strokeWidth="2" strokeLinecap="round"/>
                        <line x1="12" y1="18" x2="12" y2="22"
                          stroke={listening ? "#080808" : "#9ca3af"} strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>

                    <button onClick={handleSend}
                      disabled={loading || !prompt.trim() || remaining < 1}
                      style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: !loading && prompt.trim() && remaining >= 1
                          ? "linear-gradient(135deg,#F5C542,#00D084)"
                          : "#1a1a1a",
                        border: "none",
                        cursor: !loading && prompt.trim() && remaining >= 1 ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s",
                      }}>
                      {loading ? (
                        <span style={{
                          width: 14, height: 14, borderRadius: "50%",
                          border: "2px solid rgba(255,255,255,0.3)",
                          borderTopColor: "#fff",
                          animation: "dot-pulse 0.8s linear infinite",
                          display: "inline-block",
                        }}/>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path d="M12 19V5M5 12l7-7 7 7"
                            stroke={prompt.trim() ? "#080808" : "#444"}
                            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 10, color: "#2a2a2a", margin: "5px 0 0", textAlign: "center" }}>
                Enter to send · Shift+Enter new line
              </p>
            </div>
          </div>

          {/* ── RIGHT — Preview / History / Export ── */}
          <div style={{
            flex: 1,
            display: isMobile ? (activeTab === "preview" ? "flex" : "none") : "flex",
            flexDirection: "column", overflow: "hidden",
          }}>

            {/* Right tabs */}
            <div style={{
              display: "flex", gap: 4, padding: "8px 12px",
              borderBottom: "1px solid #1c1c1c", background: "#0C0C0C",
              flexShrink: 0,
            }}>
              {[
                { id: "preview", label: "✨ Preview" },
                { id: "history", label: "⏱ History" },
                { id: "export",  label: "📤 Export"  },
              ].map(tab => (
                <button key={tab.id} onClick={() => setRightTab(tab.id as RightTab)} style={{
                  padding: "5px 14px", borderRadius: 8,
                  border: rightTab === tab.id
                    ? "1px solid rgba(245,197,66,0.3)"
                    : "1px solid transparent",
                  background: rightTab === tab.id
                    ? "rgba(245,197,66,0.1)"
                    : "rgba(255,255,255,0.04)",
                  color: rightTab === tab.id ? "#F5C542" : "#555",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.18s",
                }}>{tab.label}</button>
              ))}

              {/* Live indicator */}
              {result && (
                <div style={{
                  marginLeft: "auto", display: "flex",
                  alignItems: "center", gap: 6, fontSize: 11, color: "#00D084",
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#00D084", animation: "dot-pulse 2s infinite",
                  }}/>
                  Live Preview
                </div>
              )}
            </div>

            {/* Preview */}
            {rightTab === "preview" && (
              <div style={{ flex: 1, background: "#111", overflow: "hidden" }}>
                {result ? (
                  <iframe
                    key={result.length} // Re-render on update
                    srcDoc={result}
                    style={{ width: "100%", height: "100%", border: "none" }}
                    sandbox="allow-scripts allow-same-origin"
                    title="Preview"
                  />
                ) : (
                  <div style={{
                    height: "100%", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 12, color: "#333",
                  }}>
                    <div style={{ fontSize: 48 }}>✨</div>
                    <p style={{ fontSize: 14 }}>Generate something to preview</p>
                  </div>
                )}
              </div>
            )}

            {/* Version History */}
            {rightTab === "history" && (
              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 14 }}>
                  ⏱ Version History
                </div>
                {versions.length === 0 ? (
                  <div style={{ color: "#444", textAlign: "center", padding: 40, fontSize: 13 }}>
                    No versions yet. Generate a project first!
                  </div>
                ) : (
                  versions.map((v, i) => (
                    <div key={v.id || i} style={{
                      background: "#0d0d0d",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10, padding: "12px 14px", marginBottom: 8,
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: "rgba(245,197,66,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 800, color: "#F5C542",
                      }}>v{v.version_number}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#e8e8e8" }}>{v.message}</div>
                        <div style={{ fontSize: 10.5, color: "#444", marginTop: 3 }}>
                          {new Date(v.created_at).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const code = v.code_snapshot?.["index.html"];
                          if (code) setResult(code);
                        }}
                        style={{
                          padding: "5px 12px", borderRadius: 6,
                          border: "1px solid rgba(245,197,66,0.3)",
                          background: "rgba(245,197,66,0.08)",
                          color: "#F5C542", fontSize: 11.5, cursor: "pointer",
                        }}
                      >↩ Restore</button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Export */}
            {rightTab === "export" && (
              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
                  📤 Export Options
                </div>
                {[
                  { label: "Download HTML", icon: "⬇", action: handleDownload },
                  { label: "Copy Code", icon: "📋", action: () => result && navigator.clipboard.writeText(result) },
                  { label: "Open in New Tab", icon: "↗", action: () => {
                    const w = window.open("", "_blank");
                    if (w) { w.document.write(result); w.document.close(); }
                  }},
                ].map(opt => (
                  <button key={opt.label} onClick={opt.action} disabled={!result} style={{
                    width: "100%", marginBottom: 10, padding: "12px 16px",
                    background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10, color: result ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s",
                    textAlign: "left",
                  }}>
                    <span style={{ fontSize: 18 }}>{opt.icon}</span>
                    {opt.label}
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
      <div style={{
        height: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#080808", color: "#F5C542",
      }}>
        Loading...
      </div>
    }>
      <CreatePage />
    </Suspense>
  );
}
