"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Icons ──────────────────────────────────────────────────────────
const icons = {
  home:     (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>),
  create:   (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>),
  templates:(<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>),
  analytics:(<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 4 4-8"/></svg>),
  dashboard:(<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>),
  settings: (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>),
  chevron:  (<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>),
  code:     (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>),
  seo:      (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>),
  performance:(<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>),
  chatbot:  (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>),
  image:    (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>),
  content:  (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
  profile:  (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  billing:  (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>),
  apikeys:  (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>),
  domains:  (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>),
  security: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>),
};

 const navItems = [
  { label: "Home", href: "/", icon: icons.home },
  { label: "Create", href: "/create", icon: icons.create, children: [
    { label: "Chatbot",   href: "/create?type=chatbot", icon: icons.chatbot },
    { label: "Image Gen", href: "/create?type=image",   icon: icons.image   },
    { label: "Content",   href: "/create?type=content", icon: icons.content },
    { label: "Code Gen",  href: "/create?type=code",    icon: icons.code    },
    { label: "Screenshot", href: "/screenshot", icon: icons.image },
  ]},
  { label: "Templates", href: "/templates", icon: icons.templates },
  { label: "Analytics", href: "/analytics", icon: icons.analytics, children: [
    { label: "Code Analysis", href: "/analytics?tab=code",       icon: icons.code        },
    { label: "SEO Analysis",  href: "/analytics?tab=seo",        icon: icons.seo         },
    { label: "Performance",   href: "/analytics?tab=performance", icon: icons.performance },
    { label: "Stats",         href: "/stats",                     icon: icons.dashboard   },
    { label: "Community",     href: "/community",                 icon: icons.home        },
  ]},
  { label: "Dashboard", href: "/dashboard", icon: icons.dashboard },
  { label: "Settings",  href: "/settings",  icon: icons.settings  },
];

// ── Profile type ───────────────────────────────────────────────────
interface Profile {
  full_name: string;
  email: string;
  plan: string;
  total_credits: number;
  used_credits: number;
}

export default function KryptonSidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const supabase  = createClient();

  const [openMenus, setOpenMenus] = useState<string[]>(["Create"]);
  const [isMobile,  setIsMobile]  = useState(false);
  const [mobileOpen,setMobileOpen]= useState(false);
  const [profile,   setProfile]   = useState<Profile | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ── Load user profile + credits ──────────────────────────────────
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data } = await supabase
      .from("profiles")
      .select("full_name, email, plan, total_credits, used_credits")
      .eq("id", session.user.id)
      .single();

    if (data) {
      setProfile(data);
    } else {
      // Fallback from auth user
      setProfile({
        full_name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "User",
        email: session.user.email || "",
        plan: "free",
        total_credits: 100,
        used_credits: 0,
      });
    }
  };

  // ── Mobile detection ───────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Close on outside click ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isMobile && mobileOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile, mobileOpen]);

  // ── Close on route change ──────────────────────────────────────
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const toggle = (label: string) => {
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "?");

  // ── Credits calculation ────────────────────────────────────────
  const totalCredits   = profile?.total_credits ?? 100;
  const usedCredits    = profile?.used_credits ?? 0;
  const remaining      = totalCredits - usedCredits;
  const usedPct        = Math.min((usedCredits / totalCredits) * 100, 100);
  const remainingPct   = 100 - usedPct;
  const displayName    = profile?.full_name || profile?.email?.split("@")[0] || "User";
  const planLabel      = profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : "Free";
  const firstLetter    = displayName[0]?.toUpperCase() || "U";

  // ── Sidebar content ────────────────────────────────────────────
  const sidebarContent = (
    <aside ref={sidebarRef} style={{
      width: 240, minHeight: "100vh",
      background: "#0d0d0d",
      borderRight: "1px solid rgba(245,197,66,0.12)",
      display: "flex", flexDirection: "column",
      position: "fixed", left: isMobile ? (mobileOpen ? 0 : -240) : 0,
      top: 0, bottom: 0, zIndex: 200,
      transition: "left 0.25s ease",
      fontFamily: "'DM Sans', sans-serif",
      overflowY: "auto", scrollbarWidth: "none",
    }}>

      {/* ── Logo ── */}
      <Link href="/" style={{
        display: "flex", alignItems: "center",
        justifyContent: "center",
        padding: "14px 16px",
        borderBottom: "1px solid rgba(245,197,66,0.12)",
        textDecoration: "none",
      }}>
        <img src="/logo.png" alt="Krypton AI"
          style={{ height: 48, width: "auto", objectFit: "contain" }} />
      </Link>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 1,
          textTransform: "uppercase", color: "#444",
          padding: "6px 12px 4px",
        }}>Navigation</div>

        {navItems.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isOpen = openMenus.includes(item.label);
          const active = isActive(item.href);

          return (
            <div key={item.label} style={{ marginBottom: 2 }}>
              {hasChildren ? (
                <div onClick={() => toggle(item.label)} style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 10,
                  cursor: "pointer",
                  color: active ? "#F5C542" : "#666",
                  background: active
                    ? "linear-gradient(135deg,rgba(245,197,66,0.15),rgba(0,208,132,0.08))"
                    : "transparent",
                  border: active
                    ? "1px solid rgba(245,197,66,0.2)"
                    : "1px solid transparent",
                  fontSize: 13.5, fontWeight: 500,
                  transition: "all 0.18s", userSelect: "none" as const,
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {item.icon}{item.label}
                  </span>
                  <span style={{
                    transition: "transform 0.22s",
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    color: "#555",
                  }}>{icons.chevron}</span>
                </div>
              ) : (
                <Link href={item.href} style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 10,
                  textDecoration: "none",
                  color: active ? "#F5C542" : "#666",
                  background: active
                    ? "linear-gradient(135deg,rgba(245,197,66,0.15),rgba(0,208,132,0.08))"
                    : "transparent",
                  border: active
                    ? "1px solid rgba(245,197,66,0.2)"
                    : "1px solid transparent",
                  fontSize: 13.5, fontWeight: 500,
                  transition: "all 0.18s",
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {item.icon}{item.label}
                  </span>
                </Link>
              )}

              {hasChildren && isOpen && (
                <div style={{
                  paddingLeft: 14, marginLeft: 20,
                  borderLeft: "1px solid rgba(245,197,66,0.12)",
                  marginTop: 2, marginBottom: 2,
                }}>
                  {item.children!.map((child) => (
                    <Link key={child.href} href={child.href} style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "7px 10px", borderRadius: 8,
                      textDecoration: "none", fontSize: 12.5,
                      color: isActive(child.href) ? "#00D084" : "#666",
                      background: isActive(child.href)
                        ? "rgba(0,208,132,0.1)"
                        : "transparent",
                      marginBottom: 1, transition: "all 0.15s",
                    }}>
                      {child.icon}{child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Credits Bar ── */}
      <div style={{
        margin: "0 10px 10px",
        background: "rgba(245,197,66,0.06)",
        border: "1px solid rgba(245,197,66,0.15)",
        borderRadius: 10, padding: "10px 14px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#666" }}>Credits Used</span>
          <button
            onClick={() => router.push("/settings?tab=billing")}
            style={{
              fontSize: 10, color: "#F5C542",
              background: "none",
              border: "1px solid rgba(245,197,66,0.3)",
              borderRadius: 4, padding: "1px 7px",
              cursor: "pointer",
            }}
          >
            Upgrade ⚡
          </button>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, background: "rgba(255,255,255,0.07)",
          borderRadius: 4, overflow: "hidden", marginBottom: 6,
        }}>
          <div style={{
            height: "100%",
            width: `${remainingPct}%`,
            background: remaining > 20
              ? "linear-gradient(90deg,#F5C542,#00D084)"
              : "linear-gradient(90deg,#ef4444,#f59e0b)",
            borderRadius: 4,
            transition: "width 0.5s ease",
          }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10.5, color: "#555" }}>
            Used: {usedCredits}
          </span>
          <span style={{
            fontSize: 10.5, fontWeight: 700,
            color: remaining > 20 ? "#00D084" : "#ef4444",
          }}>
            {remaining} / {totalCredits}
          </span>
        </div>
      </div>

      {/* ── User Card ── */}
      <div style={{
        padding: "14px 16px",
        borderTop: "1px solid rgba(245,197,66,0.12)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg,#F5C542,#00D084)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#000", flexShrink: 0,
        }}>
          {firstLetter}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12.5, fontWeight: 600, color: "#e8e8e8",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {displayName}
          </div>
          <div style={{ fontSize: 10.5, color: "#00D084", fontWeight: 500 }}>
            {planLabel} Plan
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger */}
      {isMobile && (
        <button onClick={() => setMobileOpen(!mobileOpen)} style={{
          position: "fixed", top: 12, left: 12, zIndex: 300,
          background: "#0d0d0d",
          border: "1px solid rgba(245,197,66,0.2)",
          borderRadius: 8, width: 36, height: 36,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#F5C542",
        }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {mobileOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 150,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(2px)",
        }} />
      )}

      {sidebarContent}
    </>
  );
                                             }
      
