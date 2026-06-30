// lib/component-library/tokens.ts
// KRYPTON AI — Universal Design Tokens
//
// These are the ONLY things forced across every niche: spacing, shadow,
// radius, and a11y/responsive conventions. Colors/fonts always come from
// the niche's own palette (var(--primary) etc., set per-niche in :root by
// orchestrate.ts) — components NEVER hardcode a hex color themselves.

export const SPACING = {
  xs:  "8px",
  sm:  "16px",
  md:  "24px",
  lg:  "48px",
  xl:  "80px",
  xxl: "120px",
} as const;

export const RADIUS = {
  sm:   "8px",
  md:   "14px",
  lg:   "20px",
  xl:   "28px",
  full: "999px",
} as const;

export const SHADOW = {
  sm: "0 2px 8px rgba(0,0,0,0.15)",
  md: "0 8px 24px rgba(0,0,0,0.20)",
  lg: "0 20px 60px rgba(0,0,0,0.30)",
  glow: (rgb: string, opacity = 0.35) => `0 12px 32px rgba(${rgb},${opacity})`,
} as const;

// Mobile-first breakpoint used consistently across every component's
// generated @media rule (matches Quality Gate 2.0's mobile-breakpoint check)
export const BREAKPOINT_MOBILE = "768px";

export interface ComponentContext {
  rgb: string;          // niche.palette.primary as "r,g,b" — for rgba()/glow shadows
  headingFont: string;  // var-ref string, e.g. "var(--heading-font)" not used directly;
                         // components reference CSS vars set by orchestrate.ts directly
}

// ── Shared content shapes used across multiple component categories ──
export interface CTAContent {
  text: string;
  href?: string;
}

export interface BenefitItem {
  text: string;
}

// ── Shared render helpers — every component uses these for consistency ──

export function renderButton(cta: CTAContent, variant: "primary" | "secondary", ctx: ComponentContext): string {
  if (variant === "primary") {
    return `<a href="${cta.href || "#"}" class="btn-primary" style="display:inline-block;background:var(--grad);color:#fff;padding:16px 36px;border-radius:${RADIUS.md};font-weight:700;text-decoration:none;box-shadow:${SHADOW.glow(ctx.rgb)};transition:transform .25s;">${cta.text}</a>`;
  }
  return `<a href="${cta.href || "#"}" class="btn-secondary" style="display:inline-block;background:rgba(255,255,255,0.04);color:var(--text);padding:16px 36px;border-radius:${RADIUS.md};font-weight:600;text-decoration:none;border:1px solid var(--border);transition:all .25s;">${cta.text}</a>`;
}

export function renderBenefitList(items: BenefitItem[], ctx: ComponentContext): string {
  if (!items?.length) return "";
  return `<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:${SPACING.md};">
    ${items.map(b => `
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="width:22px;height:22px;border-radius:${RADIUS.full};background:var(--grad);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:#fff;font-weight:800;" aria-hidden="true">✓</span>
      <span style="font-size:15px;color:var(--text);font-weight:500;">${b.text}</span>
    </div>`).join("")}
  </div>`;
}

export function renderBadge(text: string): string {
  return `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(var(--primary-rgb),0.1);border:1px solid rgba(var(--primary-rgb),0.25);border-radius:${RADIUS.full};padding:6px 18px;font-size:12px;font-weight:600;color:var(--primary);margin-bottom:${SPACING.md};">
    <span style="width:6px;height:6px;border-radius:${RADIUS.full};background:#7CFFB2;" aria-hidden="true"></span>${text}
  </div>`;
}

// Mobile-first responsive section wrapper — guarantees every component
// passes Quality Gate 2.0's spacing + breakpoint + overflow checks.
export function wrapSection(id: string, inner: string, opts?: { bg?: string; extraStyle?: string; component?: string }): string {
  const bg = opts?.bg || "transparent";
  // Deterministic component identity — lets the edit pipeline resolve a
  // target section without asking the AI to guess. Never removed by edits.
  const componentName = opts?.component || id;
  return `<section id="${id}" data-section="${id}" data-component="${componentName}" data-editable="true" style="padding:${SPACING.xl} ${SPACING.md};background:${bg};overflow-x:hidden;${opts?.extraStyle || ""}">
  <div class="container" style="max-width:1200px;margin:0 auto;">
    ${inner}
  </div>
</section>
<style>
@media (max-width: ${BREAKPOINT_MOBILE}) {
  #${id} { padding:${SPACING.lg} ${SPACING.sm} !important; }
}
</style>`;
}

export function hexToRgbValues(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
