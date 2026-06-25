// lib/component-library/testimonials.ts
// KRYPTON AI Component Library — Testimonials Variants

import { ComponentContext, SPACING, RADIUS, SHADOW, wrapSection } from "./tokens";

export interface TestimonialItem {
  quote: string;
  name: string;
  role: string;
  company?: string;
  avatar?: string;  // initials fallback
  rating?: number;  // 1-5
}

export interface TestimonialsContent {
  eyebrow?: string;
  headline: string;
  items: TestimonialItem[];
}

function stars(n: number = 5): string {
  return `<div style="display:flex;gap:2px;margin-bottom:14px;" aria-label="${n} out of 5 stars">
    ${Array.from({length: 5}, (_, i) => `<span style="color:${i < n ? "#F59E0B" : "var(--border)"};" aria-hidden="true">★</span>`).join("")}
  </div>`;
}

function avatar(t: TestimonialItem): string {
  const initials = t.avatar || t.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return `<div style="width:44px;height:44px;border-radius:${RADIUS.full};background:var(--grad);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:#fff;flex-shrink:0;" aria-hidden="true">${initials}</div>`;
}

function sectionHeader(c: TestimonialsContent): string {
  return `<div style="text-align:center;max-width:560px;margin:0 auto ${SPACING.lg};">
    ${c.eyebrow ? `<p style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--primary);margin-bottom:12px;">${c.eyebrow}</p>` : ""}
    <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(26px,4vw,42px);color:var(--text);">${c.headline}</h2>
  </div>`;
}

// ── Variant 1: Grid Cards — classic 3-col review cards ──
export function testimonialsGrid(ctx: ComponentContext, c: TestimonialsContent): string {
  const inner = `${sectionHeader(c)}
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;" class="testi-grid">
    ${c.items.map(t => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};padding:28px;transition:all .25s;">
      ${t.rating ? stars(t.rating) : ""}
      <p style="font-size:14px;color:var(--text);line-height:1.75;margin-bottom:20px;font-style:italic;">"${t.quote}"</p>
      <div style="display:flex;align-items:center;gap:12px;">
        ${avatar(t)}
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text);">${t.name}</div>
          <div style="font-size:12px;color:var(--text-2);">${t.role}${t.company ? ` · ${t.company}` : ""}</div>
        </div>
      </div>
    </div>`).join("")}
  </div>
  <style>@media(max-width:768px){.testi-grid{grid-template-columns:1fr !important;}}</style>`;
  return wrapSection("testimonials", inner);
}

// ── Variant 2: Featured Single — one large hero quote (high-trust) ──
export function testimonialsFeatured(ctx: ComponentContext, c: TestimonialsContent): string {
  const t = c.items[0];
  const rest = c.items.slice(1, 4);
  const inner = `${sectionHeader(c)}
  <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.xl};padding:${SPACING.lg};margin-bottom:${SPACING.sm};position:relative;overflow:hidden;">
    <div style="position:absolute;top:-20px;left:${SPACING.md};font-size:120px;color:var(--primary);opacity:0.06;font-family:serif;line-height:1;" aria-hidden="true">"</div>
    <div style="position:relative;z-index:1;">
      ${t.rating ? stars(t.rating) : ""}
      <p style="font-size:clamp(16px,2.5vw,22px);color:var(--text);line-height:1.7;font-family:var(--heading-font);font-weight:300;margin-bottom:${SPACING.md};font-style:italic;">"${t.quote}"</p>
      <div style="display:flex;align-items:center;gap:14px;">
        ${avatar(t)}
        <div>
          <div style="font-weight:700;color:var(--text);">${t.name}</div>
          <div style="font-size:13px;color:var(--text-2);">${t.role}${t.company ? ` · ${t.company}` : ""}</div>
        </div>
      </div>
    </div>
  </div>
  ${rest.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(rest.length, 3)},1fr);gap:16px;" class="testi-rest">
    ${rest.map(t => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.md};padding:${SPACING.sm};">
      <p style="font-size:13px;color:var(--text-2);line-height:1.7;margin-bottom:14px;font-style:italic;">"${t.quote.slice(0, 120)}${t.quote.length > 120 ? "…" : ""}"</p>
      <div style="display:flex;align-items:center;gap:10px;">${avatar(t)}<div style="font-size:13px;font-weight:600;color:var(--text);">${t.name}<br><span style="font-size:11px;color:var(--text-2);font-weight:400;">${t.role}</span></div></div>
    </div>`).join("")}
  </div>
  <style>@media(max-width:768px){.testi-rest{grid-template-columns:1fr !important;}}</style>` : ""}`;
  return wrapSection("testimonials", inner);
}

