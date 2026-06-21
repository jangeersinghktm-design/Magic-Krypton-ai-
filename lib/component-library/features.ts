// lib/component-library/features.ts
// KRYPTON AI Component Library — Feature Section Variants

import { ComponentContext, SPACING, RADIUS, SHADOW, wrapSection } from "./tokens";

export interface FeatureItem {
  icon?: string;       // emoji or single glyph
  title: string;
  desc: string;
  imageUrl?: string;
  stat?: string;       // for stat-highlight variant
}

export interface FeaturesContent {
  eyebrow?: string;
  headline: string;
  items: FeatureItem[];
}

function sectionHeader(c: FeaturesContent): string {
  return `<div style="text-align:center;max-width:600px;margin:0 auto ${SPACING.lg};">
    ${c.eyebrow ? `<p style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--primary);margin-bottom:12px;">${c.eyebrow}</p>` : ""}
    <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(26px,4vw,42px);color:var(--text);">${c.headline}</h2>
  </div>`;
}

// ── Variant 1: Icon Grid 3-Col — classic, works everywhere ──
export function featuresIconGrid(ctx: ComponentContext, c: FeaturesContent): string {
  const inner = `${sectionHeader(c)}
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:${SPACING.sm};" class="feat-grid">
    ${c.items.map(f => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};padding:${SPACING.md};transition:transform .25s;">
      <div style="font-size:28px;margin-bottom:16px;" aria-hidden="true">${f.icon || "◆"}</div>
      <h3 style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:8px;">${f.title}</h3>
      <p style="font-size:14px;color:var(--text-2);line-height:1.65;">${f.desc}</p>
    </div>`).join("")}
  </div>
  <style>@media(max-width:768px){.feat-grid{grid-template-columns:1fr !important;}}</style>`;
  return wrapSection("features", inner);
}

// ── Variant 2: Alternating Rows — image+text alternating sides (storytelling, SaaS) ──
export function featuresAlternating(ctx: ComponentContext, c: FeaturesContent): string {
  const rows = c.items.map((f, i) => `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:${SPACING.xl};align-items:center;direction:${i % 2 === 1 ? "rtl" : "ltr"};" class="feat-row">
      <div style="direction:ltr;">
        <h3 style="font-family:var(--heading-font);font-size:clamp(22px,3vw,30px);font-weight:700;color:var(--text);margin-bottom:12px;">${f.title}</h3>
        <p style="font-size:16px;color:var(--text-2);line-height:1.75;">${f.desc}</p>
      </div>
      <div style="direction:ltr;">
        <img src="${f.imageUrl || ""}" alt="${f.title}" loading="lazy" style="width:100%;border-radius:${RADIUS.lg};box-shadow:${SHADOW.lg};">
      </div>
    </div>`).join(`<div style="height:${SPACING.xl};" aria-hidden="true"></div>`);

  const inner = `${sectionHeader(c)}${rows}
  <style>@media(max-width:768px){.feat-row{grid-template-columns:1fr !important;direction:ltr !important;}}</style>`;
  return wrapSection("features", inner);
}

// ── Variant 3: Bento Grid — mixed-size asymmetric cards (modern/dashboard products) ──
export function featuresBentoGrid(ctx: ComponentContext, c: FeaturesContent): string {
  const items = c.items.slice(0, 5);
  const sizes = ["grid-column:span 2;", "", "", "grid-column:span 2;", ""];
  const inner = `${sectionHeader(c)}
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:${SPACING.sm};" class="feat-bento">
    ${items.map((f, i) => `
    <div style="${sizes[i] || ""}background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};padding:${SPACING.md};min-height:180px;display:flex;flex-direction:column;justify-content:flex-end;">
      <div style="font-size:24px;margin-bottom:12px;" aria-hidden="true">${f.icon || "◆"}</div>
      <h3 style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px;">${f.title}</h3>
      <p style="font-size:13px;color:var(--text-2);line-height:1.6;">${f.desc}</p>
    </div>`).join("")}
  </div>
  <style>@media(max-width:768px){.feat-bento{grid-template-columns:1fr !important;}.feat-bento>div{grid-column:span 1 !important;}}</style>`;
  return wrapSection("features", inner);
}

// ── Variant 4: Stat Highlight — big numbers + label, for metrics/results-driven niches ──
export function featuresStatHighlight(ctx: ComponentContext, c: FeaturesContent): string {
  const inner = `${sectionHeader(c)}
  <div style="display:grid;grid-template-columns:repeat(${Math.min(c.items.length, 4)},1fr);gap:${SPACING.sm};" class="feat-stats">
    ${c.items.map(f => `
    <div style="text-align:center;padding:${SPACING.md};border:1px solid var(--border);border-radius:${RADIUS.lg};background:var(--card);">
      <div style="font-family:var(--heading-font);font-size:clamp(28px,4vw,44px);font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px;">${f.stat || f.title}</div>
      <p style="font-size:13px;color:var(--text-2);font-weight:500;">${f.desc}</p>
    </div>`).join("")}
  </div>
  <style>@media(max-width:768px){.feat-stats{grid-template-columns:repeat(2,1fr) !important;}}</style>`;
  return wrapSection("features", inner);
}

export const FEATURES_VARIANTS = {
  "icon-grid":      featuresIconGrid,
  "alternating":    featuresAlternating,
  "bento-grid":     featuresBentoGrid,
  "stat-highlight": featuresStatHighlight,
} as const;

export type FeaturesVariant = keyof typeof FEATURES_VARIANTS;
