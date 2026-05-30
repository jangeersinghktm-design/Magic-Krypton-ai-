"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreatePage() {
  const router = useRouter();
  const supabase = createClient();

  // ✅ FIX: never use "prompt" as state (browser conflict safe)
  const [userPrompt, setUserPrompt] = useState<string>("");

  const promptRef = useRef<string>("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"input" | "preview">("input");

  // ✅ Mobile detection (stable)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ✅ Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) router.push("/auth/login");
    };

    checkAuth();
  }, []);

  // ✅ Input handler
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setUserPrompt(value);
    promptRef.current = value;
  };

  // ✅ Generate
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

  // ================= LEFT PANEL =================
  const LeftPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", padding: "16px" }}>
      <p style={{ color: "#888", fontSize: "11px" }}>
        Describe what you want to build
      </p>

      {/* ✅ FIXED TEXTAREA */}
      <textarea
        value={userPrompt}
        onChange={handlePromptChange}
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
        disabled={loading || !userPrompt.trim()}
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
          cursor: "pointer",
        }}
      >
        {loading ? "⚡ Generating..." : "⚡ Generate"}
      </button>

      {error && (
        <div style={{ color: "red", fontSize: "12px", marginTop: "10px" }}>
          ❌ {error}
        </div>
      )}
    </div>
  );

  // ================= PREVIEW =================
  const PreviewPanel = () => (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px", borderBottom: "1px solid #222" }}>
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
        height: "100vh",
        display: "flex",
        background: "#0a0a0a",
        color: "#fff",
        position: "fixed",
        inset: 0,
        width: "100%",
        overflow: "hidden",
      }}
    >
      {/* LEFT */}
      <div style={{ width: "320px", borderRight: "1px solid #222" }}>
        <LeftPanel />
      </div>

      {/* RIGHT */}
      <div style={{ flex: 1 }}>
        <PreviewPanel />
      </div>
    </div>
  );
}
