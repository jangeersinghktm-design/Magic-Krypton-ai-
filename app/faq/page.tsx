"use client";
// app/faq/page.tsx
// Krypton AI — FAQ Page
// Full FAQ accordion + AI-powered Q&A chat box

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const BG = "#050505";
const WHITE = "#FFFFFF";
const MUTED = "#94A3B8";
const SUB = "#CBD5E1";
const GOLD = "#FFD700";
const GREEN = "#00D084";

const gtext = {
  background: `linear-gradient(135deg,${GOLD},${GREEN})`,
  WebkitBackgroundClip: "text" as const,
  WebkitTextFillColor: "transparent" as const,
  backgroundClip: "text" as const,
};

const FAQ_CATEGORIES = [
  {
    category: "Getting Started",
    items: [
      { q: "What can Krypton AI build?", a: "Websites, web apps, browser games, dashboards, calculators, portfolios — all production-ready HTML output. Just describe what you want and Krypton AI generates it." },
      { q: "How does Krypton AI work?", a: "Describe what you want in plain English. Our AI transforms your idea into a complete, responsive project in seconds — no coding required." },
      { q: "Do I need coding skills?", a: "No. Just describe what you want and Krypton AI generates it instantly. Zero technical knowledge required to get started." },
      { q: "How long does generation take?", a: "Most websites generate in under 10 seconds. Complex apps and games may take slightly longer depending on the request." },
    ],
  },
  {
    category: "Features & Output",
    items: [
      { q: "Can I download the code?", a: "Yes. Every project downloads as a complete HTML file, ready to deploy anywhere — Vercel, Netlify, GitHub Pages, or your own server." },
      { q: "Can I edit a project after it's generated?", a: "Yes. Use the built-in editor to describe changes, debug issues, redesign sections, or add new features — Krypton AI continues working on your existing project." },
      { q: "What AI model powers this?", a: "Krypton AI uses a three-layer system — Claude, GPT-4o, and Gemini — with automatic fallback so generation never fails due to a single provider issue." },
      { q: "Can I use a competitor's website as inspiration?", a: "Yes. Paste a competitor URL when generating and Krypton AI will analyze its structure and design language to inform your build — without copying content." },
    ],
  },
  {
    category: "Pricing & Plans",
    items: [
      { q: "Is there a free plan?", a: "Yes. You get 5 free generations every day with no credit card required. Upgrade anytime for more power and saved projects." },
      { q: "What's the difference between plans?", a: "Free gives you core generation. Pro and above add project saving, version history, faster generation, premium templates, and priority support. See the Pricing page for full details." },
      { q: "Can I cancel anytime?", a: "Yes, all paid plans can be cancelled anytime from your billing settings. No long-term contracts." },
      { q: "Do you offer refunds?", a: "All plans include a 14-day money-back guarantee — no questions asked." },
    ],
  },
];

interface ChatMsg { role: "user" | "ai"; text: string; }

