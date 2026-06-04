"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5C542 0%, #00D084 100%)";
const T = {
  gold: "#F5C542", green: "#00D084", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", sub: "#B3B3B3", muted: "#6B7280",
};

const PLACEHOLDERS = [
  "Build a SaaS landing page...",
  "Build a crypto dashboard...",
  "Build a portfolio website...",
  "Build a browser game...",
  "Build a fitness app...",
  "Create a business website...",
  "Create a restaurant website...",
  "Generate a productivity tool...",
];

const NAV = [
  {
    section: null,
    items: [
      { icon: "🏠", label: "Home", path: "/" },
      { icon: "🔍", label: "Search", path: null, shortcut: "⌘K" },
    ]
  },
  {
    section: "WORKSPACE",
    items: [
      { icon: "📁", label: "Projects", path: "/dashboard" },
      { icon: "🎨", label: "Templates", path: "/templates" },
      { icon: "🤖", label: "AI Tools", path: null },
      { icon: "📊", label: "Analysis", path: "/analytics" },
    ]
  },
  {
    section: "DEPLOY",
    items: [
      { icon: "☁️", label: "Build & Deploy", path: "/settings?tab=cloudcode" },
      { icon: "💻", label: "Cloud Code", path: "/settings?tab=cloudcode" },
      { icon: "🔗", label: "Integrations", path: "/settings" },
    ]
  },
  {
    section: "TEAM",
    items: [
      { icon: "👥", label: "Team Workspace", path: "/settings" },
      { icon: "📚", label: "Knowledge", path: "/settings" },
    ]
  },
  {
    section: "ACCOUNT",
    items: [
      { icon: "⚙️", label: "Settings", path: "/settings" },
    ]
  },
];

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [prompt, setPrompt] = useState("");
  const [buildType, setBuildType] = useState("Website");
  const [showBuildDropdown, setShowBuildDropdown] = useState(false);
  const [showPlusDropdown, setShowPlusDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [credits, setCredits] = useState(5);
  const silenceTimer = useRef<any>(null);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/landing"); return; }
        setUser(user);
      } else {
        setUser(session.user);
      }
      fetchRecent();
    };
    getUser();
  }, []);

  const fetchRecent = async () => {
    const { data } = await supabase.from("projects").select("id, title, created_at").order("created_at", { ascending: false }).limit(5);
    setRecentProjects(data || []);
  };

  useEffect(() => {
    const target = PLACEHOLDERS[placeholderIndex];
    let i = 0;
    setDisplayedPlaceholder("");
    setIsTyping(true);
    const type = setInterval(() => {
      if (i < target.length) { setDisplayedPlaceholder(target.slice(0, i + 1)); i++; }
      else { clearInterval(type); setIsTyping(false); setTimeout(() => setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length), 2000); }
    }, 45);
    return () => clearInterval(type);
  }, [placeholderIndex]);

  // Ctrl+K search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowSearch(true); }
      if (e.key === "Escape") setShowSearch(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    router.push(`/create?prompt=${encodeURIComponent(prompt)}&type=${buildType}`);
  };

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported"); return; }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setPrompt(transcript);
      clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => recognition.stop(), 5000);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const firstName = user?.user_metadata?.first_name || user?.email?.split("@")[0] || "there";

  const QUICK_ACTIONS = [
    { label: "Generate Website", icon: "🌐", prompt: "Build a professional business website", type: "Website" },
    { label: "Generate App", icon: "📱", prompt: "Build a web app with dashboard", type: "App" },
    { label: "Generate Game", icon: "🎮", prompt: "Build a browser game", type: "Game" },
    { label: "Generate Tool", icon: "🛠", prompt: "Build a productivity tool", type: "Tool" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", position: "relative" }}>

      {/* Animated background */}
      <style>{`
        @keyframes gradMove { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(3%,-3%) scale(1.05); } }
        @keyframes gradMove2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-3%,3%) scale(1.08); } }
      `}</style>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "55vw", height: "55vw", borderRadius: "50%", filter: "blur(90px)", background: "radial-gradient(circle, rgba(245,197,66,0.35) 0%, rgba(245,197,66,0.12) 35%, transparent 70%)", animation: "gradMove 18s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "50vw", height: "50vw", borderRadius: "50%", filter: "blur(90px)", background: "radial-gradient(circle, rgba(0,208,132,0.28) 0%, rgba(0,208,132,0.10) 35%, transparent 70%)", animation: "gradMove2 22s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(245,197,66,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,66,0.018) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div onClick={() => setShowSearch(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "120px", backdropFilter: "blur(4px)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: "16px", width: "100%", maxWidth: "560px", margin: "0 20px", boxShadow: "0 0 60px rgba(245,197,66,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: "16px" }}>🔍</span>
              <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search projects, templates..." style={{ flex: 1, background: "none", border: "none", color: T.text, fontSize: "15px", outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
              <kbd style={{ background: "#1a1a1a", border: `1px solid ${T.border}`, borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: T.muted }}>ESC</kbd>
            </div>
            <div style={{ padding: "12px" }}>
              <p style={{ fontSize: "11px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 8px 8px" }}>Quick Actions</p>
              {QUICK_ACTIONS.map((a) => (
                <button key={a.label} onClick={() => { router.push(`/create?prompt=${encodeURIComponent(a.prompt)}&type=${a.type}`); setShowSearch(false); }} style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", color: T.text, fontSize: "14px", cursor: "pointer", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }} />
      )}

      {/* SIDEBAR */}
      <div style={{ width: "240px", height: "100vh", background: "#080808", borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden", transition: "transform 0.25s ease", flexShrink: 0, position: isMobile ? "fixed" : "relative", left: 0, top: 0, zIndex: 50, transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)" }}>

        {/* Logo */}
        <div style={{ padding: "14px 12px", borderBottom: `1px solid ${T.border}`, position: "relative" }}>
          <button onClick={() => setShowUserDropdown(!showUserDropdown)} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", width: "100%", padding: "4px 6px", borderRadius: "10px" }}>
            <img src="/logo.png" alt="Krypton AI" style={{ height: "32px", width: "auto", objectFit: "contain", flexShrink: 0 }} />
            <span style={{ color: "#555", fontSize: "11px" }}>&#9660;</span>
          </button>

          {showUserDropdown && (
            <div style={{ position: "absolute", top: "60px", left: "12px", right: "12px", background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: "14px", padding: "8px", zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
              {[
                { icon: "👤", label: "Profile", tab: "profile" },
                { icon: "💳", label: "Billing", tab: "billing" },
                { icon: "🔑", label: "API Keys", tab: "apikeys" },
                { icon: "☁️", label: "Cloud Code", tab: "cloudcode" },
                { icon: "🔔", label: "Notifications", tab: "notifications" },
                { icon: "🎨", label: "Theme", tab: "theme" },
              ].map((item) => (
                <button key={item.label} onClick={() => { router.push(`/settings?tab=${item.tab}`); setShowUserDropdown(false); }} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: T.muted, fontSize: "13px", cursor: "pointer", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = T.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.muted; }}>
                  {item.icon} {item.label}
                </button>
              ))}
              <div style={{ height: "1px", background: T.border, margin: "6px 0" }} />
              <button onClick={handleLogout} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: "#ef4444", fontSize: "13px", cursor: "pointer", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                🚪 Logout
              </button>
            </div>
          )}
        </div>

        {/* Search button */}
        <button onClick={() => setShowSearch(true)} style={{ margin: "10px 10px 4px", padding: "9px 12px", background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.muted, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>🔍 Search</span>
          <kbd style={{ background: "#1a1a1a", border: `1px solid ${T.border}`, borderRadius: "4px", padding: "2px 6px", fontSize: "10px" }}>⌘K</kbd>
        </button>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
          {NAV.map((group, gi) => (
            <div key={gi} style={{ marginBottom: "4px" }}>
              {group.section && (
                <p style={{ fontSize: "9px", color: "#333", textTransform: "uppercase", letterSpacing: "0.12em", padding: "10px 12px 4px", fontWeight: 700 }}>{group.section}</p>
              )}
              {group.items.map((item) => (
                <button key={item.label} onClick={() => { if (item.path) { router.push(item.path); if (isMobile) setSidebarOpen(false); } else if (item.label === "Search") setShowSearch(true); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "8px 12px", borderRadius: "9px", background: item.path === "/" ? "rgba(245,197,66,0.08)" : "none", border: item.path === "/" ? `1px solid ${T.border}` : "1px solid transparent", color: item.path === "/" ? T.gold : T.muted, fontSize: "13px", cursor: "pointer", textAlign: "left", width: "100%", fontWeight: item.path === "/" ? 600 : 400, transition: "all 0.15s", marginBottom: "2px" }}
                  onMouseEnter={(e) => { if (item.path !== "/") { e.currentTarget.style.background = "#0D0D0D"; e.currentTarget.style.color = T.text; } }}
                  onMouseLeave={(e) => { if (item.path !== "/") { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.muted; } }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>{item.icon} {item.label}</span>
                  {(item as any).shortcut && <kbd style={{ background: "#1a1a1a", border: `1px solid ${T.border}`, borderRadius: "4px", padding: "1px 5px", fontSize: "10px", color: "#555" }}>{(item as any).shortcut}</kbd>}
                </button>
              ))}
            </div>
          ))}

          {/* Recent Projects */}
          {recentProjects.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontSize: "9px", color: "#333", textTransform: "uppercase", letterSpacing: "0.12em", padding: "10px 12px 4px", fontWeight: 700 }}>RECENT</p>
              {recentProjects.map((p) => (
                <button key={p.id} onClick={() => router.push(`/create?id=${p.id}`)} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", color: T.muted, fontSize: "12px", cursor: "pointer", borderRadius: "8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: "6px" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#0D0D0D"; e.currentTarget.style.color = T.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.muted; }}>
                  <span style={{ fontSize: "10px" }}>📄</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.title || "Untitled"}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User card */}
        <div style={{ padding: "10px 12px", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#050505", flexShrink: 0 }}>
            {firstName[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: T.text, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{firstName}</p>
            <p style={{ fontSize: "10px", color: T.muted, margin: 0 }}>Free · {credits} credits left</p>
          </div>
          <button onClick={() => router.push("/settings?tab=billing")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: T.muted }}>⚡</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, position: "relative", zIndex: 1 }}>

        {/* Topbar */}
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, background: "rgba(8,8,8,0.8)", backdropFilter: "blur(10px)" }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: "18px", padding: "4px", flexShrink: 0 }}>
            ☰
          </button>
          {isMobile && <img src="/logo.png" alt="Krypton AI" style={{ height: "26px", width: "auto", objectFit: "contain" }} />}
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
            <button onClick={() => setShowSearch(true)} style={{ padding: "6px 12px", background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: "9px", color: T.muted, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              🔍 <span style={{ display: isMobile ? "none" : "inline" }}>Search</span>
            </button>
            <button onClick={() => router.push("/dashboard")} style={{ padding: "6px 12px", background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: "9px", color: T.muted, fontSize: "12px", cursor: "pointer" }}>
              Projects
            </button>
            <button onClick={() => router.push("/create")} style={{ padding: "6px 14px", background: G, border: "none", borderRadius: "9px", color: "#050505", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
              + New
            </button>
          </div>
        </div>

        {/* Hero */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem 1rem" }}>
          <div style={{ width: "100%", maxWidth: "700px" }}>

            {/* Welcome */}
            <div style={{ marginBottom: "2rem", textAlign: "center" }}>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(22px, 5vw, 44px)", fontWeight: 800, textAlign: "center", marginBottom: "8px", lineHeight: 1.15 }}>
                Got an idea,{" "}
                <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                 {firstName}?
                </span>
              </h1>
              <p style={{ textAlign: "center", color: T.muted, fontSize: "14px" }}>
                Describe your idea and Krypton AI will build it instantly.
              </p>
            </div>

            {/* Stats bar */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "1.5rem", justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { label: "Credits", value: `${credits}/5`, color: T.gold },
                { label: "Plan", value: "Free", color: T.green },
                { label: "Projects", value: recentProjects.length.toString(), color: T.gold },
              ].map((stat) => (
                <div key={stat.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: T.muted }}>{stat.label}:</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: stat.color }}>{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Prompt Box */}
            <div style={{ background: T.card, border: `1px solid rgba(245,197,66,0.2)`, borderRadius: "18px", padding: "14px", marginBottom: "1rem", boxShadow: "0 0 40px rgba(245,197,66,0.05)" }}>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={displayedPlaceholder + (isTyping ? "|" : "")} rows={4}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                style={{ width: "100%", background: "none", border: "none", color: T.text, fontSize: "15px", resize: "none", outline: "none", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px", borderTop: `1px solid ${T.border}`, paddingTop: "10px" }}>
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowPlusDropdown(!showPlusDropdown)} style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#1a1a1a", border: `1px solid ${T.border}`, color: T.muted, fontSize: "22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  {showPlusDropdown && (
                    <div style={{ position: "absolute", bottom: "44px", left: 0, background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: "12px", padding: "6px", zIndex: 100, minWidth: "160px" }}>
                      {["Upload Image", "Upload Screenshot", "Upload File"].map((item) => (
                        <button key={item} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: T.muted, fontSize: "13px", cursor: "pointer", borderRadius: "8px" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = T.text; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.muted; }}>
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setShowBuildDropdown(!showBuildDropdown)} style={{ padding: "7px 12px", background: "#1a1a1a", border: `1px solid ${T.border}`, borderRadius: "9px", color: T.muted, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                      {buildType} <span style={{ fontSize: "9px" }}>▼</span>
                    </button>
                    {showBuildDropdown && (
                      <div style={{ position: "absolute", bottom: "44px", right: 0, background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: "12px", padding: "6px", zIndex: 100, minWidth: "120px" }}>
                        {["Website", "App", "Game", "Tool", "Dashboard", "Landing Page"].map((type) => (
                          <button key={type} onClick={() => { setBuildType(type); setShowBuildDropdown(false); }} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: type === buildType ? "#1a1a1a" : "none", border: "none", color: type === buildType ? T.gold : T.muted, fontSize: "13px", cursor: "pointer", borderRadius: "8px" }}>
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={handleVoice} style={{ width: "36px", height: "36px", borderRadius: "50%", background: listening ? G : "#1a1a1a", border: `1px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="2" width="6" height="11" rx="3" fill={listening ? "#050505" : T.muted} />
                      <path d="M5 11a7 7 0 0 0 14 0" stroke={listening ? "#050505" : T.muted} strokeWidth="2" strokeLinecap="round" />
                      <line x1="12" y1="18" x2="12" y2="22" stroke={listening ? "#050505" : T.muted} strokeWidth="2" strokeLinecap="round" />
                      <line x1="8" y1="22" x2="16" y2="22" stroke={listening ? "#050505" : T.muted} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>

                  <button onClick={handleGenerate} disabled={!prompt.trim()} style={{ width: "36px", height: "36px", borderRadius: "50%", background: prompt.trim() ? G : "#1a1a1a", border: "none", cursor: prompt.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 19V5M5 12l7-7 7 7" stroke={prompt.trim() ? "#050505" : "#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <p style={{ textAlign: "center", color: "#2a2a2a", fontSize: "11px", marginBottom: "1.5rem" }}>
              Ctrl+Enter to generate · Krypton AI may make mistakes
            </p>

            {/* Quick Actions */}
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "11px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px", fontWeight: 600 }}>Quick Actions</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "8px" }}>
                {QUICK_ACTIONS.map((action) => (
                  <button key={action.label} onClick={() => { setPrompt(action.prompt); setBuildType(action.type); }} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "12px", textAlign: "left", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.background = "#141414"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card; }}>
                    <div style={{ fontSize: "18px", marginBottom: "6px" }}>{action.icon}</div>
                    <p style={{ color: T.text, fontWeight: 600, fontSize: "12px", margin: 0 }}>{action.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Projects */}
            {recentProjects.length > 0 && (
              <div>
                <p style={{ fontSize: "11px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px", fontWeight: 600 }}>Recent Projects</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
                  {recentProjects.map((p) => (
                    <button key={p.id} onClick={() => router.push(`/create?id=${p.id}`)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "14px", textAlign: "left", cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; }}>
                      <p style={{ fontSize: "16px", marginBottom: "4px" }}>📄</p>
                      <p style={{ color: T.text, fontWeight: 600, fontSize: "12px", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title || "Untitled"}</p>
                      <p style={{ color: T.muted, fontSize: "10px", margin: 0 }}>{new Date(p.created_at).toLocaleDateString()}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
  
