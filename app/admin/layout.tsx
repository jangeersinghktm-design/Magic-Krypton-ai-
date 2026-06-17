"use client";
// app/admin/layout.tsx — Full screen admin layout (hides main app nav)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280",
};

const NAV_LINKS = [
  { label: "Home",       href: "/" },
  { label: "Dashboard",  href: "/dashboard" },
  { label: "Create",     href: "/create" },
  { label: "Templates",  href: "/templates" },
  { label: "AI Manager", href: "/ai-manager" },
  { label: "Analytics",  href: "/analytics" },
  { label: "Settings",   href: "/settings" },
  { label: "Billing",    href: "/billing" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const supabase = createClient();

  const [checking,     setChecking]     = useState(true);
  const [allowed,      setAllowed]      = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userEmail,    setUserEmail]    = useState("");

  useEffect(() => {
    (async () => {
      // FIX: getUser() instead of getSession() — always fresh from server
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.push("/auth/login"); return; }

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();

      if (profile?.role !== "admin") { router.push("/dashboard"); return; }

      setUserEmail(user.email || "");
      setAllowed(true);
      setChecking(false);
    })();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = () => setDropdownOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [dropdownOpen]);

  if (checking) {
    return (
      <div style={{ position: "fixed", inset: 0, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontFamily: "system-ui", zIndex: 9999 }}>
        Checking admin access...
      </div>
    );
  }
  if (!allowed) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: T.bg, color: T.text,
      fontFamily: "system-ui", zIndex: 9999, display: "flex", flexDirection: "column",
      overflow: "auto",
    }}>
      {/* ── Top Bar ── */}
      <div style={{
        height: 52, borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", padding: "0 16px",
        gap: 12, flexShrink: 0, background: "#070707",
      }}>
        {/* Logo + Dropdown */}
        <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setDropdownOpen(p => !p)}
            style={{
              background: "none", border: `1px solid ${T.border}`, borderRadius: 8,
              padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <span style={{
              fontWeight: 800, fontSize: 15,
              background: `linear-gradient(135deg,${T.gold},${T.green})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>K</span>
            <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>Krypton</span>
            <span style={{ color: T.muted, fontSize: 10 }}>{dropdownOpen ? "▲" : "▼"}</span>
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0,
              background: "#0D0D0D", border: `1px solid ${T.border}`,
              borderRadius: 10, padding: 8, minWidth: 180, zIndex: 100,
              boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
            }}>
              <div style={{ fontSize: 10, color: T.muted, padding: "4px 10px 8px", letterSpacing: 1 }}>NAVIGATE TO</div>
              {NAV_LINKS.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  style={{
                    display: "block", padding: "8px 10px", color: T.text,
                    textDecoration: "none", borderRadius: 6, fontSize: 13,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {link.label}
                </a>
              ))}
              <div style={{ borderTop: `1px solid ${T.border}`, margin: "8px 0" }} />
              <div style={{ padding: "4px 10px", fontSize: 11, color: T.muted }}>{userEmail}</div>
            </div>
          )}
        </div>

        {/* Admin badge */}
        <span style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700,
          background: "rgba(245,216,0,0.1)", color: T.gold, border: `1px solid ${T.border}`,
        }}>
          ADMIN
        </span>

        {/* Quick nav links */}
        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {[
            { label: "Monitor",     href: "/admin/monitor" },
            { label: "AI Engineer", href: "/admin/ai-engineer" },
            { label: "Debug Test",  href: "/debug-test" },
          ].map(l => (
            <a key={l.href} href={l.href} style={{
              color: T.muted, fontSize: 12, textDecoration: "none",
              padding: "4px 10px", borderRadius: 6, transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = T.text)}
            onMouseLeave={e => (e.currentTarget.style.color = T.muted)}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Page Content ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}
  
