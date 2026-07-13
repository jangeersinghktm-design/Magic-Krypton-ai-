// lib/component-library/index.ts
// KRYPTON AI Component Library — Selection Engine
//
// Replaces "AI writes all HTML from scratch" with "AI picks a variant +
// writes only the content; tested template code renders the actual HTML."
// This is THE highest-leverage fix for structural consistency: spacing,
// shadows, radius, mobile breakpoints, and accessibility are GUARANTEED
// correct because they live in code, not in what the AI happens to recall
// correctly on a given generation.

import { ComponentContext, hexToRgbValues } from "./tokens";
import { HERO_VARIANTS, HeroVariant, HeroContent } from "./hero";
import { NAVBAR_VARIANTS, NavbarVariant, NavbarContent } from "./navbar";
import { FEATURES_VARIANTS, FeaturesVariant, FeaturesContent } from "./features";
import { CTA_VARIANTS, CTAVariant, CTASectionContent } from "./cta";
import { FOOTER_VARIANTS, FooterVariant, FooterContent } from "./footer";
import { PRICING_VARIANTS, PricingVariant, PricingContent } from "./pricing";
import { DASHBOARD_VARIANTS, DashboardVariant, DashboardContent } from "./dashboard";
import { TESTIMONIALS_VARIANTS, TestimonialsVariant, TestimonialsContent } from "./testimonials";
import { FAQ_VARIANTS, FAQVariant, FAQContent } from "./faq";
import { PORTFOLIO_VARIANTS, PortfolioVariant, PortfolioContent } from "./portfolio";
import { ECOMMERCE_VARIANTS, EcommerceVariant, EcommerceContent } from "./ecommerce";
import { STATS_VARIANTS, StatsVariant, StatsContent } from "./stats";

export * from "./tokens";
export * from "./hero";
export * from "./navbar";
export * from "./features";
export * from "./cta";
export * from "./footer";
export * from "./pricing";
export * from "./dashboard";
export * from "./testimonials";
export * from "./faq";
export * from "./portfolio";
export * from "./ecommerce";
export * from "./stats";

export type ComponentCategory = "hero" | "navbar" | "features" | "cta" | "footer" | "pricing" | "dashboard" | "testimonials" | "faq" | "portfolio" | "ecommerce" | "contact" | "stats";
// ── Sensible default variant per niche marketLevel/tone — used when the
// Blueprint stage doesn't specify a variant explicitly. Keeps generation
// fast (no extra decision needed) while still picking something fitting.
const NICHE_DEFAULTS: Record<string, Record<ComponentCategory, string>> = {
  luxury: {
    hero: "minimal-statement", navbar: "bold-split", features: "alternating",
    cta: "floating-card", footer: "minimal-centered", pricing: "single-highlight", dashboard: "analytics-charts",
    testimonials: "featured", faq: "accordion", portfolio: "masonry", ecommerce: "featured-product", contact: "full-form",
  },
  energetic: {
    hero: "centered", navbar: "bordered-cta", features: "stat-highlight",
    cta: "banner-strip", footer: "newsletter-rich", pricing: "three-tier", dashboard: "topnav-cards",
    testimonials: "grid", faq: "simple-list", portfolio: "filter-gallery", ecommerce: "scroll-cards", contact: "split",
  },
  trust: {
    hero: "split-image", navbar: "glass-sticky", features: "icon-grid",
    cta: "centered-gradient", footer: "four-column", pricing: "comparison-table", dashboard: "sidebar-stats",
    testimonials: "logo-wall", faq: "highlighted", portfolio: "list", ecommerce: "product-grid", contact: "full-form",
  },
  default: {
    hero: "split-image", navbar: "glass-sticky", features: "icon-grid",
    cta: "centered-gradient", footer: "four-column", pricing: "three-tier", dashboard: "sidebar-stats",
    testimonials: "grid", faq: "simple-list", portfolio: "featured-grid", ecommerce: "product-grid", contact: "full-form",
  },
};

export function getDefaultVariant(category: ComponentCategory, tone: string): string {
  const bucket = NICHE_DEFAULTS[tone] || NICHE_DEFAULTS.default;
  return bucket[category];
}

// ── Build a ComponentContext from a niche's primary color hex ───────
export function buildComponentContext(primaryHex: string): ComponentContext {
  return { rgb: hexToRgbValues(primaryHex), headingFont: "var(--heading-font)" };
}

