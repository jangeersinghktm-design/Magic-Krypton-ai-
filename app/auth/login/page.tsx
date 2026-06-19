"use client";

import { useState } from "react";
import KryptonLogo from "@/components/branding/KryptonLogo";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5C542 0%, #00D084 100%)";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/");
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) {
      setError(error.message);
      setForgotLoading(false);
      return;
    }
    setForgotSent(true);
    setForgotLoading(false);
  };

  const inputStyle = {
    width: "100%", padding: "14px 16px",
    background: "#141414", border: "1px solid rgba(245,197,66,0.12)",
    borderRadius: "12px", color: "#fff", fontSize: "15px",
    outline: "none", boxSizing: "border-box" as const,
    fontFamily: "'DM Sans', sans-serif", transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "20px", position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes gradMove { 0%,100%{transform:translate(0,0)} 50%{transform:translate(3%,5%)} }
        @keyframes gradMove2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-3%,-5%)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "55vw", height: "55vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(245,197,66,0.35) 0%, rgba(245,197,66,0.12) 35%, transparent 70%)", animation: "gradMove 18s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "50vw", height: "50vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(0,208,132,0.30) 0%, rgba(0,208,132,0.10) 35%, transparent 70%)", animation: "gradMove2 22s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(245,197,66,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,66,0.02) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "500px", animation: "fadeIn 0.4s ease" }}>

        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2rem" }}>
          <KryptonLogo size={56} showText={true} animated={true}/>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(245,197,66,0.07)", border: "1px solid rgba(245,197,66,0.15)", borderRadius: "20px", padding: "5px 14px", fontSize: "12px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00D084", display: "inline-block" }} />
            <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 600 }}>Welcome back to Krypton AI</span>
          </div>
        </div>

        <div style={{ background: "#0D0D0D", border: "1px solid rgba(245,197,66,0.15)", borderRadius: "24px", padding: "40px", boxShadow: "0 0 60px rgba(245,197,66,0.06)" }}>

          {/* ── FORGOT PASSWORD VIEW ── */}
          {showForgot ? (
            <div>
              <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: "24px", fontWeight: 800, marginBottom: "8px", color: "#fff" }}>
                Reset Password
              </h2>
              <p style={{ color: "#6B7280", fontSize: "14px", marginBottom: "24px" }}>
                Enter your email — we'll send a reset link.
              </p>

              {forgotSent ? (
                <div style={{ background: "rgba(0,208,132,0.08)", border: "1px solid rgba(0,208,132,0.25)", borderRadius: "12px", padding: "20px", textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📧</div>
                  <p style={{ color: "#00D084", fontWeight: 700, marginBottom: 6 }}>Reset link sent!</p>
                  <p style={{ color: "#6B7280", fontSize: 13 }}>Check your email: <strong>{forgotEmail}</strong></p>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  {error && (
                    <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", color: "#ef4444", fontSize: "14px" }}>
                      {error}
                    </div>
                  )}
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "8px" }}>Email Address</label>
                    <input
                      type="email" value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="you@example.com" required
                      style={inputStyle}
                      onFocus={e => e.currentTarget.style.borderColor = "#F5C542"}
                      onBlur={e => e.currentTarget.style.borderColor = "rgba(245,197,66,0.12)"}
                    />
                  </div>
                  <button type="submit" disabled={forgotLoading} style={{ width: "100%", padding: "14px", background: forgotLoading ? "#333" : G, border: "none", borderRadius: "12px", color: forgotLoading ? "#666" : "#050505", fontWeight: 700, fontSize: "15px", cursor: forgotLoading ? "not-allowed" : "pointer" }}>
                    {forgotLoading ? "Sending..." : "Send Reset Link →"}
                  </button>
                </form>
              )}

              <button onClick={() => { setShowForgot(false); setForgotSent(false); setError(""); }}
                style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer" }}>
                ← Back to Sign In
              </button>
            </div>

          ) : (
            /* ── NORMAL LOGIN VIEW ── */
            <>
              <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: "28px", fontWeight: 800, marginBottom: "8px", color: "#fff" }}>Sign In</h2>
              <p style={{ color: "#6B7280", fontSize: "14px", marginBottom: "28px" }}>
                Don't have an account?{" "}
                <span onClick={() => router.push("/auth/signup")} style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", cursor: "pointer", fontWeight: 600 }}>
                  Get Started →
                </span>
              </p>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#ef4444", fontSize: "14px" }}>
                  {error}
                </div>
              )}

              {/* Google Login Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                style={{ width: "100%", padding: "13px", background: "#fff", border: "1px solid #ddd", borderRadius: "12px", color: "#333", fontWeight: 600, fontSize: "15px", cursor: googleLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "20px", transition: "all 0.2s", opacity: googleLoading ? 0.7 : 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {googleLoading ? "Connecting..." : "Continue with Google"}
              </button>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                <span style={{ fontSize: 12, color: "#444" }}>or sign in with email</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "8px" }}>Email Address</label>
                  <input
                    type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required
                    style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = "#F5C542"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(245,197,66,0.12)"}
                  />
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "8px" }}>Password</label>
                  <input
                    type="password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required
                    style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = "#F5C542"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(245,197,66,0.12)"}
                  />
                </div>

                {/* Forgot Password Link */}
                <div style={{ textAlign: "right", marginBottom: "24px" }}>
                  <span
                    onClick={() => { setShowForgot(true); setError(""); }}
                    style={{ fontSize: 13, color: "#F5C542", cursor: "pointer", fontWeight: 600 }}>
                    Forgot password?
                  </span>
                </div>

                <button type="submit" disabled={loading} style={{ width: "100%", padding: "15px", background: loading ? "#333" : G, border: "none", borderRadius: "12px", color: loading ? "#666" : "#050505", fontWeight: 700, fontSize: "16px", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                  {loading ? "Signing in..." : "Sign In →"}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", color: "#444", fontSize: "12px", marginTop: "20px" }}>
          <span onClick={() => router.push("/landing")} style={{ color: "#555", cursor: "pointer" }}>← Back to home</span>
        </p>
      </div>
    </div>
  );
}
