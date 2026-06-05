"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const icons = {
  home: (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 12L12 3l9 9" /><path d="M9 21V12h6v9" /></svg>),
  create: (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8M8 12h8" /></svg>),
  templates: (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>),
  analytics: (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 3v18h18" /><path d="M7 16l4-6 4 4 4-8" /></svg>),
  dashboard: (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>),
  settings: (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>),
  chevron: (<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>),
  code: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>),
  seo: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>),
  performance: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>),
  chatbot: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>),
  image: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>),
  content: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>),
  profile: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>),
  billing: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>),
  apikeys: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>),
  domains: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>),
  security: (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>),
};

const navItems = [
  { label: "Home", href: "/", icon: icons.home },
  { label: "Create", href: "/create", icon: icons.create, children: [
    { label: "Chatbot", href: "/create?type=chatbot", icon: icons.chatbot },
    { label: "Image Gen", href: "/create?type=image", icon: icons.image },
    { label: "Content", href: "/create?type=content", icon: icons.content },
    { label: "Code Gen", href: "/create?type=code", icon: icons.code },
  ]},
  { label: "Templates", href: "/templates", icon: icons.templates, children: [
    { label: "AI Chatbots", href: "/templates?cat=chatbot", icon: icons.chatbot },
    { label: "Image Tools", href: "/templates?cat=image", icon: icons.image },
    { label: "SEO Tools", href: "/templates?cat=seo", icon: icons.seo },
    { label: "Code Tools", href: "/templates?cat=code", icon: icons.code },
  ]},
  { label: "Analytics", href: "/analytics", icon: icons.analytics, children: [
    { label: "Code Analysis", href: "/analytics?tab=code", icon: icons.code },
    { label: "SEO Analysis", href: "/analytics?tab=seo", icon: icons.seo },
    { label: "Performance", href: "/analytics?tab=performance", icon: icons.performance },
  ]},
  { label: "Dashboard", href: "/dashboard", icon: icons.dashboard },
  { label: "Settings", href: "/settings", icon: icons.settings, children: [
    { label: "Profile", href: "/settings?tab=profile", icon: icons.profile },
    { label: "Billing", href: "/settings?tab=billing", icon: icons.billing },
    { label: "API Keys", href: "/settings?tab=apikeys", icon: icons.apikeys },
    { label: "Domains", href: "/settings?tab=domains", icon: icons.domains },
    { label: "Security", href: "/settings?tab=security", icon: icons.security },
  ]},
];

