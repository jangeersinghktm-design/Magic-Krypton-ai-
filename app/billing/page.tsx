"use client";

// app/billing/page.tsx — Production Ready v3 (shared plan/token data)
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/lib/plans";
import { TOPUPS } from "@/lib/payment-plans";
import { HEADLINE_GRADIENT, PRIMARY, BORDER, SOFT_GRAY } from "@/lib/theme-tokens";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";

const G  = HEADLINE_GRADIENT;
const T  = { gold: PRIMARY, green: PRIMARY, border: BORDER, muted: SOFT_GRAY, card: "#0B1020" };

type Tab = "plans" | "history" | "invoices";

export default function BillingPage() {
  const supabase = createClient();

  const [billing, setBilling]     = useState<"monthly"|"yearly">("monthly");
  const [currency, setCurrency]   = useState<"INR"|"USD">("USD");
  const [tab, setTab]             = useState<Tab>("plans");
  const [currentPlan, setCurrentPlan] = useState("free");
  const [profile, setProfile]     = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices]   = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }

    const [
      { data: prof },
      { data: sub },
      { data: inv },
      { data: tx },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("subscriptions").select("*").eq("user_id", session.user.id).single(),
      supabase.from("invoices").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("credit_transactions").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(20),
    ]);

    setProfile({ ...prof, email: session.user.email });
    setCurrentPlan(prof?.plan || "free");
    setSubscription(sub);
    setInvoices(inv || []);
    setTransactions(tx || []);
    setLoading(false);
  };

  const handlePayment = async (planId: string) => {
    if (planId === "free") return;
    if (planId === "business") {
      window.open("mailto:sales@kryptonai.tech?subject=Business Plan Enquiry", "_blank");
      return;
    }

    setPaymentLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/auth/login"; return; }

    const plan = PLANS.find(p => p.id === planId);
    try {
      await openRazorpayCheckout({
        planId, billing, currency,
        promoCode: promoApplied ? promoCode : "",
        accessToken: session.access_token,
        planName: `${plan?.name || planId} Plan — ${billing === "yearly" ? "Yearly" : "Monthly"}`,
        onSuccess: (result) => {
          alert(`✅ Payment successful!\n${result.message}\nInvoice: ${result.invoiceNumber}`);
          setPaymentLoading(false);
          loadData();
        },
        onFailure: (message) => {
          alert(message);
          setPaymentLoading(false);
        },
        onDismiss: () => setPaymentLoading(false),
      });
    } catch (err: any) {
      alert("Payment error: " + err.message);
      setPaymentLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel subscription? You'll keep access until period end.")) return;
    setCancelLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from("profiles")
      .update({ cancel_at_period_end: true, subscription_status: "cancelled" })
      .eq("id", session.user.id);

    await supabase.from("subscriptions")
      .update({ cancel_at_period_end: true, cancelled_at: new Date().toISOString() })
      .eq("user_id", session.user.id);

    await supabase.from("notifications").insert({
      user_id: session.user.id,
      title: "📋 Subscription Cancelled",
      message: "Your subscription will end at period end. You can resubscribe anytime.",
      type: "info",
    });

    alert("Subscription cancelled. Access continues until period end.");
    loadData();
    setCancelLoading(false);
  };

  const remaining  = profile ? Math.max(0, (profile.total_credits || 100) - (profile.used_credits || 0)) : 0;
  const usedPct    = profile ? Math.min(((profile.used_credits || 0) / (profile.total_credits || 100)) * 100, 100) : 0;
  const periodEnd  = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const daysLeft   = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000)) : null;
  const sym        = currency === "INR" ? "₹" : "$";

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050816", color: T.gold, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(245,197,66,0.2)", borderTopColor: T.gold, animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 14, color: T.muted }}>Loading billing...</p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #050816; }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        .billing-root {
          min-height: 100vh; background: #050816; color: #fff;
          font-family: 'DM Sans', sans-serif;
          background-image: linear-gradient(rgba(245,197,66,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,66,0.025) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .plan-card { background: #0B1020; border: 1px solid rgba(245,197,66,0.12); border-radius: 20px; padding: 24px 20px; transition: all 0.2s; position: relative; overflow: hidden; display: flex; flex-direction: column; }
        .plan-card.highlight { border-color: rgba(245,197,66,0.4); box-shadow: 0 0 40px rgba(245,197,66,0.08); }
        .plan-card:hover { border-color: rgba(245,197,66,0.3); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        .pill-toggle { display: inline-flex; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 100px; padding: 4px; }
        .pill-btn { padding: 8px 20px; border-radius: 100px; border: none; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .pill-btn.on { background: ${G}; color: #000; }
        .pill-btn.off { background: transparent; color: #666; }
        .cta { width: 100%; padding: 12px; border-radius: 10px; border: none; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .cta.primary { background: ${G}; color: #000; }
        .cta.primary:hover { opacity: 0.9; box-shadow: 0 6px 20px rgba(245,197,66,0.3); }
        .cta.outline { background: transparent; border: 1px solid rgba(245,197,66,0.3); color: ${T.gold}; }
        .cta.outline:hover { background: rgba(245,197,66,0.05); }
        .cta.ghost { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #888; }
        .cta.current { background: rgba(0,204,68,0.1); border: 1px solid rgba(0,204,68,0.25); color: ${T.green}; cursor: default; }
        .badge-popular { position: absolute; top: -1px; right: 20px; background: ${G}; color: #000; font-size: 9px; font-weight: 800; padding: 4px 10px; border-radius: 0 0 8px 8px; letter-spacing: 0.5px; }
        .feature-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #9AA3AF; padding: 3px 0; }
        .topup-card { background: #0B1020; border: 1px solid rgba(245,197,66,0.12); border-radius: 12px; padding: 18px; text-align: center; cursor: pointer; transition: all 0.2s; }
        .topup-card:hover { border-color: rgba(245,197,66,0.4); transform: translateY(-2px); }
        .tab-btn { padding: 8px 18px; border-radius: 8px; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .tab-btn.active { background: rgba(245,197,66,0.15); color: ${T.gold}; border: 1px solid rgba(245,197,66,0.3); }
        .tab-btn.inactive { background: transparent; color: #666; border: 1px solid transparent; }

        @media (max-width: 768px) {
          .plans-grid { grid-template-columns: 1fr !important; }
          .topup-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <div className="billing-root">

        {/* ── HEADER ── */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(245,197,66,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 800, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontFamily: "'Inter',sans-serif" }}>Krypton AI</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", padding: "3px 10px", border: "1px solid #222", borderRadius: 20 }}>Billing & Subscriptions</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
              {(["USD","INR"] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)} style={{ padding: "5px 12px", border: "none", fontSize: 11, fontWeight: 700, background: currency === c ? "rgba(245,197,66,0.15)" : "transparent", color: currency === c ? T.gold : "#9AA3AF", cursor: "pointer" }}>
                  {c === "INR" ? "₹ INR" : "$ USD"}
                </button>
              ))}
            </div>
            <button onClick={() => window.close()} style={{ padding: "5px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#9AA3AF", fontSize: 11, cursor: "pointer" }}>✕ Close</button>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 24px", animation: "fadeIn 0.4s ease" }}>

          {/* ── SUBSCRIPTION STATUS CARD ── */}
          {profile && (
            <div style={{ background: T.card, border: `1px solid ${currentPlan !== "free" ? "rgba(0,204,68,0.3)" : T.border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 32, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 11, color: T.muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>Current Plan</p>
                <p style={{ fontSize: 20, fontWeight: 800, textTransform: "capitalize" as const, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{currentPlan}</p>
                {subscription?.cancel_at_period_end && <p style={{ fontSize: 11, color: "#E5736B", marginTop: 3 }}>⚠ Cancels at period end</p>}
              </div>
              <div>
                <p style={{ fontSize: 11, color: T.muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>Credits</p>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ height: "100%", width: `${100 - usedPct}%`, background: remaining > 20 ? G : "linear-gradient(90deg,#E5736B,#D9D9D9)", borderRadius: 3, transition: "width 0.5s" }} />
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: remaining > 20 ? T.green : "#E5736B" }}>{remaining} / {profile.total_credits} remaining</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: T.muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>Next Renewal</p>
                <p style={{ fontSize: 14, fontWeight: 700 }}>
                  {periodEnd ? periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </p>
                {daysLeft !== null && daysLeft <= 7 && (
                  <p style={{ fontSize: 11, color: "#D9D9D9", marginTop: 2 }}>⚠ {daysLeft} days left</p>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {currentPlan !== "free" && !subscription?.cancel_at_period_end && (
                  <button onClick={handleCancel} disabled={cancelLoading} style={{ padding: "7px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#E5736B", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {cancelLoading ? "..." : "Cancel Plan"}
                  </button>
                )}
                <button onClick={() => setTab("history")} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: T.muted, fontSize: 11, cursor: "pointer" }}>
                  View History
                </button>
              </div>
            </div>
          )}

          {/* ── TABS ── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
            {(["plans","history","invoices"] as Tab[]).map(t => (
              <button key={t} className={`tab-btn ${tab === t ? "active" : "inactive"}`} onClick={() => setTab(t)}>
                {t === "plans" ? "📦 Plans" : t === "history" ? "📋 History" : "🧾 Invoices"}
              </button>
            ))}
          </div>

          {/* ── PLANS TAB ── */}
          {tab === "plans" && (
            <>
              {/* Hero */}
              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <h1 style={{ fontSize: "clamp(26px,4vw,44px)", fontWeight: 900, fontFamily: "'Inter',sans-serif", lineHeight: 1.1, marginBottom: 12 }}>
                  Simple, Transparent{" "}
                  <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Pricing</span>
                </h1>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20 }}>
                  <div className="pill-toggle">
                    <button className={`pill-btn ${billing === "monthly" ? "on" : "off"}`} onClick={() => setBilling("monthly")}>Monthly</button>
                    <button className={`pill-btn ${billing === "yearly" ? "on" : "off"}`} onClick={() => setBilling("yearly")}>Yearly</button>
                  </div>
                  {billing === "yearly" && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.green, background: "rgba(0,204,68,0.1)", border: "1px solid rgba(0,204,68,0.2)", padding: "4px 10px", borderRadius: 20 }}>
                      Save 20% 🎉
                    </span>
                  )}
                </div>

                {/* Promo code */}
                <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                  <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Promo code"
                    style={{ padding: "8px 14px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif", width: 150 }} />
                  <button onClick={() => { if (promoCode) setPromoApplied(true); }}
                    style={{ padding: "8px 14px", background: promoCode ? G : "#11151F", border: "none", borderRadius: 8, color: promoCode ? "#000" : "rgba(255,255,255,0.15)", fontSize: 12, fontWeight: 700, cursor: promoCode ? "pointer" : "not-allowed" }}>
                    {promoApplied ? "✅ Applied!" : "Apply"}
                  </button>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 52 }}>
                {PLANS.map(plan => {
                  const isCurrent = currentPlan === plan.id;
                  const price = currency === "INR"
                    ? (billing === "yearly" ? plan.yearlyInr : plan.monthlyInr)
                    : (billing === "yearly" ? plan.yearlyUsd : plan.monthlyUsd);

                  return (
                    <div key={plan.id} className={`plan-card ${plan.highlight ? "highlight" : ""}`}>
                      {plan.badge && <div className="badge-popular">⭐ {plan.badge}</div>}

                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 26, marginBottom: 6 }}>{plan.emoji}</div>
                        <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 3 }}>{plan.name}</h2>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textTransform: "uppercase" as const, letterSpacing: 1 }}>{plan.creditsLabel}</p>
                      </div>

                      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        {price === 0 ? (
                          <span style={{ fontSize: 32, fontWeight: 900, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Free</span>
                        ) : (
                          <div>
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
                              <span style={{ fontSize: 13, color: "#9AA3AF", marginBottom: 4 }}>{sym}</span>
                              <span style={{ fontSize: 32, fontWeight: 900, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>{price.toLocaleString()}</span>
                              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginBottom: 4 }}>/mo</span>
                            </div>
                            {billing === "yearly" && (
                              <p style={{ fontSize: 10, color: T.green, marginTop: 3 }}>Billed {sym}{(price * 12).toLocaleString()}/yr</p>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => !isCurrent && handlePayment(plan.id)}
                        disabled={paymentLoading || isCurrent}
                        className={`cta ${isCurrent ? "current" : plan.id === "free" ? "ghost" : plan.highlight ? "primary" : "outline"}`}
                        style={{ marginBottom: 16 }}>
                        {isCurrent ? "✅ Current Plan" : paymentLoading ? "Processing..." : plan.cta}
                      </button>

                      <div style={{ flex: 1 }}>
                        {plan.features.map(f => (
                          <div key={f} className="feature-row">
                            <span style={{ color: T.green, fontSize: 12, flexShrink: 0 }}>✓</span>
                            <span>{f}</span>
                          </div>
                        ))}
                        {plan.locked.map(f => (
                          <div key={f} className="feature-row" style={{ opacity: 0.35 }}>
                            <span style={{ fontSize: 10, flexShrink: 0 }}>🔒</span>
                            <span style={{ color: "rgba(255,255,255,0.2)" }}>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top-ups */}
              <div style={{ marginBottom: 48 }}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Inter',sans-serif", marginBottom: 6 }}>
                    Need More <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Credits?</span>
                  </h2>
                  <p style={{ color: T.muted, fontSize: 13 }}>One-time top-up — credits never expire on paid plans</p>
                </div>
                <div className="topup-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                  {TOPUPS.map(topup => (
                    <div key={topup.id} className="topup-card" onClick={() => handlePayment(topup.id)}>
                      <div style={{ fontSize: 26, fontWeight: 900, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>+{topup.credits}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>Credits</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: T.gold, marginBottom: 3 }}>
                        {currency === "INR" ? `₹${topup.inr.toLocaleString()}` : `$${topup.usd}`}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.1)" }}>
                        ≈ {currency === "INR" ? `₹${Math.round(topup.inr/topup.credits)}/cr` : `$${(topup.usd/topup.credits).toFixed(2)}/cr`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === "history" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>📋 Payment History</h2>
              {transactions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, color: T.muted }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                  <p>No transactions yet</p>
                </div>
              ) : (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                  {transactions.map((tx, i) => (
                    <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: i < transactions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{tx.amount > 0 ? "💳" : "⚡"}</span>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{tx.description || "Transaction"}</p>
                          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", margin: "2px 0 0" }}>{new Date(tx.created_at).toLocaleDateString("en-IN")}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: tx.amount > 0 ? T.green : "#E5736B" }}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount} cr
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── INVOICES TAB ── */}
          {tab === "invoices" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>🧾 Invoices</h2>
              {invoices.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, color: T.muted }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
                  <p>No invoices yet</p>
                </div>
              ) : (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, color: "rgba(255,255,255,0.15)", textTransform: "uppercase" as const, letterSpacing: 1 }}>
                    <span>Invoice #</span>
                    <span>Plan</span>
                    <span>Amount</span>
                    <span>Date</span>
                    <span>Status</span>
                  </div>
                  {invoices.map((inv, i) => (
                    <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", padding: "14px 20px", borderBottom: i < invoices.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: T.gold }}>{inv.invoice_number}</span>
                      <span style={{ fontSize: 13, textTransform: "capitalize" as const }}>{inv.plan}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{inv.currency === "INR" ? "₹" : "$"}{inv.total?.toLocaleString()}</span>
                      <span style={{ fontSize: 12, color: T.muted }}>{new Date(inv.created_at).toLocaleDateString("en-IN")}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: inv.status === "paid" ? "rgba(0,204,68,0.1)" : "rgba(239,68,68,0.1)", color: inv.status === "paid" ? T.green : "#E5736B" }}>
                        {inv.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FOOTER ── */}
          <div style={{ borderTop: "1px solid rgba(245,197,66,0.06)", paddingTop: 28, marginTop: 40, display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
            {[["Privacy", "/privacy"], ["Terms", "/terms"], ["Refund Policy", "/refund"], ["Contact", "/contact"]].map(([label, href]) => (
              <a key={label} href={href} target="_blank" style={{ fontSize: 12, color: "rgba(255,255,255,0.15)", textDecoration: "none" }} onMouseEnter={e => e.currentTarget.style.color = T.gold} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.15)"}>{label}</a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
