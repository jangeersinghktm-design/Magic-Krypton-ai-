"use client";

import { useState } from "react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────
interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  icon: string;
  gradient: string;
  demoPrompt: string;
  demoResponse: string;
  popular?: boolean;
}

// ── Template Data ──────────────────────────────────────────────────────────
const templates: Template[] = [
  {
    id: "ai-chatbot",
    name: "AI Customer Support Bot",
    category: "chatbot",
    description: "Intelligent chatbot for 24/7 customer support with context-awareness.",
    tags: ["NLP", "Support", "Automation"],
    icon: "💬",
    gradient: "linear-gradient(135deg,#F5F5F5,#D9D9D9)",
    demoPrompt: "How do I reset my password?",
    demoResponse: "Sure! To reset your password:\n1. Click 'Forgot Password' on the login page.\n2. Enter your registered email.\n3. Check your inbox for the reset link.\n4. Set a new strong password.\n\nLet me know if you need further help! 😊",
    popular: true,
  },
  {
    id: "seo-writer",
    name: "SEO Content Writer",
    category: "content",
    description: "Generate SEO-optimized blog posts, meta descriptions, and landing copy.",
    tags: ["SEO", "Writing", "Marketing"],
    icon: "✍️",
    gradient: "linear-gradient(135deg,#5FB88A,#5FB88A)",
    demoPrompt: "Write a meta description for an AI SaaS tool.",
    demoResponse: "Supercharge your workflow with our AI-powered SaaS platform. Automate tasks, generate content, and analyze data — all in one place. Start free today and experience the future of productivity.",
    popular: true,
  },
  {
    id: "code-gen",
    name: "Code Generator",
    category: "code",
    description: "Generate, debug, and refactor code in 20+ programming languages.",
    tags: ["Python", "JS", "React", "API"],
    icon: "⚡",
    gradient: "linear-gradient(135deg,#BFC5CC,#5B21B6)",
    demoPrompt: "Create a React useLocalStorage hook.",
    demoResponse: "```tsx\nfunction useLocalStorage<T>(key: string, init: T) {\n  const [val, setVal] = useState<T>(() => {\n    try {\n      const item = localStorage.getItem(key);\n      return item ? JSON.parse(item) : init;\n    } catch { return init; }\n  });\n  const set = (v: T) => { setVal(v); localStorage.setItem(key, JSON.stringify(v)); };\n  return [val, set] as const;\n}\n```",
  },
  {
    id: "image-gen",
    name: "Image Generator",
    category: "image",
    description: "Generate stunning images from text prompts for any use case.",
    tags: ["DALL-E", "Stable Diffusion", "Creative"],
    icon: "🎨",
    gradient: "linear-gradient(135deg,#D9D9D9,#E5736B)",
    demoPrompt: "A futuristic city at night, neon lights, rain.",
    demoResponse: "🖼️ Generating image...\n\nPrompt optimized: 'Cyberpunk metropolis at night, neon-lit skyscrapers, rain-slicked streets, holographic billboards, cinematic composition, 8K, hyperrealistic'\n\n✅ Image ready — 1024×1024px",
  },
  {
    id: "email-writer",
    name: "Email Composer",
    category: "content",
    description: "Write professional cold emails, follow-ups, and newsletters.",
    tags: ["Sales", "Newsletter", "Outreach"],
    icon: "📧",
    gradient: "linear-gradient(135deg,#3B82F6,#1D4ED8)",
    demoPrompt: "Cold outreach for an AI SaaS product.",
    demoResponse: "Subject: Cut your content time by 80% with AI\n\nHi [Name],\n\nI noticed [Company] publishes content regularly — what if AI could do 80% of that work?\n\nKrypton AI helps teams like yours generate, optimize, and publish content 10x faster.\n\nWorth a 15-min call this week?\n\n— Jangeer",
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    category: "analytics",
    description: "Analyze datasets, generate insights, and create visual summaries.",
    tags: ["CSV", "Charts", "Insights"],
    icon: "📊",
    gradient: "linear-gradient(135deg,#5FB88A,#059669)",
    demoPrompt: "Analyze monthly revenue trend: 12k,14k,13k,17k,22k,28k",
    demoResponse: "📈 Revenue Analysis:\n• Growth Rate: +133% over 6 months\n• Best Month: Month 6 (+$6k / +27%)\n• Trend: Accelerating upward\n• Projection: ~$35k Month 7\n• Anomaly: Month 3 dip (-7%) — investigate marketing spend.",
    popular: true,
  },
];

