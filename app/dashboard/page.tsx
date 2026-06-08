"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280", red: "#ef4444",
};

type Project = {
  id: string; title: string; prompt: string;
  html_code: string; created_at: string; updated_at: string;
  status: "draft" | "building" | "completed" | "failed";
  starred?: boolean;
};

type Credits = { total: number; used: number; plan: string; resetDate: string };
type Activity = { id: string; text: string; time: string; icon: string; type: string };

function Skeleton({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg, #161616 25%, #1e1e1e 50%, #161616 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }} />
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string; icon: string }> = {
    draft:     { color: "#888",    bg: "rgba(136,136,136,0.1)", label: "Draft",     icon: "📝" },
    building:  { color: "#F5D800", bg: "rgba(245,216,0,0.1)",   label: "Building",  icon: "⚡" },
    completed: { color: "#00CC44", bg: "rgba(0,204,68,0.1)",    label: "Completed", icon: "✅" },
    failed:    { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   label: "Failed",    icon: "❌" },
  };
  const s = map[status] || map.draft;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px",
      borderRadius: 20, color: s.color, background: s.bg,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

function ProjectActions({ project, onDelete, onDuplicate, router }: any) {
  const [showMore, setShowMore] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const actions = [
    { icon: "✏️", label: "Edit",            action: () => router.push(`/create?id=${project.id}`) },
    { icon: "👁",  label: "Preview",         action: () => { const w = window.open("","_blank"); if(w){w.document.write(project.html_code);w.document.close();} } },
    { icon: "💬",  label: "AI Chat",         action: () => router.push(`/create?id=${project.id}&tab=chat`) },
    { icon: "⏱",  label: "Version History",  action: () => router.push(`/create?id=${project.id}&tab=history`) },
    { icon: "⬇️", label: "Export HTML",      action: () => {
      const blob = new Blob([project.html_code], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${project.title}.html`; a.click();
    }},
    { icon: "📤",  label: "Share",           action: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/projects/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (data.slug) {
        const url = `${window.location.origin}/share/${data.slug}`;
        navigator.clipboard.writeText(url);
        alert("✅ Share link copied!\n" + url);
      }
    }},
    { icon: "🚀",  label: "Deploy",          action: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      alert("🚀 Deploying...");
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (data.url) {
        alert(`✅ Deployed!\n${data.url}`);
        navigator.clipboard.writeText(data.url);
      } else {
        alert("❌ Deploy failed: " + data.error);
      }
    }},
    { icon: "🐙",  label: "GitHub Push",     action: () => router.push("/settings?tab=github") },
    { icon: "⧉",   label: "Duplicate",       action: () => onDuplicate(project) },
    { icon: "🗑",  label: "Delete",          action: () => onDelete(project.id), danger: true },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setShowMore(!showMore)} style={{
        padding: "5px 9px", borderRadius: 7,
        background: "#1a1a1a", border: `1px solid ${T.border}`,
        color: T.muted, fontSize: 14, cursor: "pointer",
      }}>•••</button>

      {showMore && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", right: 0,
          background: "#111", border: `1px solid ${T.border}`,
          borderRadius: 12, padding: 6, minWidth: 190, zIndex: 100,
          boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          animation: "fadeIn 0.15s ease",
        }}>
          {actions.map(a => (
            <button key={a.label} onClick={() => { a.action(); setShowMore(false); }} style={{
              width: "100%", textAlign: "left", padding: "7px 12px",
              background: "none", border: "none",
              color: (a as any).danger ? T.red : T.muted,
              fontSize: 12.5, cursor: "pointer", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = (a as any).danger ? T.red : T.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = (a as any).danger ? T.red : T.muted; }}>
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [projects, setProjects]       = useState<Project[]>([]);
  const [loading, setLoading]         = useState(true);
  const [credits, setCredits]         = useState<Credits>({ total: 100, used: 0, plan: "Free", resetDate: "" });
  const [activities, setActivities]   = useState<Activity[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotif, setShowNotif]     = useState(false);
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState<"all"|"draft"|"completed"|"starred">("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [activeNav, setActiveNav]     = useState("Dashboard");
  const [user, setUser]               = useState<any>(null);

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth/login"); return; }
    setUser(session.user);
    await Promise.all([
      fetchProjects(session.user.id),
      fetchCredits(session.user.id),
      fetchActivities(session.user.id),
      fetchNotifications(session),
    ]);
    setLoading(false);
  };

  const fetchProjects = async (uid: string) => {
    const { data } = await supabase.from("projects")
      .select("id, title, prompt, html_code, created_at, updated_at, status, starred")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false });
    setProjects(data || []);
  };

  const fetchCredits = async (uid: string) => {
    const { data } = await supabase.from("profiles")
      .select("total_credits, used_credits, plan, credits_reset_date")
      .eq("id", uid).single();
    if (data) setCredits({
      total: data.total_credits ?? 5,
      used: data.used_credits || 0,
      plan: data.plan || "Free",
      resetDate: data.credits_reset_date ? new Date(data.credits_reset_date).toLocaleDateString() : "N/A",
    });
  };

  const fetchActivities = async (uid: string) => {
    const { data } = await supabase.from("credit_transactions")
      .select("*").eq("user_id", uid)
      .order("created_at", { ascending: false }).limit(8);
    setActivities((data || []).map((tx: any) => ({
      id: tx.id,
      text: tx.description || "Credit transaction",
      time: timeAgo(tx.created_at),
      icon: tx.amount < 0 ? "⚡" : "💳",
      type: tx.type,
    })));
  };

  const fetchNotifications = async (session: any) => {
    try {
      const res = await fetch("/api/notifications", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {}
  };

  const markRead = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    });
    setNotifications(prev =>
      id === "all"
        ? prev.map(n => ({ ...n, read: true }))
        : prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const deleteProject = async (id: string) => {
    setDeleting(id);
    await supabase.from("projects").delete().eq("id", id);
    setProjects(p => p.filter(x => x.id !== id));
    setDeleting(null); setConfirmDelete(null);
  };

  const duplicateProject = async (project: Project) => {
    setDuplicating(project.id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("projects").insert({
      user_id: session.user.id,
      title: `${project.title} (Copy)`,
      prompt: project.prompt,
      html_code: project.html_code,
      status: "draft",
    }).select().single();
    if (data) setProjects(p => [{ ...data, starred: false }, ...p]);
    setDuplicating(null);
  };

  const toggleStar = async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    const newVal = !project.starred;
    setProjects(p => p.map(x => x.id === id ? { ...x, starred: newVal } : x));
    await supabase.from("projects").update({ starred: newVal }).eq("id", id);
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const filtered = projects.filter(p => {
    const matchSearch = p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.prompt?.toLowerCase().includes(search.toLowerCase());
    if (filter === "starred") return matchSearch && p.starred;
    if (filter === "all") return matchSearch;
    return matchSearch && p.status === filter;
  });

  const remaining = credits.total - credits.used;
  const pct = Math.max(0, (remaining / credits.total) * 100);
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "User";
  const planLabel = credits.plan.charAt(0).toUpperCase() + credits.plan.slice(1);
  const unreadCount = notifications.filter(n => !n.read).length;

  const QUICK_ACTIONS = [
    { icon: "🌐", label: "New Website", prompt: "Build a professional business website", type: "Website" },
    { icon: "📱", label: "New App",     prompt: "Build a web app with dashboard",       type: "App" },
    { icon: "🎮", label: "New Game",    prompt: "Build a browser game",                 type: "Game" },
    { icon: "🛠",  label: "New Tool",   prompt: "Build a productivity tool",             type: "Tool" },
  ];

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dot-pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
        .project-card { transition: all 0.2s; }
        .project-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(245,197,66,0.08); border-color: rgba(245,197,66,0.3) !important; }
        .nav-btn:hover { color: #F5D800 !important; }
      `}</style>

      <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── TOP NAV ── */}
        <nav style={{
          padding: "12px 24px", borderBottom: `1px solid ${T.border}`,
          background: "rgba(5,5,5,0.95)", backdropFilter: "blur(16px)",
          display: "flex", alignItems: "center", gap: 12,
          position: "sticky", top: 0, zIndex: 100,
        }}>
          <img src="/logo.png" alt="Kr" style={{ height: 36, width: "auto", cursor: "pointer" }}
            onClick={() => router.push("/")} />

          <div style={{ display: "flex", gap: 2, marginLeft: 8 }}>
            {["Dashboard", "Projects", "Templates", "Community", "Marketplace", "Docs"].map(nav => (
              <button key={nav} className="nav-btn"
                onClick={() => {
                  setActiveNav(nav);
                  if (nav === "Templates") router.push("/templates");
                  else if (nav === "Docs") router.push("/landing#faq");
                  else if (nav === "Projects") router.push("/dashboard");
                }}
                style={{
                  padding: "6px 12px", background: "none", border: "none",
                  color: activeNav === nav ? T.gold : T.muted,
                  fontSize: 13, fontWeight: activeNav === nav ? 600 : 400,
                  cursor: "pointer", borderRadius: 8, transition: "all 0.15s",
                  borderBottom: activeNav === nav ? `2px solid ${T.gold}` : "2px solid transparent",
                }}>{nav}</button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {/* Credits */}
            <div style={{
              padding: "6px 12px", borderRadius: 8,
              background: remaining > 20 ? "rgba(0,204,68,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${remaining > 20 ? "rgba(0,204,68,0.3)" : "rgba(239,68,68,0.3)"}`,
              fontSize: 12, color: remaining > 20 ? T.green : T.red, fontWeight: 700,
            }}>⚡ {remaining} credits</div>

            {/* Plan */}
            <div style={{
              padding: "5px 12px", borderRadius: 8,
              background: "rgba(245,216,0,0.1)", border: "1px solid rgba(245,216,0,0.2)",
              fontSize: 11, color: T.gold, fontWeight: 700,
            }}>{planLabel} Plan</div>

            {/* Upgrade */}
            {credits.plan === "free" && (
              <button onClick={() => router.push("/settings?tab=billing")} style={{
                padding: "6px 14px", background: G, border: "none",
                borderRadius: 8, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>Upgrade ⚡</button>
            )}

            {/* ── NOTIFICATIONS BELL ── */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button onClick={() => setShowNotif(!showNotif)} style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "#161616", border: `1px solid ${T.border}`,
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                position: "relative", fontSize: 16,
              }}>
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: -2, right: -2,
                    width: 16, height: 16, borderRadius: "50%",
                    background: "#ef4444", color: "#fff",
                    fontSize: 9, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{unreadCount}</span>
                )}
              </button>

              {showNotif && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  width: 320, background: "#111",
                  border: `1px solid ${T.border}`,
                  borderRadius: 14, padding: 0,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.8)",
                  zIndex: 200, overflow: "hidden",
                  animation: "fadeIn 0.18s ease",
                }}>
                  {/* Header */}
                  <div style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderBottom: `1px solid ${T.border}`,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      Notifications
                      {unreadCount > 0 && (
                        <span style={{
                          marginLeft: 8, fontSize: 10,
                          background: "rgba(239,68,68,0.15)",
                          color: "#ef4444", padding: "1px 6px",
                          borderRadius: 10, fontWeight: 700,
                        }}>{unreadCount} new</span>
                      )}
                    </span>
                    {unreadCount > 0 && (
                      <button onClick={() => markRead("all")} style={{
                        fontSize: 11, color: T.gold, background: "none",
                        border: "none", cursor: "pointer", fontWeight: 600,
                      }}>Mark all read</button>
                    )}
                  </div>

                  {/* List */}
                  <div style={{ maxHeight: 360, overflowY: "auto", scrollbarWidth: "none" }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center", color: "#444", fontSize: 13 }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id}
                          onClick={() => { markRead(n.id); if (n.link) window.open(n.link, "_blank"); }}
                          style={{
                            padding: "12px 16px",
                            borderBottom: `1px solid rgba(255,255,255,0.04)`,
                            background: n.read ? "none" : "rgba(245,197,66,0.03)",
                            cursor: n.link ? "pointer" : "default",
                            display: "flex", alignItems: "flex-start", gap: 10,
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "#161616"}
                          onMouseLeave={e => e.currentTarget.style.background = n.read ? "none" : "rgba(245,197,66,0.03)"}
                        >
                          <span style={{ fontSize: 18, flexShrink: 0 }}>
                            {n.type === "success" ? "✅" : n.type === "error" ? "❌" : "ℹ️"}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontSize: 13, fontWeight: n.read ? 400 : 600,
                              margin: 0, color: n.read ? T.muted : T.text,
                            }}>{n.title}</p>
                            {n.message && (
                              <p style={{
                                fontSize: 11.5, color: "#555", margin: "2px 0 0",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>{n.message}</p>
                            )}
                            <p style={{ fontSize: 10, color: "#333", margin: "4px 0 0" }}>
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          </div>
                          {!n.read && (
                            <div style={{
                              width: 7, height: 7, borderRadius: "50%",
                              background: T.gold, flexShrink: 0, marginTop: 4,
                            }} />
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}` }}>
                      <button onClick={() => { router.push("/settings?tab=notifications"); setShowNotif(false); }} style={{
                        width: "100%", padding: "8px", background: "none",
                        border: `1px solid ${T.border}`, borderRadius: 8,
                        color: T.muted, fontSize: 12, cursor: "pointer",
                      }}>Notification Settings →</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile */}
            <div onClick={() => router.push("/settings")} style={{
              width: 32, height: 32, borderRadius: "50%",
              background: G, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 700,
              color: "#000", cursor: "pointer",
            }}>
              {firstName[0]?.toUpperCase()}
            </div>
          </div>
        </nav>

        <div style={{ display: "flex", maxWidth: 1400, margin: "0 auto" }}>

          {/* ── LEFT MAIN ── */}
          <div style={{ flex: 1, padding: "24px", minWidth: 0 }}>

            {/* Quick Actions */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: "#444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>QUICK ACTIONS</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {QUICK_ACTIONS.map(a => (
                  <button key={a.label}
                    onClick={() => router.push(`/create?prompt=${encodeURIComponent(a.prompt)}&type=${a.type}`)}
                    style={{
                      padding: "12px 8px", background: T.card,
                      border: `1px solid ${T.border}`, borderRadius: 12,
                      color: T.muted, fontSize: 12, cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.text; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search + Filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search projects..."
                style={{
                  flex: 1, minWidth: 200, padding: "9px 14px",
                  background: T.card, border: `1px solid ${T.border}`,
                  borderRadius: 9, color: T.text, fontSize: 13,
                  outline: "none", fontFamily: "'DM Sans', sans-serif",
                }} />
              <div style={{ display: "flex", gap: 4, background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: 4 }}>
                {(["all","draft","completed","starred"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    padding: "5px 12px", borderRadius: 6, border: "none",
                    background: filter === f ? "rgba(245,197,66,0.15)" : "none",
                    color: filter === f ? T.gold : T.muted,
                    fontSize: 12, cursor: "pointer", fontWeight: filter === f ? 700 : 400,
                    textTransform: "capitalize",
                  }}>{f === "starred" ? "⭐ Starred" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
                ))}
              </div>
              <button onClick={() => router.push("/create")} style={{
                padding: "9px 18px", background: G, border: "none",
                borderRadius: 9, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>+ New</button>
            </div>

            {/* Skeleton */}
            {loading && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                    <div style={{ height: 160 }}><Skeleton h={160} r={0} /></div>
                    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                      <Skeleton h={16} w="70%" /><Skeleton h={12} w="50%" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && filtered.length === 0 && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: "60px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>{filter === "starred" ? "⭐" : "📁"}</div>
                <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  {search ? "No results" : filter === "starred" ? "No starred projects" : "No projects yet"}
                </p>
                <p style={{ color: T.muted, fontSize: 13, marginBottom: 24 }}>
                  {search ? "Try different keywords" : "Create your first project!"}
                </p>
                {!search && (
                  <button onClick={() => router.push("/create")} style={{
                    padding: "12px 28px", background: G, border: "none",
                    borderRadius: 10, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}>Create Project →</button>
                )}
              </div>
            )}

            {/* Projects Grid */}
            {!loading && filtered.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {filtered.map(project => (
                  <div key={project.id} className="project-card" style={{
                    background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: 16, overflow: "hidden",
                    animation: "fadeIn 0.3s ease",
                  }}>
                    {/* Preview */}
                    <div style={{ height: 160, background: "#111", position: "relative", overflow: "hidden", cursor: "pointer" }}
                      onClick={() => router.push(`/create?id=${project.id}`)}>
                      {project.html_code ? (
                        <iframe srcDoc={project.html_code}
                          style={{ width: "200%", height: "200%", transform: "scale(0.5)", transformOrigin: "top left", border: "none", pointerEvents: "none" }}
                          sandbox="allow-scripts" title={project.title} />
                      ) : (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: "#333" }}>📄</div>
                      )}
                      <div style={{
                        position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: 0, transition: "opacity 0.2s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0"}>
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Open Project →</span>
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                          {project.title || "Untitled"}
                        </h3>
                        <button onClick={() => toggleStar(project.id)} style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 16, color: project.starred ? "#FFD700" : "#444", marginLeft: 6, flexShrink: 0,
                        }}>★</button>
                      </div>

                      <p style={{
                        fontSize: 11.5, color: T.muted, marginBottom: 10,
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
                      }}>{project.prompt || "No description"}</p>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <StatusBadge status={project.status || "draft"} />
                        <span style={{ fontSize: 10.5, color: "#444" }}>{timeAgo(project.updated_at || project.created_at)}</span>
                      </div>

                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => router.push(`/create?id=${project.id}`)} style={{
                          flex: 1, padding: "5px 8px", borderRadius: 7,
                          background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.2)",
                          color: T.gold, fontSize: 11, fontWeight: 600, cursor: "pointer",
                        }}>✏️ Edit</button>

                        <button onClick={() => { const w = window.open("","_blank"); if(w){w.document.write(project.html_code);w.document.close();} }} style={{
                          flex: 1, padding: "5px 8px", borderRadius: 7,
                          background: "rgba(0,204,68,0.08)", border: "1px solid rgba(0,204,68,0.15)",
                          color: T.green, fontSize: 11, fontWeight: 600, cursor: "pointer",
                        }}>👁 Preview</button>

                        <button onClick={() => router.push(`/create?id=${project.id}&tab=chat`)} style={{
                          flex: 1, padding: "5px 8px", borderRadius: 7,
                          background: "rgba(100,100,255,0.08)", border: "1px solid rgba(100,100,255,0.15)",
                          color: "#8888ff", fontSize: 11, fontWeight: 600, cursor: "pointer",
                        }}>💬 AI</button>

                        <ProjectActions
                          project={project}
                          onDelete={(id: string) => setConfirmDelete(id)}
                          onDuplicate={duplicateProject}
                          router={router}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div style={{
            width: 280, borderLeft: `1px solid ${T.border}`,
            padding: "24px 16px", flexShrink: 0,
            display: "flex", flexDirection: "column", gap: 16,
            overflowY: "auto", maxHeight: "calc(100vh - 62px)",
            position: "sticky", top: 62, scrollbarWidth: "none",
          }}>

            {/* Credits Widget */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Credits</span>
                <button onClick={() => router.push("/settings?tab=billing")} style={{
                  fontSize: 10, color: T.gold, background: "none",
                  border: "1px solid rgba(245,197,66,0.3)", borderRadius: 4,
                  padding: "1px 7px", cursor: "pointer",
                }}>Top up ⚡</button>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 6, marginBottom: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct > 30 ? G : "linear-gradient(90deg,#ef4444,#f59e0b)", borderRadius: 6, transition: "width 0.5s" }} />
              </div>
              {[
                { label: "Total Credits", value: credits.total },
                { label: "Used Today",    value: credits.used },
                { label: "Remaining",     value: remaining, color: remaining > 20 ? T.green : T.red },
                { label: "Next Reset",    value: credits.resetDate },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <span style={{ fontSize: 12, color: T.muted }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: (row as any).color || T.text }}>{row.value}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: 10, background: "#161616", borderRadius: 8 }}>
                <p style={{ fontSize: 10, color: "#555", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Credit Costs</p>
                {[
                  { label: "Small Edit",  cost: "1 cr" },
                  { label: "Component",   cost: "3 cr" },
                  { label: "Full Page",   cost: "10 cr" },
                  { label: "Full App",    cost: "25 cr" },
                  { label: "AI Analysis", cost: "5 cr" },
                ].map(c => (
                  <div key={c.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span style={{ fontSize: 11, color: T.muted }}>{c.label}</span>
                    <span style={{ fontSize: 11, color: T.gold, fontWeight: 600 }}>{c.cost}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Stats */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Project Stats</p>
              {[
                { label: "Total Projects", value: projects.length,                                          icon: "📁" },
                { label: "Completed",      value: projects.filter(p => p.status === "completed").length,    icon: "✅" },
                { label: "Drafts",         value: projects.filter(p => !p.status || p.status === "draft").length, icon: "📝" },
                { label: "Starred",        value: projects.filter(p => p.starred).length,                  icon: "⭐" },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <span style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>{s.icon} {s.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.gold }}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* AI Activity Feed */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>AI Activity</p>
              {activities.length === 0 ? (
                <p style={{ color: "#444", fontSize: 12, textAlign: "center", padding: "12px 0" }}>No activity yet</p>
              ) : (
                activities.map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{a.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11.5, color: T.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.text}</p>
                      <p style={{ fontSize: 10, color: "#444", margin: "2px 0 0" }}>{a.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Recent Projects */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Recent Projects</p>
              {projects.slice(0, 4).map(p => (
                <div key={p.id} onClick={() => router.push(`/create?id=${p.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, cursor: "pointer", transition: "background 0.15s", marginBottom: 2 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#161616"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: "#161616", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>📄</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title || "Untitled"}</p>
                    <p style={{ fontSize: 10, color: "#444", margin: "1px 0 0" }}>{timeAgo(p.updated_at || p.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DELETE MODAL ── */}
        {confirmDelete && (
          <div onClick={() => setConfirmDelete(null)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            zIndex: 200, display: "flex", alignItems: "center",
            justifyContent: "center", backdropFilter: "blur(4px)",
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "#0d0d0d", border: `1px solid ${T.border}`,
              borderRadius: 16, padding: 28, maxWidth: 380, width: "90%", textAlign: "center",
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Delete Project?</h3>
              <p style={{ color: T.muted, fontSize: 13, marginBottom: 24 }}>This cannot be undone.</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setConfirmDelete(null)} style={{
                  padding: "10px 24px", background: "#161616",
                  border: `1px solid ${T.border}`, borderRadius: 9,
                  color: T.text, fontSize: 13, cursor: "pointer", fontWeight: 600,
                }}>Cancel</button>
                <button onClick={() => deleteProject(confirmDelete!)} disabled={deleting === confirmDelete} style={{
                  padding: "10px 24px", background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9,
                  color: T.red, fontSize: 13, cursor: "pointer", fontWeight: 700,
                }}>{deleting === confirmDelete ? "Deleting..." : "Delete"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