export default function FAQPage() {
  const router = useRouter();
  const [openIdx, setOpenIdx] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "ai", text: "Hi! I'm here to answer any questions about Krypton AI. What would you like to know?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const askQuestion = async (question: string) => {
    if (!question.trim() || loading) return;
    setMessages(m => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/faq-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: "ai", text: data.answer || "Sorry, I couldn't process that. Please try again." }]);
    } catch {
      setMessages(m => [...m, { role: "ai", text: "Connection issue — please try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: WHITE, fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,215,0,.3);border-radius:4px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .faq-item{animation:fadeUp .4s ease both;}
      `}</style>

      {/* Top bar */}
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid rgba(255,255,255,.07)", position: "sticky", top: 0, background: "rgba(5,5,5,.95)", backdropFilter: "blur(20px)", zIndex: 10 }}>
        <button onClick={() => router.push("/landing")} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer" }}>
          <span style={{ fontWeight: 800, fontSize: 20, fontFamily: "'Baloo 2',sans-serif", ...gtext }}>Krypton AI</span>
        </button>
        <button onClick={() => router.push("/landing")} style={{ background: "none", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: MUTED, fontSize: 13, padding: "7px 16px", cursor: "pointer" }}>
          ← Back to Home
        </button>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 20px 100px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 12 }}>
            <span style={gtext}>Help Center</span>
          </p>
          <h1 style={{ fontFamily: "'Baloo 2',sans-serif", fontSize: "clamp(28px,4.5vw,48px)", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 16 }}>
            Frequently Asked <span style={gtext}>Questions</span>
          </h1>
          <p style={{ color: MUTED, fontSize: 15, maxWidth: 520, margin: "0 auto" }}>
            Can't find what you're looking for? Ask our AI assistant below — it knows everything about Krypton AI.
          </p>
        </div>

        {/* FAQ Accordion by category */}
        {FAQ_CATEGORIES.map((cat, ci) => (
          <div key={cat.category} style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>
              {cat.category}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cat.items.map((item, i) => {
                const key = `${ci}-${i}`;
                const isOpen = openIdx === key;
                return (
                  <div key={key} className="faq-item" style={{ background: "#0D0D0D", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, overflow: "hidden" }}>
                    <button onClick={() => setOpenIdx(isOpen ? null : key)}
                      style={{ width: "100%", padding: "16px 20px", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: WHITE }}>{item.q}</span>
                      <span style={{ fontSize: 18, color: isOpen ? GOLD : MUTED, flexShrink: 0, marginLeft: 12, transition: "transform .2s", transform: isOpen ? "rotate(45deg)" : "none" }}>+</span>
                    </button>
                    <div style={{ maxHeight: isOpen ? 200 : 0, overflow: "hidden", transition: "max-height .3s ease" }}>
                      <p style={{ padding: "0 20px 18px", color: SUB, fontSize: 14, lineHeight: 1.7 }}>{item.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* AI Chat Box */}
        <div style={{ marginTop: 56 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>
            Still have questions? Ask AI
          </h2>
          <div style={{ background: "#0A0A0A", border: "1px solid rgba(255,215,0,.15)", borderRadius: 18, overflow: "hidden" }}>
            {/* Messages */}
            <div style={{ maxHeight: 360, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%", padding: "10px 14px", borderRadius: 14,
                    background: m.role === "user" ? "linear-gradient(135deg,#FFD700,#00D084)" : "rgba(255,255,255,.05)",
                    color: m.role === "user" ? "#050505" : SUB,
                    fontSize: 14, lineHeight: 1.6,
                    borderBottomRightRadius: m.role === "user" ? 4 : 14,
                    borderBottomLeftRadius: m.role === "ai" ? 4 : 14,
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "10px 14px", borderRadius: 14, background: "rgba(255,255,255,.05)", color: MUTED, fontSize: 13 }}>
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            {/* Input */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", padding: 14, display: "flex", gap: 10 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !loading) askQuestion(input); }}
                placeholder="Ask a question about Krypton AI..."
                style={{ flex: 1, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "10px 14px", color: WHITE, fontSize: 14, outline: "none" }}
              />
              <button onClick={() => askQuestion(input)} disabled={loading || !input.trim()}
                style={{
                  background: loading || !input.trim() ? "rgba(255,255,255,.06)" : "linear-gradient(135deg,#FFD700,#00D084)",
                  color: loading || !input.trim() ? MUTED : "#050505",
                  border: "none", borderRadius: 10, padding: "0 20px", fontWeight: 700, fontSize: 13,
                  cursor: loading || !input.trim() ? "default" : "pointer",
                }}>
                Send
              </button>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: 56 }}>
          <button onClick={() => router.push("/auth/signup")}
            style={{ padding: "14px 32px", background: "linear-gradient(135deg,#FFD700,#00D084)", border: "none", borderRadius: 12, color: "#050505", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Get Started Free →
          </button>
        </div>
      </div>
    </div>
  );
}