const categories = ["all", "chatbot", "content", "code", "image", "analytics"];

// ── Preview Modal ──────────────────────────────────────────────────────────
function PreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoOutput, setDemoOutput] = useState("");
  const [typed, setTyped] = useState(0);

  const runDemo = () => {
    setDemoRunning(true);
    setDemoOutput("");
    setTyped(0);
    const text = template.demoResponse;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDemoOutput(text.slice(0, i));
      setTyped(i);
      if (i >= text.length) clearInterval(interval);
    }, 18);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      backdropFilter: "blur(8px)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background: "#0B1020", border: "1px solid rgba(245,245,245,0.2)",
        borderRadius: "20px", width: "100%", maxWidth: "680px",
        maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(245,245,245,0.05)",
      }}>
        {/* Header */}
        <div style={{
          padding: "24px 28px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: template.gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}>{template.icon}</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" }}>
                {template.name}
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
                {template.description}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: "none", color: "#888",
            width: 32, height: 32, borderRadius: 8, cursor: "pointer",
            fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        {/* Live Demo */}
        <div style={{ padding: "24px 28px" }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase",
            color: "#444", marginBottom: 12,
          }}>Live Demo Preview</div>

          {/* User message */}
          <div style={{
            background: "rgba(245,245,245,0.08)", border: "1px solid rgba(245,245,245,0.15)",
            borderRadius: "10px 10px 2px 10px", padding: "10px 14px",
            fontSize: 13.5, color: "#F5F5F5", marginBottom: 12, width: "fit-content",
            maxWidth: "80%", marginLeft: "auto",
          }}>
            {template.demoPrompt}
          </div>

          {/* AI response */}
          <div style={{
            background: "#111", border: "1px solid rgba(95,184,138,0.12)",
            borderRadius: "2px 10px 10px 10px", padding: "12px 16px",
            fontSize: 13, color: "#ccc", lineHeight: 1.7,
            minHeight: 80, whiteSpace: "pre-wrap", fontFamily: "monospace",
            position: "relative",
          }}>
            {demoOutput || (
              <span style={{ color: "#444", fontStyle: "italic", fontFamily: "sans-serif" }}>
                Click "Run Demo" to see a live preview ↓
              </span>
            )}
            {demoRunning && typed < template.demoResponse.length && (
              <span style={{
                display: "inline-block", width: 2, height: 14,
                background: "#5FB88A", animation: "blink 0.7s infinite",
                marginLeft: 2, verticalAlign: "middle",
              }} />
            )}
          </div>

          {/* Tags */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
            {template.tags.map((t) => (
              <span key={t} style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#888",
              }}>{t}</span>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={runDemo} style={{
              flex: 1, padding: "11px 0",
              background: "rgba(95,184,138,0.1)", border: "1px solid rgba(95,184,138,0.3)",
              borderRadius: 10, color: "#5FB88A", fontWeight: 600, fontSize: 13.5,
              cursor: "pointer", transition: "all 0.2s",
            }}>
              ▶ Run Demo
            </button>
            <Link href={`/create?template=${template.id}`} style={{
              flex: 1, padding: "11px 0",
              background: "linear-gradient(135deg,#F5F5F5,#5FB88A)",
              border: "none", borderRadius: 10,
              color: "#000", fontWeight: 700, fontSize: 13.5,
              cursor: "pointer", textDecoration: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              Use Template →
            </Link>
          </div>
        </div>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function TemplatesPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Template | null>(null);

  const filtered = templates.filter((t) => {
    const matchCat = activeCategory === "all" || t.category === activeCategory;
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #050816; color: #F5F5F5; font-family: 'DM Sans', sans-serif; }
        .tp-page { padding: 40px 48px; max-width: 1200px; }

        /* Header */
        .tp-header { margin-bottom: 36px; }
        .tp-label {
          font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;
          color: #F5F5F5; font-weight: 600; margin-bottom: 10px;
        }
        .tp-title { font-size: 36px; font-weight: 800; color: #fff; line-height: 1.15; }
        .tp-title span {
          background: linear-gradient(135deg,#F5F5F5,#5FB88A);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .tp-sub { font-size: 15px; color: #555; margin-top: 10px; }

        /* Search */
        .tp-search-wrap { position: relative; max-width: 380px; margin-top: 24px; }
        .tp-search {
          width: 100%; padding: 11px 16px 11px 40px;
          background: #0B1020; border: 1px solid rgba(245,245,245,0.18);
          border-radius: 10px; color: #F5F5F5; font-size: 14px; outline: none;
          transition: border-color 0.2s;
        }
        .tp-search:focus { border-color: rgba(245,245,245,0.45); }
        .tp-search-icon {
          position: absolute; left: 12px; top: 50%;
          transform: translateY(-50%); color: #555;
        }

        /* Filters */
        .tp-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 28px; }
        .tp-filter {
          padding: 7px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);
          background: transparent; color: #666; font-size: 12.5px; font-weight: 500;
          cursor: pointer; text-transform: capitalize; transition: all 0.18s;
        }
        .tp-filter:hover { background: rgba(245,245,245,0.07); color: #F5F5F5; }
        .tp-filter.active {
          background: rgba(245,245,245,0.12); color: #F5F5F5;
          border-color: rgba(245,245,245,0.3);
        }

        /* Grid */
        .tp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 18px;
        }

        /* Card */
        .tp-card {
          background: #0B1020; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; overflow: hidden;
          transition: all 0.22s ease; cursor: pointer; position: relative;
        }
        .tp-card:hover {
          border-color: rgba(245,245,245,0.25);
          transform: translateY(-2px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .tp-card-banner {
          height: 100px; display: flex; align-items: center; justify-content: center;
          font-size: 40px; position: relative;
        }
        .tp-popular {
          position: absolute; top: 10px; right: 10px;
          background: rgba(245,245,245,0.9); color: #000;
          font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 5px;
          letter-spacing: 0.5px;
        }
        .tp-card-body { padding: 18px 20px 20px; }
        .tp-card-name { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 6px; }
        .tp-card-desc { font-size: 12.5px; color: #666; line-height: 1.6; margin-bottom: 14px; }
        .tp-card-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 16px; }
        .tp-tag {
          font-size: 10.5px; color: #555; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 5px;
        }
        .tp-card-actions { display: flex; gap: 8px; }
        .tp-btn-demo {
          flex: 1; padding: 9px 0; border: 1px solid rgba(95,184,138,0.3);
          background: rgba(95,184,138,0.07); color: #5FB88A; border-radius: 8px;
          font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.18s;
        }
        .tp-btn-demo:hover { background: rgba(95,184,138,0.15); }
        .tp-btn-use {
          flex: 1; padding: 9px 0;
          background: linear-gradient(135deg,#F5F5F5,#5FB88A);
          border: none; border-radius: 8px;
          color: #000; font-size: 12.5px; font-weight: 700; cursor: pointer;
          text-decoration: none; display: flex; align-items: center; justify-content: center;
          transition: opacity 0.18s;
        }
        .tp-btn-use:hover { opacity: 0.88; }
      `}</style>

      <main className="tp-page">
        {/* Header */}
        <div className="tp-header">
          <div className="tp-label">⚡ Krypton AI</div>
          <h1 className="tp-title">
            Ready-Made <span>AI Templates</span>
          </h1>
          <p className="tp-sub">
            Pick a template, run a live demo, then launch in seconds.
          </p>
          <div className="tp-search-wrap">
            <span className="tp-search-icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input
              className="tp-search"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="tp-filters">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`tp-filter ${activeCategory === cat ? "active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat === "all" ? "🌐 All" : cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="tp-grid">
          {filtered.map((t) => (
            <div key={t.id} className="tp-card">
              <div className="tp-card-banner" style={{ background: t.gradient }}>
                <span>{t.icon}</span>
                {t.popular && <span className="tp-popular">🔥 Popular</span>}
              </div>
              <div className="tp-card-body">
                <div className="tp-card-name">{t.name}</div>
                <div className="tp-card-desc">{t.description}</div>
                <div className="tp-card-tags">
                  {t.tags.map((tag) => (
                    <span key={tag} className="tp-tag">{tag}</span>
                  ))}
                </div>
                <div className="tp-card-actions">
                  <button className="tp-btn-demo" onClick={() => setPreview(t)}>
                    ▶ Demo
                  </button>
                  <Link href={`/create?template=${t.id}`} className="tp-btn-use">
                    Use →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Preview Modal */}
      {preview && <PreviewModal template={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
