"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5C542 0%, #00D084 100%)";
const T = {
  gold: "#F5C542", green: "#00D084", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", sub: "#B3B3B3", muted: "#6B7280",
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth/login"); return; }
      setUser(session.user);
      setName(session.user.user_metadata?.first_name || "");
    };
    getUser();
  }, []);

  const handleSave = async () => {
    await supabase.auth.updateUser({ data: { first_name: name } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif", padding: "40px 20px", position: "relative" }}>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50vw", height: "50vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(245,197,66,0.2) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "45vw", height: "45vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(0,208,132,0.15) 0%, transparent 70%)" }} />
      </div>

      <div style={{ maxWidth: "600px", margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "2rem" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.muted, padding: "8px 14px", cursor: "pointer", fontSize: "14px" }}>
            ← Back
          </button>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "24px", fontWeight: 800, margin: 0, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Settings</h1>
            <p style={{ color: T.muted, fontSize: "13px", margin: 0 }}>Manage your account</p>
          </div>
        </div>

        {/* Profile */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", marginBottom: "16px" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "20px", color: T.text }}>Profile</h2>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Display Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={{ width: "100%", padding: "12px 14px", background: "#141414", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.text, fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = T.gold)}
              onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Email</label>
            <input
              value={user?.email || ""}
              disabled
              style={{ width: "100%", padding: "12px 14px", background: "#0a0a0a", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.muted, fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif", cursor: "not-allowed" }}
            />
          </div>

          <button onClick={handleSave} style={{ padding: "11px 24px", background: G, border: "none", borderRadius: "10px", color: "#050505", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
            {saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>

        {/* Plan */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", marginBottom: "16px" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: T.text }}>Current Plan</h2>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: "16px", margin: 0, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Free Plan</p>
              <p style={{ color: T.muted, fontSize: "13px", margin: "4px 0 0" }}>5 generations per day</p>
            </div>
            <button onClick={() => router.push("/landing#pricing")} style={{ padding: "9px 18px", background: G, border: "none", borderRadius: "10px", color: "#050505", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
              Upgrade
            </button>
          </div>
        </div>

        {/* API Keys */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", marginBottom: "16px" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "8px", color: T.text }}>API Keys</h2>
          <p style={{ color: T.muted, fontSize: "13px", marginBottom: "16px" }}>API access is available on Pro plan and above.</p>
          <button onClick={() => router.push("/landing#pricing")} style={{ padding: "9px 18px", background: "#161616", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.text, fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
            🔒 Upgrade to Access
          </button>
        </div>

        {/* Notifications */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", marginBottom: "16px" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: T.text }}>Notifications</h2>
          {[
            { label: "Product updates", desc: "New features and improvements" },
            { label: "Tips & tutorials", desc: "Learn how to use Krypton AI" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: "14px", margin: 0 }}>{item.label}</p>
                <p style={{ color: T.muted, fontSize: "12px", margin: "2px 0 0" }}>{item.desc}</p>
              </div>
              <div style={{ width: "44px", height: "24px", background: G, borderRadius: "12px", cursor: "pointer", position: "relative" }}>
                <div style={{ position: "absolute", right: "3px", top: "3px", width: "18px", height: "18px", background: "#fff", borderRadius: "50%" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Danger Zone */}
        <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "16px", padding: "24px" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "8px", color: "#ef4444" }}>Danger Zone</h2>
          <p style={{ color: T.muted, fontSize: "13px", marginBottom: "16px" }}>These actions cannot be undone.</p>
          <button onClick={handleLogout} style={{ padding: "10px 20px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", color: "#ef4444", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
