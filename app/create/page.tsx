"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreatePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"input" | "preview">("input");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
    };
    checkAuth();
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult("");
    setError("");
    if (isMobile) setActiveTab("preview");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
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

  const LeftPanel = () => (
    <div style={{
      display: "flex",
      flexDirection: "column",
      padding: "16px",
      height: "100%",
      overflowY: "auto",
      boxSizing: "border-box",
    }}>
      <p style={{ color: "#888", fontSize: "11px", margin: "0 0 8px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Describe what you want to build
      </p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. Make a beautiful restaurant website with menu, about section and contact form..."
        style={{
          width: "100%",
          height: "130px",
          background: "#111",
          border: "1px solid #333",
          borderRadius: "8px",
          color: "#fff",
          padding: "10px",
          fontSize: "13px",
          resize: "none",
          outline: "none",
          boxSizing: "border-box",
          lineHeight: "1.5",
          fontFamily: "sans-serif",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey) handleGenerate();
        }}
      />

      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        style={{
          marginTop: "10px",
          width: "100%",
          padding: "12px",
          background: loading ? "#1a1a1a" : "linear-gradient(135deg, #7c3aed, #a855f7)",
          color: loading ? "#555" : "#fff",
          borderRadius: "8px",
          fontWeight: "700",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "14px",
          transition: "all 0.2s",
        }}
      >
        {loading ? "⚡ Generating... (30s)" : "⚡ Generate"}
      </button>

      {loading && (
        <div style={{ marginTop: "8px", textAlign: "center" }}>
          <p style={{ color: "#555", fontSize: "11px", margin: 0 }}>AI is creating your website...</p>
          <div style={{
            marginTop: "6px",
            height: "2px",
            background: "#222",
            borderRadius: "1px",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              background: "linear-gradient(90deg, #7c3aed, #a855f7)",
              animation: "progress 2s ease-in-out infinite",
              width: "60%",
            }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: "10px",
          padding: "10px",
          background: "rgba(255,0,0,0.08)",
          border: "1px solid rgba(255,0,0,0.2)",
          borderRadius: "6px",
          color: "#ff6b6b",
          fontSize: "12px",
        }}>
          ❌ {error}
        </div>
      )}

      <p style={{ color: "#444", fontSize: "11px", margin: "16px 0 6px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Quick Examples
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {examples.map((ex, i) => (
          <button
            key={i}
            onClick={() => setPrompt(ex)}
            style={{
              textAlign: "left",
              padding: "7px 10px",
              background: "rgba(124,58,237,0.06)",
              border: "1px solid rgba(124,58,237,0.12)",
              borderRadius: "6px",
              color: "#999",
              cursor: "pointer",
              fontSize: "12px",
              transition: "all 0.2s",
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );

  const PreviewPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        padding: "8px 16px",
        borderBottom: "1px solid #222",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexShrink: 0,
        background: "#0a0a0a",
      }}>
        <div style={{
          width: "8px", height: "8px", borderRadius: "50%",
          background: loading ? "#f59e0b" : result ? "#22c55e" : "#444",
          transition: "background 0.3s",
        }} />
        <span style={{ fontSize: "12px", color: "#666" }}>
          {loading ? "⚡ Generating..." : result ? `✅ Preview ready` : "Preview"}
        </span>
        {result && (
          <button
            onClick={handleDownload}
            style={{
              marginLeft: "auto",
              padding: "4px 10px",
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              borderRadius: "5px",
              color: "#a78bfa",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            ⬇️ Download HTML
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {result ? (
          <iframe
            key={result.length}
            srcDoc={result}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
              background: "#fff",
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
            gap: "12px",
            background: "#0d0d0d",
          }}>
            <span style={{ fontSize: "56px", opacity: 0.15 }}>⚡</span>
            <p style={{ color: "#2a2a2a", margin: 0, fontSize: "15px" }}>
              {loading ? "Creating your website..." : "Your creation will appear here"}
            </p>
            {!loading && (
              <p style={{ color: "#222", margin: 0, fontSize: "12px" }}>
                Type a prompt and click Generate
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      {/* Top Bar */}
      <div style={{
        padding: "10px 20px",
        borderBottom: "1px solid #1a1a1a",
        display: "flex",
        alignItems: "center",
        background: "#000",
        flexShrink: 0,
        zIndex: 10,
      }}>
        <span style={{ fontSize: "18px", marginRight: "8px" }}>⚡</span>
        <h1 style={{ fontSize: "15px", fontWeight: "bold", margin: 0, background: "linear-gradient(135deg, #7c3aed, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          KRYPTON AI
        </h1>

        {/* Mobile Tabs */}
        {isMobile && (
          <div style={{ marginLeft: "12px", display: "flex", gap: "4px" }}>
            <button
              onClick={() => setActiveTab("input")}
              style={{
                padding: "4px 10px",
                background: activeTab === "input" ? "#7c3aed" : "#111",
                border: "1px solid #333",
                borderRadius: "5px",
                color: "#fff",
                cursor: "pointer",
                fontSize: "11px",
              }}
            >
              Prompt
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              style={{
                padding: "4px 10px",
                background: activeTab === "preview" ? "#7c3aed" : "#111",
                border: "1px solid #333",
                borderRadius: "5px",
                color: "#fff",
                cursor: "pointer",
                fontSize: "11px",
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
            background: "#111",
            border: "1px solid #333",
            borderRadius: "6px",
            color: "#999",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          Dashboard
        </button>
      </div>

      {/* Main Content */}
      {isMobile ? (
        // Mobile: Tab View
        <div style={{ flex: 1, overflow: "hidden" }}>
          {activeTab === "input" ? <LeftPanel /> : <PreviewPanel />}
        </div>
      ) : (
        // Desktop: Split View
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left Panel */}
          <div style={{
            width: "320px",
            minWidth: "260px",
            maxWidth: "400px",
            borderRight: "1px solid #1a1a1a",
            flexShrink: 0,
            overflow: "hidden",
          }}>
            <LeftPanel />
          </div>

          {/* Right Panel */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <PreviewPanel />
          </div>
        </div>
      )}
    </div>
  );
}
