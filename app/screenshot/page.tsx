"use client";

// app/screenshot/page.tsx
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5F5F5 0%, #5FB88A 100%)";
const T = {
  gold: "#F5F5F5", green: "#5FB88A", bg: "#050816", card: "#0B1020",
  border: "rgba(245,245,245,0.12)", text: "#FFFFFF", muted: "#9AA3AF",
};

const CREDIT_COST = 15;

export default function ScreenshotToApp() {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [image, setImage]         = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<string | null>(null);
  const [error, setError]         = useState("");
  const [credits, setCredits]     = useState<number | null>(null);
  const [prompt, setPrompt]       = useState("");
  const [dragging, setDragging]   = useState(false);

  // Load credits on mount
  useState(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from("profiles")
        .select("total_credits, used_credits")
        .eq("id", session.user.id).single();
      if (data) setCredits((data.total_credits || 100) - (data.used_credits || 0));
    };
    load();
  });

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5MB"); return; }
    setError("");
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleGenerate = async () => {
    if (!image || !imageFile) return;
    if (credits !== null && credits < CREDIT_COST) {
      setError(`Insufficient credits! Need ${CREDIT_COST}, have ${credits}.`);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }

      // Convert to base64
      const base64 = image.split(",")[1];
      const mediaType = imageFile.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

      // Call Claude Vision API
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "", // handled server side
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 12000,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: `Analyze this UI screenshot and recreate it as a complete, self-contained HTML file.

${prompt ? `Additional instructions: ${prompt}` : ""}

Requirements:
- Output ONLY raw HTML starting with <!DOCTYPE html>
- End with </html>
- No markdown, no backticks
- Match the layout, colors, and style from the screenshot
- Make it fully responsive
- Use CSS Grid/Flexbox
- Include all interactive elements
- Premium quality UI

Build the COMPLETE page that matches this screenshot.`,
              },
            ],
          }],
        }),
      });

      // Use our API route instead
      const apiRes = await fetch("/api/screenshot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ imageBase64: base64, mediaType, prompt }),
      });

      const data = await apiRes.json();

      if (data.html) {
        setResult(data.html);
        setCredits(c => c !== null ? c - CREDIT_COST : null);
      } else {
        setError(data.error || "Generation failed");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUseResult = () => {
    if (result) {
      router.push(`/create?prompt=${encodeURIComponent("Recreate this UI: " + (prompt || "from screenshot"))}`);
    }
  };

  return (
    <>
      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif" }}>

        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, background: "rgba(8,8,8,0.9)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>← Home</button>
            <span style={{ color: "#333" }}>|</span>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📸 Screenshot to App</h1>
          </div>
          {credits !== null && (
            <div style={{ fontSize: 12, color: credits >= CREDIT_COST ? T.green : "#E5736B", fontWeight: 700, padding: "4px 10px", background: credits >= CREDIT_COST ? "rgba(95,184,138,0.1)" : "rgba(229,115,107,0.1)", borderRadius: 6, border: `1px solid ${credits >= CREDIT_COST ? "rgba(95,184,138,0.3)" : "rgba(229,115,107,0.3)"}` }}>
              ⚡ {credits} credits
            </div>
          )}
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px", display: "grid", gridTemplateColumns: result ? "1fr 1fr" : "1fr", gap: 24 }}>

          {/* Left — Upload */}
          <div>
            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 8px" }}>
                Screenshot to App
              </h2>
              <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>
                Upload any UI screenshot — Krypton AI will rebuild it as code!
              </p>
              <div style={{ marginTop: 10, fontSize: 12, color: "#444", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                ⚡ Costs {CREDIT_COST} credits per generation
              </div>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? T.gold : image ? "rgba(95,184,138,0.4)" : T.border}`,
                borderRadius: 16, padding: "32px 24px", textAlign: "center",
                cursor: "pointer", transition: "all 0.2s",
                background: dragging ? "rgba(245,245,245,0.04)" : image ? "rgba(95,184,138,0.03)" : T.card,
                marginBottom: 16, minHeight: 200,
                display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
              }}
            >
              {image ? (
                <div style={{ width: "100%" }}>
                  <img src={image} alt="Preview" style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 10, objectFit: "contain" }} />
                  <p style={{ fontSize: 12, color: T.green, marginTop: 10 }}>✅ {imageFile?.name}</p>
                  <p style={{ fontSize: 11, color: "#444", margin: "4px 0 0" }}>Click to change image</p>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Drop screenshot here</p>
                  <p style={{ fontSize: 13, color: T.muted, margin: "0 0 12px" }}>or click to browse</p>
                  <p style={{ fontSize: 11, color: "#444", margin: 0 }}>PNG, JPG, WEBP • Max 5MB</p>
                </>
              )}
            </div>

            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {/* Optional prompt */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                Additional Instructions (Optional)
              </label>
              <input value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder="e.g. Make it dark theme, add animations..."
                style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, color: T.text, padding: "10px 14px", fontSize: 13, outline: "none", marginTop: 6, boxSizing: "border-box" as const, fontFamily: "'DM Sans', sans-serif" }} />
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: "rgba(229,115,107,0.08)", border: "1px solid rgba(229,115,107,0.2)", borderRadius: 9, padding: "10px 14px", marginBottom: 14, color: "#E5736B", fontSize: 13 }}>
                ⚠ {error}
              </div>
            )}

            {/* Generate Button */}
            <button onClick={handleGenerate} disabled={!image || loading}
              style={{
                width: "100%", padding: "14px",
                background: !image || loading ? "#11151F" : G,
                border: "none", borderRadius: 10,
                color: !image || loading ? "#444" : "#000",
                fontWeight: 700, fontSize: 15, cursor: !image || loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />
                  Analyzing with Claude Vision...
                </>
              ) : (
                <>📸 Generate App — {CREDIT_COST} credits</>
              )}
            </button>

            {/* Examples */}
            <div style={{ marginTop: 24 }}>
              <p style={{ fontSize: 11, color: "#333", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12 }}>WORKS GREAT FOR</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { icon: "📱", label: "Mobile UI" },
                  { icon: "🖥", label: "Web Apps" },
                  { icon: "🎨", label: "Design Mockups" },
                  { icon: "📊", label: "Dashboards" },
                  { icon: "🛍", label: "E-commerce" },
                  { icon: "🎮", label: "Game UI" },
                ].map(ex => (
                  <div key={ex.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{ex.icon}</span>
                    <span style={{ fontSize: 12, color: T.muted }}>{ex.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Result */}
          {result && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>✅ Generated App</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { const w = window.open("","_blank"); if(w){w.document.write(result);w.document.close();} }}
                    style={{ padding: "6px 12px", background: "rgba(95,184,138,0.1)", border: "1px solid rgba(95,184,138,0.2)", borderRadius: 7, color: T.green, fontSize: 12, cursor: "pointer" }}>
                    👁 Preview
                  </button>
                  <button onClick={() => {
                    const blob = new Blob([result], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "screenshot-app.html"; a.click();
                  }} style={{ padding: "6px 12px", background: G, border: "none", borderRadius: 7, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ⬇ Download
                  </button>
                </div>
              </div>

              {/* Preview iframe */}
              <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", height: 500, border: `1px solid ${T.border}` }}>
                <iframe srcDoc={result} style={{ width: "100%", height: "100%", border: "none" }} sandbox="allow-scripts" title="Result" />
              </div>

              {/* Open in Create */}
              <button onClick={handleUseResult} style={{ width: "100%", marginTop: 12, padding: "11px", background: "rgba(245,245,245,0.1)", border: `1px solid ${T.border}`, borderRadius: 9, color: T.gold, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                ✏️ Open in Create & Edit with AI →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
                      
