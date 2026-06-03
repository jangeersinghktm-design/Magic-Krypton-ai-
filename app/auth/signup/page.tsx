"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5C542 0%, #00D084 100%)";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess(true);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "20px", position: "relative", overflow: "hidden" }}>

      {/* Animated background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "55vw", height: "55vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(245,197,66,0.35) 0%, rgba(245,197,66,0.12) 35%, transparent 70%)", animation: "gradMove 18s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "50vw", height: "50vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(0,208,132,0.30) 0%, rgba(0,208,132,0.10) 35%, transparent 70%)", animation: "gradMove2 22s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(245,197,66,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,66,0.02) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "400px" }}>

        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2rem" }}>
          <img src="/logo.jpeg" alt="Krypton AI" style={{ height: "64px", width: "auto", objectFit: "contain", marginBottom: "12px" }} />
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(245,197,66,0.07)", border: "1px solid rgba(245,197,66,0.15)", borderRadius: "20px", padding: "4px 12px", fontSize: "12px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00D084", display: "inline-block" }} />
            <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 600 }}>Free Plan — 5 Credits/Day</span>
          </div>
        </div>

        {/* Card */}
        <div style={{ background: "#0D0D0D", border: "1px solid rgba(245,197,66,0.15)", borderRadius: "20px", padding: "32px", boxShadow: "0 0 60px rgba(245,197,66,0.06)" }}>

          {success ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>✅</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, marginBottom: "8px", background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Check your email!</h2>
              <p style={{ color: "#B3B3B3", fontSize: "14px", lineHeight: 1.6 }}>We sent a confirmation link to <strong style={{ color: "#fff" }}>{email}</strong>. Click it to activate your account.</p>
              <button onClick={() => router.push("/auth/login")} style={{ marginTop: "20px", padding: "12px 24px", background: G, border: "none", borderRadius: "10px", color: "#050505", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
                Go to Login →
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "24px", fontWeight: 800, marginBottom: "6px", color: "#fff" }}>Get Started</h2>
              <p style={{ color: "#6B7280", fontSize: "13px", marginBottom: "24px" }}>
                Already have an account?{" "}
                <span onClick={() => router.push("/auth/login")} style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", cursor: "pointer", fontWeight: 600 }}>
                  Sign in →
                </span>
              </p>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", color: "#ef4444", fontSize: "13px" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSignup}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={{ width: "100%", padding: "12px 14px", background: "#141414", border: "1px solid rgba(245,197,66,0.12)", borderRadius: "10px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#F5C542")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(245,197,66,0.12)")}
                  />
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ width: "100%", padding: "12px 14px", background: "#141414", border: "1px solid rgba(245,197,66,0.12)", borderRadius: "10px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#F5C542")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(245,197,66,0.12)")}
                  />
                </div>

                <button type="submit" disabled={loading} style={{ width: "100%", padding: "13px", background: loading ? "#333" : G, border: "none", borderRadius: "10px", color: loading ? "#666" : "#050505", fontWeight: 700, fontSize: "15px", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                  {loading ? "Creating account..." : "Create Account →"}
                </button>
              </form>

              <p style={{ textAlign: "center", color: "#6B7280", fontSize: "12px", marginTop: "20px" }}>
                Already have an account?{" "}
                <span onClick={() => router.push("/auth/login")} style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", cursor: "pointer", fontWeight: 600 }}>
                  Sign in
                </span>
              </p>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", color: "#444", fontSize: "11px", marginTop: "20px" }}>
          By signing up, you agree to our{" "}
          <span style={{ color: "#F5C542", cursor: "pointer" }}>Terms of Service</span>
          {" "}and{" "}
          <span style={{ color: "#F5C542", cursor: "pointer" }}>Privacy Policy</span>
        </p>
      </div>
    </div>
  );
                                                                         }
