"use client";

import { useState, useEffect, useRef } from "react";
import KryptonLogo from "@/components/branding/KryptonLogo";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── SVG Icon System ─────────────────────────────────────────────────
const I = {
  home:       <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>,
  rocket:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>,
  globe:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  cpu:        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg>,
  shop:       <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  user:       <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  folder:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  puzzle:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  palette:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>,
  bot:        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>,
  deploy:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
  team:       <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  settings:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  billing:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  receipt:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16l3-2 2 2 2-2 2 2 2-2 3 2V4a2 2 0 00-2-2z"/><line x1="16" y1="8" x2="8" y2="8"/><line x1="16" y1="12" x2="8" y2="12"/></svg>,
  chevron:    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>,
  menu:       <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  x:          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  landing:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  dashboard2: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  saas:       <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
  signout:    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

// ── Navigation structure ─────────────────────────────────────────────
interface NavChild { label: string; href: string; icon: React.ReactNode; badge?: string; }
interface NavItem  { label: string; href: string; icon: React.ReactNode; children?: NavChild[]; dividerBefore?: boolean; }

const NAV: NavItem[] = [
  {
    label: "Home",
    href:  "/dashboard",
    icon:  I.home,
  },
  {
    label: "AI Builder",
    href:  "/create",
    icon:  I.rocket,
    children: [
      { label: "Website",      href: "/create?type=website",     icon: I.globe,      badge: "Popular" },
      { label: "SaaS / App",   href: "/create?type=saas",        icon: I.saas        },
      { label: "Landing Page", href: "/create?type=landing",     icon: I.landing     },
      { label: "Dashboard",    href: "/create?type=dashboard",   icon: I.dashboard2  },
      { label: "E-commerce",   href: "/create?type=ecommerce",   icon: I.shop        },
      { label: "Portfolio",    href: "/create?type=portfolio",   icon: I.user        },
    ],
  },
  {
    label: "Projects",
    href:  "/project-manager",
    icon:  I.folder,
  },
  {
    label: "Components",
    href:  "/templates",
    icon:  I.puzzle,
  },
  {
    label: "Design System",
    href:  "/templates?tab=design",
    icon:  I.palette,
  },
  {
    label: "AI Agents",
    href:  "/analytics",
    icon:  I.bot,
    dividerBefore: true,
  },
  {
    label: "Deploy",
    href:  "/create?tab=deploy",
    icon:  I.deploy,
  },
  {
    label: "Team",
    href:  "/team",
    icon:  I.team,
  },
  {
    label: "Settings",
    href:  "/settings",
    icon:  I.settings,
    dividerBefore: true,
    children: [
      { label: "Billing",   href: "/billing",  icon: I.billing  },
      { label: "Invoices",  href: "/billing?tab=invoices", icon: I.receipt },
    ],
  },
];

// ── Profile type ─────────────────────────────────────────────────────
interface Profile {
  full_name:     string;
  email:         string;
  plan:          string;
  total_credits: number;
  used_credits:  number;
}

// ── Component ────────────────────────────────────────────────────────
export default function KryptonSidebar() {
  const pathname   = usePathname();
  const router     = useRouter();
  const supabase   = createClient();

  const [openMenus,  setOpenMenus]  = useState<string[]>(["AI Builder", "Settings"]);
  const [isMobile,   setIsMobile]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ── Load user profile ────────────────────────────────────────────
  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, email, plan, total_credits, used_credits")
      .eq("id", user.id)
      .single();
    if (data) setProfile(data);
  };

  // ── Mobile detection ─────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Close on outside click (mobile) ─────────────────────────────
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  const toggleMenu = (label: string) => {
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "?") || pathname.startsWith(href + "/");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const creditsUsed  = profile?.used_credits  ?? 0;
  const creditsTotal = profile?.total_credits ?? 50;
  const creditsPct   = Math.min(100, Math.round((creditsUsed / creditsTotal) * 100));

  // ── Sidebar content ──────────────────────────────────────────────
  const SidebarContent = () => (
    <div style={{
      display:       "flex",
      flexDirection: "column",
      height:        "100%",
      background:    "#06070D",
      borderRight:   "1px solid rgba(255,255,255,0.06)",
      overflow:      "hidden",
    }}>

      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div style={{
        display:       "flex",
        alignItems:    "center",
        justifyContent:"space-between",
        padding:       "20px 16px 16px",
        borderBottom:  "1px solid rgba(255,255,255,0.06)",
        flexShrink:    0,
      }}>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <KryptonLogo size="sm" />
        </Link>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.5)",
            cursor: "pointer", padding: "4px", display: "flex",
          }}>
            {I.x}
          </button>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px", scrollbarWidth: "none" }}>
        {NAV.map((item) => {
          const active   = isActive(item.href);
          const hasChild = !!item.children?.length;
          const expanded = openMenus.includes(item.label);

          return (
            <div key={item.label}>
              {/* Divider */}
              {item.dividerBefore && (
                <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "10px 8px 10px" }} />
              )}

              {/* Parent item */}
              <div
                onClick={() => hasChild ? toggleMenu(item.label) : (router.push(item.href), isMobile && setMobileOpen(false))}
                style={{
                  display:       "flex",
                  alignItems:    "center",
                  justifyContent:"space-between",
                  padding:       "9px 12px",
                  borderRadius:  "8px",
                  cursor:        "pointer",
                  marginBottom:  "2px",
                  background:    active && !hasChild
                    ? "rgba(255,255,255,0.08)"
                    : "transparent",
                  color: active && !hasChild
                    ? "#fff"
                    : "rgba(255,255,255,0.55)",
                  transition:    "all 0.15s ease",
                  position:      "relative",
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLDivElement).style.color = "#fff";
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  (e.currentTarget as HTMLDivElement).style.color = active && !hasChild ? "#fff" : "rgba(255,255,255,0.55)";
                }}
              >
                {/* Active indicator bar */}
                {active && !hasChild && (
                  <div style={{
                    position: "absolute", left: 0, top: "20%", bottom: "20%",
                    width: "3px", borderRadius: "2px",
                    background: "linear-gradient(180deg,#7C3AED,#4F46E5)",
                  }} />
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ opacity: active && !hasChild ? 1 : 0.7, display: "flex" }}>
                    {item.icon}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: active && !hasChild ? 600 : 400, letterSpacing: "0.01em" }}>
                    {item.label}
                  </span>
                </div>

                {hasChild && (
                  <span style={{
                    display: "flex", opacity: 0.4,
                    transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}>
                    {I.chevron}
                  </span>
                )}
              </div>

              {/* Children */}
              {hasChild && expanded && (
                <div style={{
                  marginLeft:   "12px",
                  paddingLeft:  "12px",
                  borderLeft:   "1px solid rgba(255,255,255,0.07)",
                  marginBottom: "4px",
                }}>
                  {item.children!.map(child => {
                    const childActive = isActive(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => isMobile && setMobileOpen(false)}
                        style={{
                          display:       "flex",
                          alignItems:    "center",
                          justifyContent:"space-between",
                          gap:           "9px",
                          padding:       "8px 10px",
                          borderRadius:  "7px",
                          textDecoration:"none",
                          marginBottom:  "1px",
                          background:    childActive ? "rgba(124,58,237,0.12)" : "transparent",
                          color:         childActive ? "#A78BFA" : "rgba(255,255,255,0.45)",
                          fontSize:      "12.5px",
                          fontWeight:    childActive ? 600 : 400,
                          transition:    "all 0.15s ease",
                        }}
                        onMouseEnter={e => {
                          if (!childActive) {
                            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.75)";
                          }
                        }}
                        onMouseLeave={e => {
                          if (!childActive) {
                            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.45)";
                          }
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ opacity: 0.7, display: "flex" }}>{child.icon}</span>
                          {child.label}
                        </div>
                        {child.badge && (
                          <span style={{
                            fontSize: "10px", fontWeight: 600, padding: "2px 6px",
                            borderRadius: "4px", background: "rgba(124,58,237,0.3)",
                            color: "#A78BFA", letterSpacing: "0.03em",
                          }}>
                            {child.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Credits bar ──────────────────────────────────────────── */}
      {profile && (
        <div style={{
          padding:      "12px 14px",
          borderTop:    "1px solid rgba(255,255,255,0.06)",
          flexShrink:   0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Credits</span>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
              {creditsUsed}/{creditsTotal}
            </span>
          </div>
          <div style={{
            height: "3px", borderRadius: "2px",
            background: "rgba(255,255,255,0.08)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: "2px",
              width: `${creditsPct}%`,
              background: creditsPct > 85
                ? "linear-gradient(90deg,#EF4444,#F97316)"
                : "linear-gradient(90deg,#7C3AED,#4F46E5)",
              transition: "width 0.5s ease",
            }} />
          </div>
          {profile.plan && (
            <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                {profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)} Plan
              </span>
              <Link href="/billing" style={{
                fontSize: "10px", fontWeight: 700, color: "#7C3AED",
                textDecoration: "none", letterSpacing: "0.04em",
              }}>
                UPGRADE
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── User footer ──────────────────────────────────────────── */}
      <div style={{
        padding:       "12px 14px",
        borderTop:     "1px solid rgba(255,255,255,0.06)",
        display:       "flex",
        alignItems:    "center",
        justifyContent:"space-between",
        flexShrink:    0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#7C3AED,#4F46E5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "12px", fontWeight: 700, color: "#fff",
          }}>
            {profile?.full_name?.[0]?.toUpperCase() || "K"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.full_name || "User"}
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.email || ""}
            </div>
          </div>
        </div>
        <button onClick={handleSignOut} title="Sign out" style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.3)", display: "flex", padding: "4px", flexShrink: 0,
          borderRadius: "6px", transition: "all 0.15s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
        >
          {I.signout}
        </button>
      </div>
    </div>
  );

  // ── Desktop ──────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ width: "220px", flexShrink: 0, height: "100vh", position: "sticky", top: 0 }}>
        <SidebarContent />
      </div>
    );
  }

  // ── Mobile ───────────────────────────────────────────────────────
  return (
    <>
      {/* Hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        style={{
          position: "fixed", top: "14px", left: "14px", zIndex: 60,
          width: "38px", height: "38px", borderRadius: "10px",
          background: "rgba(6,7,13,0.9)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#fff",
        }}
      >
        {I.menu}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)", zIndex: 49,
          }}
        />
      )}

      {/* Drawer */}
      <div
        ref={sidebarRef}
        style={{
          position:   "fixed",
          top:        0,
          left:       mobileOpen ? 0 : "-240px",
          width:      "240px",
          height:     "100vh",
          zIndex:     50,
          transition: "left 0.28s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <SidebarContent />
      </div>
    </>
  );
}
