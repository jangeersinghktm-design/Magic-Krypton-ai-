"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

const NAV_ITEMS = [
  { icon: "⊞", label: "Home", path: "/" },
  { icon: "◫", label: "Projects", path: "/dashboard" },
  { icon: "⊟", label: "Templates", path: "/templates" },
  { icon: "▦", label: "Analytics", path: "/analytics" },
  { icon: "⚙", label: "Settings", path: "/settings" },
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
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [listening, setListening] = useState(false);
  const silenceTimer = useRef<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setUser(user);
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
        setTimeout(() => {
          setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        }, 2000);
      }
    }, 45);
    return () => clearInterval(type);
  }, [placeholderIndex]);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    const encoded = encodeURIComponent(prompt);
    router.push(`/create?prompt=${encoded}&type=${buildType}`);
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

  return (
    <div style={{ display: "flex", height: "100vh", background: "#080808", color: "#fff", fontFamily: "'DM Sans', sans-serif", overflow: "hidden" }}>

      {/* SIDEBAR */}
      <div style={{ width: sidebarOpen ? "240px" : "0px", minWidth: sidebarOpen ? "240px" : "0px", height: "100vh", background: "#0C0C0C", borderRight: "1px solid #1c1c1c", display: "flex", flexDirection: "column", overflow: "hidden", transition: "all 0.25s ease", flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #1c1c1c", position: "relative" }}>
          <button onClick={() => setShowUserDropdown(!showUserDropdown)} style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer", width: "100%", padding: "6px 8px", borderRadius: "10px" }}>
            <div style={{ width: "28px", height: "28px", background: "#FFC107", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L3 7v6l7 5 7-5V7L10 2z" fill="#080808" />
                <path d="M10 6l-4 3v2l4 3 4-3V9L10 6z" fill="#FFC107" opacity="0.8" />
              </svg>
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "14px", color: "#fff", flex: 1, textAlign: "left" }}>
              Krypton <span style={{ color: "#FFC107" }}>AI</span>
            </span>
            <span style={{ color: "#555", fontSize: "12px" }}>▾</span>
          </button>

          {showUserDropdown && (
            <div style={{ position: "absolute", top: "64px", left: "12px", right: "12px", background: "#141414", border: "1px solid #1c1c1c", borderRadius: "12px", padding: "6px", zIndex: 100 }}>
              {["Profile", "Billing", "API Keys", "Notifications", "Theme"].map((item) => (
                <button key={item} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: "#9ca3af", fontSize: "13px", cursor: "pointer", borderRadius: "8px" }}>
                  {item}
                </button>
              ))}
              <div style={{ height: "1px", background: "#1c1c1c", margin: "4px 0" }} />
              <button onClick={handleLogout} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: "#ff4d4d", fontSize: "13px", cursor: "pointer", borderRadius: "8px" }}>
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <div style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {NAV_ITEMS.map((item) => (
            <button key={item.label} onClick={() => router.push(item.path)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "9px", background: item.path === "/" ? "#161616" : "none", border: "none", color: item.path === "/" ? "#fff" : "#9ca3af", fontSize: "13px", cursor: "pointer", textAlign: "left", width: "100%", fontWeight: item.path === "/" ? 600 : 400 }}>
              <span style={{ fontSize: "15px" }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Recent Projects */}
        <div style={{ padding: "0 10px", flex: 1, overflowY: "auto" }}>
          <p style={{ fontSize: "10px", color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 12px 6px" }}>Recent</p>
          {recentProjects.map((p) => (
            <button key={p.id} onClick={() => router.push("/dashboard")} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", color: "#9ca3af", fontSize: "12px", cursor: "pointer", borderRadius: "8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {p.title}
            </button>
          ))}
        </div>

        {/* User Card */}
        <div style={{ padding: "12px", borderTop: "1px solid #1c1c1c", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #FFC107, #ff6b00)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#080808", flexShrink: 0 }}>
            {firstName[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#fff", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{firstName}</p>
            <p style={{ fontSize: "10px", color: "#555", margin: 0 }}>Free Plan</p>
          </div>
        </div>
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Topbar */}
        <div style={{ padding: "14px 24px", borderBottom: "1px solid #1c1c1c", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "18px", padding: "4px" }}>
            ☰
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            <button onClick={() => router.push("/dashboard")} style={{ padding: "7px 16px", background: "#101010", border: "1px solid #1c1c1c", borderRadius: "9px", color: "#9ca3af", fontSize: "13px", cursor: "pointer" }}>
              My Projects
            </button>
            <button onClick={() => router.push("/create")} style={{ padding: "7px 16px", background: "#FFC107", border: "none", borderRadius: "9px", color: "#080808", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
              + New
            </button>
          </div>
        </div>

        {/* Hero */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
          <div style={{ width: "100%", maxWidth: "720px" }}>

            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: "12px", lineHeight: 1.15 }}>
              Got an idea, <span style={{ color: "#FFC107" }}>{firstName}?</span>
            </h1>
            <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "16px", marginBottom: "2rem", lineHeight: 1.6 }}>
              Describe your idea and Krypton AI will build it instantly.
            </p>

            {/* Prompt Box */}
            <div style={{ background: "#101010", border: "1px solid #1c1c1c", borderRadius: "18px", padding: "16px" }}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={displayedPlaceholder + (isTyping ? "|" : "")}
                rows={4}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                style={{ width: "100%", background: "none", border: "none", color: "#fff", fontSize: "15px", resize: "none", outline: "none", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
              />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px", borderTop: "1px solid #1c1c1c", paddingTop: "12px" }}>

                {/* Plus button */}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowPlusDropdown(!showPlusDropdown)} style={{ width: "34px", height: "34px", borderRadius: "9px", background: "#161616", border: "1px solid #1c1c1c", color: "#9ca3af", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    +
                  </button>
                  {showPlusDropdown && (
                    <div style={{ position: "absolute", bottom: "44px", left: 0, background: "#141414", border: "1px solid #1c1c1c", borderRadius: "12px", padding: "6px", zIndex: 100, minWidth: "160px" }}>
                      {["Upload Image", "Upload Screenshot", "Upload File"].map((item) => (
                        <button key={item} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: "#9ca3af", fontSize: "13px", cursor: "pointer", borderRadius: "8px" }}>
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setShowBuildDropdown(!showBuildDropdown)} style={{ padding: "8px 14px", background: "#161616", border: "1px solid #1c1c1c", borderRadius: "9px", color: "#9ca3af", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                      {buildType} <span style={{ fontSize: "10px" }}>▾</span>
                    </button>
                    {showBuildDropdown && (
                      <div style={{ position: "absolute", bottom: "44px", right: 0, background: "#141414", border: "1px solid #1c1c1c", borderRadius: "12px", padding: "6px", zIndex: 100, minWidth: "120px" }}>
                        {["Website", "App", "Game", "Tool"].map((type) => (
                          <button key={type} onClick={() => { setBuildType(type); setShowBuildDropdown(false); }} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: type === buildType ? "#1c1c1c" : "none", border: "none", color: type === buildType ? "#FFC107" : "#9ca3af", fontSize: "13px", cursor: "pointer", borderRadius: "8px" }}>
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={handleVoice} style={{ width: "36px", height: "36px", borderRadius: "9px", background: listening ? "rgba(255,193,7,0.15)" : "#161616", border: listening ? "1px solid rgba(255,193,7,0.3)" : "1px solid #1c1c1c", color: listening ? "#FFC107" : "#9ca3af", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    🎤
                  </button>

                  <button onClick={handleGenerate} disabled={!prompt.trim()} style={{ width: "36px", height: "36px", borderRadius: "50%", background: prompt.trim() ? "#FFC107" : "#1c1c1c", border: "none", cursor: prompt.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 700, color: prompt.trim() ? "#080808" : "#333", transition: "all 0.2s" }}>
                    ↑
                  </button>
                </div>
              </div>
            </div>

            <p style={{ textAlign: "center", color: "#333", fontSize: "11px", marginTop: "12px" }}>
              Ctrl+Enter to generate · Krypton AI may make mistakes
            </p>

            {/* Bottom cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginTop: "2.5rem" }}>
              {[
                { title: "Recent Projects", desc: "Continue where you left off", icon: "◫", path: "/dashboard" },
                { title: "Templates", desc: "Start from a ready-made design", icon: "⊟", path: "/templates" },
                { title: "Continue Building", desc: "Pick up your last project", icon: "→", path: "/dashboard" },
              ].map((card) => (
                <button key={card.title} onClick={() => router.push(card.path)} style={{ background: "#101010", border: "1px solid #1c1c1c", borderRadius: "14px", padding: "1.2rem", textAlign: "left", cursor: "pointer", transition: "border-color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#FFC107")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1c1c1c")}
                >
                  <div style={{ fontSize: "20px", marginBottom: "8px", color: "#FFC107" }}>{card.icon}</div>
                  <p style={{ color: "#fff", fontWeight: 600, fontSize: "13px", margin: "0 0 4px" }}>{card.title}</p>
                  <p style={{ color: "#555", fontSize: "12px", margin: 0 }}>{card.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
                          }
