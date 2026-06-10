"use client";

// app/auth/reset-password/page.tsx
import { useState, useEffect, Suspense } from "react";
import KryptonLogo from "@/components/branding/KryptonLogo";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5C542 0%, #00D084 100%)";

function ResetPasswordContent() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    // Check if we have a valid reset session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true);
      else setError("Invalid or expired reset link. Please request a new one.");
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/"), 3000);
  };

  const inputStyle = {
    width: "100%", padding: "14px 16px",
    background: "#141414", border: "1px solid rgba(245,197,66,0.12)",
    borderRadius: "12px", color: "#fff", fontSize: "15px",
    outline: "none", boxSizing: "border-box" as const,
    fontFamily: "'DM Sans', sans-serif", transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "20px" }}>
      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1} }`}</style>

      <div style={{ width: "100%", maxWidth: "460px", animation: "fadeIn 0.4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <KryptonLogo size={52} showText={true} animated={true}/>
        </div>

        <div style={{ background: "#0D0D0D", border: "1px solid rgba(245,197,66,0.15)", borderRadius: "24px", padding: "40px", boxShadow: "0 0 60px rgba(245,197,66,0.06)" }}>

          {success ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Password Updated!</h2>
              <p style={{ color: "#6B7280", fontSize: 14 }}>Redirecting to dashboard...</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "26px", fontWeight: 800, marginBottom: "8px", color: "#fff" }}>
                Set New Password
              </h2>
              <p style={{ color: "#6B7280", fontSize: "14px", marginBottom: "28px" }}>
                Choose a strong password for your account.
              </p>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#ef4444", fontSize: "14px" }}>
                  {error}
                </div>
              )}

              {validSession ? (
                <form onSubmit={handleReset}>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "8px" }}>New Password</label>
                    <input
                      type="password" value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 8 characters" required
                      style={inputStyle}
                      onFocus={e => e.currentTarget.style.borderColor = "#F5C542"}
                      onBlur={e => e.currentTarget.style.borderColor = "rgba(245,197,66,0.12)"}
                    />
                  </div>

                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "8px" }}>Confirm Password</label>
                    <input
                      type="password" value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••" required
                      style={{
                        ...inputStyle,
                        borderColor: confirm && password !== confirm ? "rgba(239,68,68,0.5)" : "rgba(245,197,66,0.12)",
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = "#F5C542"}
                      onBlur={e => e.currentTarget.style.borderColor = confirm && password !== confirm ? "rgba(239,68,68,0.5)" : "rgba(245,197,66,0.12)"}
                    />
                    {confirm && password !== confirm && (
                      <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Passwords do not match</p>
                    )}
                  </div>

                  {/* Password strength */}
                  {password && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 3, transition: "width 0.3s",
                          width: password.length < 6 ? "25%" : password.length < 8 ? "50%" : password.length < 12 ? "75%" : "100%",
                          background: password.length < 6 ? "#ef4444" : password.length < 8 ? "#f59e0b" : password.length < 12 ? "#F5C542" : "#00D084",
                        }} />
                      </div>
                      <p style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                        {password.length < 6 ? "Weak" : password.length < 8 ? "Fair" : password.length < 12 ? "Good" : "Strong ✅"}
                      </p>
                    </div>
                  )}

                  <button type="submit" disabled={loading || password !== confirm || password.length < 8}
                    style={{ width: "100%", padding: "15px", background: loading || password !== confirm || password.length < 8 ? "#333" : G, border: "none", borderRadius: "12px", color: loading || password !== confirm || password.length < 8 ? "#666" : "#050505", fontWeight: 700, fontSize: "16px", cursor: loading || password !== confirm || password.length < 8 ? "not-allowed" : "pointer" }}>
                    {loading ? "Updating..." : "Update Password →"}
                  </button>
                </form>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <button onClick={() => router.push("/auth/login")}
                    style={{ padding: "12px 24px", background: G, border: "none", borderRadius: "10px", color: "#000", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
                    Request New Reset Link →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ height: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", color: "#F5C542" }}>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
