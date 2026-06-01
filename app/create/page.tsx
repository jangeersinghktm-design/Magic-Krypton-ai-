"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveProject } from "@/lib/saveProject";

type Message = {
  role: "user" | "ai";
  content: string;
  timestamp: Date;
};

type PreviewMode = "desktop" | "tablet" | "mobile";

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [userPrompt, setUserPrompt] = useState("");
  const promptRef = useRef("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "preview">("chat");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [editingName, setEditingName] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [messages, setMessages] = useState<Message[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/auth/login");
    };
    checkAuth();
  }, []);

  // Auto-generate if prompt passed from home page
  useEffect(() => {
    const p = searchParams.get("prompt");
    const t = searchParams.get("type");
    if (p) {
      const decoded = decodeURIComponent(p);
      setUserPrompt(decoded);
      promptRef.current = decoded;
      if (t) setProjectName(`${t}: ${decoded.slice(0, 30)}`);
      else setProjectName(decoded.slice(0, 40));
      setTimeout(() => triggerGenerate(decoded), 300);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const triggerGenerate = async (overridePrompt?: string) => {
    const p = overridePrompt || promptRef.current;
    if (!p.trim()) return;
    setLoading(true);
    setResult("");
    setError("");
    setSaved(false);

    const userMsg: Message = { role: "user", content: p, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    if (isMobile) setActiveTab("preview");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const data = await response.json();
      if (data.html) {
        setResult(data.html);
        if (!overridePrompt) setProjectName(p.slice(0, 40) || "Untitled Project");
        const aiMsg: Message = {
          role: "ai",
          content: "Done! Your project is ready. You can preview it on the right, download it, or save it to your dashboard.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        if (isMobile) setActiveTab("preview");
      } else {
        setError(data.error || "Generation failed");
        const aiMsg: Message = {
          role: "ai",
          content: `Something went wrong: ${data.error || "Generation failed"}. Please try again.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        if (isMobile) setActiveTab("chat");
      }
    } catch (err: any) {
      setError(err.message);
      if (isMobile) setActiveTab("chat");
    } finally {
      setLoading(false);
      setUserPrompt("");
      promptRef.current = "";
    }
  };

  const handleGenerate = () => triggerGenerate();

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserPrompt(e.target.value);
    promptRef.current = e.target.value;
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await saveProject({
        title: projectName,
        prompt: messages.find((m) => m.role === "user")?.content || projectName,
        html_code: result,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenTab = () => {
    const w = window.open("", "_blank");
    if (w) { w.document.write(result); w.document.close(); }
  };

  const previewWidth = previewMode === "desktop" ? "100%" : previewMode === "tablet" ? "768px" : "375px";

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#080808", color: "#fff", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", position: "fixed", inset: 0, width: "100%" }}>

      {/* TOP BAR */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1c1c1c", display: "flex", alignItems: "center", gap: "10px", background: "#0C0C0C", flexShrink: 0 }}>

        {/* Back */}
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "18px", padding: "4px 8px" }}>
          ←
        </button>

        {/* Logo */}
        <div style={{ width: "24px", height: "24px", background: "#FFC107", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L3 7v6l7 5 7-5V7L10 2z" fill="#080808" />
            <path d="M10 6l-4 3v2l4 3 4-3V9L10 6z" fill="#FFC107" opacity="0.8" />
          </svg>
        </div>

        {/* Project Name */}
        {editingName ? (
          <input
            autoFocus
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
            style={{ background: "#161616", border: "1px solid #FFC107", borderRadius: "7px", color: "#fff", padding: "4px 10px", fontSize: "13px", fontWeight: 600, outline: "none", width: "200px" }}
          />
        ) : (
          <button onClick={() => setEditingName(true)} style={{ background: "none", border: "none", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: "4px 8px", borderRadius: "7px" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#161616"}
            onMouseLeave={(e) => e.currentTarget.style.background = "none"}
          >
            {projectName} ✏️
          </button>
        )}

        {/* Mobile tabs */}
        {isMobile && (
          <div style={{ display: "flex", gap: "6px", marginLeft: "8px" }}>
            <button onClick={() => setActiveTab("chat")} style={{ padding: "4px 12px", borderRadius: "6px", border: "none", background: activeTab === "chat" ? "#FFC107" : "#1c1c1c", color: activeTab === "chat" ? "#080808" : "#fff", fontSize: "12px", cursor: "pointer", fontWeight: activeTab === "chat" ? 700 : 400 }}>
              Chat
            </button>
            <button onClick={() => setActiveTab("preview")} style={{ padding: "4px 12px", borderRadius: "6px", border: "none", background: activeTab === "preview" ? "#FFC107" : "#1c1c1c", color: activeTab === "preview" ? "#080808" : "#fff", fontSize: "12px", cursor: "pointer", fontWeight: activeTab === "preview" ? 700 : 400 }}>
              Preview {result && "✅"}
            </button>
          </div>
        )}

        {/* Right actions */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
          {result && (
            <>
              <button onClick={handleSave} disabled={saving} style={{ padding: "6px 12px", background: saved ? "rgba(0,255,149,0.15)" : "rgba(255,193,7,0.15)", border: saved ? "1px solid rgba(0,255,149,0.3)" : "1px solid rgba(255,193,7,0.3)", borderRadius: "7px", color: saved ? "#00FF95" : "#FFC107", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                {saving ? "Saving..." : saved ? "✓ Saved!" : "💾 Save"}
              </button>
              <button onClick={handleDownload} style={{ padding: "6px 12px", background: "#161616", border: "1px solid #1c1c1c", borderRadius: "7px", color: "#9ca3af", cursor: "pointer", fontSize: "12px" }}>
                ⬇ Export
              </button>
              <button onClick={handleOpenTab} style={{ padding: "6px 12px", background: "#161616", border: "1px solid #1c1c1c", borderRadius: "7px", color: "#9ca3af", cursor: "pointer", fontSize: "12px" }}>
                🔗 Open
              </button>
            </>
          )}
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT — Chat Panel */}
        <div style={{ width: isMobile ? "100%" : "340px", display: isMobile ? (activeTab === "chat" ? "flex" : "none") : "flex", flexDirection: "column", borderRight: isMobile ? "none" : "1px solid #1c1c1c", background: "#0A0A0A", flexShrink: 0 }}>

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {messages.length === 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", opacity: 0.4 }}>
                <span style={{ fontSize: "40px" }}>⚡</span>
                <p style={{ color: "#555", fontSize: "13px", textAlign: "center", margin: 0 }}>Describe what you want to build</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: "4px" }}>
                <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: msg.role === "user" ? "#FFC107" : "#161616", color: msg.role === "user" ? "#080808" : "#fff", fontSize: "13px", lineHeight: 1.6, border: msg.role === "ai" ? "1px solid #1c1c1c" : "none" }}>
                  {msg.role === "ai" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <div style={{ width: "16px", height: "16px", background: "#FFC107", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px" }}>K</div>
                      <span style={{ fontSize: "11px", color: "#555" }}>Krypton AI</span>
                    </div>
                  )}
                  {msg.content}
                </div>
                <span style={{ fontSize: "10px", color: "#444" }}>{formatTime(msg.timestamp)}</span>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                <div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "#161616", border: "1px solid #1c1c1c" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <div style={{ width: "16px", height: "16px", background: "#FFC107", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px" }}>K</div>
                    <span style={{ fontSize: "11px", color: "#555" }}>Krypton AI</span>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FFC107", animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: "12px", borderTop: "1px solid #1c1c1c", background: "#0C0C0C" }}>
            {error && (
              <div style={{ padding: "8px 12px", background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.15)", borderRadius: "8px", color: "#ff4d4d", fontSize: "12px", marginBottom: "8px" }}>
                ❌ {error}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <textarea
                value={userPrompt}
                onChange={handlePromptChange}
                placeholder={result ? "Follow-up instruction..." : "Describe what you want to build..."}
                rows={2}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                style={{ flex: 1, background: "#161616", border: "1px solid #1c1c1c", borderRadius: "10px", color: "#fff", padding: "10px 12px", fontSize: "13px", resize: "none", outline: "none", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}
                onFocus={(e) => e.target.style.borderColor = "#FFC107"}
                onBlur={(e) => e.target.style.borderColor = "#1c1c1c"}
              />
              <button onClick={handleGenerate} disabled={loading || !userPrompt.trim()} style={{ width: "38px", height: "38px", borderRadius: "50%", background: userPrompt.trim() ? "#FFC107" : "#1c1c1c", border: "none", cursor: userPrompt.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: userPrompt.trim() ? "#080808" : "#333", flexShrink: 0 }}>
                ↑
              </button>
            </div>
            <p style={{ fontSize: "10px", color: "#333", margin: "6px 0 0", textAlign: "center" }}>Enter to send · Shift+Enter for new line</p>
          </div>
        </div>

        {/* RIGHT — Preview Panel */}
        <div style={{ flex: 1, display: isMobile ? (activeTab === "preview" ? "flex" : "none") : "flex", flexDirection: "column", background: "#111", overflow: "hidden" }}>

          {/* Preview header */}
          <div style={{ padding: "8px 14px", borderBottom: "1px solid #1c1c1c", display: "flex", alignItems: "center", gap: "8px", background: "#0C0C0C", flexShrink: 0 }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: loading ? "#f59e0b" : result ? "#22c55e" : "#374151" }} />
            <span style={{ fontSize: "12px", color: "#555" }}>
              {loading ? "⚡ Building..." : result ? "✅ Preview ready" : "Preview"}
            </span>

            {/* Preview mode tabs */}
            {result && (
              <div style={{ display: "flex", gap: "4px", marginLeft: "auto" }}>
                {(["desktop", "tablet", "mobile"] as PreviewMode[]).map((mode) => (
                  <button key={mode} onClick={() => setPreviewMode(mode)} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", background: previewMode === mode ? "#FFC107" : "#161616", color: previewMode === mode ? "#080808" : "#9ca3af", fontSize: "11px", cursor: "pointer", fontWeight: previewMode === mode ? 700 : 400 }}>
                    {mode === "desktop" ? "🖥" : mode === "tablet" ? "📱" : "📲"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview content */}
          <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", background: "#0d0d0d", padding: result && previewMode !== "desktop" ? "20px" : "0" }}>
            {result ? (
              <div style={{ width: previewWidth, height: "100%", transition: "width 0.3s ease", flexShrink: 0 }}>
                <iframe
                  key={result.substring(0, 50) + previewMode}
                  srcDoc={result}
                  style={{ width: "100%", height: "100%", border: "none", display: "block", background: "#ffffff" }}
                  title="Krypton AI Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
              </div>
            ) : (
              <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
                <span style={{ fontSize: "64px", opacity: 0.08 }}>⚡</span>
                <p style={{ color: "#2a2a2a", margin: 0, fontSize: "15px" }}>Your creation will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
  } 

  export default function CreatePageWrapper() {
  return (
    <Suspense fallback={<div style={{ background: "#080808", height: "100vh" }} />}>
      <CreatePage />
    </Suspense>
  );
  }
