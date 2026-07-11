"use client";

// components/ModeSelector.tsx
// Real mode selector — controls actual routing/behavior in the parent
// page, not just a cosmetic label. Shared by Home and Create pages so
// the dropdown UI/keyboard/outside-click logic exists in exactly one place.

import { useEffect, useRef, useState } from "react";

export type AIMode = "auto" | "planning" | "build" | "edit" | "explain";

const MODES: { id: AIMode; icon: string; label: string; desc: string }[] = [
  { id: "auto",     icon: "🤖", label: "Auto",     desc: "AI decides — Build, Edit, Chat, or Explain" },
  { id: "planning", icon: "💡", label: "Planning", desc: "Roadmap, architecture, UX — never generates" },
  { id: "build",    icon: "🏗", label: "Build",    desc: "Always generates a new project" },
  { id: "edit",     icon: "✏",  label: "Edit",     desc: "Always edits the current project" },
  { id: "explain",  icon: "📖", label: "Explain",  desc: "Explains the project or idea — never changes it" },
];

export default function ModeSelector({ mode, onChange }: { mode: AIMode; onChange: (m: AIMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MODES.find(m => m.id === mode) || MODES[0];

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClickOutside); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <style>{`
        @keyframes mode-dd-in { from{opacity:0; transform:translateY(-6px) scale(.97);} to{opacity:1; transform:translateY(0) scale(1);} }
      `}</style>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current.desc}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 9, color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          whiteSpace: "nowrap", transition: "background .15s",
        }}
      >
        <span>{current.icon}</span>
        <span>{current.label}</span>
        <span style={{ fontSize: 9, opacity: 0.6, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", bottom: "calc(100% + 8px)", left: 0, minWidth: 240,
            background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12,
            padding: 6, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", zIndex: 50,
            animation: "mode-dd-in .15s cubic-bezier(.16,1,.3,1) both",
          }}
        >
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={mode === m.id}
              onClick={() => { onChange(m.id); setOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                background: mode === m.id ? "rgba(255,255,255,0.08)" : "transparent",
                border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left",
                transition: "background .12s",
              }}
              onMouseEnter={e => { if (mode !== m.id) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (mode !== m.id) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 15 }}>{m.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{m.label}</div>
                <div style={{ fontSize: 10.5, color: "#8892A0", marginTop: 1 }}>{m.desc}</div>
              </div>
              {mode === m.id && <span style={{ fontSize: 12, color: "#F5D800" }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
