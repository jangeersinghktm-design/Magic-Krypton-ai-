"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

type Tab = "profile" | "billing" | "apikeys" | "theme" | "github";

function SettingsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [tab, setTab]       = useState<Tab>((params.get("tab") as Tab) || "profile");
  const [user, setUser]     = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved]   = useState(false);
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");

  const C = {
    bg:"#080808", surface:"#0C0C0C", card:"#111",
    border:"rgba(255,255,255,0.07)", gold:"#FFD700",
    text:"#F0F0F0", muted:"#555", sub:"#888",
    green:"#00D084", red:"#EF4444",
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth/login"); return; }
      setUser(session.user);
      setEmail(session.user.email || "");
      setName(session.user.user_metadata?.full_name || "");
      const { data: p } = await supabase.from("profiles")
        .select("*").eq("id", session.user.id).single();
      setProfile(p);
      setLoading(false);
    };
    init();
  }, []);

  const handleSave = async () => {
    if (!user) return;
    await supabase.auth.updateUser({ data: { full_name: name } });
    await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id:"profile",  label:"Profile",     icon:"👤" },
    { id:"billing",  label:"Billing",     icon:"💳" },
    { id:"apikeys",  label:"API Keys",    icon:"🔑" },
    { id:"theme",    label:"Appearance",  icon:"🎨" },
    { id:"github",   label:"GitHub",      icon:"🐙" },
  ];

  const remaining = (profile?.total_credits || 5) - (profile?.used_credits || 0);

  if (loading) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg }}>
      <div style={{ width:28, height:28, borderRadius:"50%", border:`3px solid rgba(255,215,0,0.15)`, borderTopColor:C.gold, animation:"spin .8s linear infinite" }}/>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:#080808;color:#F0F0F0;font-family:'DM Sans',system-ui,sans-serif;}
      `}</style>
      <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',system-ui,sans-serif" }}>
        {/* Header */}
        <div style={{ borderBottom:`1px solid ${C.border}`, background:C.surface, padding:"14px 24px", display:"flex", alignItems:"center", gap:16 }}>
          <button onClick={()=>router.push("/")} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:20, padding:0 }}>←</button>
          <div style={{ fontSize:16, fontWeight:700, color:C.text }}>Settings</div>
          <div style={{ marginLeft:"auto", fontSize:12, color:C.muted }}>{email}</div>
        </div>

        <div style={{ display:"flex", maxWidth:900, margin:"0 auto", padding:"24px 16px", gap:24 }}>
          {/* Sidebar */}
          <div style={{ width:180, flexShrink:0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                width:"100%", textAlign:"left", padding:"10px 14px",
                marginBottom:4, borderRadius:10, border:"none",
                background: tab===t.id ? "rgba(255,215,0,0.08)" : "transparent",
                color: tab===t.id ? C.gold : C.sub,
                fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:9,
                fontWeight: tab===t.id ? 600 : 400,
                transition:"all .15s",
              }}>
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
            <div style={{ marginTop:16, padding:"0 4px" }}>
              <button onClick={handleLogout} style={{ width:"100%", padding:"9px 14px", borderRadius:10, border:`1px solid rgba(239,68,68,0.2)`, background:"rgba(239,68,68,0.06)", color:C.red, fontSize:13, cursor:"pointer", textAlign:"left" }}>
                🚪 Sign Out
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex:1 }}>
            {tab === "profile" && (
              <div>
                <div style={{ fontSize:18, fontWeight:700, marginBottom:20 }}>Profile</div>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  <div style={{ marginBottom:16 }}>
                    <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}>Full Name</label>
                    <input value={name} onChange={e=>setName(e.target.value)}
                      style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:14, outline:"none" }}/>
                  </div>
                  <div style={{ marginBottom:20 }}>
                    <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}>Email</label>
                    <input value={email} disabled
                      style={{ width:"100%", background:"rgba(255,255,255,0.02)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.muted, fontSize:14, outline:"none" }}/>
                  </div>
                  <button onClick={handleSave} style={{ padding:"10px 24px", background:saved?"rgba(0,208,132,0.15)":"linear-gradient(135deg,#FFD700,#FF7A00)", border:"none", borderRadius:9, color:saved?C.green:"#080808", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                    {saved ? "✓ Saved" : "Save Changes"}
                  </button>
                </div>
              </div>
            )}

            {tab === "billing" && (
              <div>
                <div style={{ fontSize:18, fontWeight:700, marginBottom:20 }}>Billing & Credits</div>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24, marginBottom:16 }}>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:6 }}>Current Plan</div>
                  <div style={{ fontSize:20, fontWeight:800, color:C.gold, marginBottom:16 }}>
                    {(profile?.plan || "free").toUpperCase()}
                  </div>
                  <div style={{ display:"flex", gap:16, marginBottom:20 }}>
                    <div style={{ textAlign:"center", padding:"14px 20px", background:"rgba(255,255,255,0.03)", borderRadius:10, flex:1 }}>
                      <div style={{ fontSize:24, fontWeight:800, color:C.gold }}>{remaining}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Credits Left</div>
                    </div>
                    <div style={{ textAlign:"center", padding:"14px 20px", background:"rgba(255,255,255,0.03)", borderRadius:10, flex:1 }}>
                      <div style={{ fontSize:24, fontWeight:800, color:C.text }}>{profile?.total_credits || 5}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Total Credits</div>
                    </div>
                    <div style={{ textAlign:"center", padding:"14px 20px", background:"rgba(255,255,255,0.03)", borderRadius:10, flex:1 }}>
                      <div style={{ fontSize:24, fontWeight:800, color:C.sub }}>{profile?.used_credits || 0}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Used Today</div>
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>
                    ⚡ Free plan: 5 credits daily, resets at midnight
                  </div>
                  <button style={{ padding:"12px 28px", background:"linear-gradient(135deg,#FFD700,#FF7A00)", border:"none", borderRadius:10, color:"#080808", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                    Upgrade to Pro →
                  </button>
                </div>
              </div>
            )}

            {tab === "apikeys" && (
              <div>
                <div style={{ fontSize:18, fontWeight:700, marginBottom:20 }}>API Keys & Integrations</div>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  {[
                    { key:"VERCEL_TOKEN", label:"Vercel Token", desc:"Required for one-click Vercel deploy" },
                    { key:"NETLIFY_TOKEN", label:"Netlify Token", desc:"Required for one-click Netlify deploy" },
                  ].map(item => (
                    <div key={item.key} style={{ marginBottom:20 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>{item.label}</div>
                      <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>{item.desc}</div>
                      <input placeholder={`Enter your ${item.label}...`}
                        style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:13, outline:"none", fontFamily:"monospace" }}/>
                    </div>
                  ))}
                  <div style={{ fontSize:12, color:C.muted, padding:"10px 14px", background:"rgba(255,215,0,0.04)", borderRadius:8, border:`1px solid rgba(255,215,0,0.1)` }}>
                    ⚠️ API keys are stored securely and never shared. Add them to your Vercel environment variables for production use.
                  </div>
                </div>
              </div>
            )}

            {tab === "theme" && (
              <div>
                <div style={{ fontSize:18, fontWeight:700, marginBottom:20 }}>Appearance</div>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Theme</div>
                  {["Dark (Default)", "Navy Blue", "Midnight"].map((t, i) => (
                    <button key={t} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 16px", marginBottom:8, background: i===0?"rgba(255,215,0,0.07)":"rgba(255,255,255,0.02)", border:`1px solid ${i===0?"rgba(255,215,0,0.2)":C.border}`, borderRadius:10, cursor:"pointer", color: i===0?C.gold:C.muted, fontSize:13, textAlign:"left" }}>
                      <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${i===0?C.gold:C.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {i===0 && <div style={{ width:8, height:8, borderRadius:"50%", background:C.gold }}/>}
                      </div>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === "github" && (
              <div>
                <div style={{ fontSize:18, fontWeight:700, marginBottom:20 }}>GitHub Integration</div>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Connect your GitHub account to push projects directly from Krypton AI.</div>
                  <button style={{ padding:"12px 24px", background:"rgba(255,255,255,0.06)", border:`1px solid ${C.border}`, borderRadius:10, color:C.text, fontSize:14, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
                    🐙 Connect GitHub Account
                  </button>
                </div>
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
    <Suspense fallback={<div style={{ height:"100vh", background:"#080808" }}/>}>
      <SettingsInner/>
    </Suspense>
  );
}
