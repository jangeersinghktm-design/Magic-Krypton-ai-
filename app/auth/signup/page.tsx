"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      alert("Check your email to confirm your account!");
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#06060A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "'DM Sans', sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Yellow glow */}
      <div style={{
        position: "absolute", top: "-100px", right: "-100px",
        width: "400px", height: "400px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,193,7,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      {/* Green glow */}
      <div style={{
        position: "absolute", bottom: "-100px", left: "-100px",
        width: "350px", height: "350px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,255,149,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "2rem", justifyContent: "center" }}>
          <div style={{
            width: "36px", height: "36px", background: "#FFC107",
            borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L3 7v6l7 5 7-5V7L10 2z" fill="#06060A" />
              <path d="M10 6l-4 3v2l4 3 4-3V9L10 6z" fill="#FFC107" opacity="0.7" />
            </svg>
          </div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "18px", letterSpacing: "0.05em", color: "#fff" }}>
            KRYPTON <span style={{ color: "#FFC107" }}>AI</span>
          </span>
        </div>

        {/* Card */}
        <div style={{
          background: "#0D0D12",
          border: "1px solid #1e1e2a",
          borderRadius: "24px",
          padding: "2.5rem",
        }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: "rgba(255,193,7,0.08)", border: "1px solid rgba(255,193,7,0.18)",
            borderRadius: "20px", padding: "4px 12px", fontSize: "11px",
            color: "#FFC107", fontWeight: 500, marginBottom: "1.25rem",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00FF95", display: "inline-block" }} />
            Free plan — 10 credits/day
          </div>

          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "26px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>
            Get Started
          </h1>
          <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>
            Already have an account?{" "}
            <Link href="/auth/login" style={{ color: "#FFC107", textDecoration: "none", fontWeight: 500 }}>
              Sign in →
            </Link>
          </p>

          {error && (
            <div style={{
              background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.15)",
              borderRadius: "10px", padding: "10px 14px", marginBottom: "1rem",
              color: "#ff4d4d", fontSize: "13px",
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#777", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: "100%", background: "#07070D", border: "1px solid #1e1e2a",
                  borderRadius: "12px", padding: "14px 16px", fontSize: "15px",
                  color: "#fff", outline: "none", boxSizing: "border-box",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onFocus={(e) => e.target.style.borderColor = "#FFC107"}
                onBlur={(e) => e.target.style.borderColor = "#1e1e2a"}
              />
            </div>

            <div style={{ marginBottom: "1.8rem" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#777", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%", background: "#07070D", border: "1px solid #1e1e2a",
                  borderRadius: "12px", padding: "14px 16px", fontSize: "15px",
                  color: "#fff", outline: "none", boxSizing: "border-box",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onFocus={(e) => e.target.style.borderColor = "#FFC107"}
                onBlur={(e) => e.target.style.borderColor = "#1e1e2a"}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "15px", background: "#FFC107",
                border: "none", borderRadius: "12px",
                fontFamily: "'Syne', sans-serif", fontSize: "15px",
                fontWeight: 700, color: "#06060A", cursor: "pointer",
                letterSpacing: "0.03em", opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Creating account..." : "Create Account →"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: "1.5rem", color: "#555", fontSize: "13px" }}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{ color: "#FFC107", fontWeight: 500, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
}
