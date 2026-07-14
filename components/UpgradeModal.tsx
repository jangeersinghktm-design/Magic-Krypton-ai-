"use client";

// components/UpgradeModal.tsx
// Premium payment popup — shown when a free user hits a credit/plan wall.
// Reuses: lib/plans.ts, lib/payment-plans.ts, lib/razorpay-checkout.ts,
// lib/theme-tokens.ts, and the existing /api/payment/order + verify routes.
// Nothing here duplicates payment logic, plan data, or top-up data.

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/lib/plans";
import { TOPUPS } from "@/lib/payment-plans";
import { PRIMARY, PRIMARY_HOVER, PRIMARY_GLOW, WHITE, SOFT_GRAY, BORDER, HEADLINE_GRADIENT } from "@/lib/theme-tokens";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
  reason?: string;
  remainingCredits?: number;
  totalCredits?: number;
  onPaymentSuccess?: () => void; // parent refreshes credits/closes on its own timeline too
}

type PaymentPhase = "idle" | "opening" | "success" | "error";

export default function UpgradeModal({ isOpen, onClose, feature, reason, remainingCredits, totalCredits, onPaymentSuccess }: UpgradeModalProps) {
  const supabase = createClient();
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [recentTopups, setRecentTopups] = useState<{ amount:number; description:string; created_at:string }[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly"|"yearly">("monthly");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [phase, setPhase] = useState<PaymentPhase>("idle");
  const [phaseMessage, setPhaseMessage] = useState("");
  const payingRef = useRef(false); // synchronous guard — state updates are async, this isn't

  const isCreditsIssue = remainingCredits !== undefined && remainingCredits === 0;

  // Fetch current plan + recent top-up history whenever the modal opens —
  // self-contained, doesn't require the parent page to track plan state.
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: p } = await supabase.from("profiles").select("plan").eq("id", session.user.id).single();
      if (p?.plan) setCurrentPlan(p.plan);
      const { data: tx } = await supabase.from("credit_transactions")
        .select("amount,description,created_at")
        .eq("user_id", session.user.id).eq("type", "topup")
        .order("created_at", { ascending: false }).limit(5);
      setRecentTopups(tx || []);
    })();
  }, [isOpen]);

  // Reset transient payment UI state each time the modal is (re)opened.
  useEffect(() => {
    if (isOpen) { setPhase("idle"); setPhaseMessage(""); setBuyingId(null); payingRef.current = false; }
  }, [isOpen]);

  if (!isOpen) return null;

  const buy = async (id: string, name: string) => {
    if (payingRef.current) return; // guarantees Razorpay cannot open twice from rapid repeat clicks
    payingRef.current = true;
    setBuyingId(id);
    setPhase("opening");
    setPhaseMessage("Opening Razorpay...");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPhase("error"); setPhaseMessage("Please sign in again."); payingRef.current = false; setBuyingId(null); return; }

    try {
      await openRazorpayCheckout({
        planId: id,
        planName: name,
        billing: billingCycle,
        accessToken: session.access_token,
        onSuccess: () => {
          setPhase("success");
          setPhaseMessage("Payment successful! Updating your credits...");
          onPaymentSuccess?.();
          payingRef.current = false;
          setTimeout(() => { onClose(); }, 2500);
        },
        onFailure: (message) => {
          setPhase("error");
          setPhaseMessage(message || "Payment failed. Please try again.");
          payingRef.current = false;
          setBuyingId(null);
        },
        onDismiss: () => {
          // User closed the Razorpay checkout without paying — not an error.
          setPhase("idle");
          setPhaseMessage("");
          payingRef.current = false;
          setBuyingId(null);
        },
      });
    } catch (e: any) {
      setPhase("error");
      setPhaseMessage(e?.message || "Something went wrong. Please try again.");
      payingRef.current = false;
      setBuyingId(null);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", padding: 16 }}
    >
      <style>{`
        @keyframes um-fade-scale { from { opacity:0; transform:scale(0.94) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes um-spin { to { transform: rotate(360deg); } }
        @keyframes um-pop { 0%{transform:scale(1);} 50%{transform:scale(1.15);} 100%{transform:scale(1);} }
        .um-panel { animation: um-fade-scale .25s cubic-bezier(.16,1,.3,1) both; }
        .um-spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(0,0,0,0.3); border-top-color:#000; border-radius:50%; animation: um-spin .7s linear infinite; }
        .um-btn { transition: transform .15s ease, box-shadow .15s ease, background .15s ease; }
        .um-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px ${PRIMARY_GLOW}; }
        .um-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .um-card { transition: transform .15s ease, border-color .15s ease; }
        .um-card:hover { transform: translateY(-3px); border-color: ${PRIMARY} !important; }
        .um-credit-count { animation: um-pop .4s ease; }
        @media (max-width: 560px) {
          .um-plan-grid { grid-template-columns: 1fr !important; }
          .um-topup-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <div
        className="um-panel"
        onClick={e => e.stopPropagation()}
        style={{
          background: "rgba(13,13,13,0.92)", backdropFilter: "blur(20px)",
          border: `1px solid ${BORDER}`, borderRadius: 24, padding: "32px 28px",
          maxWidth: 720, width: "100%", maxHeight: "92vh", overflowY: "auto",
          textAlign: "center", fontFamily: "'DM Sans', sans-serif",
          boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${PRIMARY_GLOW}`,
        }}
      >
        {/* ── Payment status overlay ────────────────────────────── */}
        {phase === "success" ? (
          <div style={{ padding: "40px 20px" }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, marginBottom: 8 }}>Payment Successful!</h2>
            <p style={{ color: SOFT_GRAY, fontSize: 14 }}>{phaseMessage}</p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 44, marginBottom: 12 }}>{isCreditsIssue ? "⚡" : "🔒"}</div>

            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, background: HEADLINE_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {isCreditsIssue ? "You're out of generation credits." : "This feature requires a higher plan."}
            </h2>

            <p style={{ color: SOFT_GRAY, fontSize: 14, lineHeight: 1.7, marginBottom: 6 }}>
              {reason || (isCreditsIssue ? "Top up your credits or upgrade your plan to continue." : `${feature?.replace(/_/g, " ")} is available on paid plans.`)}
            </p>

            {isCreditsIssue && totalCredits !== undefined && (
              <p className="um-credit-count" key={`${remainingCredits}-${totalCredits}`} style={{ color: WHITE, fontWeight: 700, fontSize: 15, marginBottom: 18 }}>
                {remainingCredits} / {totalCredits} Remaining
              </p>
            )}

            {phase === "error" && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#E5736B" }}>
                ⚠️ {phaseMessage}
              </div>
            )}

            {/* ── Credit Top-up tiers ─────────────────────────────── */}
            <div style={{ textAlign: "left", marginBottom: 22 }}>
              <p style={{ fontSize: 11, color: SOFT_GRAY, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Credit Top-ups</p>
              <div className="um-topup-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {TOPUPS.map(tier => (
                  <button
                    key={tier.id}
                    className="um-btn um-card"
                    disabled={buyingId !== null}
                    onClick={() => buy(tier.id, `${tier.credits} Credits Top-up`)}
                    style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 8px", cursor: "pointer", textAlign: "center" }}>
                    <div style={{ color: PRIMARY, fontWeight: 800, fontSize: 17 }}>{tier.credits}</div>
                    <div style={{ color: SOFT_GRAY, fontSize: 10.5, marginBottom: 6 }}>Credits</div>
                    <div style={{ color: WHITE, fontWeight: 700, fontSize: 13 }}>${tier.usd}</div>
                    {buyingId === tier.id ? (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 10.5, color: SOFT_GRAY }}>
                        <span className="um-spinner" style={{ borderTopColor: PRIMARY, borderColor: "rgba(255,216,77,0.25)" }}/> Opening…
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 10.5, color: PRIMARY, fontWeight: 700 }}>Buy Now →</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0", color: SOFT_GRAY, fontSize: 11 }}>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
              OR
              <div style={{ flex: 1, height: 1, background: BORDER }} />
            </div>

            {/* ── Subscription plans ──────────────────────────────── */}
            <div style={{ textAlign: "left", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: SOFT_GRAY, textTransform: "uppercase" as const, letterSpacing: 1, fontWeight: 700 }}>Plans</p>
                <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3 }}>
                  {(["monthly","yearly"] as const).map(c => (
                    <button key={c} onClick={() => setBillingCycle(c)}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        background: billingCycle===c ? PRIMARY : "transparent", color: billingCycle===c ? "#000" : SOFT_GRAY }}>
                      {c === "monthly" ? "Monthly" : "Yearly"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="um-plan-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {PLANS.map(plan => {
                  const isCurrent = currentPlan === plan.id;
                  const price = billingCycle === "yearly" ? plan.yearlyUsd : plan.monthlyUsd;
                  return (
                    <div key={plan.id} className="um-card" style={{
                      background: plan.highlight ? "rgba(255,216,77,0.06)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${plan.highlight ? PRIMARY : BORDER}`, borderRadius: 12, padding: "14px 10px", position: "relative",
                    }}>
                      {plan.badge && !isCurrent && (
                        <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: PRIMARY, color: "#000", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                          {plan.badge}
                        </div>
                      )}
                      {isCurrent && (
                        <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: "rgba(255,255,255,0.15)", color: WHITE, fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                          Current Plan
                        </div>
                      )}
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{plan.emoji}</div>
                      <div style={{ color: WHITE, fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{plan.name}</div>
                      <div style={{ color: PRIMARY, fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{price === 0 ? "Free" : `$${price}`}<span style={{ fontSize: 10, color: SOFT_GRAY, fontWeight: 400 }}>{price > 0 ? "/mo" : ""}</span></div>
                      <div style={{ color: SOFT_GRAY, fontSize: 10, marginBottom: 8 }}>{plan.creditsLabel}</div>
                      <button
                        className="um-btn"
                        disabled={isCurrent || buyingId !== null}
                        onClick={() => buy(plan.id, `${plan.name} Plan`)}
                        style={{
                          width: "100%", padding: "7px 4px", borderRadius: 8, border: "none", fontSize: 10.5, fontWeight: 700, cursor: isCurrent ? "default" : "pointer",
                          background: isCurrent ? "rgba(255,255,255,0.06)" : PRIMARY, color: isCurrent ? SOFT_GRAY : "#000",
                        }}>
                        {buyingId === plan.id ? <span className="um-spinner" style={{ borderTopColor:"#000" }}/> : (isCurrent ? "Current" : plan.cta)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Recent top-up history (reuses credit_transactions) ── */}
            {recentTopups.length > 0 && (
              <div style={{ textAlign: "left", marginBottom: 18 }}>
                <p style={{ fontSize: 11, color: SOFT_GRAY, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Recent Top-ups</p>
                {recentTopups.map((t, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: SOFT_GRAY, padding: "5px 0", borderBottom: i < recentTopups.length-1 ? `1px solid ${BORDER}` : "none" }}>
                    <span>{t.description}</span>
                    <span>{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={onClose} style={{ background: "none", border: "none", color: "#444", fontSize: 12, cursor: "pointer", padding: "4px" }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
        
