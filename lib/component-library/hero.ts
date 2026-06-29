// lib/component-library/hero.ts
// KRYPTON AI Component Library — Hero Section Variants

import { ComponentContext, SPACING, RADIUS, renderButton, renderBenefitList, renderBadge, wrapSection } from "./tokens";

export interface HeroContent {
  badge?: string;
  headline: string;        // can include a <span class="grad-text"> wrapped portion
  subheadline: string;
  ctaPrimary: { text: string; href?: string };
  ctaSecondary?: { text: string; href?: string };
  benefits?: { text: string }[];
  imageUrl?: string;
}

// ── Variant 1: Split — text left, image right (most versatile, works for SaaS/agency/ecommerce) ──
export function heroSplitImage(ctx: ComponentContext, c: HeroContent): string {
  const inner = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:${SPACING.xxl};align-items:center;" class="hero-grid">
    <div>
      ${c.badge ? renderBadge(c.badge) : ""}
      <h1 style="font-family:var(--heading-font);font-weight:var(--heading-weight);letter-spacing:var(--heading-spacing);font-size:clamp(32px,5vw,58px);line-height:1.1;color:var(--text);margin-bottom:${SPACING.sm};">${c.headline}</h1>
      <p style="font-size:18px;color:var(--text-2);line-height:1.7;max-width:480px;margin-bottom:${SPACING.md};">${c.subheadline}</p>
      ${renderBenefitList(c.benefits || [], ctx)}
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${renderButton(c.ctaPrimary, "primary", ctx)}
        ${c.ctaSecondary ? renderButton(c.ctaSecondary, "secondary", ctx) : ""}
      </div>
    </div>
    <div style="position:relative;">
      <img src="${c.imageUrl || ""}" alt="${c.headline}" loading="lazy" style="width:100%;height:auto;border-radius:${RADIUS.lg};box-shadow:0 30px 80px rgba(0,0,0,0.4);display:block;">
    </div>
  </div>
  <style>@media(max-width:768px){.hero-grid{grid-template-columns:1fr !important;}}</style>`;
  return wrapSection("hero", inner, { extraStyle: "padding-top:120px;" });
}

// ── Variant 2: Centered — badge/headline/CTA stacked, full-width (SaaS, content, minimal brands) ──
export function heroCentered(ctx: ComponentContext, c: HeroContent): string {
  const inner = `
  <div style="text-align:center;max-width:760px;margin:0 auto;">
    ${c.badge ? `<div style="display:flex;justify-content:center;">${renderBadge(c.badge)}</div>` : ""}
    <h1 style="font-family:var(--heading-font);font-weight:var(--heading-weight);letter-spacing:var(--heading-spacing);font-size:clamp(34px,6vw,64px);line-height:1.08;color:var(--text);margin-bottom:${SPACING.sm};">${c.headline}</h1>
    <p style="font-size:18px;color:var(--text-2);line-height:1.7;max-width:540px;margin:0 auto ${SPACING.md};">${c.subheadline}</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
      ${renderButton(c.ctaPrimary, "primary", ctx)}
      ${c.ctaSecondary ? renderButton(c.ctaSecondary, "secondary", ctx) : ""}
    </div>
    ${c.imageUrl ? `<img src="${c.imageUrl}" alt="${c.headline}" loading="lazy" style="width:100%;max-width:1000px;margin-top:${SPACING.xl};border-radius:${RADIUS.lg};box-shadow:0 30px 80px rgba(0,0,0,0.4);">` : ""}
  </div>`;
  return wrapSection("hero", inner, { extraStyle: "padding-top:120px;" });
}

// ── Variant 3: Product Showcase — image dominant, floating UI card overlay (dashboard/app products) ──
export function heroProductShowcase(ctx: ComponentContext, c: HeroContent): string {
  const inner = `
  <div style="text-align:center;max-width:680px;margin:0 auto ${SPACING.lg};">
    ${c.badge ? `<div style="display:flex;justify-content:center;">${renderBadge(c.badge)}</div>` : ""}
    <h1 style="font-family:var(--heading-font);font-weight:var(--heading-weight);letter-spacing:var(--heading-spacing);font-size:clamp(30px,5.5vw,54px);line-height:1.12;color:var(--text);margin-bottom:${SPACING.sm};">${c.headline}</h1>
    <p style="font-size:17px;color:var(--text-2);line-height:1.7;margin-bottom:${SPACING.md};">${c.subheadline}</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
      ${renderButton(c.ctaPrimary, "primary", ctx)}
      ${c.ctaSecondary ? renderButton(c.ctaSecondary, "secondary", ctx) : ""}
    </div>
  </div>
  <div style="position:relative;max-width:1100px;margin:0 auto;">
    <div style="position:absolute;inset:-40px;background:radial-gradient(ellipse at center,rgba(var(--primary-rgb),0.15),transparent 70%);filter:blur(40px);z-index:0;" aria-hidden="true"></div>
    <img src="${c.imageUrl || ""}" alt="Product preview" loading="lazy" style="position:relative;z-index:1;width:100%;border-radius:${RADIUS.lg};border:1px solid var(--border);box-shadow:0 40px 100px rgba(0,0,0,0.5);display:block;">
  </div>`;
  return wrapSection("hero", inner, { extraStyle: "padding-top:120px;" });
}

// ── Variant 4: Minimal Statement — typography-led, no image, ultra-premium (luxury/editorial) ──
export function heroMinimalStatement(ctx: ComponentContext, c: HeroContent): string {
  const inner = `
  <div style="position:relative;text-align:center;max-width:900px;margin:0 auto;padding:clamp(80px,14vw,160px) 0 clamp(60px,10vw,120px);">

    ${c.badge ? `
    <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:32px;">
      <div style="width:6px;height:6px;border-radius:50%;background:var(--primary);"></div>
      <p style="font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:var(--text-2);margin:0;">${c.badge}</p>
      <div style="width:6px;height:6px;border-radius:50%;background:var(--primary);"></div>
    </div>` : ""}

    <h1 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(42px,8vw,110px);letter-spacing:var(--heading-spacing);line-height:1.01;color:var(--text);margin-bottom:24px;">
      ${c.headline}
    </h1>

    <div style="width:80px;height:1px;background:linear-gradient(90deg,transparent,var(--primary),transparent);margin:0 auto 28px;"></div>

    <p style="font-size:clamp(15px,2vw,20px);color:var(--text-2);line-height:1.8;max-width:520px;margin:0 auto 48px;font-weight:300;letter-spacing:0.02em;">
      ${c.subheadline || ""}
    </p>

    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
      ${c.ctaPrimary ? `
      <a href="${c.ctaPrimary.href || "#"}"
        style="display:inline-flex;align-items:center;gap:10px;background:var(--text);color:var(--bg);padding:16px 40px;border-radius:2px;font-weight:700;font-size:13px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;transition:all .3s;box-shadow:0 8px 32px rgba(255,255,255,0.15);"
        onmouseenter="this.style.background='var(--grad)';this.style.color='#fff';this.style.transform='translateY(-2px)';this.style.boxShadow='0 16px 48px rgba(212,168,83,0.4)';"
        onmouseleave="this.style.background='var(--text)';this.style.color='var(--bg)';this.style.transform='none';this.style.boxShadow='0 8px 32px rgba(255,255,255,0.15)';">
        ${c.ctaPrimary.text}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>` : ""}
      ${c.ctaSecondary ? `
      <a href="${c.ctaSecondary.href || "#"}"
        style="display:inline-flex;align-items:center;gap:8px;color:var(--text-2);padding:16px 32px;border:1px solid rgba(255,255,255,0.12);border-radius:2px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;transition:all .3s;"
        onmouseenter="this.style.color='var(--text)';this.style.borderColor='rgba(255,255,255,0.4)';"
        onmouseleave="this.style.color='var(--text-2)';this.style.borderColor='rgba(255,255,255,0.12)';">
        ${c.ctaSecondary.text}
      </a>` : ""}
    </div>
  </div>`;
  return wrapSection("hero", inner, { extraStyle: "padding:0;position:relative;overflow:hidden;min-height:90vh;display:flex;align-items:center;background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(212,168,83,0.06) 0%,transparent 60%),var(--bg);" });
}


export const HERO_VARIANTS = {
  "split-image":        heroSplitImage,
  "centered":            heroCentered,
  "product-showcase":   heroProductShowcase,
  "minimal-statement":  heroMinimalStatement,
} as const;

export type HeroVariant = keyof typeof HERO_VARIANTS;