// ── Deterministic :root token block — NOT AI-generated, so these
// critical variables (used by every component in this library) are
// GUARANTEED correct every time, regardless of what the AI CSS stage
// produces. Prepend this to final CSS output unconditionally.
export function buildRootTokens(niche: {
  palette: { primary: string; secondary: string; grad: string; accent: string; bg: string; surface: string; card: string; text2: string };
  typography: { headingFont: string; bodyFont: string; headingWeight: string; headingSpacing: string };
}): string {
  const p = niche.palette, t = niche.typography;
  return `:root{
  --primary:${p.primary};--secondary:${p.secondary};--grad:${p.grad};--accent:${p.accent};
  --bg:${p.bg};--surface:${p.surface};--card:${p.card};
  --text:#FFFFFF;--text-2:${p.text2};
  --border:rgba(255,255,255,0.07);--border-accent:rgba(${hexToRgbValues(p.primary)},0.3);
  --primary-rgb:${hexToRgbValues(p.primary)};--bg-rgb:${hexToRgbValues(p.bg)};
  --heading-font:${t.headingFont};--body-font:${t.bodyFont};
  --heading-weight:${t.headingWeight};--heading-spacing:${t.headingSpacing};
}
*{box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:var(--body-font);margin:0;line-height:1.6;}
h1,h2,h3,h4{font-family:var(--heading-font);}
.reveal{opacity:0;transform:translateY(20px);transition:opacity .6s,transform .6s;}
.reveal.visible{opacity:1;transform:none;}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}`;
}

// ── Master dispatcher — renders any category+variant with given content ──
// Falls back to the category's first variant if an unknown/AI-hallucinated
// variant name is passed, so a bad Blueprint choice never crashes generation.
export function renderComponent(
  category: ComponentCategory,
  variant: string,
  ctx: ComponentContext,
  content: any
): string {
  switch (category) {
    case "hero": {
      const fn = HERO_VARIANTS[variant as HeroVariant] || HERO_VARIANTS["split-image"];
      return fn(ctx, content as HeroContent);
    }
    case "navbar": {
      const fn = NAVBAR_VARIANTS[variant as NavbarVariant] || NAVBAR_VARIANTS["glass-sticky"];
      return fn(ctx, content as NavbarContent);
    }
    case "features": {
      const fn = FEATURES_VARIANTS[variant as FeaturesVariant] || FEATURES_VARIANTS["icon-grid"];
      return fn(ctx, content as FeaturesContent);
    }
    case "cta": {
      const fn = CTA_VARIANTS[variant as CTAVariant] || CTA_VARIANTS["centered-gradient"];
      return fn(ctx, content as CTASectionContent);
    }
    case "footer": {
      const fn = FOOTER_VARIANTS[variant as FooterVariant] || FOOTER_VARIANTS["four-column"];
      return fn(ctx, content as FooterContent);
    }
    case "pricing": {
      const fn = PRICING_VARIANTS[variant as PricingVariant] || PRICING_VARIANTS["three-tier"];
      return fn(ctx, content as PricingContent);
    }
    case "dashboard": {
      const fn = DASHBOARD_VARIANTS[variant as DashboardVariant] || DASHBOARD_VARIANTS["sidebar-stats"];
      return fn(ctx, content as DashboardContent);
    }
    case "testimonials": {
      const fn = TESTIMONIALS_VARIANTS[variant as TestimonialsVariant] || TESTIMONIALS_VARIANTS["grid"];
      return fn(ctx, content as TestimonialsContent);
    }
    case "faq": {
      const fn = FAQ_VARIANTS[variant as FAQVariant] || FAQ_VARIANTS["simple-list"];
      return fn(ctx, content as FAQContent);
    }
    case "portfolio": {
      const fn = PORTFOLIO_VARIANTS[variant as PortfolioVariant] || PORTFOLIO_VARIANTS["featured-grid"];
      return fn(ctx, content as PortfolioContent);
    }
    case "ecommerce": {
      const fn = ECOMMERCE_VARIANTS[variant as EcommerceVariant] || ECOMMERCE_VARIANTS["product-grid"];
      return fn(ctx, content as EcommerceContent);
    }
    case "stats": {
      const fn = STATS_VARIANTS[variant as StatsVariant] || STATS_VARIANTS["counter-grid"];
      return fn(ctx, content as StatsContent);
    }
    default:
      return "";
  }
}

// ── Lists every available variant name per category — used to build the
// Blueprint-stage prompt so the AI picks from REAL options, not invented ones ──
export function listVariants(category: ComponentCategory): string[] {
  switch (category) {
    case "hero":      return Object.keys(HERO_VARIANTS);
    case "navbar":    return Object.keys(NAVBAR_VARIANTS);
    case "features":  return Object.keys(FEATURES_VARIANTS);
    case "cta":       return Object.keys(CTA_VARIANTS);
    case "footer":    return Object.keys(FOOTER_VARIANTS);
    case "pricing":   return Object.keys(PRICING_VARIANTS);
    case "dashboard":     return Object.keys(DASHBOARD_VARIANTS);
    case "testimonials":  return Object.keys(TESTIMONIALS_VARIANTS);
    case "faq":           return Object.keys(FAQ_VARIANTS);
    case "portfolio":     return Object.keys(PORTFOLIO_VARIANTS);
    case "ecommerce":     return Object.keys(ECOMMERCE_VARIANTS);
    case "stats":         return Object.keys(STATS_VARIANTS);
    default:              return [];
  }
}

export const COMPONENT_LIBRARY_STATS = {
  totalComponents: 54,
  categories: 12,
  breakdown: {
    hero: 8, navbar: 4, features: 4, cta: 4, footer: 4, pricing: 5, dashboard: 5,
    testimonials: 4, faq: 4, portfolio: 4, ecommerce: 4, stats: 4,
  },
};
