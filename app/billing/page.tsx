"use client";

// app/billing/page.tsx
// Opens in new tab when clicked from sidebar/settings
// Full standalone billing & subscription page

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Constants ──────────────────────────────────────────────────────
const PLANS = [
  {
    id: "free",
    name: "Free",
    emoji: "🟢",
    monthlyUsd: 0, yearlyUsd: 0,
    monthlyInr: 0, yearlyInr: 0,
    creditsDaily: 20,
    creditsLabel: "20 Generations / Day",
    cta: "Current Plan",
    highlight: false,
    features: [
      "Website Generator",
      "App Generator",
      "Game Generator",
      "Live Preview",
      "Download HTML",
      "Community Support",
    ],
    locked: [
      "Save Projects",
      "Project History",
      "Advanced AI Model",
      "Team Workspace",
      "API Access",
      "Priority Support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    emoji: "🔥",
    monthlyUsd: 25, yearlyUsd: 20,
    monthlyInr: 2099, yearlyInr: 1679,
    creditsLabel: "100 Generations / Month",
    cta: "Upgrade to Pro",
    highlight: true,
    badge: "Most Popular",
    features: [
      "Everything in Free",
      "Save Projects",
      "Project History",
      "Faster Generation",
      "Better AI Quality",
      "Export Full Source Code",
      "Private Projects",
      "Premium Templates",
      "Email Support",
    ],
    locked: [
      "Team Workspace",
      "API Access",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    emoji: "💎",
    monthlyUsd: 69, yearlyUsd: 55,
    monthlyInr: 5799, yearlyInr: 4639,
    creditsLabel: "300 Generations / Month",
    cta: "Upgrade to Premium",
    highlight: false,
    features: [
      "Everything in Pro",
      "Fastest AI Model",
      "Unlimited Project Saves",
      "Version History",
      "Team Collaboration (5 Users)",
      "Screenshot to App",
      "AI Project Manager",
      "Priority Support",
    ],
    locked: ["API Access"],
  },
  {
    id: "business",
    name: "Business",
    emoji: "🏢",
    monthlyUsd: 149, yearlyUsd: 119,
    monthlyInr: 12499, yearlyInr: 9999,
    creditsLabel: "Unlimited Generations / Day",
    cta: "Contact Us",
    highlight: false,
    features: [
      "Everything in Premium",
      "API Access",
      "Unlimited Team Members",
      "Admin Dashboard",
      "White Label Support",
      "Custom AI Training",
      "Business SLA",
      "Dedicated Support",
    ],
    locked: [],
  },
];

const TOPUPS = [
  { id: "topup_50",  credits: 50,  usd: 15,  inr: 1299 },
  { id: "topup_100", credits: 100, usd: 30,  inr: 2599 },
  { id: "topup_200", credits: 200, usd: 60,  inr: 4999 },
  { id: "topup_500", credits: 500, usd: 150, inr: 11999 },
];

export default function BillingPage() {
  const supabase = createClient();

  const [billing, setBilling]       = useState<"monthly" | "yearly">("monthly");
  const [currency, setCurrency]     = useState<"INR" | "USD">("INR");
  const [currentPlan, setCurrentPlan] = useState("free");
  const [credits, setCredits]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, total_credits, used_credits")
      .eq("id", session.user.id)
      .single();

    if (profile) {
      setCurrentPlan(profile.plan || "free");
      setCredits(profile);
    }
    setLoading(false);
  };

  const handlePayment = async (planId: string) => {
    if (planId === "free") return;
    if (planId === "business") {
      window.open("mailto:sales@kryptonai.tech?subject=Business Plan Enquiry", "_blank");
      return;
    }

    setPaymentLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/auth/login"; return; }

      const plan = PLANS.find(p => p.id === planId);
      const amount = currency === "INR"
        ? (billing === "yearly" ? plan?.yearlyInr : plan?.monthlyInr)
        : (billing === "yearly" ? plan?.yearlyUsd : plan?.monthlyUsd);

      const res = await fetch("/api/payment/order", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ planId, billing, currency }),
      });

      const order = await res.json();
      if (!res.ok) { alert(order.error || "Payment failed"); return; }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      document.body.appendChild(script);
      script.onload = () => {
        const options = {
          key: order.keyId,
          amount: order.amount,
          currency: order.currency || "INR",
          name: "Krypton AI",
          description: `${plan?.name} Plan - ${billing === "yearly" ? "Yearly" : "Monthly"}`,
          image: "/logo.png",
          order_id: order.orderId,
          handler: async (response: any) => {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId, credits: order.credits,
              }),
            });
            const result = await verifyRes.json();
            if (result.success) {
              alert(`✅ Payment successful! Welcome to ${plan?.name} plan!`);
              loadProfile();
            } else {
              alert("❌ Payment verification failed.");
            }
          },
          prefill: { email: session.user.email || "" },
          theme: { color: "#F5D800" },
          modal: { ondismiss: () => setPaymentLoading(false) },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      };
    } catch (err: any) {
      alert("Payment failed: " + err.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const remaining = credits ? (credits.total_credits - credits.used_credits) : 0;
  const usedPct   = credits ? Math.min(((credits.used_credits / credits.total_credits) * 100), 100) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=Syne:wght@700;800;900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #050505; }

        .billing-root {
          min-height: 100vh;
          background: #050505;
          background-image:
            linear-gradient(rgba(245,197,66,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,197,66,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          color: #ffffff;
          font-family: 'DM Sans', sans-serif;
        }

        .plan-card {
          background: #0D0D0D;
          border: 1px solid rgba(245,197,66,0.12);
          border-radius: 20px;
          padding: 28px 24px;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .plan-card.highlight {
          background: linear-gradient(145deg, #111100, #0a0a0a);
          border-color: rgba(245,197,66,0.4);
          box-shadow: 0 0 40px rgba(245,197,66,0.1), inset 0 1px 0 rgba(245,197,66,0.1);
        }

        .plan-card:hover {
          border-color: rgba(245,197,66,0.35);
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.4);
        }

        .plan-card.highlight:hover {
          box-shadow: 0 0 60px rgba(245,197,66,0.2), 0 12px 40px rgba(0,0,0,0.4);
        }

        .pill-toggle {
          display: inline-flex;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 100px;
          padding: 4px;
          gap: 4px;
        }

        .pill-btn {
          padding: 8px 22px;
          border-radius: 100px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .pill-btn.active {
          background: linear-gradient(135deg, #F5D800, #00CC44);
          color: #000;
        }

        .pill-btn.inactive {
          background: transparent;
          color: #666;
        }

        .pill-btn.inactive:hover { color: #999; }

        .cta-btn {
          width: 100%;
          padding: 13px;
          border-radius: 12px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: auto;
        }

        .cta-btn.primary {
          background: linear-gradient(135deg, #F5D800, #00CC44);
          color: #000;
        }

        .cta-btn.primary:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(245,197,66,0.3);
        }

        .cta-btn.outline {
          background: transparent;
          border: 1px solid rgba(245,197,66,0.3);
          color: #F5D800;
        }

        .cta-btn.outline:hover {
          background: rgba(245,197,66,0.05);
          border-color: rgba(245,197,66,0.5);
        }

        .cta-btn.ghost {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #888;
        }

        .cta-btn.current {
          background: rgba(0,204,68,0.1);
          border: 1px solid rgba(0,204,68,0.3);
          color: #00CC44;
          cursor: default;
        }

        .badge {
          position: absolute;
          top: -1px; right: 24px;
          background: linear-gradient(135deg, #F5D800, #00CC44);
          color: #000;
          font-size: 10px;
          font-weight: 800;
          padding: 4px 12px;
          border-radius: 0 0 8px 8px;
          letter-spacing: 0.5px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          color: #B3B3B3;
          padding: 4px 0;
        }

        .feature-icon-green { color: #00CC44; font-size: 13px; flex-shrink: 0; }
        .feature-icon-lock  { color: #F5D800; font-size: 11px; flex-shrink: 0; opacity: 0.6; }

        .topup-card {
          background: #0D0D0D;
          border: 1px solid rgba(245,197,66,0.12);
          border-radius: 14px;
          padding: 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .topup-card:hover {
          border-color: rgba(245,197,66,0.4);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(245,197,66,0.08);
        }

        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 0 rgba(245,197,66,0)} 50%{box-shadow:0 0 20px rgba(245,197,66,0.2)} }

        @media (max-width: 768px) {
          .plans-grid { grid-template-columns: 1fr !important; }
          .topup-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <div className="billing-root">

        {/* ── HEADER ── */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid rgba(245,197,66,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 900, background: "linear-gradient(135deg,#F5D800,#00CC44)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontFamily: "'Syne', sans-serif" }}>
              ⚡ Krypton AI
            </div>
            <span style={{ fontSize: 12, color: "#444", padding: "3px 10px", border: "1px solid #222", borderRadius: 20 }}>Billing</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Currency Toggle */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
              {(["INR", "USD"] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)} style={{
                  padding: "6px 14px", border: "none", fontSize: 12, fontWeight: 700,
                  background: currency === c ? "rgba(245,197,66,0.15)" : "transparent",
                  color: currency === c ? "#F5D800" : "#666", cursor: "pointer",
                }}>
                  {c === "INR" ? "₹ INR" : "$ USD"}
                </button>
              ))}
            </div>
            <button onClick={() => window.close()} style={{ padding: "6px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#666", fontSize: 12, cursor: "pointer" }}>
              ✕ Close
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px", animation: "fadeIn 0.4s ease" }}>

          {/* ── HERO ── */}
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#F5D800", background: "rgba(245,197,66,0.08)", border: "1px solid rgba(245,197,66,0.2)", padding: "5px 14px", borderRadius: 20, marginBottom: 18 }}>
              ⚡ Subscription Plans
            </div>
            <h1 style={{ fontSize: "clamp(28px,5vw,52px)", fontWeight: 900, fontFamily: "'Syne', sans-serif", lineHeight: 1.1, marginBottom: 14 }}>
              Build More,{" "}
              <span style={{ background: "linear-gradient(135deg,#F5D800,#00CC44)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Pay Less
              </span>
            </h1>
            <p style={{ color: "#6B7280", fontSize: 16, maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.7 }}>
              Choose the plan that fits your workflow. Upgrade or downgrade anytime.
            </p>

            {/* Monthly / Yearly Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <div className="pill-toggle">
                <button className={`pill-btn ${billing === "monthly" ? "active" : "inactive"}`} onClick={() => setBilling("monthly")}>
                  Monthly
                </button>
                <button className={`pill-btn ${billing === "yearly" ? "active" : "inactive"}`} onClick={() => setBilling("yearly")}>
                  Yearly
                </button>
              </div>
              {billing === "yearly" && (
                <div style={{ fontSize: 12, fontWeight: 700, color: "#00CC44", background: "rgba(0,204,68,0.1)", border: "1px solid rgba(0,204,68,0.25)", padding: "4px 12px", borderRadius: 20 }}>
                  Save up to 20% 🎉
                </div>
              )}
            </div>
          </div>

          {/* ── CREDITS STATUS (if logged in) ── */}
          {credits && (
            <div style={{ background: "#0D0D0D", border: "1px solid rgba(245,197,66,0.15)", borderRadius: 14, padding: "16px 24px", marginBottom: 36, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#666" }}>Credits Remaining</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: remaining > 20 ? "#00CC44" : "#ef4444" }}>{remaining} / {credits.total_credits}</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${100 - usedPct}%`, background: remaining > 20 ? "linear-gradient(90deg,#F5D800,#00CC44)" : "linear-gradient(90deg,#ef4444,#f59e0b)", borderRadius: 4, transition: "width 0.5s" }} />
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#666" }}>
                Current Plan: <span style={{ color: "#F5D800", fontWeight: 700, textTransform: "capitalize" }}>{currentPlan}</span>
              </div>
            </div>
          )}

          {/* ── PLANS GRID ── */}
          <div className="plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 64 }}>
            {PLANS.map(plan => {
              const isCurrentPlan = currentPlan === plan.id;
              const price = currency === "INR"
                ? (billing === "yearly" ? plan.yearlyInr : plan.monthlyInr)
                : (billing === "yearly" ? plan.yearlyUsd : plan.monthlyUsd);
              const symbol = currency === "INR" ? "₹" : "$";

              return (
                <div key={plan.id} className={`plan-card ${plan.highlight ? "highlight" : ""}`}
                  onMouseEnter={() => setHoveredPlan(plan.id)}
                  onMouseLeave={() => setHoveredPlan(null)}>

                  {plan.badge && <div className="badge">⭐ {plan.badge}</div>}

                  {/* Plan Header */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{plan.emoji}</div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{plan.name}</h2>
                    <p style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>{plan.creditsLabel}</p>
                  </div>

                  {/* Price */}
                  <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {price === 0 ? (
                      <div>
                        <span style={{ fontSize: 36, fontWeight: 900, background: "linear-gradient(135deg,#F5D800,#00CC44)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Free</span>
                        <p style={{ fontSize: 12, color: "#555", marginTop: 4 }}>Forever free</p>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
                          <span style={{ fontSize: 14, color: "#666", marginBottom: 6 }}>{symbol}</span>
                          <span style={{ fontSize: 36, fontWeight: 900, background: "linear-gradient(135deg,#F5D800,#00CC44)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>{price.toLocaleString()}</span>
                          <span style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>/mo</span>
                        </div>
                        {billing === "yearly" && (
                          <p style={{ fontSize: 11, color: "#00CC44", marginTop: 4 }}>
                            Billed {symbol}{(price * 12).toLocaleString()}/year
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => !isCurrentPlan && handlePayment(plan.id)}
                    disabled={paymentLoading || isCurrentPlan}
                    className={`cta-btn ${isCurrentPlan ? "current" : plan.id === "free" ? "ghost" : plan.highlight ? "primary" : "outline"}`}
                    style={{ marginBottom: 20 }}>
                    {isCurrentPlan ? "✅ Current Plan" : paymentLoading ? "Processing..." : plan.cta}
                  </button>

                  {/* Features */}
                  <div style={{ flex: 1 }}>
                    {plan.features.map(f => (
                      <div key={f} className="feature-item">
                        <span className="feature-icon-green">✓</span>
                        <span>{f}</span>
                      </div>
                    ))}
                    {plan.locked.map(f => (
                      <div key={f} className="feature-item" style={{ opacity: 0.4 }}>
                        <span className="feature-icon-lock">🔒</span>
                        <span style={{ color: "#555" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── CREDIT TOP-UPS ── */}
          <div style={{ marginBottom: 64 }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2 style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>
                Need More{" "}
                <span style={{ background: "linear-gradient(135deg,#F5D800,#00CC44)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Credits?</span>
              </h2>
              <p style={{ color: "#6B7280", fontSize: 14 }}>Top up anytime — credits never expire on paid plans</p>
            </div>

            <div className="topup-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              {TOPUPS.map(topup => (
                <div key={topup.id} className="topup-card" onClick={() => handlePayment(topup.id)}>
                  <div style={{ fontSize: 28, fontWeight: 900, background: "linear-gradient(135deg,#F5D800,#00CC44)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6 }}>
                    +{topup.credits}
                  </div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>Credits</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#F5D800", marginBottom: 4 }}>
                    {currency === "INR" ? `₹${topup.inr.toLocaleString()}` : `$${topup.usd}`}
                  </div>
                  <div style={{ fontSize: 11, color: "#444" }}>
                    {currency === "INR" ? `≈ ₹${Math.round(topup.inr / topup.credits)}/credit` : `≈ $${(topup.usd / topup.credits).toFixed(2)}/credit`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── FAQ ── */}
          <div style={{ maxWidth: 720, margin: "0 auto 64px" }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Syne', sans-serif", textAlign: "center", marginBottom: 32 }}>
              Billing{" "}
              <span style={{ background: "linear-gradient(135deg,#F5D800,#00CC44)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FAQ</span>
            </h2>
            {[
              { q: "Can I upgrade or downgrade anytime?", a: "Yes! You can change your plan at any time. Upgrades take effect immediately. Downgrades take effect at the end of your billing period." },
              { q: "Do credits carry over to next month?", a: "Credits reset monthly on Free plans. On paid plans (Pro, Premium, Business), unused credits carry over for up to 3 months." },
              { q: "What payment methods are accepted?", a: "We accept all major credit/debit cards, UPI, Net Banking, and Wallets through Razorpay (India). International cards are also supported." },
              { q: "Is there a refund policy?", a: "Yes. If you are not satisfied within 7 days of purchase, contact us for a full refund. See our Refund Policy for details." },
              { q: "What happens when I run out of credits?", a: "Generations will be paused until you top up or your plan resets. You can top up credits anytime from this page." },
            ].map((faq, i) => (
              <div key={i} style={{ background: "#0D0D0D", border: "1px solid rgba(245,197,66,0.08)", borderRadius: 12, padding: "18px 24px", marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F5D800", marginBottom: 8 }}>{faq.q}</h3>
                <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.7, margin: 0 }}>{faq.a}</p>
              </div>
            ))}
          </div>

          {/* ── FOOTER ── */}
          <div style={{ borderTop: "1px solid rgba(245,197,66,0.08)", paddingTop: 32, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#444" }}>© 2026 Krypton AI</span>
            <a href="/privacy" target="_blank" style={{ fontSize: 13, color: "#555", textDecoration: "none" }}>Privacy Policy</a>
            <a href="/terms" target="_blank" style={{ fontSize: 13, color: "#555", textDecoration: "none" }}>Terms of Service</a>
            <a href="/refund" target="_blank" style={{ fontSize: 13, color: "#555", textDecoration: "none" }}>Refund Policy</a>
            <a href="/contact" target="_blank" style={{ fontSize: 13, color: "#555", textDecoration: "none" }}>Contact Us</a>
          </div>
        </div>
      </div>
    </>
  );
}
