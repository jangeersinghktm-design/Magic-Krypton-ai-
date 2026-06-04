"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5C542 0%, #00D084 100%)";
const T = {
  gold: "#F5C542", green: "#00D084", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", sub: "#B3B3B3", muted: "#6B7280",
};

const TABS = [
  { id: "profile", label: "Profile", icon: "👤" },
  { id: "billing", label: "Billing", icon: "💳" },
  { id: "apikeys", label: "API Keys", icon: "🔑" },
  { id: "cloudcode", label: "Cloud Code", icon: "☁️" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "theme", label: "Theme", icon: "🎨" },
];

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [saved, setSaved] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [notifications, setNotifications] = useState({
    buildComplete: true, creditLow: true, billing: true, productUpdates: false,
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth/login"); return; }
      setUser(session.user);
      setName(session.user.user_metadata?.first_name || "");
      setCompany(session.user.user_metadata?.company || "");
    };
    getUser();
  }, []);

  const handleSave = async () => {
    await supabase.auth.updateUser({ data: { first_name: name, company } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const generateApiKey = () => {
    const key = "kr_" + Math.random().toString(36).substring(2, 18) + Math.random().toString(36).substring(2, 18);
    setApiKey(key);
  };

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif", position: "relative" }}>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50vw", height: "50vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(245,197,66,0.15) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "45vw", height: "45vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(0,208,132,0.12) 0%, transparent 70%)" }} />
      </div>

      <div style={{ display: "flex", minHeight: "100vh", position: "relative", zIndex: 1 }}>

        {!isMobile && (
          <div style={{ width: "220px", background: "#0A0A0A", borderRight: `1px solid ${T.border}`, padding: "24px 12px", flexShrink: 0 }}>
            <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: "13px", marginBottom: "24px", padding: "8px 12px" }}>
              ← Back to Home
            </button>
            <p style={{ fontSize: "10px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 12px", marginBottom: "8px" }}>Settings</p>
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: activeTab === tab.id ? "rgba(245,197,66,0.08)" : "none", border: activeTab === tab.id ? `1px solid ${T.border}` : "1px solid transparent", borderRadius: "10px", color: activeTab === tab.id ? T.gold : T.muted, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", fontWeight: activeTab === tab.id ? 600 : 400, transition: "all 0.2s" }}>
                {tab.icon} {tab.label}
              </button>
            ))}
            <div style={{ height: "1px", background: T.border, margin: "16px 0" }} />
            <button onClick={handleLogout} style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "1px solid transparent", borderRadius: "10px", color: "#ef4444", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
              🚪 Logout
            </button>
          </div>
        )}

        <div style={{ flex: 1, padding: isMobile ? "20px 16px" : "32px 40px", overflowY: "auto" }}>

          {isMobile && (
            <div style={{ marginBottom: "20px" }}>
              <button onClick={() => router.push("/")} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.muted, padding: "8px 14px", cursor: "pointer", fontSize: "14px", marginBottom: "16px" }}>
                ← Back
              </button>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {TABS.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "6px 14px", background: activeTab === tab.id ? G : "#141414", border: `1px solid ${activeTab === tab.id ? "transparent" : T.border}`, borderRadius: "20px", color: activeTab === tab.id ? "#050505" : T.muted, fontSize: "12px", fontWeight: activeTab === tab.id ? 700 : 400, cursor: "pointer" }}>
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, marginBottom: "6px", background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Profile</h1>
              <p style={{ color: T.muted, fontSize: "13px", marginBottom: "28px" }}>Manage your personal information</p>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 800, color: "#050505" }}>
                  {name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "K"}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: "15px", margin: 0 }}>{name || user?.email}</p>
                  <p style={{ color: T.muted, fontSize: "12px", margin: "2px 0 0" }}>Free Plan</p>
                </div>
              </div>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", marginBottom: "16px" }}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Display Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={{ width: "100%", padding: "12px 14px", background: "#141414", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.text, fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = T.gold)} onBlur={(e) => (e.currentTarget.style.borderColor = T.border)} />
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Company Name</label>
                  <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your company" style={{ width: "100%", padding: "12px 14px", background: "#141414", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.text, fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = T.gold)} onBlur={(e) => (e.currentTarget.style.borderColor = T.border)} />
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Email</label>
                  <input value={user?.email || ""} disabled style={{ width: "100%", padding: "12px 14px", background: "#0a0a0a", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.muted, fontSize: "14px", outline: "none", boxSizing: "border-box", cursor: "not-allowed" }} />
                </div>
                <button onClick={handleSave} style={{ padding: "11px 24px", background: G, border: "none", borderRadius: "10px", color: "#050505", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
                  {saved ? "✓ Saved!" : "Save Changes"}
                </button>
              </div>
              <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "16px", padding: "24px" }}>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, color: "#ef4444", marginBottom: "8px" }}>Danger Zone</h3>
                <p style={{ color: T.muted, fontSize: "13px", marginBottom: "16px" }}>These actions cannot be undone.</p>
                <button onClick={handleLogout} style={{ padding: "10px 20px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", color: "#ef4444", fontWeight: 600, fontSize: "13px", cursor: "pointer", marginRight: "10px" }}>Logout</button>
                <button style={{ padding: "10px 20px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", color: "#ef4444", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Delete Account</button>
              </div>
            </div>
          )}

          {activeTab === "billing" && (
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, marginBottom: "6px", background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Billing</h1>
              <p style={{ color: T.muted, fontSize: "13px", marginBottom: "28px" }}>Manage your plan and credits</p>
              <div style={{ background: "rgba(245,197,66,0.04)", border: "1px solid rgba(245,197,66,0.3)", borderRadius: "16px", padding: "24px", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <p style={{ fontSize: "12px", color: T.muted, marginBottom: "4px" }}>CURRENT PLAN</p>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, margin: 0, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Free Plan</p>
                    <p style={{ color: T.sub, fontSize: "13px", margin: "4px 0 0" }}>5 generations per day</p>
                  </div>
                  <button onClick={() => router.push("/landing#pricing")} style={{ padding: "11px 22px", background: G, border: "none", borderRadius: "10px", color: "#050505", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>Upgrade Plan →</button>
                </div>
              </div>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", marginBottom: "16px" }}>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>Credits Usage</h3>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: T.sub, fontSize: "14px" }}>Daily Credits</span>
                  <span style={{ fontWeight: 700, color: T.gold }}>0 / 5 used</span>
                </div>
                <div style={{ height: "8px", background: "#1a1a1a", borderRadius: "4px", marginBottom: "8px" }}>
                  <div style={{ height: "100%", width: "0%", background: G, borderRadius: "4px" }} />
                </div>
                <p style={{ color: T.muted, fontSize: "12px" }}>Resets daily at midnight</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: "12px", marginBottom: "16px" }}>
                {[
                  { name: "Pro", price: "$25/mo", credits: "100 credits/month", color: T.gold },
                  { name: "Premium", price: "$69/mo", credits: "300 credits/month", color: T.green },
                  { name: "Business", price: "$149/mo", credits: "100 credits/day", color: T.gold },
                ].map((plan) => (
                  <div key={plan.name} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "15px", margin: 0, color: plan.color }}>{plan.name}</p>
                      <p style={{ color: T.muted, fontSize: "12px", margin: "2px 0 0" }}>{plan.credits}</p>
                    </div>
                    <div style={{ textAlign: "right" as "right" }}>
                      <p style={{ fontWeight: 800, fontSize: "16px", margin: 0, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{plan.price}</p>
                      <button onClick={() => router.push("/landing#pricing")} style={{ marginTop: "6px", padding: "5px 12px", background: G, border: "none", borderRadius: "8px", color: "#050505", fontWeight: 700, fontSize: "11px", cursor: "pointer" }}>Upgrade</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px" }}>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>Billing History</h3>
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ fontSize: "28px", marginBottom: "8px" }}>📄</p>
                  <p style={{ color: T.muted, fontSize: "13px" }}>No invoices yet</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "apikeys" && (
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, marginBottom: "6px", background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>API Keys</h1>
              <p style={{ color: T.muted, fontSize: "13px", marginBottom: "28px" }}>Integrate Krypton AI into your apps</p>
              <div style={{ background: "rgba(245,197,66,0.04)", border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", marginBottom: "16px" }}>
                <p style={{ fontSize: "13px", color: T.sub, marginBottom: "16px" }}>API access is available on Pro plan and above.</p>
                <button onClick={() => router.push("/landing#pricing")} style={{ padding: "10px 20px", background: G, border: "none", borderRadius: "10px", color: "#050505", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>🔒 Upgrade to Access API</button>
              </div>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px" }}>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>Generate API Key (Preview)</h3>
                <button onClick={generateApiKey} style={{ padding: "10px 20px", background: "#161616", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.text, fontWeight: 600, fontSize: "13px", cursor: "pointer", marginBottom: "12px" }}>+ Generate New Key</button>
                {apiKey && (
                  <div style={{ background: "#0a0a0a", border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                    <code style={{ fontSize: "12px", color: T.gold, fontFamily: "monospace", wordBreak: "break-all" as "break-all" }}>
                      {showKey ? apiKey : apiKey.substring(0, 8) + "••••••••••••••••"}
                    </code>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button onClick={() => setShowKey(!showKey)} style={{ padding: "5px 10px", background: "#1a1a1a", border: `1px solid ${T.border}`, borderRadius: "6px", color: T.muted, fontSize: "11px", cursor: "pointer" }}>{showKey ? "Hide" : "Show"}</button>
                      <button onClick={copyKey} style={{ padding: "5px 10px", background: G, border: "none", borderRadius: "6px", color: "#050505", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Copy</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "cloudcode" && (
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, marginBottom: "6px", background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cloud Code</h1>
              <p style={{ color: T.muted, fontSize: "13px", marginBottom: "28px" }}>Export and deploy your projects</p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: "14px", marginBottom: "20px" }}>
                {[
                  { icon: "📦", title: "Download ZIP", desc: "Download complete project as ZIP", action: "Download" },
                  { icon: "⚛️", title: "Export React", desc: "Export as React component", action: "Export" },
                  { icon: "▲", title: "Deploy to Vercel", desc: "One-click Vercel deployment", action: "Deploy" },
                  { icon: "🌐", title: "Deploy to Netlify", desc: "One-click Netlify deployment", action: "Deploy" },
                  { icon: "🐙", title: "GitHub Connect", desc: "Push code to GitHub repo", action: "Connect" },
                  { icon: "📄", title: "Export HTML/CSS", desc: "Download as HTML/CSS files", action: "Export" },
                ].map((item) => (
                  <div key={item.title} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "20px", transition: "all 0.2s", cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; }}>
                    <div style={{ fontSize: "24px", marginBottom: "10px" }}>{item.icon}</div>
                    <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "14px", fontWeight: 700, marginBottom: "6px", color: T.text }}>{item.title}</h3>
                    <p style={{ color: T.muted, fontSize: "12px", marginBottom: "14px" }}>{item.desc}</p>
                    <button style={{ padding: "7px 16px", background: G, border: "none", borderRadius: "8px", color: "#050505", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>{item.action}</button>
                  </div>
                ))}
              </div>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px" }}>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>Recent Deployments</h3>
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ fontSize: "28px", marginBottom: "8px" }}>☁️</p>
                  <p style={{ color: T.muted, fontSize: "13px" }}>No deployments yet</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, marginBottom: "6px", background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Notifications</h1>
              <p style={{ color: T.muted, fontSize: "13px", marginBottom: "28px" }}>Control your notification preferences</p>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px" }}>
                {[
                  { key: "buildComplete", label: "Build Complete", desc: "Notify when AI finishes generating" },
                  { key: "creditLow", label: "Credit Low Alert", desc: "Alert when credits are running low" },
                  { key: "billing", label: "Billing Updates", desc: "Payment and invoice notifications" },
                  { key: "productUpdates", label: "Product Updates", desc: "New features and improvements" },
                ].map((item, idx) => (
                  <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: idx < 3 ? `1px solid ${T.border}` : "none" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "14px", margin: 0 }}>{item.label}</p>
                      <p style={{ color: T.muted, fontSize: "12px", margin: "3px 0 0" }}>{item.desc}</p>
                    </div>
                    <div onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                      style={{ width: "44px", height: "24px", background: notifications[item.key as keyof typeof notifications] ? G : "#2a2a2a", borderRadius: "12px", cursor: "pointer", position: "relative" as "relative", transition: "all 0.3s", flexShrink: 0 }}>
                      <div style={{ position: "absolute" as "absolute", top: "3px", left: notifications[item.key as keyof typeof notifications] ? "23px" : "3px", width: "18px", height: "18px", background: "#fff", borderRadius: "50%", transition: "left 0.3s" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "theme" && (
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, marginBottom: "6px", background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Theme</h1>
              <p style={{ color: T.muted, fontSize: "13px", marginBottom: "28px" }}>Customize your experience</p>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", marginBottom: "16px" }}>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>Color Mode</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                  {[
                    { id: "dark", label: "Dark", icon: "🌙", desc: "Easy on eyes" },
                    { id: "light", label: "Light", icon: "☀️", desc: "Coming soon" },
                    { id: "system", label: "System", icon: "💻", desc: "Auto detect" },
                  ].map((t) => (
                    <div key={t.id} onClick={() => setTheme(t.id)} style={{ background: theme === t.id ? "rgba(245,197,66,0.08)" : "#141414", border: theme === t.id ? `1px solid ${T.gold}` : `1px solid ${T.border}`, borderRadius: "12px", padding: "16px", textAlign: "center" as "center", cursor: "pointer", transition: "all 0.2s" }}>
                      <div style={{ fontSize: "24px", marginBottom: "8px" }}>{t.icon}</div>
                      <p style={{ fontWeight: 600, fontSize: "13px", margin: 0, color: theme === t.id ? T.gold : T.text }}>{t.label}</p>
                      <p style={{ color: T.muted, fontSize: "11px", margin: "4px 0 0" }}>{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px" }}>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>Accent Colors</h3>
                <p style={{ color: T.muted, fontSize: "13px", marginBottom: "16px" }}>More themes coming soon!</p>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: G, border: "2px solid #fff", cursor: "pointer" }} />
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: `2px solid ${T.border}`, cursor: "pointer", opacity: 0.4 }} />
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #ef4444, #f97316)", border: `2px solid ${T.border}`, cursor: "pointer", opacity: 0.4 }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
