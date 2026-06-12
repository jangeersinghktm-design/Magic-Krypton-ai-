"use client";
// components/workspace/AgentTimeline.tsx
// Krypton AI — Execution Timeline
// Clean linear progress — no AI vendor names, no agent labels

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

// Internal keys from SSE → user-facing Krypton workflow labels
// User NEVER sees "Planner", "Builder", "QA Tester" etc.
const WORKFLOW_STATES: Record<string, string> = {
  // Current keys (sent by orchestrate route)
  "Reading":       "Reading Request",
  "Understanding": "Understanding Goal",
  "Planning":      "Creating Plan",
  "Building":      "Building Project",
  "Validating":    "Validating Output",
  "Optimizing":    "Optimizing Result",
  "Finalizing":    "Finalizing",
  // Legacy compatibility keys
  "Planner":       "Reading Request",
  "Researcher":    "Understanding Goal",
  "Designer":      "Creating Plan",
  "Builder":       "Building Project",
  "Validator":     "Validating Output",
  "Optimizer":     "Optimizing Result",
  "Project Manager":"Finalizing",
};

// Fixed ordered steps — always shown in same order
const ALL_STATES = [
  "Reading Request",
  "Understanding Goal",
  "Creating Plan",
  "Building Project",
  "Validating Output",
  "Optimizing Result",
  "Finalizing",
];

const C = {
  gold:   "#FFD700",
  green:  "#00D084",
  muted:  "#3D4A5C",
  border: "rgba(255,255,255,0.05)",
  text:   "#94A3B8",
};

export default function AgentTimeline({ phases, isActive }: AgentTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [phases]);

  // Build map: displayLabel → { done, active, pct }
  const stateStatus: Record<string, { done: boolean; active: boolean; pct: number }> = {};
  phases.forEach(p => {
    const label = WORKFLOW_STATES[p.agent];
    if (label) {
      stateStatus[label] = {
        done:   !!p.done,
        active: !p.done && isActive,
        pct:    p.pct || 0,
      };
    }
  });

  const completedCount = phases.filter(p => p.done).length;
  const isDone = !isActive && completedCount > 0;

  return (
    <div style={{
      background:   "rgba(255,255,255,0.02)",
      border:       "1px solid rgba(255,215,0,0.08)",
      borderRadius: 14,
      overflow:     "hidden",
      fontFamily:   "'DM Sans', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding:        "9px 14px",
        borderBottom:   "1px solid rgba(255,255,255,0.05)",
        display:        "flex",
        alignItems:     "center",
        gap:            10,
        background:     "rgba(255,215,0,0.02)",
      }}>
        {isDone ? (
          <span style={{ color: C.green, fontSize: 13 }}>✓</span>
        ) : (
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: C.gold,
            animation: "pulse 1.5s ease-in-out infinite",
            flexShrink: 0,
          }}/>
        )}
        <span style={{
          fontSize: 11.5, fontWeight: 600,
          color: isDone ? C.green : C.gold,
        }}>
          {isDone ? "Complete" : "Krypton Intelligence Engine"}
        </span>
        {isActive && (
          <div style={{
            marginLeft: "auto",
            height: 2, width: 72,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 4, overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.round((completedCount / ALL_STATES.length) * 100)}%`,
              background: "linear-gradient(90deg,#FFD700,#FF7A00)",
              borderRadius: 4,
              transition: "width .5s ease",
            }}/>
          </div>
        )}
      </div>

      {/* Steps */}
      <div style={{ padding: "8px 0 10px" }}>
        {ALL_STATES.map((label, i) => {
          const info       = stateStatus[label];
          const isDoneS    = info?.done   || false;
          const isActiveS  = info?.active || false;
          const notReached = !info;

          return (
            <div key={label} style={{
              display:    "flex",
              alignItems: "center",
              gap:        12,
              padding:    "6px 14px",
              opacity:    notReached ? 0.28 : 1,
              transition: "opacity .3s ease",
            }}>
              {/* Indicator */}
              <div style={{
                width:          18, height: 18,
                borderRadius:   "50%",
                flexShrink:     0,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                background:     isDoneS  ? "rgba(0,208,132,0.1)"
                              : isActiveS ? "rgba(255,215,0,0.1)"
                              : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  isDoneS   ? "rgba(0,208,132,0.35)"
                : isActiveS ? "rgba(255,215,0,0.35)"
                :             "rgba(255,255,255,0.07)"
                }`,
                transition: "all .3s ease",
              }}>
                {isDoneS ? (
                  <span style={{ color: C.green, fontSize: 9, fontWeight: 800 }}>✓</span>
                ) : isActiveS ? (
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    border: "1.5px solid rgba(255,215,0,0.3)",
                    borderTopColor: C.gold,
                    animation: "spin .7s linear infinite",
                  }}/>
                ) : (
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }}/>
                )}
              </div>

              {/* Label */}
              <span style={{
                fontSize:           13,
                color:              isDoneS  ? "rgba(255,255,255,0.2)"
                                  : isActiveS ? C.gold
                                  :             C.text,
                textDecoration:     isDoneS ? "line-through" : "none",
                textDecorationColor:"rgba(255,255,255,0.12)",
                fontWeight:         isActiveS ? 600 : 400,
                flex:               1,
                transition:         "all .3s ease",
              }}>
                {label}
              </span>

              {/* Progress % (active only) */}
              {isActiveS && info?.pct > 0 && (
                <span style={{ fontSize: 10.5, color: "rgba(255,215,0,0.45)", flexShrink: 0 }}>
                  {info.pct}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div ref={endRef}/>
    </div>
  );
}
