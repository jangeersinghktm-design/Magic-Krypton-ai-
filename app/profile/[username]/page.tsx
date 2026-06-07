"use client";

// app/profile/[username]/page.tsx
import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280",
};

function ProfileContent() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const username = params?.username as string;

  const [profile, setProfile]   = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [isOwn, setIsOwn]       = useState(false);

  useEffect(() => { loadProfile(); }, [username]);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("username", username)
      .single();

    if (!userProfile) { setLoading(false); return; }
    setProfile(userProfile);
    setIsOwn(session?.user?.id === userProfile.id);

    const { data: communityProjects } = await supabase
      .from("community_projects")
      .select("*, projects(html_code, prompt)")
      .eq("user_id", userProfile.id)
      .order("likes", { ascending: false });

    setProjects(communityProjects || []);
    setLoading(false);
  };

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, color: T.gold }}>
      Loading...
    </div>
  );

  if (!profile) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, color: T.text, flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <p style={{ fontSize: 18, fontWeight: 700 }}>User not found</p>
      <button onClick={() => router.push("/community")} style={{ padding: "10px 20px", background: G, border: "none", borderRadius: 9, color: "#000", fontWeight: 700, cursor: "pointer" }}>
        Browse Community
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1} }`}</style>

      {/* Hero */}
      <div style={{ background: "linear-gradient(180deg,rgba(245,197,66,0.06) 0%,transparent 100%)", borderBottom: `1px solid ${T.border}`, padding: "40px 24px 32px", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, color: "#000", margin: "0 auto 16px" }}>
          {profile.username?.[0]?.toUpperCase() || "U"}
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>@{profile.username}</h1>
        {profile.bio && <p style={{ color: T.muted, fontSize: 14, maxWidth: 400, margin: "0 auto 16px" }}>{profile.bio}</p>}

        {/* Links */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: T.gold, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              🌐 Website
            </a>
          )}
          {profile.twitter && (
            <a href={`https://twitter.com/${profile.twitter}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: T.gold, textDecoration: "none" }}>
              𝕏 @{profile.twitter}
            </a>
          )}
          {profile.github && (
            <a href={`https://github.com/${profile.github}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: T.gold, textDecoration: "none" }}>
              🐙 {profile.github}
            </a>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
          {[
            { label: "Projects", value: projects.length },
            { label: "Likes", value: profile.total_likes_received || 0 },
            { label: "Featured", value: profile.is_featured ? "Yes ⭐" : "No" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.gold }}>{s.value}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>
          🌍 Public Projects ({projects.length})
        </h2>

        {projects.length === 0 ? (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
            <p style={{ color: T.muted, fontSize: 14 }}>No public projects yet</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {projects.map(p => (
              <div key={p.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", animation: "fadeIn 0.3s ease" }}>
                <div style={{ height: 140, background: "#111", position: "relative", overflow: "hidden" }}>
                  {p.projects?.html_code ? (
                    <iframe srcDoc={p.projects.html_code} style={{ width: "200%", height: "200%", transform: "scale(0.5)", transformOrigin: "top left", border: "none", pointerEvents: "none" }} sandbox="allow-scripts" />
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>🌐</div>
                  )}
                  {p.is_featured && (
                    <div style={{ position: "absolute", top: 8, left: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", background: G, color: "#000", borderRadius: 20 }}>⭐ Featured</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: "14px 16px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</h3>
                  <p style={{ fontSize: 11.5, color: T.muted, marginBottom: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{p.description}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 12, color: T.muted }}>❤️ {p.likes}</span>
                      <span style={{ fontSize: 12, color: T.muted }}>👁 {p.views}</span>
                    </div>
                    <button onClick={() => { const w = window.open("","_blank"); if(w && p.projects?.html_code){w.document.write(p.projects.html_code);w.document.close();} }}
                      style={{ padding: "4px 12px", background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.2)", borderRadius: 6, color: T.gold, fontSize: 11, cursor: "pointer" }}>
                      Preview →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050505", color: "#F5D800" }}>
        Loading...
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
                                    
