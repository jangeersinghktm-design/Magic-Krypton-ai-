"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280",
};

type Filter = "trending" | "latest" | "featured" | "most_viewed";

type CommunityProject = {
  id: string; project_id: string; user_id: string;
  title: string; description: string;
  likes: number; views: number; forks: number;
  is_featured: boolean; tags: string[];
  created_at: string;
  projects?: { html_code: string; prompt: string };
  liked?: boolean;
};

// ── Announcement Banner ────────────────────────────────────────────
function AnnouncementBanner() {
  const supabase = createClient();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [current, setCurrent]   = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    supabase.from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => setAnnouncements(data || []));
  }, []);

  if (!announcements.length || dismissed) return null;
  const ann = announcements[current];

  return (
    <div style={{
      background: "rgba(245,197,66,0.08)",
      border: "none",
      borderBottom: `1px solid rgba(245,197,66,0.2)`,
      padding: "10px 24px",
      display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>📢</span>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>{ann.title} </span>
          <span style={{ fontSize: 13, color: "#888" }}>{ann.message}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        {announcements.length > 1 && (
          <button onClick={() => setCurrent(c => (c + 1) % announcements.length)}
            style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>›</button>
        )}
        <button onClick={() => setDismissed(true)}
          style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>
    </div>
  );
}

// ── Community Card ─────────────────────────────────────────────────
function CommunityCard({
  item, onLike, onUse, onFork,
}: {
  item: CommunityProject;
  onLike: (id: string) => void;
  onUse:  (item: CommunityProject) => void;
  onFork: (item: CommunityProject) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: T.card,
        border: `1px solid ${hovered ? "rgba(245,197,66,0.3)" : T.border}`,
        borderRadius: 16, overflow: "hidden",
        transition: "all 0.2s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(245,197,66,0.08)" : "none",
        animation: "fadeIn 0.3s ease",
      }}
    >
      {/* Preview */}
      <div style={{ height: 160, background: "#111", position: "relative", overflow: "hidden" }}>
        {item.projects?.html_code ? (
          <iframe
            srcDoc={item.projects.html_code}
            style={{ width: "200%", height: "200%", transform: "scale(0.5)", transformOrigin: "top left", border: "none", pointerEvents: "none" }}
            sandbox="allow-scripts" title={item.title}
          />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>🌐</div>
        )}

        {item.is_featured && (
          <div style={{ position: "absolute", top: 8, left: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", background: G, color: "#000", borderRadius: 20 }}>⭐ Featured</span>
          </div>
        )}

        {hovered && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, animation: "fadeIn 0.15s ease" }}>
            <button onClick={() => { const w = window.open("","_blank"); if(w && item.projects?.html_code){w.document.write(item.projects.html_code);w.document.close();} }}
              style={{ padding: "8px 14px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", fontSize: 12, cursor: "pointer" }}>
              👁 Preview
            </button>
            <button onClick={() => onFork(item)}
              style={{ padding: "8px 14px", background: "rgba(245,197,66,0.2)", border: "1px solid rgba(245,197,66,0.3)", borderRadius: 8, color: T.gold, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              ⑂ Fork
            </button>
            <button onClick={() => onUse(item)}
              style={{ padding: "8px 14px", background: G, border: "none", borderRadius: 8, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Use →
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.title}
        </h3>
        <p style={{ fontSize: 11.5, color: T.muted, marginBottom: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
          {item.description || item.projects?.prompt || "Community project"}
        </p>

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {item.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{ fontSize: 10, padding: "2px 8px", background: "rgba(245,197,66,0.08)", border: `1px solid ${T.border}`, borderRadius: 20, color: T.muted }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => onLike(item.id)} style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: item.liked ? "#ef4444" : T.muted, fontSize: 12, transition: "color 0.15s" }}>
              {item.liked ? "❤️" : "🤍"} {item.likes}
            </button>
            <span style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 3 }}>
              👁 {item.views}
            </span>
            <span style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 3 }}>
              ⑂ {item.forks || 0}
            </span>
          </div>
          <span style={{ fontSize: 10, color: "#444" }}>
            {new Date(item.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function CommunityPage() {
  const router  = useRouter();
  const supabase = createClient();

  const [items, setItems]         = useState<CommunityProject[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<Filter>("trending");
  const [search, setSearch]       = useState("");
  const [userId, setUserId]       = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [myProjects, setMyProjects] = useState<any[]>([]);
  const [sharing, setSharing]     = useState<string | null>(null);
  const [shareTitle, setShareTitle] = useState("");
  const [shareDesc, setShareDesc]   = useState("");
  const [shareTags, setShareTags]   = useState("");

  useEffect(() => { init(); }, [filter]);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUserId(session?.user?.id || null);

    let query = supabase
      .from("community_projects")
      .select("*, projects(html_code, prompt)")
      .order("created_at", { ascending: false });

    if (filter === "trending")    query = (query as any).order("likes",  { ascending: false });
    if (filter === "most_viewed") query = (query as any).order("views",  { ascending: false });
    if (filter === "featured")    query = (query as any).eq("is_featured", true);

    const { data } = await (query as any).limit(24);

    // Get user likes
    let likedIds: string[] = [];
    if (session?.user?.id) {
      const { data: likes } = await supabase
        .from("project_likes")
        .select("community_project_id")
        .eq("user_id", session.user.id);
      likedIds = (likes || []).map((l: any) => l.community_project_id);
    }

    setItems((data || []).map((item: any) => ({ ...item, liked: likedIds.includes(item.id) })));
    setLoading(false);
  };

  const loadMyProjects = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("projects")
      .select("id, title, html_code, prompt")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setMyProjects(data || []);
  };

  const handleLike = async (id: string) => {
    if (!userId) { router.push("/auth/login"); return; }
    const item = items.find(i => i.id === id);
    if (!item) return;

    if (item.liked) {
      await supabase.from("project_likes").delete().eq("user_id", userId).eq("community_project_id", id);
      await supabase.from("community_projects").update({ likes: Math.max(0, item.likes - 1) }).eq("id", id);
      setItems(prev => prev.map(i => i.id === id ? { ...i, liked: false, likes: Math.max(0, i.likes - 1) } : i));
    } else {
      await supabase.from("project_likes").insert({ user_id: userId, community_project_id: id });
      await supabase.from("community_projects").update({ likes: item.likes + 1 }).eq("id", id);
      setItems(prev => prev.map(i => i.id === id ? { ...i, liked: true, likes: i.likes + 1 } : i));
    }
  };

  const handleFork = async (item: CommunityProject) => {
    if (!userId) { router.push("/auth/login"); return; }

    // Increment forks
    await supabase.from("community_projects")
      .update({ forks: (item.forks || 0) + 1 })
      .eq("id", item.id);

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, forks: (i.forks || 0) + 1 } : i));

    // Redirect to create with same prompt
    if (item.projects?.prompt) {
      router.push(`/create?prompt=${encodeURIComponent(item.projects.prompt)}`);
    } else {
      router.push("/create");
    }
  };

  const handleUse = (item: CommunityProject) => {
    if (item.projects?.prompt) {
      router.push(`/create?prompt=${encodeURIComponent(item.projects.prompt)}`);
    }
  };

  const handleShare = async (projectId: string) => {
    if (!userId) { router.push("/auth/login"); return; }
    const project = myProjects.find(p => p.id === projectId);

    const { error } = await supabase.from("community_projects").insert({
      project_id: projectId,
      user_id: userId,
      title: shareTitle || project?.title || "My Project",
      description: shareDesc || project?.prompt || "",
      tags: shareTags.split(",").map((t: string) => t.trim()).filter(Boolean),
      forks: 0,
    });

    if (!error) {
      setShowShare(false);
      setSharing(null);
      setShareTitle(""); setShareDesc(""); setShareTags("");
      init();
      alert("✅ Project shared to community!");
    }
  };

  const filtered = items.filter(item =>
    !search ||
    item.title?.toLowerCase().includes(search.toLowerCase()) ||
    item.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const FILTER_TABS: { id: Filter; icon: string; label: string }[] = [
    { id: "trending",    icon: "🔥", label: "Trending"   },
    { id: "latest",      icon: "🆕", label: "Latest"     },
    { id: "most_viewed", icon: "👁", label: "Most Viewed" },
    { id: "featured",    icon: "⭐", label: "Featured"   },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif" }}>

        {/* Announcements */}
        <AnnouncementBanner />

        {/* Hero */}
        <div style={{ padding: "48px 24px 32px", textAlign: "center", background: "linear-gradient(180deg,rgba(245,197,66,0.05) 0%,transparent 100%)", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌍</div>
          <h1 style={{ fontSize: "clamp(24px,5vw,40px)", fontWeight: 800, fontFamily: "'Syne',sans-serif", marginBottom: 12, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Community Showcase
          </h1>
          <p style={{ color: T.muted, fontSize: 15, marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
            Discover amazing projects built with Krypton AI. Like, fork, and get inspired!
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              style={{ padding: "10px 18px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif", minWidth: 240 }} />
            <button onClick={() => { loadMyProjects(); setShowShare(true); }} style={{ padding: "10px 20px", background: G, border: "none", borderRadius: 10, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              + Share Project
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            {FILTER_TABS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                padding: "8px 18px", borderRadius: 10,
                background: filter === f.id ? G : T.card,
                border: filter === f.id ? "none" : `1px solid ${T.border}`,
                color: filter === f.id ? "#000" : T.muted,
                fontSize: 13, fontWeight: filter === f.id ? 700 : 400,
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {f.icon} {f.label}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 12, color: T.muted, display: "flex", alignItems: "center" }}>
              {filtered.length} projects
            </span>
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ height: 160, background: "linear-gradient(90deg,#161616 25%,#1e1e1e 50%,#161616 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ height: 16, background: "#1a1a1a", borderRadius: 6, width: "70%" }} />
                    <div style={{ height: 12, background: "#1a1a1a", borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Projects Grid */}
          {!loading && filtered.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
              {filtered.map(item => (
                <CommunityCard
                  key={item.id}
                  item={item}
                  onLike={handleLike}
                  onUse={handleUse}
                  onFork={handleFork}
                />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 18 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🌍</div>
              <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No projects found</p>
              <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>
                {search ? "Try different keywords" : "Be the first to share!"}
              </p>
              <button onClick={() => { loadMyProjects(); setShowShare(true); }} style={{ padding: "12px 28px", background: G, border: "none", borderRadius: 10, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Share Your Project →
              </button>
            </div>
          )}
        </div>

        {/* Share Modal */}
        {showShare && (
          <div onClick={() => setShowShare(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#0d0d0d", border: `1px solid ${T.border}`, borderRadius: 18, padding: 28, width: "100%", maxWidth: 480, margin: "0 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Share to Community</h3>
                <button onClick={() => setShowShare(false)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}>✕</button>
              </div>

              {/* Project select */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1 }}>SELECT PROJECT</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, maxHeight: 160, overflowY: "auto", scrollbarWidth: "none" }}>
                  {myProjects.length === 0 ? (
                    <p style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "16px 0" }}>No projects yet. Create one first!</p>
                  ) : myProjects.map(p => (
                    <button key={p.id} onClick={() => { setSharing(p.id); setShareTitle(p.title || ""); setShareDesc(p.prompt?.slice(0, 100) || ""); }}
                      style={{ padding: "10px 14px", background: sharing === p.id ? "rgba(245,197,66,0.1)" : "#161616", border: `1px solid ${sharing === p.id ? "rgba(245,197,66,0.4)" : T.border}`, borderRadius: 8, color: sharing === p.id ? T.gold : T.text, fontSize: 13, cursor: "pointer", textAlign: "left" as const }}>
                      {p.title || "Untitled"}
                    </button>
                  ))}
                </div>
              </div>

              {[
                { label: "TITLE",                    value: shareTitle, setter: setShareTitle, placeholder: "My awesome project" },
                { label: "DESCRIPTION",              value: shareDesc,  setter: setShareDesc,  placeholder: "What did you build?" },
                { label: "TAGS (comma separated)",   value: shareTags,  setter: setShareTags,  placeholder: "saas, landing, dark" },
              ].map(field => (
                <div key={field.label} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1 }}>{field.label}</label>
                  <input value={field.value} onChange={e => field.setter(e.target.value)} placeholder={field.placeholder}
                    style={{ width: "100%", background: "#161616", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "9px 12px", fontSize: 13, outline: "none", marginTop: 6, boxSizing: "border-box" as const, fontFamily: "'DM Sans', sans-serif" }} />
                </div>
              ))}

              <button onClick={() => sharing && handleShare(sharing)} disabled={!sharing}
                style={{ width: "100%", padding: "12px", background: sharing ? G : "#1a1a1a", border: "none", borderRadius: 10, color: sharing ? "#000" : "#444", fontWeight: 700, fontSize: 14, cursor: sharing ? "pointer" : "not-allowed" }}>
                {sharing ? "Share to Community →" : "Select a project first"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
               
