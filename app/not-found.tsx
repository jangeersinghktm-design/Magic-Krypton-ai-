// app/not-found.tsx
"use client";

import { useRouter } from "next/navigation";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";

export default function NotFound() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: "100vh", background: "#050505",
      color: "#fff", fontFamily: "'DM Sans', sans-serif",
      display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column",
      gap: 16, textAlign: "center", padding: "24px",
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1} }
      `}</style>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: "60vw", height: "60vw", borderRadius: "50%", filter: "blur(100px)", background: "radial-gradient(circle,rgba(245,197,66,0.08) 0%,transparent 70%)" }} />
      </div>

      <div style={{ animation: "float 3s ease-in-out infinite", fontSize: 80 }}>🌌</div>

      <div style={{ animation: "fadeIn 0.5s ease" }}>
        <h1 style={{
          fontSize: "clamp(60px,15vw,120px)", fontWeight: 900,
          background: G, WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent", lineHeight: 1, margin: 0,
        }}>404</h1>

        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "12px 0 8px" }}>
          Page Not Found
        </h2>
        <p style={{ color: "#6B7280", fontSize: 15, maxWidth: 400, margin: "0 auto 28px", lineHeight: 1.7 }}>
          Looks like this page got lost in the AI dimension. Let's get you back!
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/")} style={{
            padding: "12px 28px", background: G, border: "none",
            borderRadius: 10, color: "#000", fontSize: 14,
            fontWeight: 700, cursor: "pointer",
          }}>
            Go Home →
          </button>
          <button onClick={() => router.push("/create")} style={{
            padding: "12px 28px", background: "none",
            border: "1px solid rgba(245,197,66,0.2)",
            borderRadius: 10, color: "#F5D800", fontSize: 14,
            fontWeight: 600, cursor: "pointer",
          }}>
            ⚡ Start Building
          </button>
        </div>
      </div>
    </div>
  );
}

