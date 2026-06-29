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
  // Safe initials — never undefined image paths
  const initials = t.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = [
    "linear-gradient(135deg,#D4A853,#B8935A)",
    "linear-gradient(135deg,#7C3AED,#6D28D9)",
    "linear-gradient(135deg,#2563EB,#1E40AF)",
    "linear-gradient(135deg,#059669,#047857)",
  ];
  const grad = colors[t.name.charCodeAt(0) % colors.length];
  return `<div style="position:relative;flex-shrink:0;">
    <div style="width:50px;height:50px;border-radius:${RADIUS.full};background:${grad};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff;letter-spacing:.02em;border:2px solid rgba(255,255,255,0.12);">${initials}</div>
    <div style="position:absolute;bottom:-2px;right:-2px;width:18px;height:18px;border-radius:${RADIUS.full};background:var(--primary);border:2px solid var(--bg);display:flex;align-items:center;justify-content:center;">
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </div>`;
}

function starRating(rating: number): string {
  return Array.from({length: 5}, (_: unknown, i: number) =>
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="${i < (rating||5) ? "#F59E0B" : "rgba(255,255,255,0.15)"}"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
  ).join("");
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
