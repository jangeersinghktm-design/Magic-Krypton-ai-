"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5F5F5 0%, #5FB88A 100%)";
const T = {
  gold: "#F5F5F5", green: "#5FB88A", bg: "#050816", card: "#0B1020",
  border: "rgba(245,245,245,0.12)", text: "#FFFFFF", muted: "#9AA3AF",
};

// ── Mini Bar Chart ─────────────────────────────────────────────
function BarChart({ data, label, color }: { data: number[]; label: string; color: string }) {
  const max = Math.max(...data, 1);
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return (
    <div>
      <p style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
        {data.map((val, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: "100%", height: `${(val / max) * 72}px`,
              background: val > 0 ? color : "rgba(255,255,255,0.06)",
              borderRadius: "4px 4px 0 0",
              minHeight: 4,
              transition: "height 0.5s ease",
            }} />
            <span style={{ fontSize: 9, color: "#444" }}>{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: any) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: "20px",
    }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || T.gold, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted }}>{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading]   = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [credits, setCredits]   = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [weekData, setWeekData] = useState({
    generations: [0,0,0,0,0,0,0],
    credits: [0,0,0,0,0,0,0],
  });

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth/login"); return; }

    const uid = session.user.id;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: projs },
      { data: prof },
      { data: tx },
    ] = await Promise.all([
      supabase.from("projects").select("id, title, created_at, status, updated_at").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("profiles").select("total_credits, used_credits, plan, credits_reset_date").eq("id", uid).single(),
      supabase.from("credit_transactions").select("*").eq("user_id", uid).gte("created_at", weekAgo).order("created_at", { ascending: true }),
    ]);

    setProjects(projs || []);
    setCredits(prof);
    setTransactions(tx || []);

    // Build week data
    const gens  = [0,0,0,0,0,0,0];
    const creds = [0,0,0,0,0,0,0];

    (tx || []).forEach((t: any) => {
      const day = new Date(t.created_at).getDay();
      const idx = day === 0 ? 6 : day - 1; // Mon=0
      if (t.type === "usage") gens[idx]++;
      creds[idx] += Math.abs(t.amount || 0);
    });

    setWeekData({ generations: gens, credits: creds });
    setLoading(false);
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, color: T.gold }}>
        Loading Analytics...
      </div>
    );
  }

  const remaining = (credits?.total_credits || 100) - (credits?.used_credits || 0);
  const totalGens = weekData.generations.reduce((a, b) => a + b, 0);
  const totalCreditsUsed = weekData.credits.reduce((a, b) => a + b, 0);
  const completedProjects = projects.filter(p => p.status === "completed").length;
  const thisWeekProjects = projects.filter(p =>
    new Date(p.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  return (
    <>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1} }
      `}</style>

      <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Header ── */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${T.border}`,
          background: "rgba(8,8,8,0.9)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 50,
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📊 Analytics</h1>
            <p style={{ fontSize: 12, color: T.muted, margin: "2px 0 0" }}>Your activity overview</p>
          </div>
          <button onClick={() => router.push("/create")} style={{
            padding: "8px 18px", background: G, border: "none",
            borderRadius: 9, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>+ New Project</button>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>

          {/* ── STATS GRID ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 14, marginBottom: 28,
          }}>
            <StatCard icon="📁" label="Total Projects" value={projects.length} sub="All time" color={T.gold} />
            <StatCard icon="✅" label="Completed" value={completedProjects} sub="Successfully built" color={T.green} />
            <StatCard icon="📅" label="This Week" value={thisWeekProjects} sub="New projects" color="#D9D9D9" />
            <StatCard icon="⚡" label="Generations" value={totalGens} sub="This week" color={T.gold} />
            <StatCard icon="💳" label="Credits Left" value={remaining} sub={`of ${credits?.total_credits || 100} total`} color={remaining > 20 ? T.green : "#E5736B"} />
            <StatCard icon="📈" label="Credits Used" value={totalCreditsUsed} sub="This week" color={T.muted} />
          </div>

          {/* ── CHARTS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>

            {/* Generations Chart */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>⚡ Generations</p>
                <span style={{ fontSize: 11, color: T.muted }}>This week</span>
              </div>
              <BarChart data={weekData.generations} label="Daily generation count" color={T.gold} />
            </div>

            {/* Credits Chart */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>💳 Credits Used</p>
                <span style={{ fontSize: 11, color: T.muted }}>This week</span>
              </div>
              <BarChart data={weekData.credits} label="Daily credit consumption" color={T.green} />
            </div>
          </div>

          {/* ── CREDITS BREAKDOWN ── */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>💳 Credits Overview</p>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 12, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.max(5, ((credits?.used_credits || 0) / (credits?.total_credits || 100)) * 100)}%`,
                  background: remaining > 30 ? G : "linear-gradient(90deg,#E5736B,#D9D9D9)",
                  borderRadius: 6, transition: "width 0.5s",
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: remaining > 20 ? T.green : "#E5736B", flexShrink: 0 }}>
                {remaining} left
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { label: "Plan",      value: credits?.plan?.charAt(0).toUpperCase() + credits?.plan?.slice(1) || "Free", color: T.gold },
                { label: "Used",      value: credits?.used_credits || 0, color: "#E5736B" },
                { label: "Resets",    value: credits?.credits_reset_date ? new Date(credits.credits_reset_date).toLocaleDateString() : "N/A", color: T.muted },
              ].map(stat => (
                <div key={stat.label} style={{ background: "#0B1020", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <button onClick={() => router.push("/settings?tab=billing")} style={{
              marginTop: 14, padding: "8px 18px", background: G, border: "none",
              borderRadius: 8, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              Upgrade Plan →
            </button>
          </div>

          {/* ── PROJECT LIST ── */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📁 Recent Projects</p>
              <button onClick={() => router.push("/dashboard")} style={{
                padding: "5px 12px", background: "none", border: `1px solid ${T.border}`,
                borderRadius: 7, color: T.muted, fontSize: 12, cursor: "pointer",
              }}>View All →</button>
            </div>

            {projects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#444" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <p style={{ fontSize: 13 }}>No projects yet</p>
              </div>
            ) : (
              projects.slice(0, 8).map((p, i) => (
                <div key={p.id} onClick={() => router.push(`/create?id=${p.id}`)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                    background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "none",
                    transition: "background 0.15s",
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#0B1020"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "rgba(255,255,255,0.02)" : "none"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "linear-gradient(135deg,rgba(245,245,245,0.2),rgba(95,184,138,0.1))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, flexShrink: 0,
                    }}>📄</div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: T.text }}>{p.title || "Untitled"}</p>
                      <p style={{ fontSize: 10, color: "#444", margin: "1px 0 0" }}>{timeAgo(p.created_at)}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                      background: p.status === "completed" ? "rgba(95,184,138,0.1)" : "rgba(136,136,136,0.1)",
                      color: p.status === "completed" ? T.green : "#888",
                    }}>
                      {p.status === "completed" ? "✅" : "📝"} {p.status || "draft"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── ACTIVITY FEED ── */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>⚡ Recent Activity</p>

            {transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#444" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <p style={{ fontSize: 13 }}>No activity this week</p>
              </div>
            ) : (
              [...transactions].reverse().slice(0, 10).map((tx, i) => (
                <div key={tx.id || i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 0", borderBottom: i < 9 ? `1px solid rgba(255,255,255,0.04)` : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>
                      {tx.amount > 0 ? "💳" : tx.type === "usage" ? "⚡" : "🔧"}
                    </span>
                    <div>
                      <p style={{ fontSize: 13, margin: 0, color: T.text }}>{tx.description || "Transaction"}</p>
                      <p style={{ fontSize: 10, color: "#444", margin: "2px 0 0" }}>{timeAgo(tx.created_at)}</p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: tx.amount > 0 ? T.green : "#E5736B",
                  }}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount} cr
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
                  
