"use client";
// components/workspace/AgentTimeline.tsx
// Krypton AI — Real-time Agent Timeline
// Shows exactly which agent is running and what it's doing
// Connected to SSE stream — no fake progress

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
  phases:       AgentPhaseEvent[];
  isActive:     boolean;
  currentAgent?: string;
}

const C = {
  bg:     "#0A0A0A",
  card:   "#111111",
  border: "rgba(255,215,0,0.08)",
  text:   "#FFFFFF",
  sub:    "#94A3B8",
  muted:  "#4A5568",
  gold:   "#FFD700",
  green:  "#00D084",
  red:    "#EF4444",
};

// Agent color map
const AGENT_COLORS: Record<string, string> = {
  Planner:          "#FFD700",
  Researcher:       "#FF8C00",
  Designer:         "#8B5CF6",
  Builder:          "#3B82F6",
  "QA Tester":      "#10B981",
  Optimizer:        "#F59E0B",
  "Content Writer": "#EC4899",
  "Project Manager":"#00D084",
};

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{
      height: 3,
      background: "rgba(255,255,255,.06)",
      borderRadius: 4,
      overflow: "hidden",
      marginTop: 6,
    }}>
      <div style={{
        height: "100%",
        width: `${Math.min(pct, 100)}%`,
        background: `linear-gradient(90deg, ${color}, ${color}88)`,
        borderRadius: 4,
        transition: "width .4s ease",
        boxShadow: `0 0 8px ${color}44`,
      }}/>
    </div>
  );
}

export default function AgentTimeline({ phases, isActive, currentAgent }: AgentTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [phases]);

  if (phases.length === 0 && !isActive) return null;

  const completedCount = phases.filter(p => p.done).length;
  const totalExpected  = 7;
  const overallPct     = Math.round((completedCount / totalExpected) * 100);

  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      overflow: "hidden",
      fontSize: 13,
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "rgba(255,215,0,.03)",
      }}>
        {isActive ? (
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#FFD700",
            animation: "pulse 1.5s ease-in-out infinite",
            flexShrink: 0,
          }}/>
        ) : (
          <span style={{ color: C.green, fontSize: 14 }}>✓</span>
        )}
        <span style={{ fontWeight: 700, color: "#fff", fontSize: 12 }}>
          {isActive ? "Krypton AI OS — Working" : "All Agents Complete"}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.muted }}>
          {completedCount}/{totalExpected} agents
        </span>
      </div>

      {/* Overall progress */}
      {isActive && (
        <div style={{ padding: "8px 14px 0" }}>
          <div style={{
            height: 2,
            background: "rgba(255,255,255,.06)",
            borderRadius: 4,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${overallPct}%`,
              background: "linear-gradient(90deg,#FFD700,#FF7A00)",
              borderRadius: 4,
              transition: "width .6s ease",
            }}/>
          </div>
        </div>
      )}

      {/* Agent phases */}
      <div style={{ padding: "8px 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {phases.map((phase, i) => {
          const color   = AGENT_COLORS[phase.agent] || "#FFD700";
          const isDone  = phase.done;
          const isCur   = !isDone && isActive && phase.agent === (currentAgent || phase.agent);

          return (
            <div key={i} style={{
              padding: "8px 10px",
              background: isDone
                ? "rgba(0,208,132,.04)"
                : isCur
                ? `rgba(255,215,0,.05)`
                : "rgba(255,255,255,.02)",
              border: `1px solid ${isDone ? "rgba(0,208,132,.12)" : isCur ? `${color}22` : "rgba(255,255,255,.04)"}`,
              borderRadius: 10,
              transition: "all .3s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Status indicator */}
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: isDone
                    ? "rgba(0,208,132,.15)"
                    : isCur
                    ? `${color}15`
                    : "rgba(255,255,255,.04)",
                  border: `1px solid ${isDone ? "rgba(0,208,132,.3)" : isCur ? `${color}40` : "rgba(255,255,255,.08)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11,
                }}>
                  {isDone
                    ? <span style={{ color: C.green, fontSize: 10 }}>✓</span>
                    : isCur
                    ? <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        border: `2px solid ${color}40`,
                        borderTopColor: color,
                        animation: "spin .7s linear infinite",
                      }}/>
                    : <span style={{ fontSize: 11 }}>{phase.icon}</span>
                  }
                </div>

                {/* Agent name */}
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: isDone ? C.muted : isCur ? color : C.muted,
                  minWidth: 110,
                }}>
                  {phase.icon} {phase.agent}
                </span>

                {/* Action message */}
                <span style={{
                  fontSize: 12,
                  color: isDone ? "#2a2a2a" : isCur ? C.sub : "#2a2a2a",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: isDone ? "line-through" : "none",
                }}>
                  {phase.action}
                </span>

                {/* Percentage */}
                {!isDone && (
                  <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>
                    {phase.pct}%
                  </span>
                )}
              </div>

              {/* Progress bar (only for active) */}
              {isCur && <ProgressBar pct={phase.pct} color={color}/>}
            </div>
          );
        })}

        {/* Pending agents (shown as placeholders) */}
        {isActive && phases.length < totalExpected && (
          Array.from({ length: Math.min(2, totalExpected - phases.length) }).map((_, i) => (
            <div key={`pending-${i}`} style={{
              padding: "8px 10px",
              background: "rgba(255,255,255,.01)",
              border: "1px solid rgba(255,255,255,.03)",
              borderRadius: 10,
              opacity: 0.4,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.06)",
              }}/>
              <span style={{ fontSize: 12, color: "#222" }}>Waiting...</span>
            </div>
          ))
        )}
      </div>

      <div ref={endRef}/>
    </div>
  );
}
      
