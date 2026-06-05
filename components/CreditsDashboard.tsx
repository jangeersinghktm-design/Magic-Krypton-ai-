"use client";
// components/CreditsDashboard.tsx
// Krypton AI — Credits System with Razorpay

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface CreditData {
  total_credits: number;
  used_credits: number;
  plan: string;
  credits_reset_at: string;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 499,
    credits: 500,
    features: ["500 credits/month", "10 projects", "Deploy", "Export ZIP"],
    color: "#00D084",
    razorpayPlanId: "plan_starter_id", // Replace with actual Razorpay plan ID
  },
  {
    id: "pro",
    name: "Pro",
    price: 999,
    credits: 2000,
    popular: true,
    features: ["2000 credits/month", "Unlimited projects", "All features", "Priority support"],
    color: "#F5C542",
    razorpayPlanId: "plan_pro_id",
  },
  {
    id: "team",
    name: "Team",
    price: 2499,
    credits: 5000,
    features: ["5000 credits/month", "5 members", "Team workspace", "Analytics"],
    color: "#7C3AED",
    razorpayPlanId: "plan_team_id",
  },
];

const TOPUPS = [
  { credits: 100, price: 99, label: "Starter Pack" },
  { credits: 300, price: 249, label: "Value Pack", popular: true },
  { credits: 700, price: 499, label: "Power Pack" },
  { credits: 1500, price: 899, label: "Pro Pack" },
];

function timeUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)} days`;
  return `${h}h ${m}m`;
}

const txIcon: Record<string, string> = {
  purchase: "💳", usage: "⚡", refund: "↩", bonus: "🎁",
  referral: "👥", monthly_reset: "🔄",
};
const txColor: Record<string, string> = {
  purchase: "#00D084", usage: "#F5C542", refund: "#00D084",
  bonus: "#00D084", referral: "#00D084", monthly_reset: "#7C3AED",
};

export default function CreditsDashboard() {
  const supabase = createClientComponentClient();
  const [data, setData]       = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying]   = useState<string | null>(null);
  const [tab, setTab]         = useState<"overview" | "plans" | "topup" | "history">("overview");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const [profileRes, txRes] = await Promise.all([
      supabase.from("profiles")
        .select("total_credits, used_credits, plan, credits_reset_at")
        .eq("id", session.user.id).single(),
      supabase.from("credit_transactions")
        .select("*").eq("user_id", session.user.id)
        .order("created_at", { ascending: false }).limit(20),
    ]);

    setData({
      total_credits: profileRes.data?.total_credits || 0,
      used_credits: profileRes.data?.used_credits || 0,
      plan: profileRes.data?.plan || "free",
      credits_reset_at: profileRes.data?.credits_reset_at || "",
      transactions: txRes.data || [],
    });
    setLoading(false);
  };

  // ── Razorpay payment ──────────────────────────────────────────
  const startPayment = async (type: "plan" | "topup", item: { id?: string; credits: number; price: number; name?: string; label?: string }) => {
    setPaying(item.id || item.label || "");

    try {
      // 1. Create Razorpay order
      const orderRes = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, planId: item.id, credits: item.credits, amount: item.price }),
      });
      const order = await orderRes.json();

      // 2. Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: "INR",
        name: "Krypton AI",
        description: type === "plan"
          ? `${item.name} Plan — ${item.credits} credits/month`
          : `${item.credits} Credits Top-up`,
        order_id: order.id,
        theme: { color: "#F5C542" },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          // 3. Verify payment
          const verifyRes = await fetch("/api/credits/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              type, credits: item.credits, planId: item.id,
            }),
          });
          if (verifyRes.ok) {
            await loadData(); // Refresh credits
            alert("✅ Credits added successfully!");
          }
        },
        prefill: { name: "", email: "", contact: "" },
        modal: { ondismiss: () => setPaying(null) },
      };

      // Load Razorpay script dynamically
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        // @ts-ignore
        const rzp = new window.Razorpay(options);
        rzp.open();
      };
      document.body.appendChild(script);
    } catch (err) {
      alert("Payment failed. Please try again.");
    } finally {
      setPaying(null);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "#555" }}>Loading credits...</div>
  );
  if (!data) return null;

  const available = data.total_credits - data.used_credits;
  const usedPercent = Math.min((data.used_credits / data.total_credits) * 100, 100);

  return (
    <>
      <style>{`
        .cd { max-width: 800px; font-family: 'DM Sans', sans-serif; padding: 0; }

        /* Tabs */
        .cd-tabs {
          display: flex; gap: 4px; margin-bottom: 24px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px; padding: 4px; width: fit-content;
        }
        .cd-tab {
          padding: 7px 18px; border-radius: 7px; border: none;
          background: transparent; color: #555; font-size: 12.5px; font-weight: 600;
          cursor: pointer; transition: all 0.18s;
        }
        .cd-tab.active {
          background: rgba(245,197,66,0.12); color: #F5C542;
        }

        /* Overview card */
        .cd-overview {
          background: linear-gradient(135deg,rgba(13,13,13,1),rgba(18,18,18,1));
          border: 1px solid rgba(245,197,66,0.15); border-radius: 18px;
          padding: 28px; margin-bottom: 20px; position: relative; overflow: hidden;
        }
        .cd-overview::before {
          content: ''; position: absolute;
          width: 200px; height: 200px; border-radius: 50%;
          background: radial-gradient(circle,rgba(245,197,66,0.07),transparent 70%);
          top: -50px; right: -50px;
        }
        .cd-plan-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(245,197,66,0.1); color: #F5C542;
          font-size: 11px; font-weight: 700; padding: 4px 12px;
          border-radius: 20px; border: 1px solid rgba(245,197,66,0.2);
          text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 16px;
        }
        .cd-credits-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 16px; }
        .cd-credits-num {
          font-size: 48px; font-weight: 900; line-height: 1;
          background: linear-gradient(135deg,#F5C542,#00D084);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .cd-credits-label { font-size: 15px; color: #555; }
        .cd-bar-wrap {
          background: rgba(255,255,255,0.06); border-radius: 8px;
          height: 8px; overflow: hidden; margin-bottom: 10px;
        }
        .cd-bar-fill {
          height: 100%; border-radius: 8px;
          background: linear-gradient(90deg,#F5C542,#00D084);
          transition: width 1s ease;
        }
        .cd-bar-info { display: flex; justify-content: space-between; font-size: 12px; color: #555; }
        .cd-reset { color: #3a3a3a; font-size: 11.5px; margin-top: 12px; }
        .cd-reset span { color: #F5C542; font-weight: 600; }

        /* Stats grid */
        .cd-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 20px; }
        .cd-stat {
          background: #0d0d0d; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; padding: 16px 18px;
        }
        .cd-stat-label { font-size: 11px; color: #444; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
        .cd-stat-val { font-size: 22px; font-weight: 800; color: #fff; }

        /* Plans */
        .cd-plans { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
        .cd-plan {
          background: #0d0d0d; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 22px; position: relative; overflow: hidden;
          transition: transform 0.18s, border-color 0.18s;
        }
        .cd-plan:hover { transform: translateY(-2px); }
        .cd-plan.popular { border-color: rgba(245,197,66,0.3); }
        .cd-popular-badge {
          position: absolute; top: 12px; right: 12px;
          background: #F5C542; color: #000; font-size: 9.5px;
          font-weight: 800; padding: 2px 8px; border-radius: 4px;
        }
        .cd-plan-name { font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 4px; }
        .cd-plan-price {
          font-size: 28px; font-weight: 900; margin: 10px 0;
        }
        .cd-plan-price span { font-size: 14px; font-weight: 400; color: #555; }
        .cd-plan-features { list-style: none; margin: 14px 0; padding: 0; }
        .cd-plan-features li {
          font-size: 12.5px; color: #666; padding: 4px 0;
          display: flex; align-items: center; gap: 7px;
        }
        .cd-plan-features li::before { content: '✓'; color: #00D084; font-weight: 700; }
        .cd-plan-btn {
          width: 100%; padding: 10px 0; border-radius: 9px;
          border: none; font-size: 13px; font-weight: 700; cursor: pointer;
          transition: opacity 0.18s;
        }
        .cd-plan-btn:hover { opacity: 0.85; }

        /* Top-up */
        .cd-topups { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
        .cd-topup {
          background: #0d0d0d; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 13px; padding: 18px; cursor: pointer;
          transition: all 0.18s; position: relative;
        }
        .cd-topup:hover { border-color: rgba(245,197,66,0.3); }
        .cd-topup.popular { border-color: rgba(0,208,132,0.25); }
        .cd-topup-pop {
          position: absolute; top: 10px; right: 10px;
          background: rgba(0,208,132,0.15); color: #00D084;
          font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 4px;
        }
        .cd-topup-credits { font-size: 24px; font-weight: 900; color: #F5C542; margin-bottom: 4px; }
        .cd-topup-label { font-size: 11.5px; color: #555; margin-bottom: 10px; }
        .cd-topup-price {
          font-size: 16px; font-weight: 800; color: #fff;
        }
        .cd-topup-btn {
          margin-top: 12px; width: 100%; padding: 8px 0; border-radius: 8px;
          background: rgba(245,197,66,0.1); border: 1px solid rgba(245,197,66,0.25);
          color: #F5C542; font-size: 12.5px; font-weight: 700; cursor: pointer;
          transition: all 0.15s;
        }
        .cd-topup-btn:hover { background: rgba(245,197,66,0.2); }

        /* History */
        .cd-history { display: flex; flex-direction: column; gap: 8px; }
        .cd-tx {
          display: flex; align-items: center; gap: 12px;
          background: #0d0d0d; border: 1px solid rgba(255,255,255,0.05);
          border-radius: 10px; padding: 12px 16px;
        }
        .cd-tx-icon { font-size: 18px; flex-shrink: 0; }
        .cd-tx-info { flex: 1; }
        .cd-tx-desc { font-size: 13px; color: #e8e8e8; margin-bottom: 3px; }
        .cd-tx-time { font-size: 11px; color: #444; }
        .cd-tx-amount { font-size: 15px; font-weight: 800; }
      `}</style>

      <div className="cd">

        {/* Tabs */}
        <div className="cd-tabs">
          {(["overview","plans","topup","history"] as const).map((t) => (
            <button key={t} className={`cd-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}>
              {t === "overview" ? "📊 Overview" :
               t === "plans"    ? "💎 Plans" :
               t === "topup"    ? "⚡ Top Up" : "📋 History"}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <>
            <div className="cd-overview">
              <div className="cd-plan-badge">
                ✦ {data.plan.toUpperCase()} PLAN
              </div>
              <div className="cd-credits-row">
                <div className="cd-credits-num">{available.toLocaleString()}</div>
                <div className="cd-credits-label">credits remaining</div>
              </div>
              <div className="cd-bar-wrap">
                <div className="cd-bar-fill" style={{ width: `${100 - usedPercent}%` }} />
              </div>
              <div className="cd-bar-info">
                <span>{data.used_credits.toLocaleString()} used</span>
                <span>{data.total_credits.toLocaleString()} total</span>
              </div>
              {data.credits_reset_at && (
                <div className="cd-reset">
                  Resets in <span>{timeUntil(data.credits_reset_at)}</span>
                </div>
              )}
            </div>

            <div className="cd-stats">
              <div className="cd-stat">
                <div className="cd-stat-label">Total Credits</div>
                <div className="cd-stat-val">{data.total_credits.toLocaleString()}</div>
              </div>
              <div className="cd-stat">
                <div className="cd-stat-label">Used Today</div>
                <div className="cd-stat-val">
                  {data.transactions
                    .filter(t => t.type === "usage" &&
                      new Date(t.created_at).toDateString() === new Date().toDateString())
                    .reduce((sum, t) => sum + Math.abs(t.amount), 0)}
                </div>
              </div>
              <div className="cd-stat">
                <div className="cd-stat-label">Transactions</div>
                <div className="cd-stat-val">{data.transactions.length}</div>
              </div>
            </div>
          </>
        )}

        {/* Plans */}
        {tab === "plans" && (
          <div className="cd-plans">
            {PLANS.map((plan) => (
              <div key={plan.id} className={`cd-plan ${plan.popular ? "popular" : ""}`}>
                {plan.popular && <div className="cd-popular-badge">POPULAR</div>}
                <div className="cd-plan-name" style={{ color: plan.color }}>{plan.name}</div>
                <div className="cd-plan-price" style={{ color: plan.color }}>
                  ₹{plan.price}<span>/month</span>
                </div>
                <ul className="cd-plan-features">
                  {plan.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <button
                  className="cd-plan-btn"
                  style={{
                    background: data.plan === plan.id
                      ? "rgba(255,255,255,0.05)"
                      : `linear-gradient(135deg,${plan.color},${plan.color}cc)`,
                    color: data.plan === plan.id ? "#555" : "#000",
                    cursor: data.plan === plan.id ? "not-allowed" : "pointer",
                  }}
                  disabled={data.plan === plan.id || paying === plan.id}
                  onClick={() => startPayment("plan", plan)}
                >
                  {data.plan === plan.id ? "Current Plan" :
                   paying === plan.id ? "Processing..." : `Upgrade to ${plan.name}`}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Top Up */}
        {tab === "topup" && (
          <div className="cd-topups">
            {TOPUPS.map((t) => (
              <div key={t.credits} className={`cd-topup ${t.popular ? "popular" : ""}`}>
                {t.popular && <div className="cd-topup-pop">BEST VALUE</div>}
                <div className="cd-topup-credits">{t.credits} credits</div>
                <div className="cd-topup-label">{t.label}</div>
                <div className="cd-topup-price">₹{t.price}</div>
                <button
                  className="cd-topup-btn"
                  disabled={paying === t.label}
                  onClick={() => startPayment("topup", t)}
                >
                  {paying === t.label ? "Processing..." : "Buy Now →"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {tab === "history" && (
          <div className="cd-history">
            {data.transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                No transactions yet
              </div>
            ) : (
              data.transactions.map((tx) => (
                <div key={tx.id} className="cd-tx">
                  <div className="cd-tx-icon">{txIcon[tx.type] || "💳"}</div>
                  <div className="cd-tx-info">
                    <div className="cd-tx-desc">{tx.description || tx.type}</div>
                    <div className="cd-tx-time">
                      {new Date(tx.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                    </div>
                  </div>
                  <div className="cd-tx-amount"
                    style={{ color: tx.amount > 0 ? "#00D084" : "#F5C542" }}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}

