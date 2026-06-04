"use client";

import { useRouter } from "next/navigation";

const G = "linear-gradient(135deg, #F5C542 0%, #00D084 100%)";
const T = {
  gold: "#F5C542", green: "#00D084", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", sub: "#B3B3B3", muted: "#6B7280",
};

const TEMPLATES = [
  { title: "SaaS Landing Page", desc: "Modern landing page for software products", category: "Website", prompt: "Build a modern SaaS landing page with hero, features, pricing and CTA sections" },
  { title: "Portfolio Website", desc: "Personal portfolio for designers & developers", category: "Website", prompt: "Build a personal portfolio website with about, projects, skills and contact sections" },
  { title: "Restaurant Website", desc: "Food menu and reservation system", category: "Website", prompt: "Build a restaurant website with menu, gallery, about and reservation sections" },
  { title: "Snake Game", desc: "Classic snake game in the browser", category: "Game", prompt: "Build a snake game with score tracking and game over screen" },
  { title: "2048 Game", desc: "Number puzzle game", category: "Game", prompt: "Build a 2048 puzzle game with animations and score tracking" },
  { title: "Memory Card Game", desc: "Card matching memory game", category: "Game", prompt: "Build a memory card matching game with timer and difficulty levels" },
  { title: "CRM Dashboard", desc: "Customer relationship management tool", category: "App", prompt: "Build a CRM dashboard with customer list, pipeline and analytics" },
  { title: "Invoice Generator", desc: "Create and download invoices", category: "App", prompt: "Build an invoice generator with client details, items list and PDF download" },
  { title: "Expense Tracker", desc: "Track income and expenses", category: "App", prompt: "Build an expense tracker with categories, charts and monthly summary" },
  { title: "BMI Calculator", desc: "Health and fitness calculator", category: "Tool", prompt: "Build a BMI calculator with health tips and weight range chart" },
  { title: "Password Generator", desc: "Secure password generator", category: "Tool", prompt: "Build a password generator with strength meter and copy to clipboard" },
  { title: "Unit Converter", desc: "Convert units of measurement", category: "Tool", prompt: "Build a unit converter for length, weight, temperature and currency" },
];

const CATEGORIES = ["All", "Website", "App", "Game", "Tool"];

export default function TemplatesPage() {
  const router = useRouter();
  const [selected, setSelected] = (require("react") as any).useState("All");

  const filtered = selected === "All" ? TEMPLATES : TEMPLATES.filter(t => t.category === selected);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif", padding: "40px 20px", position: "relative" }}>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50vw", height: "50vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(245,197,66,0.2) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "45vw", height: "45vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle, rgba(0,208,132,0.15) 0%, transparent 70%)" }} />
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "2rem" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.muted, padding: "8px 14px", cursor: "pointer", fontSize: "14px" }}>
            ← Back
          </button>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "24px", fontWeight: 800, margin: 0, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Templates</h1>
            <p style={{ color: T.muted, fontSize: "13px", margin: 0 }}>Start from a ready-made design</p>
          </div>
        </div>

        {/* Category Filter */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "2rem", flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setSelected(cat)} style={{ padding: "8px 18px", background: selected === cat ? G : "#141414", border: `1px solid ${selected === cat ? "transparent" : T.border}`, borderRadius: "20px", color: selected === cat ? "#050505" : T.muted, fontSize: "13px", fontWeight: selected === cat ? 700 : 400, cursor: "pointer", transition: "all 0.2s" }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {filtered.map((template) => (
            <div key={template.title} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", transition: "all 0.3s", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(245,197,66,0.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", background: "rgba(245,197,66,0.1)", border: `1px solid ${T.border}`, borderRadius: "20px", color: T.gold }}>
                  {template.category}
                </span>
              </div>

              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "8px", background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {template.title}
              </h3>
              <p style={{ color: T.sub, fontSize: "13px", lineHeight: 1.6, marginBottom: "20px" }}>{template.desc}</p>

              <button onClick={() => router.push(`/create?prompt=${encodeURIComponent(template.prompt)}&type=${template.category}`)} style={{ width: "100%", padding: "10px", background: G, border: "none", borderRadius: "10px", color: "#050505", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                Use Template →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
