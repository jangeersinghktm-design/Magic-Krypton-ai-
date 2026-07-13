// lib/component-library/stats.ts
// KRYPTON AI Component Library — Stats Variants
// A genuinely new component category (metrics/numbers showcase — common
// on SaaS/startup/agency sites: "10,000+ customers", "99.9% uptime" etc).

import { ComponentContext, SPACING, RADIUS, wrapSection } from "./tokens";

export interface StatItem {
  value: string;   // e.g. "10,000+", "99.9%", "$2M"
  label: string;   // e.g. "Happy customers"
  icon?: string;    // optional emoji/icon
}

export interface StatsContent {
  eyebrow?: string;
  headline?: string;
  items: StatItem[];
}

function sectionHeader(c: StatsContent): string {
  if (!c.headline) return "";
  return `<div style="text-align:center;max-width:600px;margin:0 auto ${SPACING.lg};">
    ${c.eyebrow ? `<p style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--primary);margin-bottom:12px;">${c.eyebrow}</p>` : ""}
    <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(24px,3.5vw,36px);color:var(--text);">${c.headline}</h2>
  </div>`;
}

// ── Variant 1: Counter Grid — big bold numbers in an even row ──────────
export function statsCounterGrid(ctx: ComponentContext, c: StatsContent): string {
  const cols = Math.min(c.items.length, 4);
  const inner = `
  ${sectionHeader(c)}
  <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${SPACING.lg};text-align:center;" class="stats-grid">
    ${c.items.map(s => `
      <div>
        <div style="font-family:var(--heading-font);font-weight:800;font-size:clamp(32px,5vw,52px);background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;line-height:1.1;">${s.value}</div>
        <p style="font-size:14px;color:var(--text-2);margin-top:8px;">${s.label}</p>
      </div>
    `).join("")}
  </div>
  <style>@media(max-width:768px){.stats-grid{grid-template-columns:repeat(2,1fr) !important;}}</style>`;
  return wrapSection("stats", inner);
}

// ── Variant 2: Icon Stats — number paired with an icon, card-style ──────
export function statsIconCards(ctx: ComponentContext, c: StatsContent): string {
  const cols = Math.min(c.items.length, 4);
  const inner = `
  ${sectionHeader(c)}
  <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${SPACING.md};" class="stats-grid">
    ${c.items.map(s => `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};padding:28px 20px;text-align:center;">
        ${s.icon ? `<div style="font-size:28px;margin-bottom:12px;">${s.icon}</div>` : ""}
        <div style="font-family:var(--heading-font);font-weight:700;font-size:clamp(26px,4vw,38px);color:var(--text);">${s.value}</div>
        <p style="font-size:13px;color:var(--text-2);margin-top:6px;">${s.label}</p>
      </div>
    `).join("")}
  </div>
  <style>@media(max-width:768px){.stats-grid{grid-template-columns:repeat(2,1fr) !important;}}</style>`;
  return wrapSection("stats", inner);
}

// ── Variant 3: Split Stats — headline on one side, stat list on the other
export function statsSplit(ctx: ComponentContext, c: StatsContent): string {
  const inner = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:${SPACING.xl};align-items:center;" class="stats-split">
    <div>
      ${c.eyebrow ? `<p style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--primary);margin-bottom:12px;">${c.eyebrow}</p>` : ""}
      <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(26px,4vw,42px);color:var(--text);line-height:1.15;">${c.headline || ""}</h2>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:${SPACING.md};">
      ${c.items.slice(0, 4).map(s => `
        <div style="border-left:2px solid var(--primary);padding-left:16px;">
          <div style="font-family:var(--heading-font);font-weight:800;font-size:clamp(24px,3.5vw,34px);color:var(--text);">${s.value}</div>
          <p style="font-size:13px;color:var(--text-2);margin-top:4px;">${s.label}</p>
        </div>
      `).join("")}
    </div>
  </div>
  <style>@media(max-width:768px){.stats-split{grid-template-columns:1fr !important;}}</style>`;
  return wrapSection("stats", inner);
}

// ── Variant 4: Minimal Inline — single-row, no cards, understated ──────
export function statsMinimalInline(ctx: ComponentContext, c: StatsContent): string {
  const inner = `
  ${sectionHeader(c)}
  <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:${SPACING.xl};text-align:center;">
    ${c.items.map((s, i) => `
      ${i > 0 ? `<div style="width:1px;background:var(--border);align-self:stretch;"></div>` : ""}
      <div>
        <div style="font-family:var(--heading-font);font-weight:700;font-size:clamp(22px,3vw,30px);color:var(--text);">${s.value}</div>
        <p style="font-size:12px;color:var(--text-2);margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;">${s.label}</p>
      </div>
    `).join("")}
  </div>`;
  return wrapSection("stats", inner);
}

export const STATS_VARIANTS = {
  "counter-grid":   statsCounterGrid,
  "icon-cards":     statsIconCards,
  "split":          statsSplit,
  "minimal-inline": statsMinimalInline,
} as const;

export type StatsVariant = keyof typeof STATS_VARIANTS;

