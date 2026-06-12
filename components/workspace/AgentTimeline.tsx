"use client";
// components/workspace/AgentTimeline.tsx
// Krypton AI — Clean Claude-style Execution Timeline
// No agent names. No AI branding. Pure Krypton workflow states.

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

// Map internal agent names → user-facing Krypton workflow states
const WORKFLOW_STATES: Record<string, { label: string; icon: string }> = {
  "Planner":          { label: "Reading Request",    icon: "○" },
  "Researcher":       { label: "Understanding Goal",  icon: "○" },
  "Designer":         { label: "Creating Plan",       icon: "○" },
  "Builder":          { label: "Building Project",    icon: "○" },
  "QA Tester":        { label: "Validating Output",   icon: "○" },
  "Optimizer":        { label: "Optimizing Result",   icon: "○" },
  "Project Manager":  { label: "Finalizing",          icon: "○" },
};

const ALL_STATES = [
  "Reading Request",
  "Understanding Goal",
  "Creating Plan",
  "Building Project",
  "Validating Output",
  "Optimizing Result",
  "Finalizing",
];

export default function AgentTimeline({ phases, isActive }: AgentTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [phases]);

  // Build state list from phases
  const stateMap: Record<string, { done: boolean; active: boolean; pct: number; action: string }> = {};
  phases.forEach(p => {
    const mapped = WORKFLOW_STATES[p.agent];
    if (mapped) {
      stateMap[mapped.label] = {
        done:   !!p.done,
        active: !p.done && isActive,
        pct:    p.pct || 0,
        action: p.action,
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
        padding:      "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display:      "flex",
        alignItems:   "center",
        gap:          10,
      }}>
        {isDone ? (
          <span style={{ color:"#00D084", fontSize:13 }}>✓</span>
        ) : (
          <div style={{
            width:8, height:8, borderRadius:"50%",
            background:"#FFD700",
            animation:"pulse 1.5s ease-in-out infinite",
            flexShrink:0,
          }}/>
        )}
        <span style={{ fontSize:12, fontWeight:600, color:isDone?"#00D084":"#FFD700" }}>
          {isDone ? "Complete" : "Krypton Intelligence Engine"}
        </span>
        {!isDone && isActive && (
          <div style={{
            marginLeft:"auto",
            height:2, width:80,
            background:"rgba(255,255,255,0.06)",
            borderRadius:4, overflow:"hidden",
          }}>
            <div style={{
              height:"100%",
              width:`${Math.round((completedCount / ALL_STATES.length) * 100)}%`,
              background:"linear-gradient(90deg,#FFD700,#FF7A00)",
              borderRadius:4,
              transition:"width .5s ease",
            }}/>
          </div>
        )}
      </div>

      {/* Clean linear steps */}
      <div style={{ padding:"10px 0" }}>
        {ALL_STATES.map((state, i) => {
          const info    = stateMap[state];
          const isDoneS = info?.done || false;
          const isActiveS = info?.active || false;
          const notReached = !info;

          return (
            <div key={state} style={{
              display:    "flex",
              alignItems: "center",
              gap:        14,
              padding:    "7px 16px",
              opacity:    notReached ? 0.3 : 1,
              transition: "opacity 0.3s ease",
            }}>
              {/* Step indicator */}
              <div style={{
                width:    18, height: 18,
                borderRadius: "50%",
                flexShrink:   0,
                display:      "flex",
                alignItems:   "center",
                justifyContent: "center",
                background:   isDoneS
                  ? "rgba(0,208,132,0.12)"
                  : isActiveS
                  ? "rgba(255,215,0,0.12)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  isDoneS   ? "rgba(0,208,132,0.4)"
                  : isActiveS ? "rgba(255,215,0,0.4)"
                  : "rgba(255,255,255,0.08)"
                }`,
              }}>
                {isDoneS ? (
                  <span style={{ color:"#00D084", fontSize:9, fontWeight:700 }}>✓</span>
                ) : isActiveS ? (
                  <div style={{
                    width:6, height:6, borderRadius:"50%",
                    border:"1.5px solid rgba(255,215,0,0.3)",
                    borderTopColor:"#FFD700",
                    animation:"spin .7s linear infinite",
                  }}/>
                ) : (
                  <div style={{ width:4, height:4, borderRadius:"50%", background:"rgba(255,255,255,0.2)" }}/>
                )}
              </div>

              {/* Label */}
              <span style={{
                fontSize:   13,
                color:      isDoneS ? "rgba(255,255,255,0.3)"
                            : isActiveS ? "#FFD700"
                            : "rgba(255,255,255,0.3)",
                textDecoration: isDoneS ? "line-through" : "none",
                textDecorationColor: "rgba(255,255,255,0.15)",
                fontWeight: isActiveS ? 600 : 400,
                flex:       1,
                transition: "all .3s ease",
              }}>
                {state}
              </span>

              {/* Progress (active only) */}
              {isActiveS && info?.pct > 0 && (
                <span style={{ fontSize:11, color:"rgba(255,215,0,0.5)", flexShrink:0 }}>
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
