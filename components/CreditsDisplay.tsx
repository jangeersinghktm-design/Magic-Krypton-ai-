"use client";

// components/CreditsDisplay.tsx
// Use this on EVERY page to show credit status

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";

interface CreditInfo {
  plan: string;
  remaining: number;
  total: number;
  nextReset: string | null;
  periodEnd: string | null;
}

export default function CreditsDisplay({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [info, setInfo] = useState<CreditInfo | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/credits", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInfo({
          plan: data.plan,
          remaining: data.remaining,
          total: data.total,
          nextReset: data.nextReset,
          periodEnd: data.periodEnd,
        });
      }
    };
    load();
  }, []);

  if (!info) return null;

  const pct = info.total > 0 ? Math.max(5, (info.remaining / info.total) * 100) : 5;
  const isLow = info.remaining <= (info.plan === "free" ? 1 : info.total * 0.1);
  const planLabel = info.plan.charAt(0).toUpperCase() + info.plan.slice(1);

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: isLow ? "rgba(239,68,68,0.1)" : "rgba(0,204,68,0.1)", border: `1px solid ${isLow ? "rgba(239,68,68,0.3)" : "rgba(0,204,68,0.3)"}`, cursor: "pointer" }}
        onClick={() => window.open("/billing", "_blank")}>
        <span style={{ fontSize: 12 }}>⚡</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: isLow ? "#ef4444" : "#00CC44" }}>{info.remaining}</span>
      </div>
    );
  }

  return (
    <div style={{ background: "#0D0D0D", border: `1px solid ${isLow ? "rgba(239,68,68,0.3)" : "rgba(245,197,66,0.15)"}`, borderRadius: 14, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 11, color: "#666", textTransform: "uppercase" as const, letterSpacing: 1 }}>Plan</span>
          <p style={{ fontSize: 15, fontWeight: 700, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "2px 0 0" }}>
            {planLabel}
          </p>
        </div>
        <button onClick={() => window.open("/billing", "_blank")} style={{ padding: "5px 12px", background: G, border: "none", borderRadius: 7, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          Upgrade ⚡
        </button>
      </div>

      {/* Credits bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#666" }}>Credits</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: isLow ? "#ef4444" : "#00CC44" }}>
            {info.remaining} / {info.total}
          </span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: isLow ? "linear-gradient(90deg,#ef4444,#f59e0b)" : G, borderRadius: 4, transition: "width 0.5s" }} />
        </div>
      </div>

      {/* Next reset */}
      {info.plan === "free" && (
        <p style={{ fontSize: 11, color: "#444", margin: 0 }}>
          🔄 Resets daily when all credits used
        </p>
      )}
      {info.plan !== "free" && info.periodEnd && (
        <p style={{ fontSize: 11, color: "#444", margin: 0 }}>
          🔄 Renews: {new Date(info.periodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}

      {isLow && (
        <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 12, color: "#ef4444", cursor: "pointer" }}
          onClick={() => window.open("/billing", "_blank")}>
          ⚠️ {info.remaining === 0 ? "No credits left! Upgrade to continue." : `Only ${info.remaining} credit${info.remaining === 1 ? "" : "s"} left!`}
        </div>
      )}
    </div>
  );
}

