"use client";

// components/ThemeProvider.tsx
// Production theme system — React Context based
// No CSS variables needed — pure React state

import {
  createContext, useContext, useEffect,
  useState, useCallback, useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────
export type ThemeMode   = "dark" | "light" | "system";
export type AccentColor = "gold-green" | "purple-blue" | "orange-red" | "cyan-blue" | "pink-purple";

export interface ThemeColors {
  bg: string;
  card: string;
  hover: string;
  input: string;
  border: string;
  text: string;
  sub: string;
  muted: string;
  dim: string;
  gold: string;
  green: string;
  gradient: string;
  isDark: boolean;
}

interface ThemeContextType {
  mode: ThemeMode;
  accent: AccentColor;
  colors: ThemeColors;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentColor) => void;
  saveTheme: () => Promise<void>;
  saving: boolean;
  saved: boolean;
}

// ── Color Definitions ──────────────────────────────────────────
const DARK_COLORS = {
  bg:     "#050505",
  card:   "#0D0D0D",
  hover:  "#161616",
  input:  "#161616",
  border: "rgba(245,197,66,0.12)",
  text:   "#FFFFFF",
  sub:    "#B3B3B3",
  muted:  "#6B7280",
  dim:    "#444444",
  isDark: true,
};

const LIGHT_COLORS = {
  bg:     "#F5F5F5",
  card:   "#FFFFFF",
  hover:  "#F0F0F0",
  input:  "#F0F0F0",
  border: "rgba(0,0,0,0.1)",
  text:   "#111111",
  sub:    "#555555",
  muted:  "#888888",
  dim:    "#CCCCCC",
  isDark: false,
};

const ACCENT_COLORS: Record<AccentColor, { gold: string; green: string; gradient: string }> = {
  "gold-green":  { gold: "#F5D800", green: "#00CC44", gradient: "linear-gradient(135deg,#F5D800,#00CC44)" },
  "purple-blue": { gold: "#8B5CF6", green: "#3B82F6", gradient: "linear-gradient(135deg,#8B5CF6,#3B82F6)" },
  "orange-red":  { gold: "#F97316", green: "#EF4444", gradient: "linear-gradient(135deg,#F97316,#EF4444)" },
  "cyan-blue":   { gold: "#06B6D4", green: "#3B82F6", gradient: "linear-gradient(135deg,#06B6D4,#3B82F6)" },
  "pink-purple": { gold: "#EC4899", green: "#8B5CF6", gradient: "linear-gradient(135deg,#EC4899,#8B5CF6)" },
};

// ── Helpers ────────────────────────────────────────────────────
function getSystemMode(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function buildColors(mode: ThemeMode, accent: AccentColor): ThemeColors {
  const resolved = mode === "system" ? getSystemMode() : mode;
  const base = resolved === "dark" ? DARK_COLORS : LIGHT_COLORS;
  const accentVals = ACCENT_COLORS[accent];
  return { ...base, ...accentVals };
}

// ── Context ────────────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextType>({
  mode: "dark",
  accent: "gold-green",
  colors: { ...DARK_COLORS, ...ACCENT_COLORS["gold-green"] },
  setMode: () => {},
  setAccent: () => {},
  saveTheme: async () => {},
  saving: false,
  saved: false,
});

export const useTheme = () => useContext(ThemeContext);

// ── Provider ───────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [mode, setModeState]     = useState<ThemeMode>("dark");
  const [accent, setAccentState] = useState<AccentColor>("gold-green");
  const [saving, setSaving]      = useState(false);
  const [saved, setSaved]        = useState(false);

  // Compute colors
  const colors = useMemo(() => buildColors(mode, accent), [mode, accent]);

  // Apply to body immediately
  useEffect(() => {
    document.body.style.background = colors.bg;
    document.body.style.color      = colors.text;
    document.body.style.transition = "background 0.3s ease, color 0.3s ease";
  }, [colors]);

  // Load from DB on mount
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("theme, accent_color")
        .eq("id", session.user.id)
        .single();

      if (profile?.theme)        setModeState(profile.theme as ThemeMode);
      if (profile?.accent_color) setAccentState(profile.accent_color as AccentColor);
    };
    load();
  }, []);

  // Listen for system changes
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setModeState("system"); // triggers re-render
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const setAccent = useCallback((a: AccentColor) => setAccentState(a), []);

  const saveTheme = useCallback(async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from("profiles")
        .update({ theme: mode, accent_color: accent })
        .eq("id", session.user.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [mode, accent]);

  return (
    <ThemeContext.Provider value={{ mode, accent, colors, setMode, setAccent, saveTheme, saving, saved }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Export buildColors for non-context use ─────────────────────
export { buildColors, ACCENT_COLORS };

