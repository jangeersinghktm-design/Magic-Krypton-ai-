"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Real pages that exist in the project
const REAL_PAGES = ["/", "/create", "/dashboard", "/settings", "/billing",
  "/analytics", "/templates", "/chatbot", "/image-gen", "/content", "/landing",
  "/about", "/blog", "/support", "/team"];

type Tab = "profile" | "billing" | "apikeys" | "theme";

const C = {
  bg: "#080808", surface: "#0C0C0C", card: "#111111",
  border: "rgba(255,255,255,0.07)", gold: "#FFD700",
  text: "#F0F0F0", muted: "#555", sub: "#888",
  green: "#00D084", red: "#EF4444", grad: "linear-gradient(135deg,#FFD700,#FF7A00)",
};

function SettingsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [tab, setTab]     = useState<Tab>((params.get("tab") as Tab) || "profile");
  const [user, setUser]   = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [vercelToken, setVercelToken] = useState("");
  const [netlifyToken, setNetlifyToken] = useState("");
  const [tokenSaved, setTokenSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth/login"); return; }
      setUser(session.user);
      setEmail(session.user.email || "");
      setName(session.user.user_metadata?.full_name || "");
      const { data: p } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(p);
      setLoading(false);
    })();
  }, []);

  const saveProfile = async () => {
    if (!user) return;
    await supabase.auth.updateUser({ data: { full_name: name } });
    await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/landing");
  };

  const remaining = (profile?.total_credits || 5) - (profile?.used_credits || 0);
  const plan = (profile?.plan || "free").toUpperCase();

  const TABS = [
    { id: "profile" as Tab, icon: "👤", label: "Profile" },
    { id: "billing" as Tab, icon: "💳", label: "Billing" },
    { id: "apikeys" as Tab, icon: "🔑", label: "Integrations" },
    { id: "theme"   as Tab, icon: "🎨", label: "Appearance" },
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
        html,body{background:#080808;color:#F0F0F0;font-family:'DM Sans',system-ui,sans-serif;}
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus{border-color:rgba(255,215,0,0.4)!important;outline:none;}
        .tab-btn:hover{background:rgba(255,255,255,0.05)!important;}
        .nav-item:hover{background:#1a1a1a!important;color:#fff!important;}
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
              border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.06)",
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
                    <button onClick={saveProfile} style={{ padding:"10px 24px", background:saved?"rgba(0,208,132,0.15)":C.grad, border:"none", borderRadius:9, color:saved?C.green:"#080808", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                      {saved ? "✓ Saved!" : "Save Changes"}
                    </button>
                    <span style={{ fontSize:12, color:C.muted }}>{plan} Plan</span>
                  </div>
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
                  <button onClick={()=>router.push("/billing")} style={{ padding:"12px 28px", background:C.grad, border:"none", borderRadius:10, color:"#080808", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                    Upgrade to Pro →
                  </button>
                </div>
              </div>
            )}

            {/* API Keys */}
            {tab === "apikeys" && (
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, marginBottom:20, color:C.text }}>Integrations</h2>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>Vercel Token</div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Required for one-click Vercel deploy from the Deploy panel</div>
                    <input value={vercelToken} onChange={e=>setVercelToken(e.target.value)}
                      type="password" placeholder="vercel_xxxxxxx..."
                      style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:13, fontFamily:"monospace" }}/>
                  </div>
                  <div style={{ marginBottom:24 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>Netlify Token</div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Required for one-click Netlify deploy</div>
                    <input value={netlifyToken} onChange={e=>setNetlifyToken(e.target.value)}
                      type="password" placeholder="nfp_xxxxxxx..."
                      style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px", color:C.text, fontSize:13, fontFamily:"monospace" }}/>
                  </div>
                  <button onClick={()=>{setTokenSaved(true);setTimeout(()=>setTokenSaved(false),2000);}} style={{ padding:"10px 24px", background:tokenSaved?"rgba(0,208,132,0.15)":C.grad, border:"none", borderRadius:9, color:tokenSaved?C.green:"#080808", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                    {tokenSaved ? "✓ Saved" : "Save Tokens"}
                  </button>
                  <div style={{ marginTop:16, fontSize:12, color:C.muted, padding:"10px 14px", background:"rgba(255,215,0,0.04)", borderRadius:8, border:"1px solid rgba(255,215,0,0.1)" }}>
                    ⚠️ For production: add these as environment variables in your Vercel project settings.
                  </div>
                </div>

                {/* GitHub */}
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24, marginTop:16 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:8 }}>🐙 GitHub</div>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Connect GitHub to push generated projects directly to your repos.</div>
                  <button style={{ padding:"10px 20px", background:"rgba(255,255,255,0.06)", border:`1px solid ${C.border}`, borderRadius:9, color:C.text, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                    Connect GitHub →
                  </button>
                </div>
              </div>
            )}

            {/* Appearance */}
            {tab === "theme" && (
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, marginBottom:20, color:C.text }}>Appearance</h2>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Theme</div>
                  {[
                    { id:"dark",  label:"Dark",       desc:"#080808 background", active:true },
                    { id:"navy",  label:"Navy Blue",   desc:"#07091A background", active:false },
                    { id:"black", label:"Pure Black",  desc:"#000000 background", active:false },
                  ].map(t=>(
                    <div key={t.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px", marginBottom:8, background: t.active?"rgba(255,215,0,0.06)":"rgba(255,255,255,0.02)", border:`1px solid ${t.active?"rgba(255,215,0,0.2)":C.border}`, borderRadius:10, cursor:"pointer" }}>
                      <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${t.active?C.gold:C.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {t.active && <div style={{ width:8, height:8, borderRadius:"50%", background:C.gold }}/>}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:t.active?C.gold:C.text }}>{t.label}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{t.desc}</div>
                      </div>
                    </div>
                  ))}
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
