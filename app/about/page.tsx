// app/about/page.tsx
export default function AboutPage() {
  const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
  const T = { gold: "#F5D800", green: "#00CC44", border: "rgba(245,197,66,0.12)", muted: "#6B7280" };

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Hero */}
      <div style={{ padding: "80px 24px 60px", textAlign: "center", background: "linear-gradient(180deg,rgba(245,197,66,0.06) 0%,transparent 100%)", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>⚡</div>
        <h1 style={{ fontSize: "clamp(28px,6vw,52px)", fontWeight: 900, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 16 }}>
          About Krypton AI
        </h1>
        <p style={{ color: T.muted, fontSize: 18, maxWidth: 600, margin: "0 auto", lineHeight: 1.7 }}>
          We're on a mission to democratize software development — making it possible for anyone to build professional digital products with AI.
        </p>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px" }}>

        {/* Mission */}
        <div style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 20, padding: "40px", marginBottom: 32, textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Our Mission</h2>
          <p style={{ color: T.muted, fontSize: 16, lineHeight: 1.8, maxWidth: 600, margin: "0 auto" }}>
            "The future of building is a sentence away." We believe everyone should be able to create software — regardless of technical background. Krypton AI bridges the gap between ideas and reality.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 40 }}>
          {[
            { icon: "⚡", value: "Krypton Intelligence", label: "World-class AI Infrastructure" },
            { icon: "🌍", value: "Global", label: "Users worldwide" },
            { icon: "🚀", value: "Seconds", label: "To generate any app" },
            { icon: "💰", value: "Free", label: "To get started" },
          ].map(stat => (
            <div key={stat.label} style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 14, padding: "24px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.gold, marginBottom: 4 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: T.muted }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* What we build */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>What You Can Build</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {[
              { icon: "🌐", title: "Websites", desc: "Landing pages, portfolios, business sites" },
              { icon: "📱", title: "Web Apps", desc: "Dashboards, tools, SaaS products" },
              { icon: "🎮", title: "Games", desc: "Browser games, puzzles, arcade" },
              { icon: "🛠", title: "Tools", desc: "Utilities, converters, generators" },
            ].map(item => (
              <div key={item.title} style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 20, padding: "32px", marginBottom: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Built With</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {["Next.js 14", "TypeScript", "Supabase", "Krypton Intelligence", "Vercel", "Razorpay", "Resend"].map(tech => (
              <span key={tech} style={{ padding: "8px 16px", background: "rgba(245,197,66,0.08)", border: `1px solid ${T.border}`, borderRadius: 20, fontSize: 13, color: T.gold }}>
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Ready to Build?</h2>
          <p style={{ color: T.muted, fontSize: 15, marginBottom: 24 }}>Join thousands of builders using Krypton AI</p>
          <a href="/create" style={{ display: "inline-block", padding: "14px 36px", background: G, borderRadius: 12, color: "#000", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
            Start Building Free →
          </a>
        </div>
      </div>
    </div>
  );
}
