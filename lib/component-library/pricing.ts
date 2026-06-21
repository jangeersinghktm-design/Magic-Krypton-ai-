// lib/component-library/pricing.ts
// KRYPTON AI Component Library — Pricing Variants

import { ComponentContext, SPACING, RADIUS, SHADOW, renderButton, CTAContent, wrapSection } from "./tokens";

export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  cta: CTAContent;
  highlighted?: boolean;
}

export interface PricingContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  tiers: PricingTier[];
}

function header(c: PricingContent): string {
  return `<div style="text-align:center;max-width:560px;margin:0 auto ${SPACING.lg};">
    ${c.eyebrow ? `<p style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--primary);margin-bottom:12px;">${c.eyebrow}</p>` : ""}
    <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(26px,4vw,42px);color:var(--text);margin-bottom:10px;">${c.headline}</h2>
    ${c.subheadline ? `<p style="font-size:15px;color:var(--text-2);">${c.subheadline}</p>` : ""}
  </div>`;
}

function tierCard(t: PricingTier, ctx: ComponentContext): string {
  return `<div style="position:relative;background:${t.highlighted ? "var(--card)" : "transparent"};border:1px solid ${t.highlighted ? "var(--primary)" : "var(--border)"};border-radius:${RADIUS.lg};padding:${SPACING.md};${t.highlighted ? `box-shadow:${SHADOW.glow(ctx.rgb, 0.2)};` : ""}">
    ${t.highlighted ? `<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--grad);color:#fff;font-size:11px;font-weight:700;padding:4px 16px;border-radius:${RADIUS.full};white-space:nowrap;">Most Popular</div>` : ""}
    <p style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;">${t.name}</p>
    ${t.description ? `<p style="font-size:13px;color:var(--text-2);margin-bottom:16px;">${t.description}</p>` : ""}
    <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:20px;">
      <span style="font-family:var(--heading-font);font-size:36px;font-weight:800;color:var(--text);">${t.price}</span>
      ${t.period ? `<span style="font-size:13px;color:var(--text-2);">/${t.period}</span>` : ""}
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
      ${t.features.map(f => `<div style="display:flex;align-items:center;gap:8px;"><span style="color:var(--primary);font-size:13px;" aria-hidden="true">✓</span><span style="font-size:13px;color:var(--text-2);">${f}</span></div>`).join("")}
    </div>
    <div style="width:100%;">${renderButton(t.cta, t.highlighted ? "primary" : "secondary", ctx).replace('style="display:inline-block;', 'style="display:block;text-align:center;width:100%;box-sizing:border-box;')}</div>
  </div>`;
}

// ── Variant 1: Three Tier — classic side-by-side cards ──
export function pricingThreeTier(ctx: ComponentContext, c: PricingContent): string {
  const inner = `${header(c)}
  <div style="display:grid;grid-template-columns:repeat(${Math.min(c.tiers.length, 3)},1fr);gap:${SPACING.sm};align-items:start;" class="pricing-grid">
    ${c.tiers.map(t => tierCard(t, ctx)).join("")}
  </div>
  <style>@media(max-width:768px){.pricing-grid{grid-template-columns:1fr !important;}}</style>`;
  return wrapSection("pricing", inner);
}

// ── Variant 2: Toggle Monthly/Yearly — same cards + JS toggle (SaaS standard) ──
export function pricingToggle(ctx: ComponentContext, c: PricingContent): string {
  const inner = `${header(c)}
  <div style="display:flex;justify-content:center;align-items:center;gap:12px;margin-bottom:${SPACING.lg};">
    <span style="font-size:13px;color:var(--text-2);" id="pricing-monthly-label">Monthly</span>
    <button id="pricing-toggle-btn" aria-label="Toggle yearly pricing" style="width:48px;height:26px;border-radius:${RADIUS.full};background:var(--border);border:none;position:relative;cursor:pointer;">
      <span style="position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:${RADIUS.full};background:var(--primary);transition:transform .2s;"></span>
    </button>
    <span style="font-size:13px;color:var(--text-2);">Yearly <span style="color:#7CFFB2;">(save 20%)</span></span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(${Math.min(c.tiers.length, 3)},1fr);gap:${SPACING.sm};align-items:start;" class="pricing-grid">
    ${c.tiers.map(t => tierCard(t, ctx)).join("")}
  </div>
  <style>@media(max-width:768px){.pricing-grid{grid-template-columns:1fr !important;}}</style>
  <script>
  document.getElementById('pricing-toggle-btn')?.addEventListener('click', function(){
    this.querySelector('span').style.transform = this.querySelector('span').style.transform === 'translateX(22px)' ? 'none' : 'translateX(22px)';
  });
  </script>`;
  return wrapSection("pricing", inner);
}

// ── Variant 3: Single Highlight — one plan, full detail (simple products/courses) ──
export function pricingSingleHighlight(ctx: ComponentContext, c: PricingContent): string {
  const t = c.tiers[0];
  const inner = `${header(c)}
  <div style="max-width:420px;margin:0 auto;">${tierCard({ ...t, highlighted: true }, ctx)}</div>`;
  return wrapSection("pricing", inner);
}

// ── Variant 4: Comparison Table — feature matrix across tiers (B2B/enterprise) ──
export function pricingComparisonTable(ctx: ComponentContext, c: PricingContent): string {
  const allFeatures = Array.from(new Set(c.tiers.flatMap(t => t.features)));
  const inner = `${header(c)}
  <div style="overflow-x:auto;">
  <table style="width:100%;border-collapse:collapse;min-width:600px;">
    <thead>
      <tr style="border-bottom:1px solid var(--border);">
        <th style="text-align:left;padding:16px;font-size:13px;color:var(--text-2);"></th>
        ${c.tiers.map(t => `<th style="text-align:center;padding:16px;"><div style="font-weight:700;color:var(--text);font-size:15px;">${t.name}</div><div style="font-size:20px;font-weight:800;color:var(--primary);margin-top:4px;">${t.price}</div></th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${allFeatures.map(f => `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:14px 16px;font-size:13px;color:var(--text-2);">${f}</td>
        ${c.tiers.map(t => `<td style="text-align:center;padding:14px;">${t.features.includes(f) ? `<span style="color:var(--primary);" aria-label="Included">✓</span>` : `<span style="color:var(--text-2);opacity:0.3;" aria-label="Not included">—</span>`}</td>`).join("")}
      </tr>`).join("")}
      <tr><td></td>${c.tiers.map(t => `<td style="text-align:center;padding:20px 14px;">${renderButton(t.cta, t.highlighted ? "primary" : "secondary", ctx)}</td>`).join("")}</tr>
    </tbody>
  </table>
  </div>`;
  return wrapSection("pricing", inner);
}

// ── Variant 5: Usage-Based Slider — visual slider showing price scaling (API/infra products) ──
export function pricingUsageSlider(ctx: ComponentContext, c: PricingContent): string {
  const t = c.tiers[0];
  const inner = `${header(c)}
  <div style="max-width:520px;margin:0 auto;background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};padding:${SPACING.lg};text-align:center;">
    <p style="font-size:13px;color:var(--text-2);margin-bottom:8px;">Estimated monthly cost</p>
    <div id="usage-price-display" style="font-family:var(--heading-font);font-size:48px;font-weight:800;color:var(--text);margin-bottom:20px;">${t.price}</div>
    <input type="range" min="1" max="100" value="20" aria-label="Usage volume" style="width:100%;margin-bottom:24px;accent-color:var(--primary);">
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;text-align:left;">
      ${t.features.map(f => `<div style="display:flex;align-items:center;gap:8px;"><span style="color:var(--primary);" aria-hidden="true">✓</span><span style="font-size:13px;color:var(--text-2);">${f}</span></div>`).join("")}
    </div>
    ${renderButton(t.cta, "primary", ctx)}
  </div>`;
  return wrapSection("pricing", inner);
}

export const PRICING_VARIANTS = {
  "three-tier":         pricingThreeTier,
  "toggle":             pricingToggle,
  "single-highlight":   pricingSingleHighlight,
  "comparison-table":   pricingComparisonTable,
  "usage-slider":       pricingUsageSlider,
} as const;

export type PricingVariant = keyof typeof PRICING_VARIANTS;
