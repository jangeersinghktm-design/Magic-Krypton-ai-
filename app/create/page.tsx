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

function CreatePage() {
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
  const [listening, setListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const silenceTimer = useRef<any>(null);

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
        setMessages((prev) => [...prev, { role: "ai", content: "Done! Preview it on the right, download or save to dashboard.", timestamp: new Date() }]);
        if (isMobile) setActiveTab("preview");
      } else {
        setError(data.error || "Generation failed");
        setMessages((prev) => [...prev, { role: "ai", content: `Something went wrong. Please try again.`, timestamp: new Date() }]);
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

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported"); return; }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setUserPrompt(transcript);
      promptRef.current = transcript;
      clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => recognition.stop(), 5000);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await saveProject({ title: projectName, prompt: messages.find((m) => m.role === "user")?.content || projectName, html_code: result });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) { console.error(err); }
    finally { setSaving(false); }
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const msg = `[Image: ${file.name}] Use as reference.`;
      setUserPrompt((prev) => prev ? prev + "\n" + msg : msg);
      promptRef.current = userPrompt ? userPrompt + "\n" + msg : msg;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const msg = `[File: ${file.name}]\n${(reader.result as string).slice(0, 800)}`;
        setUserPrompt((prev) => prev ? prev + "\n" + msg : msg);
        promptRef.current = userPrompt ? userPrompt + "\n" + msg : msg;
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const previewWidth = previewMode === "desktop" ? "100%" : previewMode === "tablet" ? "768px" : "375px";
  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#080808", color: "#fff", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", position: "fixed", inset: 0, width: "100%" }}>

      {/* TOP BAR */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #1c1c1c", display: "flex", alignItems: "center", gap: "8px", background: "#0C0C0C", flexShrink: 0, minHeight: "52px" }}>
        <button onClick={() => router.push("/")} style={{ background: "#161616", border: "1px solid #1c1c1c", borderRadius: "8px", color: "#fff", cursor: "pointer", fontSize: "16px", padding: "5px 10px", fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
          &larr;
        </button>
        <div style={{ width: "24px", height: "24px", background: "#FFC107", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L3 7v6l7 5 7-5V7L10 2z" fill="#080808" />
            <path d="M10 6l-4 3v2l4 3 4-3V9L10 6z" fill="#FFC107" opacity="0.8" />
          </svg>
        </div>

        {editingName ? (
          <input autoFocus value={projectName} onChange={(e) => setProjectName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={(e) => e.key === "Enter" && setEditingName(false)} style={{ background: "#161616", border: "1px solid #FFC107", borderRadius: "7px", color: "#fff", padding: "4px 8px", fontSize: "12px", fontWeight: 600, outline: "none", flex: 1, minWidth: 0 }} />
        ) : (
          <button onClick={() => setEditingName(true)} style={{ background: "none", border: "none", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", padding: "4px 6px", borderRadius: "7px", display: "flex", alignItems: "center", gap: "4px", flex: 1, minWidth: 0, overflow: "hidden" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{projectName}</span>
            <span style={{ fontSize: "11px", color: "#555", flexShrink: 0 }}>&#9998;</span>
          </button>
        )}

        {isMobile && (
          <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
            <button onClick={() => setActiveTab("chat")} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", background: activeTab === "chat" ? "#FFC107" : "#1c1c1c", color: activeTab === "chat" ? "#080808" : "#fff", fontSize: "11px", cursor: "pointer", fontWeight: activeTab === "chat" ? 700 : 400 }}>Chat</button>
            <button onClick={() => setActiveTab("preview")} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", background: activeTab === "preview" ? "#FFC107" : "#1c1c1c", color: activeTab === "preview" ? "#080808" : "#fff", fontSize: "11px", cursor: "pointer", fontWeight: activeTab === "preview" ? 700 : 400 }}>Preview</button>
          </div>
        )}

        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexShrink: 0 }}>
          {result && (
            <>
              <button onClick={handleSave} disabled={saving} style={{ padding: "5px 10px", background: saved ? "rgba(0,255,149,0.15)" : "rgba(255,193,7,0.15)", border: saved ? "1px solid rgba(0,255,149,0.3)" : "1px solid rgba(255,193,7,0.3)", borderRadius: "7px", color: saved ? "#00FF95" : "#FFC107", cursor: "pointer", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}>
                {saving ? "..." : saved ? "Saved!" : "Save"}
              </button>
              {!isMobile && (
                <>
                  <button onClick={handleDownload} style={{ padding: "5px 10px", background: "#161616", border: "1px solid #1c1c1c", borderRadius: "7px", color: "#9ca3af", cursor: "pointer", fontSize: "11px" }}>Export</button>
                  <button onClick={handleOpenTab} style={{ padding: "5px 10px", background: "#161616", border: "1px solid #1c1c1c", borderRadius: "7px", color: "#9ca3af", cursor: "pointer", fontSize: "11px" }}>Open</button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT - Chat */}
        <div style={{ width: isMobile ? "100%" : "320px", display: isMobile ? (activeTab === "chat" ? "flex" : "none") : "flex", flexDirection: "column", borderRight: isMobile ? "none" : "1px solid #1c1c1c", background: "#0A0A0A", flexShrink: 0 }}>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.length === 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", opacity: 0.4, minHeight: "150px" }}>
                <div style={{ width: "40px", height: "40px", background: "#FFC107", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2L3 7v6l7 5 7-5V7L10 2z" fill="#080808" />
                    <path d="M10 6l-4 3v2l4 3 4-3V9L10 6z" fill="#FFC107" opacity="0.8" />
                  </svg>
                </div>
                <p style={{ color: "#555", fontSize: "13px", textAlign: "center", margin: 0 }}>Describe what you want to build</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: "3px" }}>
                <div style={{ maxWidth: "88%", padding: "9px 13px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: msg.role === "user" ? "#FFC107" : "#161616", color: msg.role === "user" ? "#080808" : "#fff", fontSize: "13px", lineHeight: 1.6, border: msg.role === "ai" ? "1px solid #1c1c1c" : "none" }}>
                  {msg.role === "ai" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
                      <div style={{ width: "14px", height: "14px", background: "#FFC107", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "#080808", fontWeight: 700 }}>K</div>
                      <span style={{ fontSize: "10px", color: "#555" }}>Krypton AI</span>
                    </div>
                  )}
                  {msg.content}
                </div>
                <span style={{ fontSize: "10px", color: "#444" }}>{formatTime(msg.timestamp)}</span>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "3px" }}>
                <div style={{ padding: "9px 13px", borderRadius: "14px 14px 14px 4px", background: "#161616", border: "1px solid #1c1c1c" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "7px" }}>
                    <div style={{ width: "14px", height: "14px", background: "#FFC107", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "#080808", fontWeight: 700 }}>K</div>
                    <span style={{ fontSize: "10px", color: "#555" }}>Krypton AI</span>
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#FFC107", opacity: 0.6 }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid #1c1c1c", background: "#0C0C0C", flexShrink: 0 }}>
            {error && (
              <div style={{ padding: "7px 10px", background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.15)", borderRadius: "8px", color: "#ff4d4d", fontSize: "12px", marginBottom: "8px" }}>
                {error}
              </div>
            )}
            <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: "14px", padding: "10px 12px" }}>
              <textarea
                value={userPrompt}
                onChange={handlePromptChange}
                placeholder={result ? "Follow-up instruction..." : "Describe what you want to build..."}
                rows={3}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                style={{ width: "100%", background: "none", border: "none", color: "#fff", fontSize: "14px", resize: "none", outline: "none", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px", paddingTop: "8px", borderTop: "1px solid #1c1c1c" }}>
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*,.txt,.html,.css,.js,.pdf" onChange={handleFileUpload} style={{ display: "none" }} />
                  <button onClick={() => fileInputRef.current?.click()} style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#2a2a2a", border: "none", color: "#9ca3af", fontSize: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 300 }}>
                    +
                  </button>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button onClick={handleVoice} style={{ width: "34px", height: "34px", borderRadius: "50%", background: listening ? "#FFC107" : "#2a2a2a", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                    {listening ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="8" width="3" height="8" rx="1.5" fill="#080808"/>
                        <rect x="7" y="5" width="3" height="14" rx="1.5" fill="#080808"/>
                        <rect x="12" y="3" width="3" height="18" rx="1.5" fill="#080808"/>
                        <rect x="17" y="6" width="3" height="12" rx="1.5" fill="#080808"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="2" width="6" height="11" rx="3" fill="#9ca3af"/>
                        <path d="M5 11a7 7 0 0 0 14 0" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="12" y1="18" x2="12" y2="22" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="8" y1="22" x2="16" y2="22" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                  <button onClick={handleGenerate} disabled={loading || !userPrompt.trim()} style={{ width: "34px", height: "34px", borderRadius: "50%", background: userPrompt.trim() && !loading ? "#FFC107" : "#1a1a1a", border: "none", cursor: userPrompt.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                    {loading ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <rect x="7" y="7" width="10" height="10" rx="2" fill="#555"/>
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path d="M12 19V5M5 12l7-7 7 7" stroke={userPrompt.trim() ? "#080808" : "#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <p style={{ fontSize: "10px", color: "#2a2a2a", margin: "5px 0 0", textAlign: "center" }}>Enter to send · Shift+Enter new line</p>
          </div>
        </div>

         {/* RIGHT - Preview */}
        <div style={{ flex: 1, display: isMobile ? (activeTab === "preview" ? "flex" : "none") : "flex", flexDirection: "column", background: "#111", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #1c1c1c", display: "flex", alignItems: "center", gap: "8px", background: "#0C0C0C", flexShrink: 0 }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: loading ? "#FFC107" : result ? "#22c55e" : "#374151", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "#555" }}>
              {loading ? "Building..." : result ? "Preview ready" : "Preview"}
            </span>
            {result && !isMobile && (
              <div style={{ display: "flex", gap: "4px", marginLeft: "auto" }}>
                {(["desktop", "tablet", "mobile"] as PreviewMode[]).map((mode) => (
                  <button key={mode} onClick={() => setPreviewMode(mode)} style={{ padding: "3px 8px", borderRadius: "6px", border: "none", background: previewMode === mode ? "#FFC107" : "#161616", color: previewMode === mode ? "#080808" : "#9ca3af", fontSize: "11px", cursor: "pointer", fontWeight: previewMode === mode ? 700 : 400 }}>
                    {mode === "desktop" ? "Desktop" : mode === "tablet" ? "Tablet" : "Mobile"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", background: "#0d0d0d", padding: result && previewMode !== "desktop" && !isMobile ? "20px" : "0" }}>
            {result ? (
              <div style={{ width: isMobile ? "100%" : previewWidth, height: "100%", transition: "width 0.3s ease", flexShrink: 0 }}>
                <iframe key={result.substring(0, 50) + previewMode} srcDoc={result} style={{ width: "100%", height: "100%", border: "none", display: "block", background: "#fff" }} title="Preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" />
              </div>
            ) : (
              <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
                <div style={{ width: "48px", height: "48px", background: "#111", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #1c1c1c" }}>
                  <svg width="24" height="24" viewBox="0 0 20 20" fill="none" opacity={0.3}>
                    <path d="M10 2L3 7v6l7 5 7-5V7L10 2z" fill="#FFC107" />
                  </svg>
                </div>
                <p style={{ color: "#2a2a2a", margin: 0, fontSize: "13px" }}>Your creation will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
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