export default function KryptonSidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>(["Create"]);

  const toggle = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "?");

  return (
    <>
      <style>{`
        :root { --gold: #F5C542; --green: #00D084; --surface: #0d0d0d; --border: rgba(245,197,66,0.12); --text: #e8e8e8; --muted: #666; }
        .ks-sidebar { width:240px; min-height:100vh; background:var(--surface); border-right:1px solid var(--border); display:flex; flex-direction:column; position:fixed; left:0; top:0; bottom:0; z-index:100; font-family:'DM Sans',sans-serif; }
        .ks-logo { display:flex; align-items:center; gap:10px; padding:20px 20px 16px; border-bottom:1px solid var(--border); text-decoration:none; }
        .ks-logo-img { width:32px; height:32px; object-fit:contain; }
        .ks-logo-text { font-size:17px; font-weight:700; background:linear-gradient(135deg,var(--gold),var(--green)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .ks-nav { flex:1; padding:12px 10px; overflow-y:auto; scrollbar-width:none; }
        .ks-section-label { font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:#444; padding:6px 12px 4px; }
        .ks-item-wrap { margin-bottom:2px; }
        .ks-item { display:flex; align-items:center; justify-content:space-between; padding:9px 12px; border-radius:10px; cursor:pointer; color:var(--muted); text-decoration:none; font-size:13.5px; font-weight:500; transition:all 0.18s; user-select:none; }
        .ks-item:hover { background:rgba(245,197,66,0.06); color:var(--text); }
        .ks-item.active { background:linear-gradient(135deg,rgba(245,197,66,0.15),rgba(0,208,132,0.08)); color:var(--gold); border:1px solid rgba(245,197,66,0.2); }
        .ks-item-left { display:flex; align-items:center; gap:10px; }
        .ks-chevron { transition:transform 0.22s ease; color:var(--muted); flex-shrink:0; }
        .ks-chevron.open { transform:rotate(90deg); }
        .ks-sub { overflow:hidden; max-height:0; transition:max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease; opacity:0; }
        .ks-sub.open { max-height:300px; opacity:1; }
        .ks-sub-inner { padding:4px 0 4px 14px; margin-left:20px; border-left:1px solid var(--border); }
        .ks-sub-item { display:flex; align-items:center; gap:9px; padding:7px 10px; border-radius:8px; text-decoration:none; font-size:12.5px; color:var(--muted); transition:all 0.15s; margin-bottom:1px; }
        .ks-sub-item:hover { background:rgba(0,208,132,0.07); color:var(--green); }
        .ks-sub-item.active { color:var(--green); background:rgba(0,208,132,0.1); }
        .ks-credits { margin:0 10px 10px; background:rgba(245,197,66,0.06); border:1px solid rgba(245,197,66,0.15); border-radius:10px; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; }
        .ks-credits-label { font-size:11px; color:var(--muted); }
        .ks-credits-val { font-size:13px; font-weight:700; background:linear-gradient(90deg,var(--gold),var(--green)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .ks-credits-bar { height:3px; background:rgba(255,255,255,0.07); border-radius:3px; margin-top:7px; overflow:hidden; }
        .ks-credits-fill { height:100%; width:62%; background:linear-gradient(90deg,var(--gold),var(--green)); border-radius:3px; }
        .ks-user { padding:14px 16px; border-top:1px solid var(--border); display:flex; align-items:center; gap:10px; }
        .ks-avatar { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,var(--gold),var(--green)); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:#000; flex-shrink:0; }
        .ks-user-name { font-size:12.5px; font-weight:600; color:var(--text); }
        .ks-user-plan { font-size:10.5px; color:var(--green); font-weight:500; }
      `}</style>

      <aside className="ks-sidebar">
        <Link href="/" className="ks-logo">
          <img src="/logo.png" alt="Krypton AI" className="ks-logo-img" />
          <span className="ks-logo-text">Krypton AI</span>
        </Link>

        <nav className="ks-nav">
          <div className="ks-section-label">Navigation</div>
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openMenus.includes(item.label);
            const active = isActive(item.href);
            return (
              <div key={item.label} className="ks-item-wrap">
                {hasChildren ? (
                  <div className={`ks-item ${active ? "active" : ""}`} onClick={() => toggle(item.label)}>
                    <span className="ks-item-left">{item.icon}{item.label}</span>
                    <span className={`ks-chevron ${isOpen ? "open" : ""}`}>{icons.chevron}</span>
                  </div>
                ) : (
                  <Link href={item.href} className={`ks-item ${active ? "active" : ""}`}>
                    <span className="ks-item-left">{item.icon}{item.label}</span>
                  </Link>
                )}
                {hasChildren && (
                  <div className={`ks-sub ${isOpen ? "open" : ""}`}>
                    <div className="ks-sub-inner">
                      {item.children!.map((child) => (
                        <Link key={child.href} href={child.href} className={`ks-sub-item ${isActive(child.href) ? "active" : ""}`}>
                          {child.icon}{child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="ks-credits">
          <div>
            <div className="ks-credits-label">Credits Used</div>
            <div className="ks-credits-bar">
              <div className="ks-credits-fill" />
            </div>
          </div>
          <div className="ks-credits-val">620 / 1k</div>
        </div>

        <div className="ks-user">
          <div className="ks-avatar">K</div>
          <div>
            <div className="ks-user-name">Jangeer Singh</div>
            <div className="ks-user-plan">Pro Plan</div>
          </div>
        </div>
      </aside>
    </>
  );
}
