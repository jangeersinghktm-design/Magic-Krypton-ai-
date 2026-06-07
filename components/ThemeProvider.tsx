"use client";

// components/ThemeProvider.tsx
// Global theme provider — no page refresh needed

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Theme = "dark" | "light" | "system";
type Accent = "gold-green" | "purple-blue" | "orange-red" | "cyan-blue" | "pink-purple";

interface ThemeContextType {
  theme: Theme;
  accent: Accent;
  setTheme: (t: Theme) => void;
  setAccent: (a: Accent) => void;
  saveTheme: () => Promise<void>;
  saving: boolean;
  saved: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark", accent: "gold-green",
  setTheme: () => {}, setAccent: () => {},
  saveTheme: async () => {}, saving: false, saved: false,
});

export const useTheme = () => useContext(ThemeContext);

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

 function applyTheme(theme: Theme, accent: Accent) {
  const root = document.documentElement;
  const resolved = theme === "system" ? getSystemTheme() : theme;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-accent", accent);

  // Direct body apply
  if (resolved === "light") {
    document.body.style.background = "#F8F9FA";
    document.body.style.color = "#111111";
    document.documentElement.style.setProperty("--bg", "#F8F9FA");
    document.documentElement.style.setProperty("--bg-card", "#FFFFFF");
    document.documentElement.style.setProperty("--bg-hover", "#F1F3F4");
    document.documentElement.style.setProperty("--border", "rgba(0,0,0,0.1)");
    document.documentElement.style.setProperty("--text", "#111111");
    document.documentElement.style.setProperty("--text-muted", "#6B7280");
  } else {
    document.body.style.background = "#050505";
    document.body.style.color = "#FFFFFF";
    document.documentElement.style.setProperty("--bg", "#050505");
    document.documentElement.style.setProperty("--bg-card", "#0D0D0D");
    document.documentElement.style.setProperty("--bg-hover", "#161616");
    document.documentElement.style.setProperty("--border", "rgba(245,197,66,0.12)");
    document.documentElement.style.setProperty("--text", "#FFFFFF");
    document.documentElement.style.setProperty("--text-muted", "#6B7280");
  }
 }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [theme, setThemeState]   = useState<Theme>("dark");
  const [accent, setAccentState] = useState<Accent>("gold-green");
  const [saving, setSaving]      = useState(false);
  const [saved, setSaved]        = useState(false);

  // Load theme from DB on mount
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("theme, accent_color")
        .eq("id", session.user.id)
        .single();

      if (profile?.theme) setThemeState(profile.theme as Theme);
      if (profile?.accent_color) setAccentState(profile.accent_color as Accent);
    };
    load();
  }, []);

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(theme, accent);
  }, [theme, accent]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system", accent);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, accent]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const setAccent = useCallback((a: Accent) => {
    setAccentState(a);
  }, []);

  const saveTheme = useCallback(async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from("profiles")
        .update({ theme, accent_color: accent })
        .eq("id", session.user.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [theme, accent]);

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent, saveTheme, saving, saved }}>
      {children}
    </ThemeContext.Provider>
  );
}

