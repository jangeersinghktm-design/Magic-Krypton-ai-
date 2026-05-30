"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreatePage() {
  const promptRef = useRef("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [uiPrompt, setUiPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"input" | "preview">("input");

  const router = useRouter();
  const supabase = createClient();

  const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 768);
  check();
  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}, []);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
      }
    };

    checkAuth();
  }, []);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;

    promptRef.current = value; // no re-render trigger
    setUiPrompt(value); // UI update only
  };

  const handleGenerate = async () => {
    if (!promptRef.current.trim()) return;

    setLoading(true);
    setResult("");
    setError("");

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

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "krypton-creation.html";
    a.click();

    URL.revokeObjectURL(url);
  };

  const examples = [
    "Restaurant website with menu",
    "Snake game in JavaScript",
    "Portfolio for a designer",
    "Calculator app",
    "Todo list app",
    "Gym fitness landing page",
  ];

  // ================= LEFT PANEL =================
  const LeftPanel = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "16px",
        height: "100%",
        overflowY: "auto",
      }}
    >
      <p style={{ color: "#888", fontSize: "11px" }}>
        Describe what you want to build
      </p>

      <textarea
  value={prompt}
  onChange={(e) => setPrompt(e.target.value)}
  placeholder="Type your prompt..."
  style={{
    width: "100%",
    height: "130px",
    background: "#111",
    border: "1px solid #333",
    borderRadius: "8px",
    color: "#fff",
    padding: "10px",
    fontSize: "16px",
    outline: "none",
    resize: "none",
  }}
  inputMode="text"
  autoComplete="off"
  autoCorrect="off"
  autoCapitalize="none"
/>

      <button
        onClick={handleGenerate}
        disabled={loading || !uiPrompt.trim()}
        style={{
          marginTop: "10px",
          width: "100%",
          padding: "12px",
          background: loading
            ? "#1a1a1a"
            : "linear-gradient(135deg, #7c3aed, #a855f7)",
          color: "#fff",
          borderRadius: "8px",
          fontWeight: "700",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "⚡ Generating..." : "⚡ Generate"}
      </button>

      {error && (
        <div style={{ color: "red", fontSize: "12px", marginTop: "10px" }}>
          ❌ {error}
        </div>
      )}

      <div style={{ marginTop: "16px" }}>
        {examples.map((ex, i) => (
          <button
            key={i}
            onClick={() => {
              promptRef.current = ex;
              setUiPrompt(ex);
            }}
            style={{
              display: "block",
              width: "100%",
              marginBottom: "6px",
              padding: "8px",
              background: "#111",
              border: "1px solid #333",
              color: "#aaa",
              fontSize: "12px",
              borderRadius: "6px",
              textAlign: "left",
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );

  // ================= PREVIEW =================
  const PreviewPanel = () => (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "8px",
          borderBottom: "1px solid #222",
          fontSize: "12px",
        }}
      >
        {loading ? "⚡ Generating..." : result ? "✅ Ready" : "Preview"}
      </div>

      <div style={{ flex: 1 }}>
        {result ? (
          <iframe
            srcDoc={result}
            style={{ width: "100%", height: "100%", border: "none" }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#555",
            }}
          >
            No preview yet
          </div>
        )}
      </div>
    </div>
  );

  // ================= UI =================
  return (
    <div
  style={{
    height: "100vh"
    height: "-webkit-fill-available",
    display: "flex",
    background: "#0a0a0a",
    color: "#fff",

    /* 🚀 CRITICAL FIXES */
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    overflow: "hidden",
  }}
>
      <div style={{ width: "320px", borderRight: "1px solid #222" }}>
        <LeftPanel />
      </div>

      <div style={{ flex: 1 }}>
        <PreviewPanel />
      </div>
    </div>
  );
                }
