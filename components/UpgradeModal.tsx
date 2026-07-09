"use client";

// components/UpgradeModal.tsx
// Shows when free user tries to access a paid feature, or is out of credits.

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
  reason?: string;
  remainingCredits?: number;
}

// Brand pair — gold + white only (kept consistent with login/billing pages).
const G = "linear-gradient(135deg, #F5D800 0%, #FFFFFF 100%)";
const T = { gold: "#F5D800", white: "#FFFFFF", border: "rgba(245,197,66,0.12)", muted: "#6B7280" };

// Same top-up tiers as app/billing/page.tsx — kept in sync manually since
// there's no shared constants file for this yet.
const TOPUP_TIERS = [
  { credits: 50,  price: 15  },
  { credits: 100, price: 30  },
  { credits: 200, price: 60  },
  { credits: 500, price: 150 },
];

export default function UpgradeModal({ isOpen, onClose, feature, reason, remainingCredits }: UpgradeModalProps) {
  if (!isOpen) return null;

  const isCreditsIssue = remainingCredits !== undefined && remainingCredits === 0;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)", padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 20, padding: "36px 32px", maxWidth: 460, width: "100%", textAlign: "center", fontFamily: "'DM Sans', sans-serif", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ fontSize: 52, marginBottom: 16 }}>
          {isCreditsIssue ? "⚡" : "🔒"}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {isCreditsIssue ? "You're out of generation credits." : "This feature requires a higher plan."}
        </h2>

        <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          {reason || (isCreditsIssue
            ? "Top up your credits to continue generating."
            : `${feature?.replace(/_/g, " ")} is available on paid plans.`)}
        </p>

        {isCreditsIssue && (
          <>
            <div style={{ background: "rgba(245,216,0,0.06)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: T.muted }}>
              💡 <strong style={{ color: T.gold }}>Free plan</strong> gets 5 credits daily. They reset every 24 hours.
            </div>

            {/* Top-up tiers — same as Billing → Plans page */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {TOPUP_TIERS.map(tier => (
                <button
                  key={tier.credits}
                  onClick={() => { window.open("/billing?topup="+tier.credits, "_blank"); onClose(); }}
                  style={{ background: "#161616", border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 8px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ color: T.gold, fontWeight: 800, fontSize: 16 }}>+{tier.credits}</div>
                  <div style={{ color: T.muted, fontSize: 11, marginBottom: 2 }}>Credits</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>${tier.price}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Feature comparison */}
        <div style={{ background: "#161616", borderRadius: 12, padding: "16px", marginBottom: 20, textAlign: "left" }}>
          <p style={{ fontSize: 11, color: "#444", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 10 }}>Pro Plan Includes</p>
          {[
            "Unlimited project saves",
            "100 generations/month",
            "Better AI quality",
            "Export full source code",
            "Premium templates",
            "Email support",
          ].map(f => (
            <p key={f} style={{ fontSize: 13, color: T.muted, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: T.gold }}>✓</span> {f}
            </p>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {isCreditsIssue && (
            <button
              onClick={() => { window.open("/billing?tab=topup", "_blank"); onClose(); }}
              style={{ width: "100%", padding: "14px", background: G, border: "none", borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              ⚡ Top Up Credits
            </button>
          )}

          <button
            onClick={() => { window.open("/billing", "_blank"); onClose(); }}
            style={{
              width: "100%", padding: "14px",
              background: isCreditsIssue ? "rgba(245,216,0,0.08)" : G,
              border: isCreditsIssue ? `1px solid ${T.border}` : "none",
              borderRadius: 10,
              color: isCreditsIssue ? T.gold : "#000",
              fontWeight: 800, fontSize: 15, cursor: "pointer",
            }}>
            💳 {isCreditsIssue ? "Upgrade Plan" : "Upgrade Plan →"}
          </button>

          {isCreditsIssue && (
            <button
              onClick={onClose}
              style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 10, color: T.muted, fontSize: 13, cursor: "pointer" }}>
              Wait for daily reset (5 free credits/day)
            </button>
          )}

          <button onClick={onClose} style={{ background: "none", border: "none", color: "#444", fontSize: 12, cursor: "pointer", padding: "4px" }}>
            {isCreditsIssue ? "Maybe later" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
