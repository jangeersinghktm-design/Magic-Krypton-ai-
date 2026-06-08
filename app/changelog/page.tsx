// app/changelog/page.tsx

export default function ChangelogPage() {
  const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
  const T = {
    gold: "#F5D800", green: "#00CC44",
    border: "rgba(245,197,66,0.12)", muted: "#6B7280",
  };

  const changes = [
    {
      version: "v2.0.0",
      date: "June 2026",
      badge: "🎉 Major",
      items: [
        "AI Project Manager — Generate full roadmaps, DB schemas, API docs",
        "Screenshot to App — Upload any UI and rebuild it with AI",
        "Team Workspace — Collaborate with your team",
        "Community Showcase — Share and discover projects",
        "Templates Marketplace — 22+ professional templates",
        "GitHub Integration — Push projects to GitHub repos",
        "Referral System — Invite friends, earn credits",
        "Onboarding Flow — Step-by-step welcome guide",
      ],
    },
    {
      version: "v1.5.0",
      date: "May 2026",
      badge: "⚡ Features",
      items: [
        "Analytics Center — Code, SEO and Performance analysis",
        "Notification Bell — Real-time in-app notifications",
        "Email Notifications — Powered by Resend",
        "Deploy System — One-click deploy",
        "Public Share URLs — Share projects publicly",
        "Theme System — Dark/Light/System mode",
      ],
    },
    {
      version: "v1.0.0",
      date: "April 2026",
      badge: "🚀 Launch",
      items: [
        "AI Generation — Websites, Apps, Games, Tools",
        "Live Preview — Desktop/Tablet/Mobile switcher",
        "Version History — Auto-save and restore",
        "Export Center — HTML, ZIP, Copy code",
        "Razorpay Payments — INR payment support",
        "Credits System — Usage tracking",
        "Supabase Auth — Secure authentication",
      ],
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'DM Sans', sans-serif", padding: "60px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h1 style={{ fontSize: 40, fontWeight: 900, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 12 }}>
            Changelog
          </h1>
          <p style={{ color: T.muted, fontSize: 15 }}>All updates and improvements to Krypton AI</p>
        </div>

        {/* Releases */}
        {changes.map((release, i) => (
          <div key={release.version} style={{ display: "flex", gap: 24, marginBottom: 48 }}>

            {/* Timeline */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: G, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#000",
              }}>
                {i + 1}
              </div>
              {i < changes.length - 1 && (
                <div style={{ width: 2, flex: 1, background: "rgba(245,197,66,0.15)", marginTop: 8 }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{release.version}</h2>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 10px",
                  background: "rgba(245,197,66,0.1)", color: T.gold,
                  borderRadius: 20, border: "1px solid rgba(245,197,66,0.2)",
                }}>
                  {release.badge}
                </span>
                <span style={{ fontSize: 12, color: "#444" }}>{release.date}</span>
              </div>

              <div style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
                {release.items.map((item, j) => (
                  <p key={j} style={{ fontSize: 13, color: T.muted, margin: "0 0 8px", lineHeight: 1.6, display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ color: T.green, flexShrink: 0 }}>✅</span>
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="/docs" style={{
            display: "inline-block", padding: "12px 28px",
            background: G, borderRadius: 10, color: "#000",
            fontWeight: 700, fontSize: 14, textDecoration: "none",
          }}>
            View Documentation →
          </a>
        </div>
      </div>
    </div>
  );
}
