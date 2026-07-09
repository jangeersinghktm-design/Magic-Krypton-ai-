"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme, ACCENT_COLORS, type ThemeMode, type AccentColor } from "@/components/ThemeProvider";

// Real pages that exist in the project
const REAL_PAGES = ["/", "/create", "/dashboard", "/settings", "/billing",
  "/analytics", "/templates", "/chatbot", "/image-gen", "/content", "/landing",
  "/about", "/blog", "/support", "/team"];

type Tab = "profile" | "account" | "security" | "notifications" | "billing" | "apikeys" | "theme";

const C = {
  bg: "#050816", surface: "#0B1020", card: "#0B1020",
  border: "rgba(255,255,255,0.07)", gold: "#F5F5F5",
  text: "#F5F5F5", muted: "#555", sub: "#888",
  green: "#5FB88A", red: "#E5736B", grad: "linear-gradient(135deg,#F5F5F5,#D9D9D9)",
};

function SettingsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const { mode, accent, setMode, setAccent, saveTheme, saving: themeSaving, saved: themeSaved } = useTheme();

  const [tab, setTab]     = useState<Tab>((params.get("tab") as Tab) || "profile");
  const [user, setUser]   = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // ── API Keys tab state (backed by /api/settings/api-keys) ──────
  const [apiKeys, setApiKeys]       = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>("never"); // 'never' | '30' | '90' | '365'
  const [creatingKey, setCreatingKey] = useState(false);
  const [freshRawKey, setFreshRawKey] = useState<string | null>(null); // shown once
  const [keysError, setKeysError]   = useState("");

  // ── Account tab state ──────────────────────────────────────────
  const [newEmail, setNewEmail]           = useState("");
  const [emailChangeMsg, setEmailChangeMsg] = useState("");
  const [deletePassword, setDeletePassword]       = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteMsg, setDeleteMsg]                 = useState("");
  const [deleteSubmitting, setDeleteSubmitting]   = useState(false);
  const [deletionScheduledFor, setDeletionScheduledFor] = useState<string | null>(null);

  // ── Security tab state ─────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg]                     = useState("");
  const [pwSaving, setPwSaving]               = useState(false);

  // ── Notifications tab state ────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState({
    productUpdates: true, creditAlerts: true, marketingEmails: false,
  });
  const [notifSaved, setNotifSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth/login"); return; }
      setUser(session.user);
      setEmail(session.user.email || "");
      setName(session.user.user_metadata?.full_name || "");
      const { data: p } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(p);
      if (p?.notification_prefs) setNotifPrefs({ productUpdates: true, creditAlerts: true, marketingEmails: false, ...p.notification_prefs });

      const token = session.access_token;
      const authHeader = { Authorization: `Bearer ${token}` };

      // Real API keys (hash-only backend, never returns raw keys after creation)
      fetch("/api/settings/api-keys", { headers: authHeader })
        .then(r => r.json()).then(d => setApiKeys(d.keys || [])).catch(() => {});

      // Real pending-deletion status (7-day recovery window)
      fetch("/api/settings/account/delete", { headers: authHeader })
        .then(r => r.json()).then(d => { if (d.pending) setDeletionScheduledFor(d.scheduledFor); }).catch(() => {});

      setLoading(false);
    })();
  }, []);

  const saveProfile = async () => {
    if (!user) return;
    await supabase.auth.updateUser({ data: { full_name: name } });
    await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  // ── Account: change email (Supabase sends a confirmation link to the new address) ──
  const changeEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) { setEmailChangeMsg("Enter a valid email address."); return; }
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailChangeMsg(error ? error.message : "Confirmation link sent to your new email. Click it to finish the change.");
  };

  // ── Account: request deletion — password-verified, 7-day recovery window ──
  const requestAccountDeletion = async () => {
    setDeleteMsg("");
    if (deleteConfirmText !== "DELETE") { setDeleteMsg('Type "DELETE" to confirm.'); return; }
    if (!deletePassword) { setDeleteMsg("Enter your password to confirm."); return; }
    setDeleteSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/settings/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ password: deletePassword, confirmText: deleteConfirmText }),
    });
    const data = await res.json();
    setDeleteSubmitting(false);
    if (!res.ok) { setDeleteMsg(data.error || "Something went wrong."); return; }
    setDeletionScheduledFor(data.scheduledFor);
    setDeletePassword(""); setDeleteConfirmText("");
  };

  const cancelAccountDeletion = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/settings/account/cancel-deletion", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) setDeletionScheduledFor(null);
  };

  // ── Security: change password — requires current password, verified server-side ──
  const changePassword = async () => {
    setPwMsg("");
    if (!currentPassword) { setPwMsg("Enter your current password."); return; }
    if (newPassword.length < 8) { setPwMsg("New password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPwMsg("Passwords do not match."); return; }
    setPwSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/settings/security/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setPwSaving(false);
    setPwMsg(res.ok ? "Password updated successfully." : (data.error || "Something went wrong."));
    if (res.ok) { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }
  };

  // ── Notifications: persist preferences (JSONB — see architecture notes) ──
  const saveNotifPrefs = async () => {
    if (!user) return;
    try {
      await supabase.from("profiles").update({ notification_prefs: notifPrefs }).eq("id", user.id);
    } catch {}
    setNotifSaved(true); setTimeout(() => setNotifSaved(false), 2000);
  };

  // ── API Keys: create (hashed server-side, raw key shown once) ──
  const createApiKey = async () => {
    if (!newKeyName.trim()) { setKeysError("Give the key a name."); return; }
    setCreatingKey(true); setKeysError("");
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        name: newKeyName.trim(),
        provider: "krypton",
        expiresInDays: newKeyExpiry === "never" ? null : Number(newKeyExpiry),
      }),
    });
    const data = await res.json();
    setCreatingKey(false);
    if (!res.ok) { setKeysError(data.error || "Failed to create key."); return; }
    setFreshRawKey(data.rawKey);
    setApiKeys(prev => [data.key, ...prev]);
    setNewKeyName("");
  };

  const revokeApiKey = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/settings/api-keys?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) setApiKeys(prev => prev.map(k => k.id === id ? { ...k, status: "revoked" } : k));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const remaining = (profile?.total_credits || 5) - (profile?.used_credits || 0);
  const plan = (profile?.plan || "free").toUpperCase();

  const TABS = [
    { id: "profile"       as Tab, icon: "👤", label: "Profile" },
    { id: "account"       as Tab, icon: "🗂️", label: "Account" },
    { id: "security"      as Tab, icon: "🔒", label: "Security" },
    { id: "notifications" as Tab, icon: "🔔", label: "Notifications" },
    { id: "billing"       as Tab, icon: "💳", label: "Billing" },
    { id: "apikeys"       as Tab, icon: "🔑", label: "API Keys" },
    { id: "theme"         as Tab, icon: "🎨", label: "Appearance" },
  ];

  if (loading) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg }}>
      <div style={{ width:28, height:28, borderRadius:"50%", border:"3px solid rgba(255,215,0,0.15)", borderTopColor:C.gold, animation:"spin .8s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:#050816;color:#F5F5F5;font-family:'DM Sans',system-ui,sans-serif;}
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus{border-color:rgba(255,215,0,0.4)!important;outline:none;}
        .tab-btn:hover{background:rgba(255,255,255,0.05)!important;}
        .nav-item:hover{background:#11151F!important;color:#fff!important;}
      `}</style>

      <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'DM Sans',system-ui,sans-serif" }}>

        {/* Top bar */}
        <div style={{ height:52, borderBottom:`1px solid ${C.border}`, background:C.surface, display:"flex", alignItems:"center", padding:"0 24px", gap:14 }}>
          <button onClick={()=>router.push("/")} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18, padding:"4px 8px", borderRadius:7 }}>←</button>
          <span style={{ fontSize:15, fontWeight:700, color:C.text }}>Settings</span>
          <div style={{ marginLeft:"auto", fontSize:12, color:C.muted }}>{email}</div>
        </div>

        <div style={{ maxWidth:860, margin:"0 auto", padding:"28px 16px", display:"flex", gap:24 }}>

          {/* Sidebar */}
          <div style={{ width:190, flexShrink:0 }}>
            {TABS.map(t => (
              <button key={t.id} className="tab-btn" onClick={()=>setTab(t.id)} style={{
                width:"100%", textAlign:"left", padding:"10px 14px", marginBottom:4,
                borderRadius:10, border:"none",
                background: tab===t.id ? "rgba(255,215,0,0.08)" : "transparent",
                color: tab===t.id ? C.gold : C.sub,
                fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:9,
                fontWeight: tab===t.id ? 600 : 400, transition:"all .15s",
              }}>
                {t.icon} {t.label}
              </button>
            ))}

            <div style={{ height:1, background:C.border, margin:"12px 0" }}/>

            {/* Real page links */}
            {[
              { icon:"🏠", label:"Home",      path:"/" },
              { icon:"✨", label:"Create",    path:"/create" },
              { icon:"📊", label:"Dashboard", path:"/dashboard" },
              { icon:"📈", label:"Analytics", path:"/analytics" },
              { icon:"⭐", label:"Templates", path:"/templates" },
              { icon:"🤖", label:"Chatbot",   path:"/chatbot" },
            ].map(item => (
              <button key={item.path} className="nav-item" onClick={()=>router.push(item.path)} style={{
                width:"100%", textAlign:"left", padding:"9px 14px", marginBottom:3,
                borderRadius:9, border:"none", background:"transparent",
                color:C.muted, fontSize:13, cursor:"pointer",
                display:"flex", alignItems:"center", gap:9, transition:"all .15s",
              }}>
                {item.icon} {item.label}
              </button>
            ))}

            <div style={{ height:1, background:C.border, margin:"12px 0" }}/>
            <button onClick={handleLogout} style={{
              width:"100%", padding:"9px 14px", borderRadius:10,
              border:"1px solid rgba(229,115,107,0.2)", background:"rgba(229,115,107,0.06)",
              color:C.red, fontSize:13, cursor:"pointer", textAlign:"left",
              display:"flex", alignItems:"center", gap:9,
            }}>
              🚪 Sign Out
            </button>
          </div>

          {/* Content */}
          <div style={{ flex:1 }}>

            {/* Profile */}
            {tab === "profile" && (
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, marginBottom:20, color:C.text }}>Profile</h2>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  <div style={{ marginBottom:16 }}>
                    <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}>Full Name</label>
                    <input value={name} onChange={e=>setName(e.target.value)}
                      style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:14, transition:"border .2s" }}/>
                  </div>
                  <div style={{ marginBottom:24 }}>
                    <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}>Email</label>
                    <input value={email} disabled
                      style={{ width:"100%", background:"rgba(255,255,255,0.02)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.muted, fontSize:14 }}/>
                    <div style={{ fontSize:11, color:C.muted, marginTop:5 }}>Email cannot be changed</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <button onClick={saveProfile} style={{ padding:"10px 24px", background:saved?"rgba(95,184,138,0.15)":C.grad, border:"none", borderRadius:9, color:saved?C.green:"#050816", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                      {saved ? "✓ Saved!" : "Save Changes"}
                    </button>
                    <span style={{ fontSize:12, color:C.muted }}>{plan} Plan</span>
                  </div>
                </div>
              </div>
            )}

            {/* Account */}
            {tab === "account" && (
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, marginBottom:20, color:C.text }}>Account</h2>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24, marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>Change Email</div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>Current: {email}. A confirmation link is sent to the new address.</div>
                  <div style={{ display:"flex", gap:10 }}>
                    <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="new@email.com"
                      style={{ flex:1, background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:14 }}/>
                    <button onClick={changeEmail} style={{ padding:"10px 20px", background:C.grad, border:"none", borderRadius:9, color:"#050816", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                      Send Link
                    </button>
                  </div>
                  {emailChangeMsg && <div style={{ fontSize:12, color:C.green, marginTop:10 }}>{emailChangeMsg}</div>}
                </div>

                <div style={{ background:"rgba(229,115,107,0.05)", border:"1px solid rgba(229,115,107,0.2)", borderRadius:14, padding:24 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:4 }}>Delete Account</div>

                  {deletionScheduledFor ? (
                    <>
                      <div style={{ fontSize:12, color:C.muted, marginBottom:12, lineHeight:1.6 }}>
                        Your account is scheduled for permanent deletion on{" "}
                        <strong style={{ color:C.text }}>{new Date(deletionScheduledFor).toLocaleString()}</strong>.
                        You can cancel any time before then.
                      </div>
                      <button onClick={cancelAccountDeletion} style={{ padding:"10px 20px", background:"rgba(95,184,138,0.15)", border:"1px solid rgba(95,184,138,0.3)", borderRadius:9, color:C.green, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                        Cancel Deletion
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:11, color:C.muted, marginBottom:12, lineHeight:1.6 }}>
                        Your account will be permanently deleted after a <strong style={{color:C.text}}>7-day recovery window</strong> —
                        you can cancel any time before then. Enter your password and type "DELETE" to confirm.
                      </div>
                      <div style={{ marginBottom:10 }}>
                        <input type="password" value={deletePassword} onChange={e=>setDeletePassword(e.target.value)} placeholder="Your password"
                          style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:14, marginBottom:10 }}/>
                        <div style={{ display:"flex", gap:10 }}>
                          <input value={deleteConfirmText} onChange={e=>setDeleteConfirmText(e.target.value)} placeholder="Type DELETE"
                            style={{ flex:1, background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:14 }}/>
                          <button onClick={requestAccountDeletion} disabled={deleteConfirmText!=="DELETE" || !deletePassword || deleteSubmitting}
                            style={{ padding:"10px 20px", background: (deleteConfirmText==="DELETE" && deletePassword) ? "#E5736B" : "rgba(229,115,107,0.2)", border:"none", borderRadius:9, color:"#fff", fontSize:13, fontWeight:700, cursor: (deleteConfirmText==="DELETE" && deletePassword && !deleteSubmitting) ? "pointer" : "not-allowed", whiteSpace:"nowrap" }}>
                            {deleteSubmitting ? "Scheduling…" : "Delete Account"}
                          </button>
                        </div>
                      </div>
                      {deleteMsg && <div style={{ fontSize:12, color:C.red, marginTop:6 }}>{deleteMsg}</div>}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Security */}
            {tab === "security" && (
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, marginBottom:20, color:C.text }}>Security</h2>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24, marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:14 }}>Change Password</div>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}>Current Password</label>
                    <input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}
                      style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:14 }}/>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}>New Password</label>
                    <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters"
                      style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:14 }}/>
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}>Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
                      style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:14 }}/>
                  </div>
                  <button onClick={changePassword} disabled={pwSaving} style={{ padding:"10px 24px", background:C.grad, border:"none", borderRadius:9, color:"#050816", fontSize:14, fontWeight:700, cursor:pwSaving?"default":"pointer", opacity:pwSaving?0.6:1 }}>
                    {pwSaving ? "Updating…" : "Update Password"}
                  </button>
                  {pwMsg && <div style={{ fontSize:12, color: pwMsg.includes("success") ? C.green : C.red, marginTop:10 }}>{pwMsg}</div>}
                </div>

                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:12 }}>Account Status</div>
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.muted }}>Email verified</span>
                    <span style={{ fontSize:12, color: user?.email_confirmed_at ? C.green : C.red, fontWeight:600 }}>
                      {user?.email_confirmed_at ? "Verified" : "Not verified"}
                    </span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0" }}>
                    <span style={{ fontSize:12, color:C.muted }}>Last sign in</span>
                    <span style={{ fontSize:12, color:C.text }}>
                      {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications */}
            {tab === "notifications" && (
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, marginBottom:20, color:C.text }}>Notifications</h2>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  {[
                    { key:"productUpdates" as const, label:"Product updates", desc:"New features and improvements" },
                    { key:"creditAlerts"   as const, label:"Credit alerts",    desc:"When your daily credits run low" },
                    { key:"marketingEmails"as const, label:"Marketing emails", desc:"Tips, offers, and promotions" },
                  ].map(n => (
                    <div key={n.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{n.label}</div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{n.desc}</div>
                      </div>
                      <button
                        onClick={() => setNotifPrefs(prev => ({ ...prev, [n.key]: !prev[n.key] }))}
                        style={{
                          width:40, height:22, borderRadius:11, border:"none", cursor:"pointer", position:"relative",
                          background: notifPrefs[n.key] ? C.grad : "rgba(255,255,255,0.12)", transition:"background .2s",
                        }}>
                        <div style={{
                          width:16, height:16, borderRadius:"50%", background:"#050816", position:"absolute", top:3,
                          left: notifPrefs[n.key] ? 21 : 3, transition:"left .2s",
                        }}/>
                      </button>
                    </div>
                  ))}
                  <button onClick={saveNotifPrefs} style={{ marginTop:20, padding:"10px 24px", background:notifSaved?"rgba(95,184,138,0.15)":C.grad, border:"none", borderRadius:9, color:notifSaved?C.green:"#050816", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                    {notifSaved ? "✓ Saved!" : "Save Preferences"}
                  </button>
                </div>
              </div>
            )}

            {/* Billing */}
            {tab === "billing" && (
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, marginBottom:20, color:C.text }}>Billing & Credits</h2>

                {/* Stats */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
                  {[
                    { label:"Credits Left", value:remaining, color:remaining>2?C.gold:C.red },
                    { label:"Total Credits", value:profile?.total_credits||5, color:C.text },
                    { label:"Used Today", value:profile?.used_credits||0, color:C.sub },
                  ].map(s=>(
                    <div key={s.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px", textAlign:"center" }}>
                      <div style={{ fontSize:28, fontWeight:800, color:s.color }}>{s.value}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Plan info */}
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24, marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, color:C.gold }}>{plan}</div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Current Plan</div>
                    </div>
                  </div>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:20, lineHeight:1.7 }}>
                    ⚡ Free plan: <strong style={{color:C.text}}>5 credits daily</strong>, resets at midnight.<br/>
                    Upgrade for unlimited credits and priority generation.
                  </div>
                  <button onClick={()=>router.push("/billing")} style={{ padding:"12px 28px", background:C.grad, border:"none", borderRadius:10, color:"#050816", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                    Upgrade to Pro →
                  </button>
                </div>
              </div>
            )}

            {/* API Keys */}
            {tab === "apikeys" && (
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, marginBottom:20, color:C.text }}>API Keys</h2>

                {freshRawKey && (
                  <div style={{ background:"rgba(95,184,138,0.08)", border:"1px solid rgba(95,184,138,0.3)", borderRadius:14, padding:20, marginBottom:16 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.green, marginBottom:8 }}>✓ Key created — copy it now, it won't be shown again</div>
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <code style={{ flex:1, background:"#000", border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", color:C.text, fontSize:12, fontFamily:"monospace", overflowX:"auto", whiteSpace:"nowrap" }}>{freshRawKey}</code>
                      <button onClick={()=>{navigator.clipboard.writeText(freshRawKey); }} style={{ padding:"8px 16px", background:C.grad, border:"none", borderRadius:8, color:"#050816", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>Copy</button>
                    </div>
                    <button onClick={()=>setFreshRawKey(null)} style={{ marginTop:10, background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer" }}>Dismiss</button>
                  </div>
                )}

                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24, marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>Create New Key</div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:12 }}>Only a hash of your key is stored — the raw key is shown once, at creation.</div>
                  <div style={{ display:"flex", gap:10 }}>
                    <input value={newKeyName} onChange={e=>setNewKeyName(e.target.value)} placeholder="e.g. Production deploy"
                      style={{ flex:1, background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:14 }}/>
                    <select value={newKeyExpiry} onChange={e=>setNewKeyExpiry(e.target.value)}
                      style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:13 }}>
                      <option value="never">Never expires</option>
                      <option value="30">Expires in 30 days</option>
                      <option value="90">Expires in 90 days</option>
                      <option value="365">Expires in 1 year</option>
                    </select>
                    <button onClick={createApiKey} disabled={creatingKey} style={{ padding:"10px 20px", background:C.grad, border:"none", borderRadius:9, color:"#050816", fontSize:13, fontWeight:700, cursor:creatingKey?"default":"pointer", opacity:creatingKey?0.6:1, whiteSpace:"nowrap" }}>
                      {creatingKey ? "Creating…" : "Generate Key"}
                    </button>
                  </div>
                  {keysError && <div style={{ fontSize:12, color:C.red, marginTop:8 }}>{keysError}</div>}
                </div>

                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:14 }}>Your Keys</div>
                  {apiKeys.length === 0 && <div style={{ fontSize:12, color:C.muted }}>No API keys yet.</div>}
                  {apiKeys.map(k => {
                    const expired = k.expires_at && new Date(k.expires_at).getTime() < Date.now();
                    return (
                    <div key={k.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{k.name}</div>
                        <div style={{ fontSize:11, color:C.muted, fontFamily:"monospace", marginTop:2 }}>{k.key_prefix}••••••••</div>
                        <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
                          Created {new Date(k.created_at).toLocaleDateString()}
                          {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                          {` · ${k.usage_count || 0} uses`}
                          {k.expires_at && ` · ${expired ? "Expired" : "Expires"} ${new Date(k.expires_at).toLocaleDateString()}`}
                        </div>
                      </div>
                      {k.status === "revoked" ? (
                        <span style={{ fontSize:11, color:C.muted, fontWeight:600 }}>Revoked</span>
                      ) : expired ? (
                        <span style={{ fontSize:11, color:C.red, fontWeight:600 }}>Expired</span>
                      ) : (
                        <button onClick={()=>revokeApiKey(k.id)} style={{ padding:"6px 14px", background:"rgba(229,115,107,0.1)", border:"1px solid rgba(229,115,107,0.25)", borderRadius:8, color:C.red, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                          Revoke
                        </button>
                      )}
                    </div>
                    );
                  })}
                </div>

                {/* GitHub */}
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24, marginTop:16 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:8 }}>🐙 GitHub</div>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Connect GitHub to push generated projects directly to your repos.</div>
                  <button onClick={()=>router.push("/settings/github")} style={{ padding:"10px 20px", background:"rgba(255,255,255,0.06)", border:`1px solid ${C.border}`, borderRadius:9, color:C.text, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                    Connect GitHub →
                  </button>
                </div>
              </div>
            )}

            {/* Appearance */}
            {tab === "theme" && (
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, marginBottom:20, color:C.text }}>Appearance</h2>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24, marginBottom:16 }}>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Mode</div>
                  {([
                    { id:"dark"   as ThemeMode, label:"Dark",   desc:"Always use dark mode" },
                    { id:"light"  as ThemeMode, label:"Light",  desc:"Always use light mode" },
                    { id:"system" as ThemeMode, label:"System", desc:"Match your device setting" },
                  ]).map(t=>(
                    <div key={t.id} onClick={()=>setMode(t.id)} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px", marginBottom:8, background: mode===t.id?"rgba(255,215,0,0.06)":"rgba(255,255,255,0.02)", border:`1px solid ${mode===t.id?"rgba(255,215,0,0.2)":C.border}`, borderRadius:10, cursor:"pointer" }}>
                      <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${mode===t.id?C.gold:C.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {mode===t.id && <div style={{ width:8, height:8, borderRadius:"50%", background:C.gold }}/>}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:mode===t.id?C.gold:C.text }}>{t.label}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{t.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24, marginBottom:16 }}>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Accent Color</div>
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                    {(Object.keys(ACCENT_COLORS) as AccentColor[]).map(a=>(
                      <button key={a} onClick={()=>setAccent(a)} title={a} style={{
                        width:36, height:36, borderRadius:"50%", cursor:"pointer",
                        background: ACCENT_COLORS[a].gradient,
                        border: accent===a ? "3px solid #fff" : "3px solid transparent",
                        boxShadow: accent===a ? "0 0 0 2px rgba(255,255,255,0.3)" : "none",
                      }}/>
                    ))}
                  </div>
                </div>

                <button onClick={saveTheme} disabled={themeSaving} style={{ padding:"10px 24px", background:themeSaved?"rgba(95,184,138,0.15)":C.grad, border:"none", borderRadius:9, color:themeSaved?C.green:"#050816", fontSize:14, fontWeight:700, cursor:themeSaving?"default":"pointer", opacity:themeSaving?0.6:1 }}>
                  {themeSaving ? "Saving…" : themeSaved ? "✓ Saved!" : "Save Appearance"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ height:"100vh", background:"#050816" }}/>}>
      <SettingsInner/>
    </Suspense>
  );
}