// ── Variant 3: Masonry Wall — Pinterest-style variable height (social proof at scale) ──
export function testimonialsMasonry(ctx: ComponentContext, c: TestimonialsContent): string {
  const cols = [c.items.filter((_, i) => i % 2 === 0), c.items.filter((_, i) => i % 2 === 1)];
  const renderCol = (items: TestimonialItem[]) => items.map(t => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};padding:24px;margin-bottom:16px;break-inside:avoid;">
      ${t.rating ? stars(t.rating) : ""}
      <p style="font-size:14px;color:var(--text);line-height:1.7;margin-bottom:16px;font-style:italic;">"${t.quote}"</p>
      <div style="display:flex;align-items:center;gap:10px;">${avatar(t)}<div style="font-size:13px;font-weight:600;color:var(--text);">${t.name}<br><span style="font-size:11px;color:var(--text-2);font-weight:400;">${t.role}</span></div></div>
    </div>`).join("");

  const inner = `${sectionHeader(c)}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="masonry-grid">
    <div>${renderCol(cols[0])}</div>
    <div style="margin-top:${SPACING.lg};">${renderCol(cols[1])}</div>
  </div>
  <style>@media(max-width:768px){.masonry-grid{grid-template-columns:1fr !important;} .masonry-grid>div:last-child{margin-top:0 !important;}}</style>`;
  return wrapSection("testimonials", inner);
}

// ── Variant 4: Logo Wall + Quotes — social proof with company logos ──
export function testimonialsLogoWall(ctx: ComponentContext, c: TestimonialsContent): string {
  const inner = `${sectionHeader(c)}
  <!-- Company trust bar -->
  <div style="display:flex;justify-content:center;gap:${SPACING.lg};flex-wrap:wrap;margin-bottom:${SPACING.lg};padding-bottom:${SPACING.md};border-bottom:1px solid var(--border);">
    ${c.items.map(t => t.company ? `<div style="font-family:var(--heading-font);font-size:16px;font-weight:700;color:var(--text-2);opacity:0.6;">${t.company}</div>` : "").filter(Boolean).join("")}
  </div>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;" class="logo-testi-grid">
    ${c.items.slice(0, 4).map(t => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};padding:28px;">
      ${t.rating ? stars(t.rating) : ""}
      <p style="font-size:14px;color:var(--text);line-height:1.75;margin-bottom:20px;font-style:italic;">"${t.quote}"</p>
      <div style="display:flex;align-items:center;gap:12px;">
        ${avatar(t)}
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text);">${t.name}</div>
          <div style="font-size:12px;color:var(--primary);">${t.role}${t.company ? ` @ ${t.company}` : ""}</div>
        </div>
      </div>
    </div>`).join("")}
  </div>
  <style>@media(max-width:768px){.logo-testi-grid{grid-template-columns:1fr !important;}}</style>`;
  return wrapSection("testimonials", inner);
}

export const TESTIMONIALS_VARIANTS = {
  "grid":       testimonialsGrid,
  "featured":   testimonialsFeatured,
  "masonry":    testimonialsMasonry,
  "logo-wall":  testimonialsLogoWall,
} as const;

export type TestimonialsVariant = keyof typeof TESTIMONIALS_VARIANTS;
