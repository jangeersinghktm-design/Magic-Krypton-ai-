"use client";

// components/UpgradeModal.tsx
// Shows when free user tries to access a paid feature

import { useRouter } from "next/navigation";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
  reason?: string;
  remainingCredits?: number;
}

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
const T = { gold: "#F5D800", green: "#00CC44", border: "rgba(245,197,66,0.12)", muted: "#6B7280" };

export default function UpgradeModal({ isOpen, onClose, feature, reason, remainingCredits }: UpgradeModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const isCreditsIssue = remainingCredits !== undefined && remainingCredits === 0;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)", padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 20, padding: "36px 32px", maxWidth: 440, width: "100%", textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}
      >
        <div style={{ fontSize: 52, marginBottom: 16 }}>
          {isCreditsIssue ? "⚡" : "🔒"}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {isCreditsIssue ? "Out of Credits!" : "Upgrade Required"}
        </h2>

        <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          {reason || `${feature?.replace(/_/g, " ")} is available on paid plans.`}
        </p>

        {isCreditsIssue && (
          <div style={{ background: "rgba(245,197,66,0.06)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: T.muted }}>
            💡 <strong style={{ color: T.gold }}>Free plan</strong> gets 5 credits daily. They reset every 24 hours.
          </div>
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
              <span style={{ color: T.green }}>✓</span> {f}
            </p>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => { window.open("/billing", "_blank"); onClose(); }}
            style={{ width: "100%", padding: "14px", background: G, border: "none", borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
            💳 View Plans & Upgrade →
          </button>

          {isCreditsIssue && (
            <button
              onClick={onClose}
              style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 10, color: T.muted, fontSize: 13, cursor: "pointer" }}>
              Wait for daily reset (5 free credits/day)
            </button>
          )}

          <button onClick={onClose} style={{ background: "none", border: "none", color: "#444", fontSize: 12, cursor: "pointer", padding: "4px" }}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

