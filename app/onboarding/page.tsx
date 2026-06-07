"use client";

// app/onboarding/page.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280",
};

const STEPS = [
  {
    id: 1, emoji: "👋", title: "Welcome to Krypton AI!",
    desc: "Build websites, apps, and games with AI in seconds. No coding needed!",
    tip: "You have 100 free credits to start building.",
  },
  {
    id: 2, emoji: "⚡", title: "How Credits Work",
    desc: "Credits power your AI generations. Each project uses a few credits.",
    tip: "Free plan gives you 100 credits. Upgrade anytime for more!",
    breakdown: [
      { label: "Website/App/Game", cost: "5 credits" },
      { label: "AI Edit",          cost: "1 credit" },
      { label: "AI Analysis",      cost: "5 credits" },
    ],
  },
  {
    id: 3, emoji: "🚀", title: "Build Your First Project",
    desc: "Just describe what you want and Krypton AI will build it!",
    tip: "Try: 'Build a snake game' or 'Create a portfolio website'",
    examples: [
      "Build a SaaS landing page",
      "Create a todo app with dark theme",
      "Build a snake game",
      "Make a restaurant website",
    ],
  },
  {
    id: 4, emoji: "🌍", title: "Share & Export",
    desc: "Download your project, push to GitHub, or share with the community!",
    tip: "Every project can be exported as HTML or pushed to GitHub!",
    features: [
      { icon: "⬇️", label: "Download HTML" },
      { icon: "🐙", label: "Push to GitHub" },
      { icon: "🌍", label: "Share publicly" },
      { icon: "🚀", label: "Deploy online" },
    ],
  },
  {
    id: 5, emoji: "🎁", title: "Invite Friends, Get Credits!",
    desc: "Share your referral link. Both you and your friend get 50 free credits!",
    tip: "The more you invite, the more you earn!",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep]             = useState(0);
  const [referralCode, setReferralCode] = useState("");
  const [myCode, setMyCode]         = useState("");
  const [applying, setApplying]     = useState(false);
  const [applied, setApplied]       = useState(false);
  const [applyError, setApplyError] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState("");

  useEffect(() => {
    loadReferralCode();
  }, []);

  const loadReferralCode = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/referral", {
      headers: { "Authorization": `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (data.code) setMyCode(data.code);
  };

  const applyReferral = async () => {
    if (!referralCode.trim()) return;
    setApplying(true);
    setApplyError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ referralCode: referralCode.trim().toUpperCase() }),
    });
    const data = await res.json();

    if (data.success) {
      setApplied(true);
    } else {
      setApplyError(data.error || "Invalid code");
    }
    setApplying(false);
  };

  const completeOnboarding = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", session.user.id);

    if (selectedPrompt) {
      router.push(`/create?prompt=${encodeURIComponent(selectedPrompt)}`);
    } else {
      router.push("/");
    }
  };

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, color: T.text,
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50vw", height: "50vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle,rgba(245,197,66,0.15) 0%,transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "45vw", height: "45vw", borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle,rgba(0,204,68,0.12) 0%,transparent 70%)" }} />
      </div>

      <div style={{ width: "100%", maxWidth: 520, position: "relative", zIndex: 1 }}>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 4,
              background: i <= step ? G : "rgba(255,255,255,0.1)",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        {/* Card */}
        <div key={step} style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 20, padding: "36px 32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          animation: "fadeIn 0.35s ease",
        }}>
          {/* Emoji */}
          <div style={{ fontSize: 56, textAlign: "center", marginBottom: 20 }}>
            {currentStep.emoji}
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", marginBottom: 12, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {currentStep.title}
          </h1>

          {/* Desc */}
          <p style={{ color: T.muted, fontSize: 15, textAlign: "center", lineHeight: 1.7, marginBottom: 24 }}>
            {currentStep.desc}
          </p>

          {/* Step specific content */}

          {/* Step 2 — Credits breakdown */}
          {currentStep.breakdown && (
            <div style={{ background: "#161616", borderRadius: 12, padding: "16px", marginBottom: 20 }}>
              {currentStep.breakdown.map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 13, color: T.muted }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>{item.cost}</span>
                </div>
              ))}
            </div>
          )}

          {/* Step 3 — Example prompts */}
          {currentStep.examples && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {currentStep.examples.map(ex => (
                <button key={ex} onClick={() => setSelectedPrompt(ex)} style={{
                  padding: "12px 16px", textAlign: "left",
                  background: selectedPrompt === ex ? "rgba(245,197,66,0.1)" : "#161616",
                  border: `1px solid ${selectedPrompt === ex ? "rgba(245,197,66,0.4)" : T.border}`,
                  borderRadius: 10, color: selectedPrompt === ex ? T.gold : T.muted,
                  fontSize: 13, cursor: "pointer", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>✨</span> {ex}
                </button>
              ))}
            </div>
          )}

          {/* Step 4 — Features */}
          {currentStep.features && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {currentStep.features.map(f => (
                <div key={f.label} style={{ background: "#161616", border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{f.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Step 5 — Referral */}
          {isLast && (
            <div style={{ marginBottom: 20 }}>
              {/* My referral link */}
              {myCode && (
                <div style={{ background: "#161616", borderRadius: 12, padding: "16px", marginBottom: 14 }}>
                  <p style={{ fontSize: 12, color: T.muted, marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Your Referral Link</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <code style={{ flex: 1, fontSize: 12, color: T.gold, background: "#0d0d0d", padding: "8px 10px", borderRadius: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      krypton.app?ref={myCode}
                    </code>
                    <button onClick={() => navigator.clipboard.writeText(`https://magic-krypton-ai.vercel.app?ref=${myCode}`)}
                      style={{ padding: "8px 12px", background: G, border: "none", borderRadius: 7, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Apply referral code */}
              {!applied && (
                <div style={{ background: "#161616", borderRadius: 12, padding: "16px" }}>
                  <p style={{ fontSize: 12, color: T.muted, marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Have a Referral Code?</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="Enter code (e.g. KRABC123)"
                      style={{ flex: 1, background: "#0d0d0d", border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
                    <button onClick={applyReferral} disabled={applying || !referralCode.trim()}
                      style={{ padding: "8px 14px", background: referralCode.trim() ? G : "#1a1a1a", border: "none", borderRadius: 7, color: referralCode.trim() ? "#000" : "#444", fontSize: 12, fontWeight: 700, cursor: referralCode.trim() ? "pointer" : "not-allowed", flexShrink: 0 }}>
                      {applying ? "..." : "Apply"}
                    </button>
                  </div>
                  {applyError && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>❌ {applyError}</p>}
                </div>
              )}

              {applied && (
                <div style={{ background: "rgba(0,204,68,0.08)", border: "1px solid rgba(0,204,68,0.25)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🎉</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.green, margin: 0 }}>+50 Credits Added!</p>
                    <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0" }}>Referral code applied successfully!</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tip */}
          <div style={{ background: "rgba(245,197,66,0.06)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 24, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <p style={{ fontSize: 12.5, color: T.muted, margin: 0, lineHeight: 1.6 }}>{currentStep.tip}</p>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: "12px", background: "none", border: `1px solid ${T.border}`, borderRadius: 10, color: T.muted, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                ← Back
              </button>
            )}
            <button onClick={isLast ? completeOnboarding : () => setStep(s => s + 1)} style={{ flex: 2, padding: "12px", background: G, border: "none", borderRadius: 10, color: "#000", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              {isLast ? (selectedPrompt ? "🚀 Start Building!" : "Get Started →") : "Next →"}
            </button>
          </div>

          {/* Skip */}
          {!isLast && (
            <button onClick={completeOnboarding} style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: "#444", fontSize: 12, cursor: "pointer" }}>
              Skip onboarding
            </button>
          )}
        </div>

        {/* Step counter */}
        <p style={{ textAlign: "center", color: "#333", fontSize: 12, marginTop: 16 }}>
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
              }

