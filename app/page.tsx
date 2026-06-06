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

const QUICK_ACTIONS = [
  { label: "Generate Website", icon: "🌐", prompt: "Build a professional business website", type: "Website" },
  { label: "Generate App", icon: "📱", prompt: "Build a web app with dashboard", type: "App" },
  { label: "Generate Game", icon: "🎮", prompt: "Build a browser game", type: "Game" },
  { label: "Generate Tool", icon: "🛠", prompt: "Build a productivity tool", type: "Tool" },
];

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [prompt, setPrompt] = useState("");
  const [buildType, setBuildType] = useState("Website");
  const [showBuildDropdown, setShowBuildDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [listening, setListening] = useState(false);
  const [credits, setCredits] = useState(5);
  const silenceTimer = useRef<any>(null);

  // Auth check
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
    const { data } = await supabase
      .from("projects")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    setRecentProjects(data || []);
  };

  // Typing animation
  useEffect(() => {
    const target = PLACEHOLDERS[placeholderIndex];
    let i = 0;
    setDisplayedPlaceholder("");
    setIsTyping(true);
    const type = setInterval(() => {
      if (i < target.length) {
        setDisplayedPlaceholder(target.slice(0, i + 1));
        i++;
      } else {
        clearInterval(type);
        setIsTyping(false);
        setTimeout(() => setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length), 2000);
      }
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

  const firstName = user?.user_metadata?.first_name || user?.email?.split("@")[0] || "there";

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      background: T.bg, color: T.text,
      fontFamily: "'DM Sans', sans-serif",
      overflow: "hidden", minHeight: "100vh",
      position: "relative",
    }}>

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
              <input
                autoFocus value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, templates..."
                style={{ flex: 1, background: "none", border: "none", color: T.text, fontSize: "15px", outline: "none", fontFamily: "'DM Sans', sans-serif" }}
              />
              <kbd style={{ background: "#1a1a1a", border: `1px solid ${T.border}`, borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: T.muted }}>ESC</kbd>
            </div>
            <div style={{ padding: "12px" }}>
              <p style={{ fontSize: "11px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 8px 8px" }}>Quick Actions</p>
              {QUICK_ACTIONS.map((a) => (
                <button key={a.label} onClick={() => { router.push(`/create?prompt=${encodeURIComponent(a.prompt)}&type=${a.type}`); setShowSearch(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", color: T.text, fontSize: "14px", cursor: "pointer", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOPBAR - Search + Projects + New */}
      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: "10px",
        flexShrink: 0, background: "rgba(8,8,8,0.8)",
        backdropFilter: "blur(10px)", position: "relative", zIndex: 10,
      }}>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={() => setShowSearch(true)} style={{
            padding: "6px 12px", background: "#0D0D0D",
            border: `1px solid ${T.border}`, borderRadius: "9px",
            color: T.muted, fontSize: "12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            🔍 Search
          </button>
          <button onClick={() => router.push("/dashboard")} style={{
            padding: "6px 12px", background: "#0D0D0D",
            border: `1px solid ${T.border}`, borderRadius: "9px",
            color: T.muted, fontSize: "12px", cursor: "pointer",
          }}>
            Projects
          </button>
          <button onClick={() => router.push("/create")} style={{
            padding: "6px 14px", background: G, border: "none",
            borderRadius: "9px", color: "#050505",
            fontSize: "12px", fontWeight: 700, cursor: "pointer",
          }}>
            + New
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{
        flex: 1, overflowY: "auto",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "1.5rem 1rem", position: "relative", zIndex: 1,
      }}>
        <div style={{ width: "100%", maxWidth: "700px" }}>

          {/* Welcome */}
          <div style={{ marginBottom: "2rem", textAlign: "center" }}>
            <h1 style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "clamp(22px, 5vw, 44px)",
              fontWeight: 800, textAlign: "center",
              marginBottom: "8px", lineHeight: 1.15,
            }}>
              Got an idea,{" "}
              <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {firstName}?
              </span>
            </h1>
            <p style={{ color: T.muted, fontSize: "14px", margin: 0 }}>
              Describe your idea and Krypton AI will build it instantly.
            </p>

            {/* Stats */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "16px", flexWrap: "wrap" }}>
              {[
                { label: "Credits", value: `${credits}/5` },
                { label: "Plan", value: "Free" },
                { label: "Projects", value: recentProjects.length },
              ].map((stat) => (
                <div key={stat.label} style={{
                  padding: "5px 14px", background: "#0D0D0D",
                  border: `1px solid ${T.border}`, borderRadius: "20px",
                  fontSize: "12px", color: T.muted,
                }}>
                  {stat.label}: <span style={{ color: T.gold, fontWeight: 700 }}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt Input */}
          <div style={{
            background: "#0D0D0D", border: `1px solid ${T.border}`,
            borderRadius: "16px", padding: "16px",
            boxShadow: "0 0 40px rgba(245,197,66,0.06)",
          }}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={displayedPlaceholder}
              rows={3}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              style={{
                width: "100%", background: "none", border: "none",
                color: T.text, fontSize: "15px", resize: "none",
                outline: "none", fontFamily: "'DM Sans', sans-serif",
                lineHeight: 1.6, boxSizing: "border-box",
              }}
            />

            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between", marginTop: "8px",
              paddingTop: "10px", borderTop: `1px solid ${T.border}`,
            }}>
              {/* Build type */}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowBuildDropdown(!showBuildDropdown)} style={{
                  padding: "6px 12px", background: "#1a1a1a",
                  border: `1px solid ${T.border}`, borderRadius: "8px",
                  color: T.text, fontSize: "12px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  {buildType} ▾
                </button>
                {showBuildDropdown && (
                  <div style={{
                    position: "absolute", bottom: "40px", left: 0,
                    background: "#0D0D0D", border: `1px solid ${T.border}`,
                    borderRadius: "10px", padding: "6px", zIndex: 50,
                    minWidth: "130px",
                  }}>
                    {["Website", "App", "Game", "Tool", "Dashboard"].map((type) => (
                      <button key={type} onClick={() => { setBuildType(type); setShowBuildDropdown(false); }}
                        style={{
                          width: "100%", textAlign: "left", padding: "8px 12px",
                          background: "none", border: "none", color: T.muted,
                          fontSize: "13px", cursor: "pointer", borderRadius: "7px",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = T.text; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.muted; }}>
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Voice + Send */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button onClick={handleVoice} style={{
                 width: "34px", height: "34px", borderRadius: "50%",
                 background: listening ? T.gold : "#2a2
                 border: "none", cursor: "pointer",
                 display: "flex", alignItems: "center", justifyContent: "center",
               }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                 <rect x="9" y="2" width="6" height="11" rx="3"
                  fill={listening ? "#080808" : "#9ca3af"}/>
                 <path d="M5 11a7 7 0 0014 0"
                  stroke={listening ? "#080808" : "#9ca3af"}
                  strokeWidth="2" strokeLinecap="round"/>
                 <line x1="12" y1="18" x2="12" y2="22"
                  stroke={listening ? "#080808" : "#9ca3af"}
                  strokeWidth="2" strokeLinecap="round"/>
                 <line x1="8" y1="22" x2="16" y2="22"
                  stroke={listening ? "#080808" : "#9ca3af"}
                  strokeWidth="2" strokeLinecap="round"/>
                </svg>
               </button>
                <button onClick={handleGenerate} disabled={!prompt.trim()} style={{
                  width: "34px", height: "34px", borderRadius: "50%",
                  background: prompt.trim() ? G : "#1a1a1a",
                  border: "none", cursor: prompt.trim() ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px",
                }}>
                  ↑
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ marginTop: "20px" }}>
            <p style={{ fontSize: "11px", color: "#333", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
              QUICK ACTIONS
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" }}>
              {QUICK_ACTIONS.map((action) => (
                <button key={action.label} onClick={() => router.push(`/create?prompt=${encodeURIComponent(action.prompt)}&type=${action.type}`)}
                  style={{
                    padding: "14px 16px", background: "#0D0D0D",
                    border: `1px solid ${T.border}`, borderRadius: "12px",
                    color: T.muted, fontSize: "13px", cursor: "pointer",
                    textAlign: "center", transition: "all 0.18s",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: "8px",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
                  <span style={{ fontSize: "22px" }}>{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Projects */}
          {recentProjects.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <p style={{ fontSize: "11px", color: "#333", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
                RECENT PROJECTS
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {recentProjects.slice(0, 3).map((p) => (
                  <button key={p.id} onClick={() => router.push(`/create?id=${p.id}`)}
                    style={{
                      padding: "12px 16px", background: "#0D0D0D",
                      border: `1px solid ${T.border}`, borderRadius: "10px",
                      color: T.muted, fontSize: "13px", cursor: "pointer",
                      textAlign: "left", display: "flex",
                      alignItems: "center", gap: "10px", transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = T.muted; }}>
                    <span>📄</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title || "Untitled"}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: "11px", color: "#333" }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
                
