"use client";

import { useTheme } from "@/components/ThemeProvider";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280",
};

const PLANS = [
  {
    id: "free", name: "Free", emoji: "🟢",
    priceUsd: 0, priceInr: 0,
    credits: 100, creditsLabel: "5 Generations / Day",
    cta: "Current Plan",
    features: ["Website Generator","App Generator","Game Generator","Live Preview","Download HTML","Community Support"],
    locked: ["Save Projects","Project History","Advanced AI","Team Workspace","API Access"],
  },
  {
    id: "pro", name: "Pro", emoji: "🔥",
    priceUsd: 25, priceInr: 2099,
    credits: 2000, creditsLabel: "100 Generations / Month",
    cta: "Upgrade to Pro", highlight: true,
    features: ["Everything in Free","Save Projects","Project History","Faster Generation","Better AI Quality","Export Full Source Code","Private Projects","Premium Templates","Email Support"],
    locked: ["Team Workspace","API Access"],
  },
  {
    id: "premium", name: "Premium", emoji: "💎",
    priceUsd: 69, priceInr: 5799,
    credits: 5000, creditsLabel: "300 Generations / Month",
    cta: "Upgrade to Premium",
    features: ["Everything in Pro","Fastest AI Model","Unlimited Project Saves","Version History","Team Collaboration (5 Users)","Priority Support"],
    locked: ["API Access"],
  },
  {
    id: "business", name: "Business", emoji: "🏢",
    priceUsd: 149, priceInr: 12499,
    credits: 10000, creditsLabel: "100 Generations / Day",
    cta: "Contact Us",
    features: ["Everything in Premium","API Access","Unlimited Team Members","Admin Dashboard","White Label Support","Business SLA"],
    locked: [],
  },
];

const TOPUPS = [
  { id: "topup_50",  credits: 50,  priceUsd: 15,  priceInr: 1299 },
  { id: "topup_100", credits: 100, priceUsd: 30,  priceInr: 2599 },
  { id: "topup_200", credits: 200, priceUsd: 60,  priceInr: 4999 },
  { id: "topup_500", credits: 500, priceUsd: 150, priceInr: 11999 },
];

