// lib/component-library/cta.ts
// KRYPTON AI Component Library — CTA Section Variants

import { ComponentContext, SPACING, RADIUS, renderButton, CTAContent, wrapSection } from "./tokens";

export interface CTASectionContent {
  headline: string;
  subheadline?: string;
  ctaPrimary: CTAContent;
  ctaSecondary?: CTAContent;
  formPlaceholder?: string; // for split-form variant
}

// ── Variant 1: Centered Gradient — glow background, classic high-impact close ──
export function ctaCenteredGradient(ctx: ComponentContext, c: CTASectionContent): string {
  const inner = `<div style="position:relative;text-align:center;max-width:640px;margin:0 auto;padding:${SPACING.xl} 0;">
    <div style="position:absolute;inset:-60px;background:radial-gradient(ellipse at center,rgba(var(--primary-rgb),0.12),transparent 70%);filter:blur(40px);z-index:0;" aria-hidden="true"></div>
    <div style="position:relative;z-index:1;">
      <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(28px,4.5vw,48px);color:var(--text);margin-bottom:16px;">${c.headline}</h2>
      ${c.subheadline ? `<p style="font-size:16px;color:var(--text-2);margin-bottom:${SPACING.md};">${c.subheadline}</p>` : ""}
      <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
        ${renderButton(c.ctaPrimary, "primary", ctx)}
        ${c.ctaSecondary ? renderButton(c.ctaSecondary, "secondary", ctx) : ""}
      </div>
    </div>
  </div>`;
  return wrapSection("cta", inner, { bg: "var(--surface)" });
}

// ── Variant 2: Split Form — headline left, email-capture form right (newsletter/lead-gen) ──
export function ctaSplitForm(ctx: ComponentContext, c: CTASectionContent): string {
  const inner = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:${SPACING.lg};align-items:center;background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.xl};padding:${SPACING.lg};" class="cta-split">
    <div>
      <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(24px,3.5vw,36px);color:var(--text);margin-bottom:12px;">${c.headline}</h2>
      ${c.subheadline ? `<p style="font-size:15px;color:var(--text-2);">${c.subheadline}</p>` : ""}
    </div>
    <form style="display:flex;gap:10px;flex-wrap:wrap;" onsubmit="event.preventDefault();this.querySelector('button').textContent='✓ Done';">
      <input type="email" required placeholder="${c.formPlaceholder || "Enter your email"}" aria-label="Email address" style="flex:1;min-width:200px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:${RADIUS.md};padding:14px 18px;color:var(--text);font-size:14px;">
      <button type="submit" style="background:var(--grad);color:#fff;border:none;border-radius:${RADIUS.md};padding:14px 28px;font-weight:700;cursor:pointer;">${c.ctaPrimary.text}</button>
    </form>
  </div>
  <style>@media(max-width:768px){.cta-split{grid-template-columns:1fr !important;}}</style>`;
  return wrapSection("cta", inner);
}

// ── Variant 3: Banner Strip — slim full-width bar, minimal/persistent feel ──
export function ctaBannerStrip(ctx: ComponentContext, c: CTASectionContent): string {
  const inner = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;background:var(--grad);border-radius:${RADIUS.lg};padding:${SPACING.md} ${SPACING.lg};">
    <div>
      <h2 style="font-size:clamp(18px,2.5vw,24px);font-weight:700;color:#fff;">${c.headline}</h2>
      ${c.subheadline ? `<p style="font-size:14px;color:rgba(255,255,255,0.85);">${c.subheadline}</p>` : ""}
    </div>
    <a href="${c.ctaPrimary.href || "#"}" style="background:#fff;color:#000;padding:12px 28px;border-radius:${RADIUS.md};font-weight:700;text-decoration:none;flex-shrink:0;">${c.ctaPrimary.text}</a>
  </div>`;
  return wrapSection("cta", inner);
}

// ── Variant 4: Floating Card — elevated card over subtle bg pattern (premium/luxury close) ──
export function ctaFloatingCard(ctx: ComponentContext, c: CTASectionContent): string {
  const inner = `<div style="max-width:560px;margin:0 auto;text-align:center;background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.xl};padding:${SPACING.xl} ${SPACING.lg};box-shadow:0 30px 80px rgba(0,0,0,0.4);">
    <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(24px,3.5vw,34px);color:var(--text);margin-bottom:14px;">${c.headline}</h2>
    ${c.subheadline ? `<p style="font-size:15px;color:var(--text-2);margin-bottom:${SPACING.md};">${c.subheadline}</p>` : ""}
    ${renderButton(c.ctaPrimary, "primary", ctx)}
  </div>`;
  return wrapSection("cta", inner);
}

export const CTA_VARIANTS = {
  "centered-gradient": ctaCenteredGradient,
  "split-form":        ctaSplitForm,
  "banner-strip":      ctaBannerStrip,
  "floating-card":     ctaFloatingCard,
} as const;

export type CTAVariant = keyof typeof CTA_VARIANTS;
