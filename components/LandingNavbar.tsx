"use client";

// components/LandingNavbar.tsx
// Public dropdown before login, Private after login

import { useState, useEffect, useRef } from "react";
import KryptonLogo from "@/components/branding/KryptonLogo";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PUBLIC_DROPDOWN = [
  { section: "PRODUCT" },
  { icon: "🏠", label: "Home",              path: "/landing" },
  { icon: "✨", label: "Features",          path: "/landing#features" },
  { icon: "🖼️", label: "Templates",         path: "/templates", hasArrow: true },
  { icon: "🎮", label: "Examples Gallery",  path: "/landing#examples" },
  { icon: "💰", label: "Pricing",           path: "/landing#pricing" },
  { icon: "🗺️", label: "Roadmap",           path: "/landing#roadmap" },

  { section: "LEARN" },
  { icon: "📚", label: "Documentation",     path: "/docs" },
  { icon: "🎥", label: "Demo Videos",       path: "/demo" },
  { icon: "⭐", label: "Customer Showcase", path: "/showcase" },
  { icon: "🏆", label: "Community",         path: "/community" },
  { icon: "📝", label: "Changelog",         path: "/changelog" },
  { icon: "❓", label: "FAQ",               path: "/landing#faq" },
  { icon: "📞", label: "Contact",           path: "/contact" },

  { section: "ACCOUNT" },
  { icon: "🚀", label: "Login",             path: "/auth/login",  highlight: false },
  { icon: "🟢", label: "Get Started Free",  path: "/auth/signup", highlight: true  },
];

const PRIVATE_DROPDOWN = [
  { section: "WORKSPACE" },
  { icon: "🏠", label: "Dashboard",       path: "/" },
  { icon: "📂", label: "Projects",        path: "/dashboard" },
  { icon: "⭐", label: "Templates",       path: "/templates" },
  { icon: "💬", label: "AI Chat",         path: "/create" },
  { icon: "🔍", label: "Analyze",         path: "/analytics" },
  { icon: "📜", label: "Version History", path: "/dashboard" },
  { icon: "☁️", label: "Deployments",     path: "/dashboard" },

  { section: "ACCOUNT" },
  { icon: "💳", label: "Billing",         path: "/settings?tab=billing" },
  { icon: "🔑", label: "API Keys",        path: "/settings?tab=apikeys" },
  { icon: "🔔", label: "Notifications",   path: "/settings?tab=notifications" },
  { icon: "👤", label: "Profile",         path: "/settings?tab=profile" },
  { icon: "🌙", label: "Theme",           path: "/settings?tab=theme" },
  { icon: "🚪", label: "Logout",          path: null, isLogout: true },
];

const TEMPLATE_CATEGORIES = [
  { icon: "💼", label: "SaaS Templates" },
  { icon: "🤖", label: "AI Startup Templates" },
  { icon: "🎨", label: "Portfolio Templates" },
  { icon: "🏢", label: "Agency Templates" },
  { icon: "🛒", label: "E-commerce Templates" },
  { icon: "📊", label: "Dashboard Templates" },
  { icon: "🚀", label: "Landing Pages" },
  { icon: "🎮", label: "Browser Games" },
  { icon: "⭐", label: "Premium Templates" },
];

