"use client";
// app/admin-login/page.tsx
// Secret admin-only login page — not linked anywhere in the main UI

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError("");

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });

    if (authErr || !data.user) {
      setError("Invalid credentials");
      setLoading(false);
      return;
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile?.role !== "admin") {
      await supabase.auth.signOut();
      setError("Access denied — Admin only");
      setLoading(false);
      return;
    }

    router.push("/admin/ai-engineer");
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#050505", display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input { outline: none; }
        input:focus { border-color: rgba(245,216,0,0.6) !important; }
      `}</style>

      <div style={{
        background: "#0D0D0D", border: "1px solid rgba(245,216,0,0.15)",
        borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 380,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontSize: 32, marginBottom: 12,
            background: "linear-gradient(135deg,#F5D800,#00CC44)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            fontFamily: "'Syne',sans-serif", fontWeight: 800,
          }}>
            K
          </div>
          <h1 style={{ color: "#fff", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22 }}>
            Krypton Admin
          </h1>
          <p style={{ color: "#6B7280", fontSize: 13, marginTop: 6 }}>
            AI Engineer Access Only
          </p>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="email"
            placeholder="Admin Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{
              background: "#111", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "13px 16px", color: "#fff",
              fontSize: 14, transition: "border-color 0.2s",
              fontFamily: "inherit",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{
              background: "#111", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "13px 16px", color: "#fff",
              fontSize: 14, transition: "border-color 0.2s",
              fontFamily: "inherit",
            }}
          />

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8, padding: "10px 14px", color: "#EF4444", fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            style={{
              background: loading ? "#1a1a1a" : "linear-gradient(135deg,#F5D800,#00CC44)",
              color: loading ? "#6B7280" : "#000",
              border: "none", borderRadius: 10, padding: "14px",
              fontWeight: 700, fontSize: 15, cursor: loading ? "default" : "pointer",
              transition: "all 0.2s", fontFamily: "inherit",
            }}
          >
            {loading ? "Verifying..." : "Access AI Engineer →"}
          </button>
        </div>

        <p style={{ color: "#374151", fontSize: 11, textAlign: "center", marginTop: 24 }}>
          This page is not publicly linked. Admin access only.
        </p>
      </div>
    </div>
  );
}

