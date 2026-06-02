"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const HERO_PROMPTS = [
  "Build a SaaS dashboard...",
  "Create a portfolio website...",
  "Build a snake game...",
  "Create a CRM system...",
  "Build a landing page...",
  "Create a restaurant website...",
];

export default function LandingPage() {
  const router = useRouter();
  const [promptIndex, setPromptIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const target = HERO_PROMPTS[promptIndex];
    let i = 0;
    setDisplayed("");
    setIsTyping(true);
    const type = setInterval(() => {
      if (i < target.length) {
        setDisplayed(target.slice(0, i + 1));
        i++;
      } else {
        clearInterval(type);
        setIsTyping(false);
        setTimeout(() => {
          setPromptIndex((prev) => (prev + 1) % HERO_PROMPTS.length);
        }, 3000);
      }
    }, 50);
    return () => clearInterval(type);
  }, [promptIndex]);

  return (
    <div style={{ background: "#080808", color: "#fff", fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", overflowX: "hidden" }}>

      {/* NAVBAR */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, borderBottom: "1px solid #1c1c1c", background: "rgba(8,8,8,0.85)", backdropFilter: "blur(12px)", padding: "0 24px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Left - Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", background: "#FFC107", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L3 7v6l7 5 7-5V7L10 2z" fill="#080808" />
              <path d="M10 6l-4 3v2l4 3 4-3V9L10 6z" fill="#FFC107" opacity="0.8" />
            </svg>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "15px" }}>
              Krypton <span style={{ color: "#FFC107" }}>AI</span>
            </span>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowDropdown(!showDropdown)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "11px", padding: "2px 4px" }}>
                &#9660;
              </button>
              {showDropdown && (
                <div style={{ position: "absolute", top: "28px", left: 0, background: "#141414", border: "1px solid #1c1c1c", borderRadius: "12px", padding: "6px", minWidth: "160px", zIndex: 200 }}>
                  {["Changelog", "Documentation", "Roadmap", "Contact"].map((item) => (
                    <button key={item} style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: "#9ca3af", fontSize: "13px", cursor: "pointer", borderRadius: "8px" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#1c1c1c"; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#9ca3af"; }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center - Nav links (desktop only) */}
         <div style={{ display: typeof window !== "undefined" && window.innerWidth < 768 ? "none" : "flex", gap: "28px", position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
  {["Features", "Pricing", "Examples", "Roadmap"].map((item) => (
    <a key={item} href={`#${item.toLowerCase()}`} style={{ color: "#9ca3af", fontSize: "13px", textDecoration: "none", fontWeight: 500 }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
    >
      {item}
    </a>
  ))}
</div>

        {/* Right - CTA */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={() => router.push("/auth/login")} style={{ padding: "7px 16px", background: "none", border: "1px solid #1c1c1c", borderRadius: "9px", color: "#9ca3af", fontSize: "13px", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1c1c1c"; e.currentTarget.style.color = "#9ca3af"; }}
          >
            Login
          </button>
          <button onClick={() => router.push("/auth/signup")} style={{ padding: "7px 16px", background: "#FFC107", border: "none", borderRadius: "9px", color: "#080808", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px 60px", textAlign: "center", position: "relative" }}>
        {/* Glow */}
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: "600px", height: "400px", background: "radial-gradient(ellipse, rgba(255,193,7,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(255,193,7,0.08)", border: "1px solid rgba(255,193,7,0.2)", borderRadius: "20px", padding: "6px 14px", marginBottom: "2rem", fontSize: "12px", color: "#FFC107" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00FF95", display: "inline-block" }} />
          Powered by Claude AI · Now Live
        </div>

        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(36px, 7vw, 72px)", fontWeight: 800, lineHeight: 1.1, marginBottom: "1.5rem", maxWidth: "800px" }}>
          Build websites, apps<br />
          <span style={{ color: "#FFC107" }}>and games with AI.</span>
        </h1>

        <p style={{ color: "#9ca3af", fontSize: "clamp(15px, 2vw, 18px)", lineHeight: 1.7, maxWidth: "560px", marginBottom: "2.5rem" }}>
          Turn ideas into production-ready projects using natural language prompts.
        </p>

        {/* Animated prompt box */}
        <div style={{ width: "100%", maxWidth: "560px", background: "#101010", border: "1px solid #1c1c1c", borderRadius: "16px", padding: "20px", marginBottom: "2rem", textAlign: "left" }}>
          <div style={{ color: "#fff", fontSize: "15px", minHeight: "28px", fontFamily: "monospace" }}>
            {displayed}<span style={{ opacity: isTyping ? 1 : 0, transition: "opacity 0.1s" }}>|</span>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
            <button onClick={() => router.push("/auth/signup")} style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#FFC107", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M5 12l7-7 7 7" stroke="#080808" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => router.push("/auth/signup")} style={{ padding: "14px 28px", background: "#FFC107", border: "none", borderRadius: "12px", color: "#080808", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>
            Get Started Free →
          </button>
          <button onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "14px 28px", background: "none", border: "1px solid #1c1c1c", borderRadius: "12px", color: "#fff", fontSize: "15px", cursor: "pointer" }}>
            Watch Demo
          </button>
        </div>

        <p style={{ color: "#444", fontSize: "12px", marginTop: "1.5rem" }}>
          No credit card required · Free plan available
        </p>
      </section>

      {/* WHAT KRYPTON CAN BUILD */}
      <section id="features" style={{ padding: "80px 24px", maxWidth: "1100px", margin: "0 auto" }}>
        <p style={{ textAlign: "center", color: "#FFC107", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>What You Can Build</p>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "3rem" }}>
          Everything you need to ship fast.
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
          {[
            { icon: "🌐", title: "Websites", desc: "Landing pages, portfolios, business sites — pixel-perfect and responsive." },
            { icon: "📱", title: "Web Apps", desc: "Dashboards, CRM tools, productivity apps with full interactivity." },
            { icon: "🎮", title: "Browser Games", desc: "Snake, 2048, puzzle games — fully playable in the browser." },
            { icon: "📊", title: "Business Tools", desc: "Calculators, forms, trackers — tools that actually work." },
          ].map((card) => (
            <div key={card.title} style={{ background: "#101010", border: "1px solid #1c1c1c", borderRadius: "16px", padding: "28px 24px", transition: "border-color 0.2s, transform 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#FFC107"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1c1c1c"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ fontSize: "32px", marginBottom: "16px" }}>{card.icon}</div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>{card.title}</h3>
              <p style={{ color: "#9ca3af", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "80px 24px", background: "#0C0C0C", borderTop: "1px solid #1c1c1c", borderBottom: "1px solid #1c1c1c" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <p style={{ textAlign: "center", color: "#FFC107", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Simple Process</p>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "3rem" }}>
            How It Works
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "24px" }}>
            {[
              { step: "01", title: "Describe Your Idea", desc: "Type what you want to build in plain English. No technical knowledge needed." },
              { step: "02", title: "AI Generates Project", desc: "Krypton AI builds your project instantly — complete HTML, CSS, and JavaScript." },
              { step: "03", title: "Download & Launch", desc: "Preview live, download the code, or share directly. Ready to deploy." },
            ].map((item) => (
              <div key={item.step} style={{ position: "relative", padding: "28px", background: "#101010", border: "1px solid #1c1c1c", borderRadius: "16px" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "48px", fontWeight: 800, color: "rgba(255,193,7,0.1)", position: "absolute", top: "16px", right: "20px" }}>{item.step}</div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "10px" }}>{item.title}</h3>
                <p style={{ color: "#9ca3af", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXAMPLES */}
      <section id="examples" style={{ padding: "80px 24px", maxWidth: "1100px", margin: "0 auto" }}>
        <p style={{ textAlign: "center", color: "#FFC107", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Built With Krypton</p>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "3rem" }}>
          Examples Gallery
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
          {["SaaS Dashboard", "Restaurant Site", "Portfolio", "Calculator", "Snake Game", "CRM Tool"].map((item) => (
            <div key={item} style={{ background: "#101010", border: "1px solid #1c1c1c", borderRadius: "14px", padding: "32px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#FFC107"; e.currentTarget.style.background = "#141414"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1c1c1c"; e.currentTarget.style.background = "#101010"; }}
            >
              <p style={{ color: "#fff", fontWeight: 600, fontSize: "14px", margin: 0 }}>{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARISON */}
      <section style={{ padding: "80px 24px", background: "#0C0C0C", borderTop: "1px solid #1c1c1c", borderBottom: "1px solid #1c1c1c" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <p style={{ textAlign: "center", color: "#FFC107", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Why Krypton</p>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "3rem" }}>
            Why Krypton AI?
          </h2>
          <div style={{ background: "#101010", border: "1px solid #1c1c1c", borderRadius: "16px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#141414", padding: "14px 24px", borderBottom: "1px solid #1c1c1c" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#9ca3af" }}>Feature</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#FFC107", textAlign: "center" }}>Krypton AI</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#9ca3af", textAlign: "center" }}>Typical AI Builder</span>
            </div>
            {[
              ["Full HTML Output", "✅", "❌"],
              ["Browser Games", "✅", "❌"],
              ["Download Source Code", "✅", "❌"],
              ["Mobile Responsive", "✅", "⚠️"],
              ["Instant Preview", "✅", "⚠️"],
            ].map(([feature, us, them]) => (
              <div key={feature} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "14px 24px", borderBottom: "1px solid #1c1c1c" }}>
                <span style={{ fontSize: "13px", color: "#9ca3af" }}>{feature}</span>
                <span style={{ fontSize: "16px", textAlign: "center" }}>{us}</span>
                <span style={{ fontSize: "16px", textAlign: "center" }}>{them}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section id="roadmap" style={{ padding: "80px 24px", maxWidth: "900px", margin: "0 auto" }}>
        <p style={{ textAlign: "center", color: "#FFC107", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>What's Next</p>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "3rem" }}>
          Roadmap
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div style={{ background: "#101010", border: "1px solid #1c1c1c", borderRadius: "16px", padding: "28px" }}>
            <p style={{ color: "#00FF95", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>Live Now</p>
            {["Website Generator", "App Generator", "Game Generator", "Project Save & Export"].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ color: "#00FF95" }}>✅</span>
                <span style={{ fontSize: "14px", color: "#fff" }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "#101010", border: "1px solid #1c1c1c", borderRadius: "16px", padding: "28px" }}>
            <p style={{ color: "#FFC107", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>Coming Soon</p>
            {["AI Campaign Builder", "Team Workspaces", "Templates Marketplace", "API Access"].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span>🚀</span>
                <span style={{ fontSize: "14px", color: "#9ca3af" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "80px 24px", background: "#0C0C0C", borderTop: "1px solid #1c1c1c", borderBottom: "1px solid #1c1c1c" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <p style={{ textAlign: "center", color: "#FFC107", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Simple Pricing</p>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "3rem" }}>
            Pricing
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
            {[
              { name: "Free", price: "₹0", period: "forever", features: ["10 generations/day", "Basic preview", "Download HTML", "Community support"], cta: "Get Started", highlight: false },
              { name: "Pro", price: "₹499", period: "/month", features: ["Unlimited generations", "Priority AI model", "Save projects", "Export code", "Email support"], cta: "Start Pro", highlight: true },
              { name: "Business", price: "₹1499", period: "/month", features: ["Everything in Pro", "Team workspace", "API access", "Custom domain", "Priority support"], cta: "Contact Us", highlight: false },
            ].map((plan) => (
              <div key={plan.name} style={{ background: plan.highlight ? "rgba(255,193,7,0.05)" : "#101010", border: plan.highlight ? "1px solid rgba(255,193,7,0.3)" : "1px solid #1c1c1c", borderRadius: "16px", padding: "28px", position: "relative" as "relative" }}>
                {plan.highlight && (
                  <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "#FFC107", color: "#080808", fontSize: "11px", fontWeight: 700, padding: "4px 14px", borderRadius: "20px" }}>
                    Most Popular
                  </div>
                )}
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>{plan.name}</h3>
                <div style={{ marginBottom: "20px" }}>
                  <span style={{ fontSize: "36px", fontWeight: 800, color: plan.highlight ? "#FFC107" : "#fff" }}>{plan.price}</span>
                  <span style={{ color: "#555", fontSize: "14px" }}>{plan.period}</span>
                </div>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <span style={{ color: "#FFC107", fontSize: "14px" }}>✓</span>
                    <span style={{ fontSize: "14px", color: "#9ca3af" }}>{f}</span>
                  </div>
                ))}
                <button onClick={() => router.push("/auth/signup")} style={{ width: "100%", marginTop: "20px", padding: "12px", background: plan.highlight ? "#FFC107" : "#161616", border: plan.highlight ? "none" : "1px solid #1c1c1c", borderRadius: "10px", color: plan.highlight ? "#080808" : "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "80px 24px", maxWidth: "700px", margin: "0 auto" }}>
        <p style={{ textAlign: "center", color: "#FFC107", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>FAQ</p>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, textAlign: "center", marginBottom: "3rem" }}>
          Frequently Asked
        </h2>
        {[
          { q: "What can Krypton build?", a: "Websites, web apps, browser games, dashboards, calculators, portfolios, and more — all as production-ready HTML files." },
          { q: "Do I need coding skills?", a: "No. Just describe what you want in plain English and Krypton AI generates it instantly." },
          { q: "Can I download the code?", a: "Yes. Every project can be downloaded as a complete HTML file, ready to deploy anywhere." },
          { q: "Does it work on mobile?", a: "Yes, Krypton AI is fully responsive and works on all devices." },
          { q: "What AI models are used?", a: "Krypton uses Claude AI as the primary model with Gemini as fallback for maximum reliability." },
        ].map((item, i) => (
          <div key={i} style={{ borderBottom: "1px solid #1c1c1c", padding: "20px 0" }}>
            <p style={{ fontWeight: 600, fontSize: "15px", marginBottom: "8px", color: "#fff" }}>{item.q}</p>
            <p style={{ color: "#9ca3af", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{item.a}</p>
          </div>
        ))}
      </section>

      {/* CTA BANNER */}
      <section style={{ padding: "80px 24px", textAlign: "center", borderTop: "1px solid #1c1c1c" }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 800, marginBottom: "1.5rem" }}>
          The future of building is<br />
          <span style={{ color: "#FFC107" }}>a sentence away.</span>
        </h2>
        <button onClick={() => router.push("/auth/signup")} style={{ padding: "16px 36px", background: "#FFC107", border: "none", borderRadius: "14px", color: "#080808", fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>
          Start Free — No credit card required →
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #1c1c1c", padding: "60px 24px 30px", background: "#0C0C0C" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "40px", marginBottom: "40px" }}>
            {[
              { title: "Product", links: ["Features", "Pricing", "Roadmap"] },
              { title: "Resources", links: ["Documentation", "Blog", "Support"] },
              { title: "Company", links: ["About", "Contact"] },
              { title: "Legal", links: ["Privacy Policy", "Terms"] },
            ].map((col) => (
              <div key={col.title}>
                <p style={{ fontWeight: 700, fontSize: "13px", marginBottom: "16px", color: "#fff" }}>{col.title}</p>
                {col.links.map((link) => (
                  <p key={link} style={{ color: "#555", fontSize: "13px", marginBottom: "10px", cursor: "pointer" }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "#9ca3af"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "#555"}
                  >
                    {link}
                  </p>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #1c1c1c", paddingTop: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "20px", height: "20px", background: "#FFC107", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2L3 7v6l7 5 7-5V7L10 2z" fill="#080808" />
                </svg>
              </div>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "13px" }}>Krypton <span style={{ color: "#FFC107" }}>AI</span></span>
            </div>
            <p style={{ color: "#444", fontSize: "12px" }}>© 2026 Krypton AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
