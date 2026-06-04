"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5C542 0%, #00D084 100%)";
const T = {
  gold: "#F5C542", green: "#00D084", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", sub: "#B3B3B3", muted: "#6B7280",
};

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth/login"); return; }
      const { data } = await supabase.from("projects").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
      setProjects(data || []);
      setLoading(false);
    };
    getData();
  }, []);

  const totalProjects = projects.length;
  const thisMonth = projects.filter(p => new Date(p.created_at).getMonth() === new Date().getMonth()).length;
  const websites = projects.filter(p => p.prompt?.toLowerCase().includes("website") || p.prompt?.toLowerCase().includes("landing")).length;
  const games = projects.filter(p => p.prompt?.toLowerCase().includes("game")).length;

  const stats = [
    { label: "Total Projects", value: totalProjects, icon: "📁", color: T.gold },
    { label: "This Month", value: thisMonth, icon: "📅", color: T.green },
    { label: "Websites", value: websites, icon: "🌐", color: T.gold },
    { label: "Games", value: games, icon: "🎮", color: T.green },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif", padding: "40px 20px", position: "relative" }}>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50vw", height: "50vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(245,197,66,0.2) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "45vw", height: "45vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(0,208,132,0.15) 0%, transparent 70%)" }} />
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "2rem" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.muted, padding: "8px 14px", cursor: "pointer", fontSize: "14px" }}>
            ← Back
          </button>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "24px", fontWeight: 800, margin: 0, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Analytics</h1>
            <p style={{ color: T.muted, fontSize: "13px", margin: 0 }}>Your generation history</p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px", marginBottom: "2rem" }}>
          {stats.map((stat) => (
            <div key={stat.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "20px", textAlign: "center" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>{stat.icon}</div>
              <p style={{ fontSize: "32px", fontWeight: 800, margin: 0, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{loading ? "..." : stat.value}</p>
              <p style={{ color: T.muted, fontSize: "12px", margin: "4px 0 0" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Credits */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", marginBottom: "16px" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Credits Usage</h2>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: T.sub, fontSize: "14px" }}>Daily Credits Used</span>
            <span style={{ fontWeight: 700, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>0 / 5</span>
          </div>
          <div style={{ height: "8px", background: "#1a1a1a", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "0%", background: G, borderRadius: "4px" }} />
          </div>
          <p style={{ color: T.muted, fontSize: "12px", marginTop: "8px" }}>Resets daily at midnight</p>
        </div>

        {/* Recent Projects */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Recent Projects</h2>
          {loading ? (
            <p style={{ color: T.muted, fontSize: "14px" }}>Loading...</p>
          ) : projects.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: "32px", marginBottom: "8px" }}>📁</p>
              <p style={{ color: T.muted, fontSize: "14px" }}>No projects yet</p>
              <button onClick={() => router.push("/")} style={{ marginTop: "12px", padding: "10px 20px", background: G, border: "none", borderRadius: "10px", color: "#050505", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                Create First Project →
              </button>
            </div>
          ) : (
            projects.slice(0, 10).map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: "14px", margin: 0 }}>{p.title || "Untitled"}</p>
                  <p style={{ color: T.muted, fontSize: "12px", margin: "2px 0 0" }}>{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => router.push(`/create?id=${p.id}`)} style={{ padding: "6px 14px", background: "none", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.muted, fontSize: "12px", cursor: "pointer" }}>
                  Open →
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
