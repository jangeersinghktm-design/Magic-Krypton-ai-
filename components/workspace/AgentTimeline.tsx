"use client";
// components/workspace/AgentTimeline.tsx
// Krypton AI — Engineering Workflow Timeline v2
// Platinum / Silver / Deep-Space — no AI vendor names exposed to user.
// Phase order reflects the REAL backend execution sequence
// (Validation runs before Optimization — repair-then-polish).

import { useEffect, useRef } from "react";

export interface AgentPhaseEvent {
  agent:    string;
  icon:     string;
  action:   string;
  pct:      number;
  done?:    boolean;
  status?:  "running" | "done" | "error";
}

interface AgentTimelineProps {
  phases:        AgentPhaseEvent[];
  isActive:      boolean;
  currentAgent?: string;
}

// Internal SSE keys → user-facing engineering workflow labels.
// Six named stages, matching the platform's actual execution order.
const WORKFLOW_STATES: Record<string, string> = {
  "Reading":        "Planning",
  "Understanding":  "Planning",
  "Planning":       "Architecture",
  "Building":       "Generation",
  "Validating":     "Validation",
  "Optimizing":     "Optimization",
  "Finalizing":     "Completed",
  // Legacy compatibility keys
  "Planner":        "Planning",
  "Researcher":     "Planning",
  "Designer":       "Architecture",
  "Builder":        "Generation",
  "Validator":      "Validation",
  "Optimizer":      "Optimization",
  "Project Manager":"Completed",
};

// Fixed ordered stages — matches real backend sequence
const ALL_STATES = [
  "Planning",
  "Architecture",
  "Generation",
  "Validation",
  "Optimization",
  "Completed",
];

const C = {
  white:    "#F5F5F5",
  silver:   "#D9D9D9",
  success:  "#5FB88A",
  muted:    "#5B6472",
  border:   "rgba(255,255,255,0.07)",
  borderHi: "rgba(245,245,245,0.18)",
  text:     "#9AA3AF",
  surface:  "rgba(255,255,255,0.02)",
};

export default function AgentTimeline({ phases, isActive }: AgentTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [phases]);

  // Build map: displayLabel → { done, active, pct }
  // Multiple backend agents can map to the same display stage (e.g. Reading
  // + Understanding both roll into "Planning") — we take the latest state.
  const stateStatus: Record<string, { done: boolean; active: boolean; pct: number }> = {};
  phases.forEach(p => {
    const label = WORKFLOW_STATES[p.agent];
    if (label) {
      const existing = stateStatus[label];
      stateStatus[label] = {
        done:   existing?.done || !!p.done,
        active: !p.done && isActive,
        pct:    p.pct || existing?.pct || 0,
      };
    }
  });

  const reachedCount = ALL_STATES.filter(s => stateStatus[s]).length;
  const completedCount = ALL_STATES.filter(s => stateStatus[s]?.done).length;
  const isDone = !isActive && completedCount === ALL_STATES.length;

  return (
    <div style={{
      background:   C.surface,
      border:       `1px solid ${C.border}`,
      borderRadius: 14,
      overflow:     "hidden",
      fontFamily:   "'Inter', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding:      "11px 16px",
        borderBottom: `1px solid ${C.border}`,
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        background:   "rgba(255,255,255,0.015)",
      }}>
        {isDone ? (
          <span style={{ color: C.success, fontSize: 13 }}>✓</span>
        ) : (
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: C.white,
            animation: "krAgentPulse 1.6s ease-in-out infinite",
            flexShrink: 0,
          }}/>
        )}
        <span style={{
          fontSize: 11.5, fontWeight: 600, letterSpacing: "0.01em",
          color: isDone ? C.success : C.white,
        }}>
          {isDone ? "Build Complete" : "Engineering Workflow"}
        </span>
        {isActive && (
          <div style={{
            marginLeft: "auto",
            height: 2, width: 80,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 4, overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.round((completedCount / ALL_STATES.length) * 100)}%`,
              background: `linear-gradient(90deg,${C.white},${C.silver})`,
              borderRadius: 4,
              transition: "width .5s cubic-bezier(0.16,1,0.3,1)",
            }}/>
          </div>
        )}
      </div>

      {/* Steps — vertical timeline with connecting line */}
      <div style={{ padding: "10px 0 12px", position: "relative" }}>
        {ALL_STATES.map((label, i) => {
          const info       = stateStatus[label];
          const isDoneS    = info?.done   || false;
          const isActiveS  = info?.active || false;
          const notReached = !info;
          const isLast     = i === ALL_STATES.length - 1;

          return (
            <div key={label} style={{ position: "relative" }}>
              <div style={{
                display:    "flex",
                alignItems: "center",
                gap:        12,
                padding:    "7px 16px",
                opacity:    notReached ? 0.3 : 1,
                transition: "opacity .35s ease",
              }}>
                {/* Connecting line segment */}
                {!isLast && (
                  <div style={{
                    position: "absolute", left: 24, top: 28, width: 1, height: 22,
                    background: isDoneS ? "rgba(95,184,138,0.3)" : "rgba(255,255,255,0.08)",
                    transition: "background .3s ease",
                  }}/>
                )}

                {/* Indicator */}
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isDoneS   ? "rgba(95,184,138,0.12)"
                            : isActiveS ? "rgba(245,245,245,0.1)"
                            :             "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    isDoneS   ? "rgba(95,184,138,0.4)"
                  : isActiveS ? C.borderHi
                  :             "rgba(255,255,255,0.08)"
                  }`,
                  transition: "all .3s ease",
                  zIndex: 1,
                }}>
                  {isDoneS ? (
                    <span style={{ color: C.success, fontSize: 9, fontWeight: 800 }}>✓</span>
                  ) : isActiveS ? (
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      border: "1.5px solid rgba(245,245,245,0.25)",
                      borderTopColor: C.white,
                      animation: "krAgentSpin .7s linear infinite",
                    }}/>
                  ) : (
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.18)" }}/>
                  )}
                </div>

                {/* Label */}
                <span style={{
                  fontSize:   13,
                  color:      isDoneS   ? "rgba(255,255,255,0.35)"
                            : isActiveS ? C.white
                            :             C.text,
                  textDecoration: isDoneS ? "line-through" : "none",
                  textDecorationColor: "rgba(255,255,255,0.15)",
                  fontWeight: isActiveS ? 600 : 400,
                  flex: 1,
                  transition: "all .3s ease",
                }}>
                  {label}
                </span>

                {/* Progress % (active only) */}
                {isActiveS && info?.pct > 0 && (
                  <span style={{ fontSize: 10.5, color: "rgba(245,245,245,0.4)", flexShrink: 0, fontFamily: "monospace" }}>
                    {info.pct}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes krAgentPulse { 0%,100%{opacity:.4;transform:scale(.85)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes krAgentSpin  { to{transform:rotate(360deg)} }
      `}</style>

      <div ref={endRef}/>
    </div>
  );
}
