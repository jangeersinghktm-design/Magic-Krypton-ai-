// app/error.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";

export default function Error({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh", background: "#050505",
      color: "#fff", fontFamily: "'DM Sans', sans-serif",
      display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column",
      gap: 16, textAlign: "center", padding: "24px",
    }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      `}</style>

      <div style={{ animation: "float 3s ease-in-out infinite", fontSize: 72 }}>⚡</div>

      <h1 style={{
        fontSize: 48, fontWeight: 900, margin: 0,
        background: G, WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}>Oops!</h1>

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "8px 0" }}>
        Something went wrong
      </h2>
      <p style={{ color: "#6B7280", fontSize: 14, maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.7 }}>
        An unexpected error occurred. Don't worry — your projects are safe!
      </p>

      {error.message && (
        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 10, padding: "12px 20px", fontSize: 12,
          color: "#ef4444", maxWidth: 400, marginBottom: 8,
        }}>
          {error.message}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={reset} style={{
          padding: "12px 28px", background: G, border: "none",
          borderRadius: 10, color: "#000", fontSize: 14,
          fontWeight: 700, cursor: "pointer",
        }}>
          Try Again →
        </button>
        <button onClick={() => router.push("/")} style={{
          padding: "12px 28px", background: "none",
          border: "1px solid rgba(245,197,66,0.2)",
          borderRadius: 10, color: "#F5D800", fontSize: 14,
          fontWeight: 600, cursor: "pointer",
        }}>
          Go Home
        </button>
      </div>
    </div>
  );
}