const TABS = [
  { id: "profile",       label: "Profile",       icon: "👤", section: "ACCOUNT" },
  { id: "billing",       label: "Billing",       icon: "💳", section: "ACCOUNT" },
  { id: "apikeys",       label: "API Keys",      icon: "🔑", section: "ACCOUNT" },
  { id: "notifications", label: "Notifications", icon: "🔔", section: "DEVELOPER" },
  { id: "theme",         label: "Theme",         icon: "🎨", section: "DEVELOPER" },
  { id: "cloudcode",     label: "Cloud Code",    icon: "☁️", section: "DEVELOPER" },
  { id: "github",        label: "GitHub",        icon: "🐙", section: "ADVANCED" },
  { id: "domains",       label: "Domains",       icon: "🌐", section: "ADVANCED" },
  { id: "security",      label: "Security",      icon: "🔒", section: "ADVANCED" },
  { id: "members",       label: "Members",       icon: "👥", section: "ADVANCED" },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { mode, accent, colors, setMode, setAccent, saveTheme, saving: savingTheme, saved: savedTheme } = useTheme();

  const [activeTab, setActiveTab]     = useState(searchParams.get("tab") || "profile");
  const [profile, setProfile]         = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showTopup, setShowTopup]     = useState(false);
  const [selectedTopup, setSelectedTopup] = useState(TOPUPS[1]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [billing, setBilling]         = useState<"monthly"|"yearly">("monthly");

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [savedProfile, setSavedProfile] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys]         = useState<any[]>([]);
  const [showKey, setShowKey]         = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copiedKey, setCopiedKey]     = useState<string | null>(null);

  // Notifications
  const [notifSettings, setNotifSettings] = useState({
    buildComplete: true,
    creditLow: true,
    billing: true,
    productUpdates: false,
    deploySuccess: true,
    weeklyDigest: false,
  });
  const [savingNotif, setSavingNotif] = useState(false);
  const [savedNotif, setSavedNotif]   = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth/login"); return; }

    const { data: prof } = await supabase
      .from("profiles").select("*").eq("id", session.user.id).single();

    setProfile({ ...prof, email: session.user.email });
    setDisplayName(prof?.full_name || "");
    setCompanyName(prof?.company_name || "");

    // Load notification settings from profile
    if (prof?.notification_settings) {
      setNotifSettings(prof.notification_settings);
    }

    // Load API keys
    const { data: keys } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    setApiKeys(keys || []);

    const { data: tx } = await supabase
      .from("credit_transactions")
      .select("*").eq("user_id", session.user.id)
      .order("created_at", { ascending: false }).limit(20);
    setTransactions(tx || []);

    setLoading(false);
  };

  // ── Generate API Key ──────────────────────────────────────────
  const generateApiKey = async () => {
    setGeneratingKey(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const key = `kr_live_${Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, "0")).join("")}`;
    const prefix = key.slice(0, 12) + "...";

    const { data, error } = await supabase.from("api_keys").insert({
      user_id: session.user.id,
      key_hash: key,
      prefix,
      name: `Key ${apiKeys.length + 1}`,
      created_at: new Date().toISOString(),
    }).select().single();

    if (data) {
      setApiKeys(prev => [{ ...data, key_hash: key }, ...prev]);
      setShowKey(data.id);
    }
    setGeneratingKey(false);
  };

  const deleteApiKey = async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    setApiKeys(prev => prev.filter(k => k.id !== id));
  };

  const copyKey = async (key: string, id: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ── Save Profile ──────────────────────────────────────────────
  const handleSaveProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("profiles")
      .update({ full_name: displayName, company_name: companyName })
      .eq("id", session.user.id);
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 3000);
  };

  // ── Save Notifications ────────────────────────────────────────
  const handleSaveNotifications = async () => {
    setSavingNotif(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("profiles")
      .update({ notification_settings: notifSettings })
      .eq("id", session.user.id);
    setSavingNotif(false);
    setSavedNotif(true);
    setTimeout(() => setSavedNotif(false), 3000);
  };

  // ── Payment ───────────────────────────────────────────────────
  const handlePayment = async (planId: string) => {
    setPaymentLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }

      const res = await fetch("/api/payment/order", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ planId }),
      });

      const order = await res.json();
      if (!res.ok) { alert(order.error || "Failed"); return; }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "Krypton AI",
          description: order.planName,
          image: "/logo.png",
          order_id: order.orderId,
          handler: async (response: any) => {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId, credits: order.credits,
              }),
            });
            const result = await verifyRes.json();
            if (result.success) {
              alert(`✅ Payment successful! ${result.creditsAdded} credits added.`);
              loadData(); setShowTopup(false);
            } else {
              alert("❌ Payment verification failed.");
            }
          },
          prefill: { email: profile?.email || "", name: profile?.full_name || "" },
          theme: { color: "#F5D800" },
          modal: { ondismiss: () => setPaymentLoading(false) },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      };
    } catch (err: any) {
      alert("Payment failed: " + err.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/landing");
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, color: T.gold }}>
        Loading...
      </div>
    );
  }

  const currentPlan = PLANS.find(p => p.id === (profile?.plan || "free")) || PLANS[0];
  const remaining = (profile?.total_credits ?? 5) - (profile?.used_credits || 0);
  const firstName = profile?.full_name?.split(" ")[0] || profile?.email?.split("@")[0] || "User";

  const sections = ["ACCOUNT", "DEVELOPER", "ADVANCED"];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 220, borderRight: `1px solid ${T.border}`, background: "#080808", padding: "20px 12px", flexShrink: 0 }}>
        <button onClick={() => router.push("/")} style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", color: T.muted,
          cursor: "pointer", fontSize: 13, marginBottom: 20, padding: "6px 8px",
        }}>← Back to Home</button>

        {sections.map(section => (
          <div key={section}>
            <p style={{ fontSize: 9, color: "#333", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, padding: "0 8px 6px", marginTop: 12 }}>{section}</p>
            {TABS.filter(t => t.section === section).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                width: "100%", textAlign: "left", padding: "8px 12px",
                borderRadius: 8, border: "none",
                background: activeTab === tab.id ? "rgba(245,197,66,0.1)" : "none",
                color: activeTab === tab.id ? T.gold : T.muted,
                fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 2, fontWeight: activeTab === tab.id ? 600 : 400,
              }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        ))}

        <div style={{ height: 1, background: T.border, margin: "16px 8px" }} />
        <button onClick={handleLogout} style={{
          width: "100%", textAlign: "left", padding: "8px 12px",
          borderRadius: 8, border: "none", background: "none",
          color: "#ef4444", fontSize: 13, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
        }}>🚪 Logout</button>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px", maxWidth: 860 }}>

        {/* ── PROFILE ── */}
        {activeTab === "profile" && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Profile</h2>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 28 }}>Manage your personal information</p>

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "24px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#000" }}>
                  {firstName[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{profile?.email}</div>
                  <div style={{ fontSize: 12, color: T.green, marginTop: 2 }}>{currentPlan.name} Plan</div>
                </div>
              </div>

              {[
                { label: "DISPLAY NAME", value: displayName, setter: setDisplayName, placeholder: "Your name" },
                { label: "COMPANY NAME", value: companyName, setter: setCompanyName, placeholder: "Your company" },
              ].map(field => (
                <div key={field.label} style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1, textTransform: "uppercase" as const, fontWeight: 700 }}>{field.label}</label>
                  <input value={field.value} onChange={e => field.setter(e.target.value)} placeholder={field.placeholder}
                    style={{ width: "100%", background: "#161616", border: `1px solid ${T.border}`, borderRadius: 9, color: T.text, padding: "10px 14px", fontSize: 14, outline: "none", marginTop: 6, boxSizing: "border-box" as const }} />
                </div>
              ))}

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, color: T.muted, letterSpacing: 1, textTransform: "uppercase" as const, fontWeight: 700 }}>EMAIL</label>
                <input value={profile?.email || ""} disabled
                  style={{ width: "100%", background: "#0d0d0d", border: `1px solid ${T.border}`, borderRadius: 9, color: "#555", padding: "10px 14px", fontSize: 14, outline: "none", marginTop: 6, boxSizing: "border-box" as const, cursor: "not-allowed" }} />
              </div>

              <button onClick={handleSaveProfile} style={{
                padding: "10px 24px",
                background: savedProfile ? "rgba(0,204,68,0.15)" : G,
                border: savedProfile ? "1px solid rgba(0,204,68,0.3)" : "none",
                borderRadius: 9, color: savedProfile ? T.green : "#000",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}>
                {savedProfile ? "✓ Saved!" : "Save Changes"}
              </button>
            </div>

            {/* Danger Zone */}
            <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "20px 24px" }}>
              <p style={{ color: "#ef4444", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Danger Zone</p>
              <p style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>These actions cannot be undone.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleLogout} style={{ padding: "8px 18px", background: "rgba(245,197,66,0.1)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.gold, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Logout</button>
                <button style={{ padding: "8px 18px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", fontSize: 13, cursor: "pointer" }}>Delete Account</button>
              </div>
            </div>
          </div>
        )}

        {/* ── BILLING ── */}
         {activeTab === "billing" && (
          <div>
           <button onClick={() => window.open("/billing", "_blank")} style={{
            width: "100%", padding: "13px", marginBottom: 24,
            background: "linear-gradient(135deg,#F5D800,#00CC44)",
            border: "none", borderRadius: 10, color: "#000",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            💳 Open Full Billing Page — New Tab →
           </button>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Billing</h2>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 28 }}>Manage your plan and credits</p>

            {/* Current Plan */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: T.muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 10 }}>CURRENT PLAN</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {currentPlan.emoji} {currentPlan.name} Plan
                  </div>
                  <p style={{ color: T.muted, fontSize: 13, margin: "6px 0 0" }}>{currentPlan.creditsLabel}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowTopup(true)} style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${T.border}`, background: "none", color: T.text, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                    Top up credits
                  </button>
                  {profile?.plan !== "business" && (
                    <button onClick={() => document.getElementById("plans-section")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: G, color: "#000", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                      Upgrade Plan →
                    </button>
                  )}
                </div>
              </div>
            </div>

             {/* Credits Usage */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Credits Usage</p>
              <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ height: "100%", width: `${Math.max(5, (remaining / (profile?.total_credits || 100)) * 100)}%`, background: remaining > 20 ? G : "#ef4444", borderRadius: 8 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "Remaining", value: remaining, color: remaining > 20 ? T.green : "#ef4444" },
                  { label: "Used", value: profile?.used_credits || 0, color: T.muted },
                  { label: "Total", value: profile?.total_credits || 100, color: T.gold },
                ].map(stat => (
                  <div key={stat.label} style={{ background: "#161616", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transaction History */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Transaction History</p>
              {transactions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#444" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <p style={{ margin: 0, fontSize: 13 }}>No transactions yet</p>
                </div>
              ) : (
                transactions.map((tx, i) => (
                  <div key={tx.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < transactions.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <div>
                      <div style={{ fontSize: 13, color: T.text }}>{tx.description}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{new Date(tx.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: tx.amount > 0 ? T.green : "#ef4444" }}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount} credits
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Plans */}
            <div id="plans-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Plans</h3>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4, display: "flex" }}>
                  {(["monthly", "yearly"] as const).map(b => (
                    <button key={b} onClick={() => setBilling(b)} style={{
                      padding: "6px 16px", borderRadius: 7, border: "none",
                      background: billing === b ? G : "none",
                      color: billing === b ? "#000" : T.muted,
                      fontSize: 12, fontWeight: billing === b ? 700 : 400, cursor: "pointer",
                    }}>
                      {b === "monthly" ? "Monthly" : "Yearly"}{b === "yearly" && <span style={{ fontSize: 9, marginLeft: 4 }}>20% off</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                {PLANS.map(plan => {
                  const isCurrent = profile?.plan === plan.id || (!profile?.plan && plan.id === "free");
                  const price = billing === "yearly" ? Math.round(plan.priceUsd * 0.8) : plan.priceUsd;
                  const priceInr = billing === "yearly" ? Math.round(plan.priceInr * 0.8) : plan.priceInr;
                  return (
                    <div key={plan.id} style={{ background: plan.highlight ? "rgba(245,197,66,0.04)" : T.card, border: plan.highlight ? "1px solid rgba(245,197,66,0.4)" : `1px solid ${T.border}`, borderRadius: 14, padding: "20px", position: "relative" }}>
                      {plan.highlight && (
                        <div style={{ position: "absolute" as const, top: -12, left: "50%", transform: "translateX(-50%)", background: G, color: "#000", fontSize: 11, fontWeight: 700, padding: "3px 14px", borderRadius: 20 }}>Most Popular</div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span>{plan.emoji}</span>
                        <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{plan.name}</h3>
                        {isCurrent && <span style={{ fontSize: 10, background: "rgba(0,208,132,0.15)", color: T.green, border: "1px solid rgba(0,208,132,0.3)", borderRadius: 20, padding: "1px 8px" }}>Current</span>}
                      </div>
                      <p style={{ color: T.green, fontSize: 11, margin: "0 0 10px" }}>{plan.creditsLabel}</p>
                      <div style={{ marginBottom: 16 }}>
                        {plan.priceUsd === 0 ? (
                          <span style={{ fontSize: 30, fontWeight: 800, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>$0</span>
                        ) : (
                          <div>
                            <span style={{ fontSize: 30, fontWeight: 800, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>${price}</span>
                            <span style={{ color: T.muted, fontSize: 12 }}>/mo</span>
                            <span style={{ color: "#444", fontSize: 11, display: "block" }}>≈ ₹{priceInr.toLocaleString()}/mo</span>
                          </div>
                        )}
                      </div>
                      {plan.features.slice(0, 4).map(f => (
                        <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 5 }}>
                          <span style={{ color: T.green, fontSize: 12 }}>✅</span>
                          <span style={{ fontSize: 12, color: T.muted }}>{f}</span>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          if (plan.id === "free" || isCurrent) return;
                          if (plan.id === "business") { window.location.href = "mailto:support@kryptonai.com?subject=Business Plan"; return; }
                          handlePayment(plan.id);
                        }}
                        disabled={isCurrent || plan.id === "free" || paymentLoading}
                        style={{ width: "100%", marginTop: 16, padding: "11px", background: isCurrent ? "rgba(0,204,68,0.1)" : plan.highlight ? G : "#161616", border: isCurrent ? "1px solid rgba(0,204,68,0.3)" : plan.highlight ? "none" : `1px solid ${T.border}`, borderRadius: 10, color: plan.highlight && !isCurrent ? "#000" : isCurrent ? T.green : T.text, fontWeight: 700, fontSize: 13, cursor: isCurrent || plan.id === "free" ? "default" : "pointer" }}>
                        {isCurrent ? "✓ Current Plan" : paymentLoading ? "Processing..." : plan.cta}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── API KEYS ── */}
        {activeTab === "apikeys" && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>API Keys</h2>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 28 }}>Use API keys to integrate Krypton AI into your apps</p>

            <div style={{ background: "rgba(245,197,66,0.04)", border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>
                ⚠️ API keys are shown only once. Save them securely.
              </p>
            </div>

            <button onClick={generateApiKey} disabled={generatingKey} style={{
              padding: "10px 20px", background: G, border: "none",
              borderRadius: 9, color: "#000", fontWeight: 700, fontSize: 13,
              cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 8,
            }}>
              {generatingKey ? "Generating..." : "+ Generate New API Key"}
            </button>

            {apiKeys.length === 0 ? (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔑</div>
                <p style={{ color: T.muted, fontSize: 13 }}>No API keys yet. Generate one above.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {apiKeys.map(key => (
                  <div key={key.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{key.name}</span>
                        <span style={{ fontSize: 11, color: T.muted, marginLeft: 10 }}>
                          Created {new Date(key.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <button onClick={() => deleteApiKey(key.id)} style={{
                        padding: "4px 10px", background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6,
                        color: "#ef4444", fontSize: 11, cursor: "pointer",
                      }}>Delete</button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#161616", borderRadius: 8, padding: "10px 14px" }}>
                      <code style={{ flex: 1, fontSize: 12, color: T.gold, fontFamily: "monospace", wordBreak: "break-all" as const }}>
                        {showKey === key.id ? (key.key_hash || key.prefix) : `${key.prefix || "kr_live_"}${"•".repeat(32)}`}
                      </code>
                      <button onClick={() => setShowKey(showKey === key.id ? null : key.id)} style={{
                        padding: "4px 10px", background: "#1a1a1a", border: `1px solid ${T.border}`,
                        borderRadius: 6, color: T.muted, fontSize: 11, cursor: "pointer", flexShrink: 0,
                      }}>{showKey === key.id ? "Hide" : "Show"}</button>
                      <button onClick={() => copyKey(key.key_hash || key.prefix, key.id)} style={{
                        padding: "4px 10px", background: copiedKey === key.id ? "rgba(0,204,68,0.15)" : G,
                        border: "none", borderRadius: 6,
                        color: copiedKey === key.id ? T.green : "#000",
                        fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0,
                      }}>{copiedKey === key.id ? "✓ Copied" : "Copy"}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {activeTab === "notifications" && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Notifications</h2>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 28 }}>Control which notifications you receive</p>

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Email Notifications</p>
              {[
                { key: "buildComplete",   label: "Build Complete",    desc: "When your project finishes generating" },
                { key: "creditLow",       label: "Low Credits",       desc: "When credits fall below 10" },
                { key: "billing",         label: "Billing Updates",   desc: "Receipts and plan changes" },
                { key: "deploySuccess",   label: "Deploy Success",    desc: "When your project is deployed" },
                { key: "productUpdates",  label: "Product Updates",   desc: "New features and improvements" },
                { key: "weeklyDigest",    label: "Weekly Digest",     desc: "Summary of your weekly activity" },
              ].map(item => (
                <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: T.muted, margin: "3px 0 0" }}>{item.desc}</p>
                  </div>
                  <div
                    onClick={() => setNotifSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: notifSettings[item.key as keyof typeof notifSettings] ? G : "#1a1a1a",
                      border: `1px solid ${notifSettings[item.key as keyof typeof notifSettings] ? "transparent" : T.border}`,
                      cursor: "pointer", position: "relative", transition: "all 0.2s", flexShrink: 0,
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 2,
                      left: notifSettings[item.key as keyof typeof notifSettings] ? 22 : 2,
                      transition: "left 0.2s",
                    }} />
                  </div>
                </div>
              ))}
            </div>

            <button onClick={handleSaveNotifications} disabled={savingNotif} style={{
              padding: "10px 24px",
              background: savedNotif ? "rgba(0,204,68,0.15)" : G,
              border: savedNotif ? "1px solid rgba(0,204,68,0.3)" : "none",
              borderRadius: 9, color: savedNotif ? T.green : "#000",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>
              {savingNotif ? "Saving..." : savedNotif ? "✓ Saved!" : "Save Preferences"}
            </button>
          </div>
        )}

         {/* ── THEME ── */}
{activeTab === "theme" && (
  <div>
    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: colors.text }}>Theme</h2>
    <p style={{ color: colors.muted, fontSize: 14, marginBottom: 28 }}>
      Changes apply instantly — no refresh needed
    </p>

    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
      <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: colors.text }}>Color Mode</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { id: "dark",   label: "Dark",   icon: "🌙", preview: "#050505" },
          { id: "system", label: "System", icon: "💻", preview: "#1a1a1a" },
          { id: "light",  label: "Light",  icon: "☀️", preview: "#F5F5F5" },
        ].map(t => (
          <div key={t.id} onClick={() => setMode(t.id as any)} style={{
            border: mode === t.id ? `2px solid ${colors.gold}` : `1px solid ${colors.border}`,
            borderRadius: 12, padding: 16, cursor: "pointer",
            background: mode === t.id ? "rgba(245,197,66,0.05)" : colors.card,
            transition: "all 0.15s", textAlign: "center" as const,
          }}>
            <div style={{ width: "100%", height: 48, background: t.preview, borderRadius: 8, marginBottom: 10, border: `1px solid ${colors.border}` }} />
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <p style={{ fontSize: 13, fontWeight: 600, margin: "6px 0 0", color: mode === t.id ? colors.gold : colors.muted }}>{t.label}</p>
          </div>
        ))}
      </div>
    </div>

    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
      <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: colors.text }}>Accent Color</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { id: "gold-green",  label: "Gold & Green",  g: "linear-gradient(135deg,#F5D800,#00CC44)" },
          { id: "purple-blue", label: "Purple & Blue", g: "linear-gradient(135deg,#8B5CF6,#3B82F6)" },
          { id: "orange-red",  label: "Orange & Red",  g: "linear-gradient(135deg,#F97316,#EF4444)" },
          { id: "cyan-blue",   label: "Cyan & Blue",   g: "linear-gradient(135deg,#06B6D4,#3B82F6)" },
          { id: "pink-purple", label: "Pink & Purple", g: "linear-gradient(135deg,#EC4899,#8B5CF6)" },
        ].map(color => (
          <div key={color.id} onClick={() => setAccent(color.id as any)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: color.g,
              border: accent === color.id ? "3px solid #fff" : "3px solid transparent",
              boxShadow: accent === color.id ? `0 0 0 2px ${colors.gold}` : "none",
              transition: "all 0.15s",
            }} />
            <span style={{ fontSize: 10, color: accent === color.id ? colors.gold : colors.muted, whiteSpace: "nowrap" as const }}>{color.label}</span>
          </div>
        ))}
      </div>
    </div>

    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: colors.text }}>Preview</p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button style={{ padding: "8px 20px", background: colors.gradient, border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Primary Button
        </button>
        <button style={{ padding: "8px 20px", background: "none", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 13, cursor: "pointer" }}>
          Ghost Button
        </button>
      </div>
    </div>

    <button onClick={saveTheme} disabled={savingTheme} style={{
      padding: "10px 24px",
      background: savedTheme ? "rgba(0,204,68,0.15)" : colors.gradient,
      border: savedTheme ? "1px solid rgba(0,204,68,0.3)" : "none",
      borderRadius: 9, color: savedTheme ? colors.green : "#000",
      fontWeight: 700, fontSize: 14, cursor: "pointer",
    }}>
      {savingTheme ? "Saving..." : savedTheme ? "✓ Saved!" : "Save Theme"}
    </button>
  </div>
)}

        {/* ── COMING SOON ── */}
        {!["profile","billing","apikeys","notifications","theme"].includes(activeTab) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, color: "#444" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: T.muted }}>Coming Soon</p>
            <p style={{ fontSize: 13, color: "#444", marginTop: 6 }}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} settings will be available soon.
            </p>
          </div>
        )}
      </div>

      {/* ── TOP-UP MODAL ── */}
      {showTopup && (
        <div onClick={() => setShowTopup(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d0d0d", border: `1px solid ${T.border}`, borderRadius: 18, padding: 28, width: "100%", maxWidth: 440, margin: "0 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Add more credits</h3>
                <p style={{ color: T.muted, fontSize: 13, margin: "4px 0 0" }}>Valid for 12 months</p>
              </div>
              <button onClick={() => setShowTopup(false)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {TOPUPS.map(topup => (
                <div key={topup.id} onClick={() => setSelectedTopup(topup)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: 10,
                  border: selectedTopup.id === topup.id ? "1px solid rgba(245,197,66,0.5)" : `1px solid ${T.border}`,
                  background: selectedTopup.id === topup.id ? "rgba(245,197,66,0.08)" : "#161616",
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: selectedTopup.id === topup.id ? "6px solid #F5D800" : `2px solid ${T.border}` }} />
                    <span style={{ fontSize: 14, color: selectedTopup.id === topup.id ? T.gold : T.text, fontWeight: selectedTopup.id === topup.id ? 700 : 400 }}>
                      +{topup.credits} credits
                    </span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: selectedTopup.id === topup.id ? T.gold : T.muted }}>${topup.priceUsd}</span>
                </div>
              ))}
            </div>
            <button onClick={() => handlePayment(selectedTopup.id)} disabled={paymentLoading} style={{
              width: "100%", padding: "13px", background: G, border: "none",
              borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer",
            }}>
              {paymentLoading ? "Processing..." : `Buy ${selectedTopup.credits} Credits — $${selectedTopup.priceUsd}`}
            </button>
            <p style={{ textAlign: "center", fontSize: 11, color: "#444", marginTop: 10 }}>
              Secured by Razorpay • Valid for 12 months
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050505", color: "#F5D800", fontFamily: "'DM Sans', sans-serif" }}>
        Loading...
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
