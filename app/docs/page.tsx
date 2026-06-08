// app/docs/page.tsx
export default function DocsPage() {
  const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
  const T = { gold: "#F5D800", green: "#00CC44", border: "rgba(245,197,66,0.12)", muted: "#6B7280" };

  const sections = [
    {
      title: "Getting Started",
      icon: "🚀",
      items: [
        { title: "Create an Account", desc: "Sign up for free and get 100 credits instantly. No credit card required." },
        { title: "Generate Your First Project", desc: "Type a description like 'Build a snake game' and hit generate. Done in seconds!" },
        { title: "Understanding Credits", desc: "Each generation costs 5 credits. Free plan gives 100 credits. Upgrade for more." },
      ]
    },
    {
      title: "Creating Projects",
      icon: "⚡",
      items: [
        { title: "Writing Good Prompts", desc: "Be specific! Instead of 'make a website', try 'Build a dark-theme SaaS landing page with pricing tables and testimonials'." },
        { title: "Project Types", desc: "Krypton AI supports Websites, Web Apps, Games, Tools, and Dashboards. Specify the type for better results." },
        { title: "AI Edit Mode", desc: "After generating, you can edit your project using AI. Type changes like 'make the header bigger' or 'add dark mode'." },
      ]
    },
    {
      title: "Exporting & Deploying",
      icon: "📤",
      items: [
        { title: "Download HTML", desc: "Download your project as a single self-contained HTML file. Works in any browser." },
        { title: "GitHub Push", desc: "Connect your GitHub account and push projects directly to repositories." },
        { title: "Deploy", desc: "One-click deploy to create a live URL for your project." },
        { title: "Share", desc: "Generate a public share link to show your project to others." },
      ]
    },
    {
      title: "Credits & Plans",
      icon: "💳",
      items: [
        { title: "Free Plan", desc: "100 credits/day. Perfect for trying out Krypton AI." },
        { title: "Pro Plan ($25/mo)", desc: "2000 credits/month. Save projects, version history, faster generation." },
        { title: "Premium Plan ($69/mo)", desc: "5000 credits/month. Unlimited saves, team collaboration (5 users)." },
        { title: "Business Plan ($149/mo)", desc: "10000 credits/day. API access, unlimited team, white label support." },
      ]
    },
    {
      title: "Advanced Features",
      icon: "🛠",
      items: [
        { title: "Screenshot to App", desc: "Upload any UI screenshot and Krypton AI will recreate it as code. Costs 15 credits." },
        { title: "Voice Input", desc: "Use voice commands to describe your project. Works in modern browsers." },
        { title: "AI Project Manager", desc: "Get a complete project roadmap, DB schema, API docs, and multiple screens from one prompt." },
        { title: "Templates", desc: "Start from 22+ professional templates across websites, apps, games and tools." },
      ]
    },
    {
      title: "Team Features",
      icon: "👥",
      items: [
        { title: "Create a Team", desc: "Go to /team and create your workspace. Invite unlimited members." },
        { title: "Roles", desc: "Admin: full access. Editor: create & edit. Viewer: read only." },
        { title: "Shared Projects", desc: "Share any project with your team for collaboration." },
        { title: "Activity Logs", desc: "Track all team activity in real-time." },
      ]
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ padding: "60px 24px 40px", textAlign: "center", background: "linear-gradient(180deg,rgba(245,197,66,0.06) 0%,transparent 100%)", borderBottom: `1px solid ${T.border}`, marginBottom: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
        <h1 style={{ fontSize: 40, fontWeight: 900, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 12 }}>Documentation</h1>
        <p style={{ color: T.muted, fontSize: 16, maxWidth: 500, margin: "0 auto" }}>Everything you need to know about building with Krypton AI</p>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 60px" }}>
        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <span>{section.icon}</span>
              <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{section.title}</span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {section.items.map(item => (
                <div key={item.title} style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.gold, flexShrink: 0, marginTop: 6 }} />
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{item.title}</h3>
                    <p style={{ fontSize: 13, color: T.muted, margin: 0, lineHeight: 1.7 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ background: "rgba(245,197,66,0.04)", border: `1px solid ${T.border}`, borderRadius: 18, padding: "32px", textAlign: "center" }}>
          <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Need More Help?</h3>
          <p style={{ color: T.muted, fontSize: 14, marginBottom: 20 }}>Our support team is ready to help you!</p>
          <a href="/contact" style={{ display: "inline-block", padding: "12px 28px", background: G, borderRadius: 10, color: "#000", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            Contact Support →
          </a>
        </div>
      </div>
    </div>
  );
}

