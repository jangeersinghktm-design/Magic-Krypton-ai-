"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveProject } from "@/lib/saveProject";

export default function CreatePage() {
  const router = useRouter();
  const supabase = createClient();
  const [userPrompt, setUserPrompt] = useState<string>("");
  const promptRef = useRef<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"input" | "preview">("input");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setUserPrompt(value);
    promptRef.current = value;
  };

  const handleGenerate = async () => {
    if (!promptRef.current.trim()) return;
    setLoading(true);
    setResult("");
    setError("");
    setSaved(false);
    if (isMobile) setActiveTab("preview");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptRef.current }),
      });
      const data = await response.json();
      if (data.html) {
        setResult(data.html);
      } else {
        setError(data.error || "Generation failed");
        if (isMobile) setActiveTab("input");
      }
    } catch (err: any) {
      setError(err.message);
      if (isMobile) setActiveTab("input");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await saveProject({
        title: promptRef.current.slice(0, 50) || "Untitled Project",
        prompt: promptRef.current,
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
    a.download = "krypton-creation.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenTab = () => {
    const w = window.open("", "_blank");
    if (w) { w.document.write(result); w.document.close(); }
  };

  const examples = [
    "Restaurant website with menu",
    "Snake game in JavaScript",
    "Portfolio for a designer",
    "Calculator app",
    "Todo list app",
    "E-commerce landing page",
    "Fitness gym website",
    "2048 puzzle game",
  ];

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      overflow: "hidden",
      position: "fixed",
      inset: 0,
      width: "100%",
    }}>

      {/* TOP BAR */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid #1f1f1f",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "#000",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "18px" }}>⚡</span>
        <span style={{ fontSize: "15px", fontWeight: "700", color: "#FFC107" }}>Krypton AI</span>

        {isMobile && (
          <div style={{ display: "flex", gap: "6px", marginLeft: "8px" }}>
            <button
              onClick={() => setActiveTab("input")}
              style={{
                padding: "4px 12px",
                borderRadius: "6px",
                border: "none",
                background: activeTab === "input" ? "#FFC107" : "#1f1f1f",
                color: activeTab === "input" ? "#06060A" : "#fff",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: activeTab === "input" ? 700 : 400,
              }}
            >
              Prompt
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              style={{
                padding: "4px 12px",
                borderRadius: "6px",
                border: "none",
                background: activeTab === "preview" ? "#FFC107" : "#1f1f1f",
                color: activeTab === "preview" ? "#06060A" : "#fff",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: activeTab === "preview" ? 700 : 400,
              }}
            >
              Preview {result && "✅"}
            </button>
          </div>
        )}

        <button
          onClick={() => router.push("/dashboard")}
          style={{
            marginLeft: "auto",
            padding: "5px 12px",
            background: "#1f1f1f",
            border: "1px solid #333",
            borderRadius: "6px",
            color: "#aaa",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          Dashboard
        </button>
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT PANEL */}
        <div style={{
          width: isMobile ? "100%" : "320px",
          display: isMobile ? (activeTab === "input" ? "flex" : "none") : "flex",
          flexDirection: "column",
          padding: "16px",
          borderRight: isMobile ? "none" : "1px solid #1f1f1f",
          overflowY: "auto",
          background: "#0a0a0a",
          flexShrink: 0,
          gap: "10px",
        }}>

          <p style={{ color: "#666", fontSize: "11px", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            What do you want to build?
          </p>

          <textarea
            value={userPrompt}
            onChange={handlePromptChange}
            placeholder="e.g. Restaurant website with menu and contact form..."
            rows={5}
            style={{
              width: "100%",
              background: "#111",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              color: "#fff",
              padding: "10px",
              fontSize: "16px",
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
              lineHeight: "1.6",
              fontFamily: "inherit",
            }}
            onFocus={(e) => e.target.style.borderColor = "#FFC107"}
            onBlur={(e) => e.target.style.borderColor = "#2a2a2a"}
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
          />

          <button
            onClick={handleGenerate}
            disabled={loading || !userPrompt.trim()}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "#1a1a1a" : "#FFC107",
              color: loading ? "#555" : "#06060A",
              borderRadius: "8px",
              fontWeight: "700",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
            }}
          >
            {loading ? "⚡ Generating... (30s)" : "⚡ Generate"}
          </button>

          {error && (
            <div style={{
              padding: "10px",
              background: "rgba(255,0,0,0.1)",
              border: "1px solid rgba(255,0,0,0.3)",
              borderRadius: "8px",
              color: "#ff6b6b",
              fontSize: "13px",
            }}>
              ❌ {error}
            </div>
          )}

          <p style={{ color: "#333", fontSize: "10px", margin: "4px 0 2px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Quick examples
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => {
                  setUserPrompt(ex);
                  promptRef.current = ex;
                }}
                style={{
                  textAlign: "left",
                  padding: "7px 10px",
                  background: "rgba(255,193,7,0.06)",
                  border: "1px solid rgba(255,193,7,0.12)",
                  borderRadius: "6px",
                  color: "#888",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL - Preview */}
        <div style={{
          flex: 1,
          display: isMobile ? (activeTab === "preview" ? "flex" : "none") : "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#111",
        }}>

          {/* Preview Header */}
          <div style={{
            padding: "8px 14px",
            borderBottom: "1px solid #1f1f1f",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#0a0a0a",
            flexShrink: 0,
          }}>
            <div style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: loading ? "#f59e0b" : result ? "#22c55e" : "#374151",
            }} />
            <span style={{ fontSize: "12px", color: "#555" }}>
              {loading ? "⚡ Generating..." : result ? "✅ Preview ready" : "Preview"}
            </span>

            {result && (
              <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                {/* SAVE BUTTON */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: "4px 10px",
                    background: saved ? "rgba(0,255,149,0.15)" : "rgba(255,193,7,0.15)",
                    border: saved ? "1px solid rgba(0,255,149,0.3)" : "1px solid rgba(255,193,7,0.3)",
                    borderRadius: "5px",
                    color: saved ? "#00FF95" : "#FFC107",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {saving ? "Saving..." : saved ? "✓ Saved!" : "💾 Save"}
                </button>

                <button
                  onClick={handleDownload}
                  style={{
                    padding: "4px 10px",
                    background: "rgba(124,58,237,0.15)",
                    border: "1px solid rgba(124,58,237,0.3)",
                    borderRadius: "5px",
                    color: "#a78bfa",
                    cursor: "pointer",
                    fontSize: "11px",
                  }}
                >
                  ⬇️ Download
                </button>
                <button
                  onClick={handleOpenTab}
                  style={{
                    padding: "4px 10px",
                    background: "rgba(34,197,94,0.1)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    borderRadius: "5px",
                    color: "#4ade80",
                    cursor: "pointer",
                    fontSize: "11px",
                  }}
                >
                  🔗 Open
                </button>
              </div>
            )}
          </div>

          {/* Preview Content */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {result ? (
              <iframe
                key={result.substring(0, 50)}
                srcDoc={result}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  display: "block",
                  background: "#ffffff",
                }}
                title="Krypton AI Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            ) : (
              <div style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "16px",
              }}>
                <span style={{ fontSize: "64px", opacity: 0.15 }}>⚡</span>
                <p style={{ color: "#2a2a2a", margin: 0, fontSize: "16px" }}>
                  Your creation will appear here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
      }
