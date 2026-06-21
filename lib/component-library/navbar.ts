// lib/component-library/navbar.ts
// KRYPTON AI Component Library — Navbar Variants
// EVERY variant ships the same mandatory mobile hamburger pattern —
// this directly fixes the recurring "Cart wraps awkwardly" bug.

import { ComponentContext, SPACING, RADIUS, renderButton, CTAContent } from "./tokens";

export interface NavbarContent {
  logoText: string;
  links: { label: string; href: string }[];
  cta?: CTAContent;
}

function hamburgerScript(): string {
  return `<script>
document.querySelectorAll('.nav-hamburger').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-links').forEach(n=>n.classList.toggle('open'));
    btn.textContent = btn.textContent.trim()==='☰' ? '✕' : '☰';
  });
});
</script>`;
}

const MOBILE_NAV_CSS = `
<style>
@media (max-width: 768px) {
  .nav-links { display:none !important; position:fixed; top:64px; right:0; height:calc(100vh - 64px); width:78%;
    flex-direction:column !important; align-items:flex-start !important; background:var(--surface); padding:32px 24px;
    z-index:100; box-shadow:-8px 0 32px rgba(0,0,0,0.4); gap:20px !important; }
  .nav-links.open { display:flex !important; }
  .nav-hamburger { display:block !important; }
}
</style>`;

// ── Variant 1: Glass Sticky — frosted-blur background on scroll (SaaS/modern) ──
export function navbarGlassSticky(ctx: ComponentContext, c: NavbarContent): string {
  return `<nav style="position:sticky;top:0;z-index:50;display:flex;justify-content:space-between;align-items:center;padding:16px ${SPACING.md};background:rgba(var(--bg-rgb),0.7);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);">
  <div style="font-family:var(--heading-font);font-weight:800;font-size:20px;color:var(--text);">${c.logoText}</div>
  <div class="nav-links" style="display:flex;gap:32px;align-items:center;">
    ${c.links.map(l => `<a href="${l.href}" style="color:var(--text-2);text-decoration:none;font-size:14px;font-weight:500;">${l.label}</a>`).join("")}
    ${c.cta ? renderButton(c.cta, "primary", ctx) : ""}
  </div>
  <button class="nav-hamburger" aria-label="Toggle menu" style="display:none;background:none;border:none;color:var(--text);font-size:24px;cursor:pointer;">☰</button>
</nav>
${MOBILE_NAV_CSS}${hamburgerScript()}`;
}

// ── Variant 2: Minimal Centered — logo+links centered, CTA right (portfolio/agency) ──
export function navbarMinimalCentered(ctx: ComponentContext, c: NavbarContent): string {
  return `<nav style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:20px ${SPACING.md};border-bottom:1px solid var(--border);">
  <div style="font-family:var(--heading-font);font-weight:700;font-size:18px;color:var(--text);">${c.logoText}</div>
  <div class="nav-links" style="display:flex;gap:28px;">
    ${c.links.map(l => `<a href="${l.href}" style="color:var(--text-2);text-decoration:none;font-size:14px;">${l.label}</a>`).join("")}
  </div>
  <div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;">
    ${c.cta ? renderButton(c.cta, "secondary", ctx) : ""}
    <button class="nav-hamburger" aria-label="Toggle menu" style="display:none;background:none;border:none;color:var(--text);font-size:24px;cursor:pointer;">☰</button>
  </div>
</nav>
${MOBILE_NAV_CSS}${hamburgerScript()}`;
}

// ── Variant 3: Bordered CTA Pill — logo left, links center, pill-CTA right (premium/fintech) ──
export function navbarBorderedCta(ctx: ComponentContext, c: NavbarContent): string {
  return `<nav style="display:flex;justify-content:space-between;align-items:center;padding:18px ${SPACING.md};">
  <div style="font-family:var(--heading-font);font-weight:800;font-size:19px;color:var(--text);">${c.logoText}</div>
  <div class="nav-links" style="display:flex;gap:8px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:${RADIUS.full};padding:6px;">
    ${c.links.map(l => `<a href="${l.href}" style="color:var(--text-2);text-decoration:none;font-size:13px;font-weight:500;padding:8px 16px;border-radius:${RADIUS.full};">${l.label}</a>`).join("")}
  </div>
  <div style="display:flex;align-items:center;gap:12px;">
    ${c.cta ? renderButton(c.cta, "primary", ctx) : ""}
    <button class="nav-hamburger" aria-label="Toggle menu" style="display:none;background:none;border:none;color:var(--text);font-size:24px;cursor:pointer;">☰</button>
  </div>
</nav>
${MOBILE_NAV_CSS}${hamburgerScript()}`;
}

// ── Variant 4: Bold Split — large logo, links far right, no CTA clutter (editorial/luxury) ──
export function navbarBoldSplit(ctx: ComponentContext, c: NavbarContent): string {
  return `<nav style="display:flex;justify-content:space-between;align-items:center;padding:28px ${SPACING.md};">
  <div style="font-family:var(--heading-font);font-weight:800;font-size:24px;letter-spacing:-0.02em;color:var(--text);">${c.logoText}</div>
  <div class="nav-links" style="display:flex;gap:40px;align-items:center;">
    ${c.links.map(l => `<a href="${l.href}" style="color:var(--text);text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">${l.label}</a>`).join("")}
    ${c.cta ? renderButton(c.cta, "secondary", ctx) : ""}
  </div>
  <button class="nav-hamburger" aria-label="Toggle menu" style="display:none;background:none;border:none;color:var(--text);font-size:24px;cursor:pointer;">☰</button>
</nav>
${MOBILE_NAV_CSS}${hamburgerScript()}`;
}

export const NAVBAR_VARIANTS = {
  "glass-sticky":      navbarGlassSticky,
  "minimal-centered":  navbarMinimalCentered,
  "bordered-cta":      navbarBorderedCta,
  "bold-split":        navbarBoldSplit,
} as const;

export type NavbarVariant = keyof typeof NAVBAR_VARIANTS;