export default function LandingNavbar() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowTemplates(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowDropdown(false);
    router.push("/landing");
  };

  const handleNav = (path: string | null, isLogout?: boolean) => {
    if (isLogout) { handleLogout(); return; }
    if (path) { router.push(path); setShowDropdown(false); setShowTemplates(false); }
  };

  const dropdown = user ? PRIVATE_DROPDOWN : PUBLIC_DROPDOWN;
  const firstName = user?.user_metadata?.first_name || user?.email?.split("@")[0] || "";

  return (
    <>
      <style>{`
        .ln-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 24px;
          background: rgba(5,5,5,0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(245,197,66,0.1);
          font-family: 'DM Sans', sans-serif;
        }

        /* Logo */
        .ln-logo {
          display: flex; align-items: center; gap: 10px;
          cursor: pointer; text-decoration: none; position: relative;
        }
        .ln-logo-img {
          height: 48px; width: auto; object-fit: contain;
        }
        .ln-logo-chevron {
          font-size: 10px; color: #666; margin-left: 2px;
          transition: transform 0.2s;
        }
        .ln-logo-chevron.open { transform: rotate(180deg); }

        /* Dropdown */
        .ln-dropdown {
          position: absolute; top: calc(100% + 10px); left: 0;
          width: 260px;
          background: #0d0d0d;
          border: 1px solid rgba(245,197,66,0.15);
          border-radius: 16px; padding: 8px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(245,197,66,0.05);
          animation: dropIn 0.2s ease;
          max-height: 80vh; overflow-y: auto;
          scrollbar-width: none;
        }
        @keyframes dropIn {
          from { opacity:0; transform:translateY(-8px) }
          to   { opacity:1; transform:translateY(0)    }
        }

        /* Section label */
        .ln-section {
          font-size: 9px; font-weight: 700; letter-spacing: 1.5px;
          text-transform: uppercase; color: #333;
          padding: 10px 12px 4px; margin-top: 4px;
        }
        .ln-section:first-child { margin-top: 0; }

        /* Item */
        .ln-item {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; padding: 9px 12px; border-radius: 9px;
          cursor: pointer; border: none; background: none;
          width: 100%; text-align: left; color: #888;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s; position: relative;
        }
        .ln-item:hover { background: rgba(255,255,255,0.05); color: #e8e8e8; }
        .ln-item.highlight {
          background: linear-gradient(135deg,rgba(245,197,66,0.15),rgba(0,208,132,0.1));
          color: #F5C542; border: 1px solid rgba(245,197,66,0.2);
          font-weight: 700;
        }
        .ln-item.highlight:hover { opacity: 0.85; }
        .ln-item.logout { color: #ef4444; }
        .ln-item.logout:hover { background: rgba(239,68,68,0.08); }

        .ln-item-left { display: flex; align-items: center; gap: 9px; }

        /* Template sub-dropdown */
        .ln-sub {
          position: absolute; left: 100%; top: 0;
          width: 220px; margin-left: 6px;
          background: #0d0d0d;
          border: 1px solid rgba(245,197,66,0.12);
          border-radius: 14px; padding: 8px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.7);
          animation: dropIn 0.2s ease;
        }
        .ln-sub-item {
          display: flex; align-items: center; gap: 9px;
          padding: 8px 12px; border-radius: 8px;
          cursor: pointer; font-size: 12.5px; color: #888;
          transition: all 0.15s;
        }
        .ln-sub-item:hover { background: rgba(255,255,255,0.05); color: #e8e8e8; }
        .ln-sub-item.premium { color: #F5C542; }

        /* Divider */
        .ln-divider {
          height: 1px; background: rgba(255,255,255,0.06);
          margin: 6px 8px;
        }

        /* Right nav buttons */
        .ln-right { display: flex; align-items: center; gap: 10px; }

        .ln-nav-link {
          padding: 7px 14px; border-radius: 8px;
          background: none; border: none;
          color: #888; font-size: 13px; font-weight: 500;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: color 0.15s;
        }
        .ln-nav-link:hover { color: #e8e8e8; }

        .ln-login-btn {
          padding: 8px 18px; border-radius: 9px;
          background: none; border: 1px solid rgba(255,255,255,0.1);
          color: #888; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }
        .ln-login-btn:hover { border-color: rgba(245,197,66,0.3); color: #F5C542; }

        .ln-cta-btn {
          padding: 9px 20px; border-radius: 9px; border: none;
          background: linear-gradient(135deg,#F5C542,#00D084);
          color: #000; font-size: 13.5px; font-weight: 800;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: opacity 0.15s, transform 0.15s;
          white-space: nowrap;
        }
        .ln-cta-btn:hover { opacity: 0.88; transform: translateY(-1px); }

        /* User avatar */
        .ln-avatar {
          width: 34px; height: 34px; border-radius: "50%";
          background: linear-gradient(135deg,#F5C542,#00D084);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800; color: #000;
          cursor: pointer; border-radius: 50%;
          border: 2px solid rgba(245,197,66,0.3);
        }
      `}</style>

      <nav className="ln-nav">
        {/* Logo + Dropdown */}
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <div className="ln-logo" onClick={() => setShowDropdown(!showDropdown)}>
            <KryptonLogo size={36} showText={true} animated={false}/>
            <span className={`ln-logo-chevron ${showDropdown ? "open" : ""}`}>▼</span>
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div className="ln-dropdown">
              {dropdown.map((item: any, i) => {
                if (item.section) {
                  return <div key={i} className="ln-section">{item.section}</div>;
                }
                if (item.label === "Logout") {
                  return (
                    <button key={i} className="ln-item logout" onClick={handleLogout}>
                      <span className="ln-item-left">
                        <span>{item.icon}</span>{item.label}
                      </span>
                    </button>
                  );
                }
                return (
                  <div key={i} style={{ position: "relative" }}>
                    <button
                      className={`ln-item ${item.highlight ? "highlight" : ""}`}
                      onClick={() => !item.hasArrow && handleNav(item.path, item.isLogout)}
                      onMouseEnter={() => item.hasArrow && setShowTemplates(true)}
                      onMouseLeave={() => !showTemplates && setShowTemplates(false)}
                    >
                      <span className="ln-item-left">
                        <span>{item.icon}</span>{item.label}
                      </span>
                      {item.hasArrow && <span style={{ fontSize: 10, color: "#555" }}>▶</span>}
                    </button>

                    {/* Templates sub-dropdown */}
                    {item.hasArrow && showTemplates && (
                      <div
                        className="ln-sub"
                        onMouseEnter={() => setShowTemplates(true)}
                        onMouseLeave={() => setShowTemplates(false)}
                      >
                        {TEMPLATE_CATEGORIES.map((cat, ci) => (
                          <div
                            key={ci}
                            className={`ln-sub-item ${cat.label.includes("Premium") ? "premium" : ""}`}
                            onClick={() => {
                              router.push(`/templates?cat=${encodeURIComponent(cat.label)}`);
                              setShowDropdown(false);
                              setShowTemplates(false);
                            }}
                          >
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                            {cat.label.includes("Premium") && (
                              <span style={{ marginLeft: "auto", fontSize: 10, color: "#F5C542" }}>⭐</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Center nav links */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {["Features", "Pricing", "Examples", "Roadmap"].map(link => (
            <button key={link} className="ln-nav-link"
              onClick={() => router.push(`/landing#${link.toLowerCase()}`)}>
              {link}
            </button>
          ))}
        </div>

        {/* Right buttons */}
        <div className="ln-right">
          {user ? (
            <>
              <div className="ln-avatar" onClick={() => setShowDropdown(!showDropdown)}>
                {firstName[0]?.toUpperCase() || "U"}
              </div>
              <button className="ln-cta-btn" onClick={() => router.push("/")}>
                Dashboard →
              </button>
            </>
          ) : (
            <>
              <button className="ln-login-btn" onClick={() => router.push("/auth/login")}>
                Login
              </button>
              <button className="ln-cta-btn" onClick={() => router.push("/auth/signup")}>
                Get Started Free →
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div style={{ height: 72 }} />
    </>
  );
                            }

