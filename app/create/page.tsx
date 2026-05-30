"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// =============================================
// MAIN PAGE — Login check karke route karta hai
// =============================================
export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#06060A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "24px", height: "24px", border: "2px solid #FFC107", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return user ? <Dashboard user={user} /> : <Landing />;
}

// =============================================
// LANDING PAGE — Login se pehle
// =============================================
function Landing() {
  const router = useRouter();

  const FEATURES = [
    { emoji: "🌐", title: "Website Builder", subtitle: "Describe idea → get full website", badge: "Most Popular", badgeColor: "#FFC107", route: "/create" },
    { emoji: "🎮", title: "Game/App Builder", subtitle: "Build playable games & interactive apps", badge: "New", badgeColor: "#f97316", route: "/create" },
    { emoji: "✨", title: "AI Image Studio", subtitle: "Generate stunning AI images instantly", badge: "Stability AI", badgeColor: "#a855f7", route: "/create" },
    { emoji: "📊", title: "Website Analysis", subtitle: "Deep AI analysis of any website", badge: "Insights", badgeColor: "#14b8a6", route: "/create" },
    { emoji: "🧠", title: "AI Plan Builder", subtitle: "Ask anything — get a detailed plan", badge: "GPT + Claude", badgeColor: "#6366f1", route: "/create" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#06060A", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflowX: "hidden" }}>

      {/* Cinematic Background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% -10%, #1a1408 0%, #06060A 55%, #000000 100%)" }} />
        <div style={{ position: "absolute", top: "-160px", left: "-160px", width: "720px", height: "720px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(255,193,7,0.22), transparent 70%)", filter: "blur(60px)", animation: "floatSlow 14s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "20%", right: "-160px", width: "640px", height: "640px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(0,255,149,0.16), transparent 70%)", filter: "blur(60px)", animation: "float 9s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.15, backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      {/* Navbar */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(20px)", background: "rgba(6,6,10,0.7)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg, #FFC107, #ff8c00)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", boxShadow: "0 0 20px rgba(255,193,7,0.4)" }}>⚡</div>
            <span style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "-0.02em" }}>Krypton AI</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => router.push("/auth/login")} style={{ padding: "8px 16px", background: "transparent", border: "none", color: "#d1d5db", cursor: "pointer", fontSize: "14px" }}>
              Sign in
            </button>
            <button onClick={() => router.push("/auth/signup")} style={{ padding: "8px 20px", background: "#FFC107", color: "#000", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer", fontSize: "14px", boxShadow: "0 0 28px rgba(255,193,7,0.35)" }}>
              Start Free
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: "1280px", margin: "0 auto", padding: "140px 24px 100px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "100px", border: "1px solid rgba(255,193,7,0.3)", background: "rgba(255,193,7,0.06)", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#FFC107", marginBottom: "32px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00FF95", boxShadow: "0 0 8px #00FF95", animation: "pulse 1.6s ease-in-out infinite", display: "inline-block" }} />
          Krypton OS · Online · Claude AI
        </div>

        <h1 style={{ fontSize: "clamp(44px, 8vw, 100px)", fontWeight: "600", lineHeight: "0.95", letterSpacing: "-0.045em", marginBottom: "28px" }}>
          Describe your idea.
          <br />
          <span style={{ background: "linear-gradient(135deg, #FFC107 0%, #00FF95 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Krypton builds it.
          </span>
        </h1>

        <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: "#9ca3af", maxWidth: "640px", margin: "0 auto 40px", lineHeight: "1.6" }}>
          Build websites, apps, AI tools, games, and dashboards with world-class AI — cinematic design, production-ready code, instant preview.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "40px" }}>
          <button onClick={() => router.push("/auth/signup")} style={{ padding: "14px 28px", background: "#FFC107", color: "#000", border: "none", borderRadius: "12px", fontWeight: "700", fontSize: "15px", cursor: "pointer", boxShadow: "0 0 60px rgba(255,193,7,0.35)" }}>
            Start Building Free →
          </button>
          <button onClick={() => router.push("/auth/login")} style={{ padding: "14px 28px", background: "transparent", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "15px", cursor: "pointer" }}>
            Sign In
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", justifyContent: "center", gap: "24px", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "#6b7280" }}>
          {["✓ No credit card", "✓ Deploy in 10s", "✓ Claude · GPT · Gemini"].map((t) => <span key={t}>{t}</span>)}
        </div>
      </section>

      {/* Features Section */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: "1280px", margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase" as const, color: "#FFC107", fontWeight: "600", marginBottom: "16px" }}>What can you build</div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "600", letterSpacing: "-0.03em" }}>Everything you need to ship fast.</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {FEATURES.map((f) => (
            <div key={f.title} onClick={() => router.push("/auth/signup")} style={{
              position: "relative",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "20px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.border = `1px solid ${f.badgeColor}40`;
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${f.badgeColor}30`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              <span style={{ position: "absolute", top: "12px", right: "12px", fontSize: "9px", fontWeight: "600", padding: "3px 8px", borderRadius: "100px", color: f.badgeColor, border: `1px solid ${f.badgeColor}55`, background: `${f.badgeColor}1a` }}>
                {f.badge}
              </span>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", background: `${f.badgeColor}26`, boxShadow: `0 0 18px ${f.badgeColor}33`, marginBottom: "16px" }}>
                {f.emoji}
              </div>
              <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "6px" }}>{f.title}</div>
              <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.5" }}>{f.subtitle}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: "1280px", margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase" as const, color: "#FFC107", fontWeight: "600", marginBottom: "16px" }}>Loved by builders</div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "600", letterSpacing: "-0.03em" }}>People who shipped with Krypton.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          {[
            { name: "Maya Patel", role: "Founder, Nebula", color: "#a78bfa", quote: "Krypton replaced an entire design + dev sprint. It feels less like a tool and more like a co-founder." },
            { name: "Jordan Reyes", role: "Indie hacker", color: "#FFC107", quote: "I shipped a real product on a flight. Krypton is the closest thing to magic I've used in years." },
            { name: "Aisha Karim", role: "Design lead, Helix", color: "#00FF95", quote: "The output is genuinely premium. Typography, motion, hierarchy — all considered. Wild." },
          ].map((t) => (
            <div key={t.name} style={{ borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>{[0,1,2,3,4].map((i) => <span key={i} style={{ color: "#FFC107" }}>★</span>)}</div>
              <p style={{ fontSize: "14px", color: "#e5e7eb", lineHeight: "1.6", marginBottom: "20px" }}>"{t.quote}"</p>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: `linear-gradient(135deg, ${t.color}, #1a1a1a)` }} />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>{t.name}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: "960px", margin: "0 auto", padding: "0 24px 128px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(32px, 5vw, 60px)", fontWeight: "600", letterSpacing: "-0.035em", background: "linear-gradient(135deg, #FFC107, #00FF95)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block", marginBottom: "24px" }}>
          The future of building is a sentence away.
        </h2>
        <p style={{ color: "#9ca3af", maxWidth: "480px", margin: "0 auto 40px", lineHeight: "1.6" }}>
          Join thousands of founders, designers, and engineers shipping at impossible speed.
        </p>
        <button onClick={() => router.push("/auth/signup")} style={{ padding: "16px 32px", background: "#FFC107", color: "#000", border: "none", borderRadius: "12px", fontWeight: "700", fontSize: "16px", cursor: "pointer", boxShadow: "0 0 60px rgba(255,193,7,0.35)" }}>
          Start Free — No credit card required →
        </button>
      </section>

      {/* Footer */}
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(6,6,10,0.8)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "40px 24px", display: "flex", flexWrap: "wrap" as const, alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #FFC107, #ff8c00)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>⚡</div>
            <span style={{ fontSize: "16px", fontWeight: "700" }}>Krypton AI</span>
          </div>
          <p style={{ fontSize: "12px", color: "#4b5563" }}>© {new Date().getFullYear()} Krypton AI — Describe your idea. Krypton builds it.</p>
        </div>
      </footer>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
        @keyframes floatSlow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-30px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  );
}

// =============================================
// DASHBOARD — Login ke baad
// =============================================
function Dashboard({ user }: { user: any }) {
  const router = useRouter();
  const supabase = createClient();

  const FEATURES = [
    { emoji: "🌐", title: "Website Builder", subtitle: "Describe idea → get full website", badge: "Most Popular", badgeColor: "#FFC107", route: "/create" },
    { emoji: "🎮", title: "Game/App Builder", subtitle: "Build playable games & interactive apps", badge: "New", badgeColor: "#f97316", route: "/create" },
    { emoji: "✨", title: "AI Image Studio", subtitle: "Generate stunning AI images instantly", badge: "Stability AI", badgeColor: "#a855f7", route: "/create" },
    { emoji: "📊", title: "Website Analysis", subtitle: "Deep AI analysis of any website", badge: "Insights", badgeColor: "#14b8a6", route: "/create" },
    { emoji: "🧠", title: "AI Plan Builder", subtitle: "Ask anything — get a detailed plan", badge: "GPT + Claude", badgeColor: "#6366f1", route: "/create" },
  ];

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const name = user?.email?.split("@")[0] || "there";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#06060A", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Cinematic Background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% -10%, #1a1408 0%, #06060A 50%, #000000 100%)" }} />
        <div style={{ position: "absolute", top: "-160px", left: "-160px", width: "520px", height: "520px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(255,193,7,0.12), transparent 70%)", filter: "blur(60px)", animation: "floatSlow 14s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "30%", right: "-160px", width: "480px", height: "480px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(0,255,149,0.08), transparent 70%)", filter: "blur(60px)", animation: "float 9s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      {/* Top Navbar */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(6,6,10,0.8)", backdropFilter: "blur(20px)" }}>
        <div style={{ padding: "0 16px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #FFC107, #ff8c00)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", boxShadow: "0 0 16px rgba(255,193,7,0.35)" }}>⚡</div>
            <span style={{ fontSize: "15px", fontWeight: "700", color: "#FFC107" }}>Krypton AI</span>
          </div>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => router.push("/create")}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "#FFC107", color: "#000", border: "none", borderRadius: "100px", fontWeight: "700", fontSize: "12px", padding: "6px 14px", cursor: "pointer", boxShadow: "0 0 18px rgba(255,193,7,0.28)" }}
            >
              + New Project
            </button>
            <button
              onClick={handleLogout}
              style={{ padding: "6px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#9ca3af", cursor: "pointer", fontSize: "12px" }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: "flex" }}>

        {/* Sidebar */}
        <aside style={{ width: "220px", flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.05)", minHeight: "calc(100vh - 56px)", padding: "12px", display: "flex", flexDirection: "column", gap: "4px", position: "relative", zIndex: 1 }}>
          {[
            { icon: "🏠", label: "Home", route: "/"
