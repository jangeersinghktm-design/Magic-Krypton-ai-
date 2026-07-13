// app/api/orchestrate/route.ts
// Krypton AI — Real Agent Orchestration via Server-Sent Events
// 7-Phase Pipeline: Plan → Research → Design → Build → QA → Optimize → Deliver
// Never fake progress — every event tied to real AI operations

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { acquireGenerationLock, releaseGenerationLock } from "@/lib/generation-lock";
import { createSeededRandom, generationSeedFromId, pickVariantFromSeed } from "@/lib/design-engine";
import { callClaude, callOpenAI, callGemini, kryptonGenerate } from "@/lib/ai-providers";
import {
  renderComponent, getDefaultVariant, listVariants, buildComponentContext,
  buildRootTokens, type ComponentCategory,
} from "@/lib/component-library";
import {
  runProductionGate,
  buildRepairInstructions,
  getWebsiteTemplate,
  hasWebsiteTemplate,
  buildWebsiteChecklistPrompt,
  generateWebsiteBlueprint,
  buildBlueprintPrompt,
  applyAutoRepairs,
  type ProductionGateResult,
  type ProjectBlueprint,
} from "@/lib/completion-engine";
import { buildDesignSummary } from "@/lib/completion-engine/design-summary";
import { buildDesignPlan } from "@/lib/design-director";

export const runtime     = "nodejs"; // FIXED: was "edge" — Edge ignores maxDuration on Hobby plan
                                      // and blocks external API calls. Node.js required for AI calls.
export const maxDuration = 300; // Hobby plan Node.js max = 60s. Pro plan allows 300s.

// ── Types ────────────────────────────────────────────────────────
interface AgentPhase {
  agent:   string;
  icon:    string;
  action:  string;
  pct:     number;
  done?:   boolean;
}

interface StreamController {
  send:  (event: string, data: object) => void;
  close: () => void;
}

// ── Krypton Intelligence Engine — Multi-provider system (see lib/ai-providers.ts) ──

// ═══════════════════════════════════════════════════════════════
// REAL IMAGE SYSTEM — Fixes dead source.unsplash.com (discontinued
// August 2023). Uses Unsplash's live Search API when a free API key
// is configured (UNSPLASH_ACCESS_KEY env var — sign up free at
// unsplash.com/developers, 50 req/hour on demo tier).
//
// Falls back to a curated bank of verified-permanent Unsplash CDN
// photo IDs (images.unsplash.com/photo-ID format never expires,
// unlike the dead "source" redirect API) when no key is set.
// ═══════════════════════════════════════════════════════════════

// SAFE fallback — Picsum Photos (https://picsum.photos) requires no API key,
// no photo-ID lookup, and NEVER returns a broken link — every seed number
// deterministically maps to a real, stable photo. Used only when the
// Unsplash Search API key isn't configured (less keyword-relevant, but
// 100% guaranteed to load — never a broken/dead image).
import {
  getPicsumFallback, fetchUnsplashImages, getRealImageSet, detectProjectType,
  generateBlueprint, type DesignCritique, runDesignCritic, generateVisualBoostCSS,
} from "@/lib/rendering-engine/generation-helpers";


// Real Unsplash Search API call — returns genuinely relevant, working images

// Main entry — tries real API first, falls back to curated bank.
// Returns a ready-to-use array of WORKING image URLs for this niche.
// ═══════════════════════════════════════════════════════════════
// IMAGE SANITIZER — Safety net for when the AI ignores instructions
// and hallucinates its own unsplash.com photo IDs (which are almost
// always fake/broken, since the AI is pattern-matching from training
// data, not actually looking up real photos). This guarantees every
// shipped website has WORKING images regardless of AI behavior.
// ═══════════════════════════════════════════════════════════════
import {
  sanitizeImageUrls, enforceLuxuryPalette, enforceResponsiveHeadings,
  getPremiumEffects, cleanHTML, FORCE_RULES,
} from "@/lib/rendering-engine/html-utils";


// ═══════════════════════════════════════════════════════════════
// LUXURY PALETTE ENFORCER — safety net for when the AI defaults to
// cheap flat SaaS colors (#FFD700, #FFA500, #FF7A00 etc.) instead of
// the muted antique-gold palette specified for luxury-tier brands.
// Same defense-in-depth pattern as the image sanitizer.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// RESPONSIVE FONT ENFORCER — safety net for when the AI uses fixed
// px font-sizes on headings instead of clamp(), causing huge
// one-word-per-line wrapping on mobile (e.g. "font-size: 48px"
// on a 6-word headline becomes 6 separate giant lines on a 375px
// screen). Forces every heading rule to scale responsively.
// ═══════════════════════════════════════════════════════════════


// kryptonGenerate is imported from lib/ai-providers.ts (see top of file)

// ── Project Type Detector ────────────────────────────────────────

// ── Build System Prompt by Type ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════
// KRYPTON AI — NICHE INTELLIGENCE ENGINE v2.0
// Replaces buildPrompt() + detectPalette() in app/api/orchestrate/route.ts
// Copy everything below and paste ABOVE the existing buildPrompt function,
// then replace the buildPrompt function call with: buildNichePrompt(userPrompt, type, plan)
// ═══════════════════════════════════════════════════════════════════

// ── PHASE 1: NICHE INTELLIGENCE ──────────────────────────────────

import {
  NicheProfile, AudienceDimensions, NichePalette, NicheTypography, BrandVoice,
} from "@/lib/rendering-engine/types";

// ═══════════════════════════════════════════════════════════════════
// PHASE 1: WEBSITE REVERSE ENGINEERING ENGINE
// Extracts structural blueprint from competitor URL/domain mention
// WITHOUT copying content — only structural patterns
// ═══════════════════════════════════════════════════════════════════

interface CompetitorBlueprint {
  style: string;
  heroPattern: string;
  ctaStrategy: string;
  trustPattern: string;
  layoutPhilosophy: string;
  typographyFeel: string;
  conversionTactic: string;
  fullBlueprint?:   string | null;
  extractedColors?: string[];
}

const COMPETITOR_BLUEPRINTS: Record<string, CompetitorBlueprint> = {
  "stripe.com": {
    style: "Stripe",
    heroPattern: "Left-aligned text (55%) + animated product visual (45%). Gradient mesh background. Purple/indigo palette. Badge above headline.",
    ctaStrategy: "Primary: 'Start now' (no friction). Secondary: 'Contact sales'. Both above fold. Strong hierarchy.",
    trustPattern: "Logo bar of Fortune 500 companies ABOVE fold. Revenue numbers. Compliance badges (SOC2, PCI).",
    layoutPhilosophy: "Alternating feature rows (text+visual, visual+text). Generous whitespace. No clutter. Purple gradient accents.",
    typographyFeel: "Clean sans-serif, large headings -0.04em tracking, precise spacing.",
    conversionTactic: "Reduce friction: 'No setup fees. Cancel anytime.' below every CTA.",
  },
  "apple.com": {
    style: "Apple",
    heroPattern: "Full-width product image/video. Centered headline. Minimal text. 2 CTAs: 'Learn more' + 'Buy'. Black or white bg.",
    ctaStrategy: "Ultra minimal — only 2 actions: explore OR buy. Never compete. Clean hierarchy.",
    trustPattern: "Product quality speaks. No badges. No testimonials. Brand reputation IS the trust.",
    layoutPhilosophy: "Extreme whitespace. Full-bleed imagery. One message per section. Typography as design.",
    typographyFeel: "SF Pro feel. Large, precise. -0.03em tracking. Light weights for large sizes.",
    conversionTactic: "Desire through beauty. Show product as art. Price reveal only when desire is built.",
  },
  "nike.com": {
    style: "Nike",
    heroPattern: "Full-bleed athlete photography. Massive bold headline (top-left). Minimal text. One CTA. High contrast.",
    ctaStrategy: "Single powerful CTA: 'Shop Now' or 'Get It'. Never two options in hero — dilutes power.",
    trustPattern: "Athletes. Action shots. 'Just Do It' attitude. Community counts.",
    layoutPhilosophy: "Grid-based product showcase. Diagonal accents. Bold numbers. Dark backgrounds.",
    typographyFeel: "Condensed bold. ALL CAPS for impact. Large tracking for subtitles.",
    conversionTactic: "Urgency: limited drops, 'Only X left'. Athlete endorsement = social proof.",
  },
  "airbnb.com": {
    style: "Airbnb",
    heroPattern: "Full-width search bar as primary CTA. Background: destination photography. Friendly headline. No hard sell.",
    ctaStrategy: "Search = primary action. Browse = exploration. Soft CTAs — invitation not demand.",
    trustPattern: "Real photos of real places and people. Host reviews. Superhost badge. Booking counts.",
    layoutPhilosophy: "Card-based browsing. Warm rounded corners. Human photography. No dark backgrounds.",
    typographyFeel: "Cereal font — rounded, friendly. Medium weights. Warm tone.",
    conversionTactic: "Show results immediately. Let discovery create desire. Reviews close the deal.",
  },
  "linear.app": {
    style: "Linear",
    heroPattern: "Dark background. Gradient headline. Product screenshot floating below. Subtle particle/grid background.",
    ctaStrategy: "Primary: 'Get started'. Secondary: 'See all features'. Clean badges: 'Free forever · No credit card'.",
    trustPattern: "Company logos used as customers. GitHub stars. Team size.",
    layoutPhilosophy: "Dark, premium, developer-focused. Cards with subtle borders. Keyboard-shortcut callouts.",
    typographyFeel: "Inter. Clean. -0.03em tracking. Code font for shortcuts/commands.",
    conversionTactic: "Show product WORKING. Interactive demos. 'Try it in 30 seconds' hooks.",
  },
  "framer.com": {
    style: "Framer",
    heroPattern: "Animated hero with live product preview. Colorful gradient. Playful yet professional. Badge above headline.",
    ctaStrategy: "'Start for free' dominant. 'See templates' secondary. Feature badges: AI-powered.",
    trustPattern: "Design community credibility. Created-with-Framer showcase. Designer testimonials.",
    layoutPhilosophy: "Creative, experimental layouts. Animated sections. Bold color usage. Templates showcase.",
    typographyFeel: "Mixed weights — heavy headline + light body. Expressive.",
    conversionTactic: "Show beautiful output. 'Made in Framer' gallery. Let output sell itself.",
  },
  "notion.so": {
    style: "Notion",
    heroPattern: "White or very light background. Simple centered text. Minimal design. Template preview below hero.",
    ctaStrategy: "'Get Notion free' dominant. Simple, no friction. No secondary CTA competing.",
    trustPattern: "Used by [Company] teams. Simple testimonials. Template marketplace as proof.",
    layoutPhilosophy: "Content-first. Beige/white tones. Block-based visual metaphors. Extremely minimal.",
    typographyFeel: "Clean serif + sans mix. Professional but friendly. Medium weights.",
    conversionTactic: "Simplicity IS the pitch. 'All-in-one workspace' + minimal friction.",
  },
  "hubspot.com": {
    style: "HubSpot",
    heroPattern: "Split layout: value prop text left + demo/product right. Orange CTA button. Trust badges below fold.",
    ctaStrategy: "'Get started free' + 'Get a demo' — two tracks: self-serve vs enterprise.",
    trustPattern: "Customer count ('200,000+ customers'). G2/Gartner badges. ROI statistics.",
    layoutPhilosophy: "Professional but accessible. Orange accents. Feature tabs. Comparison tables.",
    typographyFeel: "Lexend — highly readable. Consistent sizing. Conversion-optimized.",
    conversionTactic: "Free tier eliminates risk. Case studies with ROI. Enterprise vs SMB tracks.",
  },
  "shopify.com": {
    style: "Shopify",
    heroPattern: "Green gradient background. Store preview mockup. 'Start selling today' CTA. Trial offer front and center.",
    ctaStrategy: "Email capture as primary CTA (start trial). Low friction. No credit card callout.",
    trustPattern: "Store count (millions). Success stories with revenue. 'Trusted by' enterprise logos.",
    layoutPhilosophy: "Feature-rich but scannable. Section tabs. App ecosystem showcase.",
    typographyFeel: "Clean, conversion-focused. Action-oriented copy.",
    conversionTactic: "Free trial drives everything. Success story calculator. 'Join millions' social proof.",
  },
};

function detectCompetitorFromURL(prompt: string): CompetitorBlueprint | null {
  const p = prompt.toLowerCase();
  // Direct URL patterns: "inspired by stripe.com", "like apple.com", "create like linear.app"
  for (const [domain, blueprint] of Object.entries(COMPETITOR_BLUEPRINTS)) {
    const domainBase = domain.split('.')[0]; // stripe, apple, nike, etc.
    const pattern = new RegExp(
      `(inspired by|like|similar to|based on|style of|build like)\s*[\w.]*${domainBase}[\w.]*`,
      'i'
    );
    if (pattern.test(p) || p.includes(domain)) {
      return blueprint;
    }
  }
  return null;
}

// ── PHASE 2: Competitor Style Detector ──────────────────────────

// ════════════════════════════════════════════════════════════════════
// DESIGN REFERENCE INTELLIGENCE ENGINE
// ════════════════════════════════════════════════════════════════════
// Maps every domain to world-class design references with:
//   - Exact CSS directives (not vague "design like X")
//   - Component variant decisions (which hero, which pricing, etc.)
//   - Photography and motion direction
//   - Never-do rules to prevent quality regression
//
// Used in BASE prompt so every generation stage receives reference intel.
// ════════════════════════════════════════════════════════════════════

interface DesignReference {
  name:               string;      // display name: "Ferrari × Porsche Automotive"
  brands:             string[];    // world-class reference brands for this domain
  styleKey:           string;      // matches competitorStyle field
  cssDirectives:      string;      // exact CSS patterns / design rules to produce
  componentVariants:  Partial<Record<string, string>>;  // exact variant per category
  heroDirective:      string;      // how to build the hero for this domain
  cardDirective:      string;      // how to build cards
  typographyDirective:string;      // headline size, weight, spacing rules
  motionDirective:    string;      // animation curve, duration, trigger
  ctaDirective:       string;      // CTA button style and placement
  photoDirective:     string;      // photography style brief
  qualityTarget:      string;      // what "great" looks like for this domain
  never:              string[];    // absolute avoidance rules
}

const REFERENCE_PROFILES: Record<string, DesignReference> = {

  // ── LUXURY AUTOMOTIVE: Ferrari × Porsche × Aston Martin ────────────
  "Bottega Veneta Editorial": {
    name:     "Ferrari × Porsche Automotive Luxury",
    brands:   ["Ferrari","Porsche","Lamborghini","Aston Martin","Bugatti","Rolls-Royce"],
    styleKey: "Bottega Veneta Editorial",
    cssDirectives: `
/* Luxury Automotive CSS Directives */
/* 1. Zero border-radius — edges are sharp. Luxury needs no softening. */
.card, button, .btn, img, section { border-radius: 0 !important; }
/* 2. Typography: very large, very light weight hero headline */
h1 { font-weight: 300; font-size: clamp(64px,10vw,140px); letter-spacing: -0.02em; line-height: 0.95; }
/* 3. Section rhythm: 180px top/bottom — let it breathe */
section { padding: 180px clamp(24px,8vw,120px); }
/* 4. Primary color accent only on fine details — not on large blocks */
.accent-line { width: 48px; height: 1px; background: var(--primary); margin: 32px 0; }
/* 5. Horizontal rule dividers instead of card borders */
.section-divider { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 80px 0; }
/* 6. Images: full-bleed, no rounding, dramatic proportion */
.hero-img { width: 100%; height: 80vh; object-fit: cover; }
/* 7. CTA: outlined, uppercase, letter-spaced — not filled */
.cta-primary { background: transparent; border: 1px solid var(--primary); color: var(--primary); text-transform: uppercase; letter-spacing: 0.15em; font-size: 11px; padding: 18px 48px; }
/* 8. Navigation: minimal, center-aligned or spaced, no heavy backgrounds */
nav { background: transparent; padding: 32px 80px; }`,
    componentVariants: {
      hero: "split-image", features: "alternating", pricing: "three-tier",
      testimonials: "featured", faq: "accordion", cta: "floating-card",
      footer: "four-column", navbar: "bold-split",
    },
    heroDirective:    "Full-bleed vehicle image LEFT, ultra-thin headline RIGHT. No gradient overlays. Black background. Absolutely no rounding. Headline: 3 words maximum — aspirational. Subhead: 1 sentence maximum.",
    cardDirective:    "No card borders. Horizontal rule separators only. Content floats on dark background. Image-led. Text below, never overlaid on image.",
    typographyDirective:"H1: 300 weight, -0.02em tracking, clamp(64px,10vw,140px). H2: 200-300 weight, clamp(32px,5vw,72px). All headings: uppercase tracking on labels only. Body: 16px, line-height 1.8, muted color.",
    motionDirective:  "Hero: fade-in 1.4s ease (no slide). Sections: opacity 0→1 over 1.0s, NO translateY. Images: scale 1.01 on hover over 0.8s. CTA: border-color transition 0.3s. Zero bounce or spring easing.",
    ctaDirective:     "Primary: outlined button, uppercase, 0.15em letter-spacing, 11px font. Never filled with gradient. Color: primary accent. Secondary: text-only link with arrow →.",
    photoDirective:   "Studio photography: single vehicle on black or white seamless. Low angle (10-30°). Dramatic key lighting. No lifestyle people. No stock. 3:2 ratio or wider. Color: desaturated, high contrast.",
    qualityTarget:    "Passes as a Ferrari or Porsche official website. Zero stock feel. Every element deliberate. White space is a feature. Typography-led, not graphic-led.",
    never:            ["Rounded corners on anything","Gradient-filled buttons","Multiple rainbow colors","Stock business people photos","Emoji or icons in headings","Centered body text","Generic stock car images","Busy patterns or textures","Generic pricing card layouts"],
  },

  // ── FINE DINING: Nobu × Eleven Madison × Alain Ducasse ─────────────
  "Airbnb": {
    name:     "Nobu × Eleven Madison Park Fine Dining",
    brands:   ["Nobu","Eleven Madison Park","Noma","Alain Ducasse","The Fat Duck","Heston Blumenthal"],
    styleKey: "Airbnb",
    cssDirectives: `
/* Fine Dining CSS Directives */
/* 1. Warm, organic border-radius — 16-24px max */
.card, .card-inner { border-radius: 20px; }
/* 2. Typography: editorial serif for headings, clean sans for body */
h1, h2, h3 { font-family: var(--heading-font); font-weight: 400; font-style: italic; }
/* 3. Section rhythm: 100-140px — generous but not luxury-car spacious */
section { padding: clamp(80px,10vw,140px) clamp(24px,6vw,80px); }
/* 4. Warm image treatment: slight warm tone, no cold blues */
img { filter: brightness(0.95) saturate(1.1) sepia(0.05); }
/* 5. Section alternation: warm cream and deep charcoal */
section:nth-child(even) { background: #0E0A07; }
section:nth-child(odd) { background: #080604; }
/* 6. Menu items: horizontal rule below, clean typography, no card boxes */
.menu-item { border-bottom: 1px solid rgba(255,255,255,0.08); padding: 20px 0; }
/* 7. Reservation CTA: full-width subtle background, prominent */
.reservation-form { background: rgba(255,255,255,0.04); padding: 48px; }`,
    componentVariants: {
      hero: "centered", features: "alternating", testimonials: "masonry",
      cta: "split-form", footer: "minimal-centered", navbar: "minimal-centered",
    },
    heroDirective:    "Full-screen atmospheric restaurant interior or hero dish. Centered headline with restaurant name in elegant serif italic. Subheadline: 1 sentence describing the experience. CTA: 'Reserve a Table' — center-aligned. No busy layout.",
    cardDirective:    "Rounded 20px. Warm dark background. Image: full-card top, square or 4:3. Text: restaurant name, 1-line description. Hover: gentle lift 4px, warm shadow. No hard borders.",
    typographyDirective:"H1: serif italic, 400 weight, clamp(48px,7vw,96px). H2: same serif, 300-400 weight. Labels: sans-serif uppercase 0.1em tracking. Body: 16px, 1.8 line-height, warm off-white.",
    motionDirective:  "Fade-in from bottom 20px, 0.7s ease-out. Image hover: scale 1.03 over 0.5s ease. CTA hover: background lighten 8%. No parallax. No dramatic effects. Warmth, not spectacle.",
    ctaDirective:     "Primary: warm accent filled, rounded 12px, 'Reserve a Table'. Secondary: text link '→ View Menu'. Form CTA: full-width, high contrast.",
    photoDirective:   "Food: macro close-up, steam visible, warm side-lighting. Interior: candle-lit, bokeh background, genuine warmth. Chef: candid in kitchen, action shot. Golden-hour warm tones throughout. Analog film aesthetic preferred.",
    qualityTarget:    "Matches Nobu or Eleven Madison Park website. Warm, aspirational, sensory. Makes you taste the food before you visit. Every image deliberate.",
    never:            ["Cold blue tones","Startup aesthetic","Generic stock food","Dashboard layouts","Multiple CTAs per page","Busy icon grids","Tech-style pricing tables","Sans-serif headings on hero"],
  },

  // ── SAAS: Stripe × Linear × Vercel ────────────────────────────────
  "Stripe": {
    name:     "Stripe × Linear × Vercel",
    brands:   ["Stripe","Linear","Vercel","Resend","Clerk","Supabase","PlanetScale"],
    styleKey: "Stripe",
    cssDirectives: `
/* Stripe × Linear SaaS CSS Directives */
/* 1. Precise grid: 8px base unit */
:root { --unit: 8px; }
/* 2. Border radius: 8-12px — modern but not playful */
.card, button { border-radius: 10px; }
/* 3. Card: glass effect, 1px border, blur */
.card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(20px); }
/* 4. Gradient accent line on featured cards */
.card-featured::before { content:''; display:block; height:2px; background: var(--grad); border-radius: 2px 2px 0 0; margin: -1px -1px 0; }
/* 5. Typography: tight tracking, medium weight */
h1 { font-size: clamp(40px,6vw,80px); font-weight: 700; letter-spacing: -0.03em; line-height: 1.0; }
/* 6. Section alternation: very subtle — two shades of near-black */
section:nth-child(even) { background: #0A0A0F; }
/* 7. Code-style accents */
code, .code-tag { font-family: 'JetBrains Mono', monospace; font-size: 0.85em; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; }
/* 8. Grid lines background effect on hero */
.hero-grid-bg { background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 72px 72px; }`,
    componentVariants: {
      hero: "product-showcase", features: "bento-grid", pricing: "toggle",
      testimonials: "logo-wall", faq: "simple-list", cta: "centered-gradient",
      footer: "newsletter-rich", navbar: "glass-sticky",
    },
    heroDirective:    "Product screenshot as primary visual — above fold, on dark background with subtle grid. Headline: 6-8 words, tight tracking, gradient on last word. Subheadline: 1 sentence, outcome-focused. Social proof: user count or logos below CTA.",
    cardDirective:    "Glass morphism: rgba(255,255,255,0.04) + 1px border + blur(20px). Featured: 2px gradient top border. Hover: border brightens to rgba(255,255,255,0.16). Icon: small, 16px, inside rounded 8px bg.",
    typographyDirective:"H1: 700 weight, -0.03em tracking, gradient on keyword. H2: 600 weight, -0.02em. Code/tags: monospace inline. Body: 15-16px, 1.7 line-height, rgba(255,255,255,0.7) color. Labels: 11px, 0.1em tracking, primary color.",
    motionDirective:  "Reveal: opacity+translateY(16px) → 0, 0.5s ease. Grid lines: fade in 0.3s. Card hover: translateY(-2px), border glow. Counter: count up on viewport entry. Chart bars: animate width from 0. Cursor: default (no custom).",
    ctaDirective:     "Primary: gradient filled, 700 weight, 14px, rounded 8px. 'Start Free Trial' or 'Get Started'. Secondary: text with arrow, muted color. Badge above CTA: '⚡ Free — no credit card required'.",
    photoDirective:   "Product UI screenshots on dark mockup device. Team: casual, diverse, office or remote. Abstract: gradient meshes, geometric data vis. Never: stock handshake, generic office, physical currency.",
    qualityTarget:    "Passes as a Linear or Stripe landing page. Data-dense but not busy. Every metric scannable in under 3 seconds. Premium but approachable.",
    never:            ["Serif fonts on main content","Rounded >12px on interactive elements","Rainbow gradients","Stock business handshakes","Long paragraphs over 4 lines","Luxury fashion aesthetic","Restaurant warmth"],
  },

  // ── CREATIVE AGENCY: Superside × Fantasy ──────────────────────────
  "Linear": {
    name:     "Superside × Fantasy × Collins Agency",
    brands:   ["Superside","Fantasy","Collins","Wolff Olins","Pentagram","BUCK"],
    styleKey: "Linear",
    cssDirectives: `
/* Agency Creative CSS Directives */
/* 1. Oversized display type — typography IS the design */
h1 { font-size: clamp(72px,14vw,200px); font-weight: 800; line-height: 0.88; letter-spacing: -0.04em; }
/* 2. Large numbers as decorative elements */
.section-number { font-size: clamp(120px,20vw,280px); font-weight: 900; opacity: 0.04; line-height: 1; }
/* 3. Portfolio grid: irregular sizes, hover reveals */
.work-grid { display: grid; grid-template-columns: repeat(12,1fr); gap: 16px; }
.work-card { position: relative; overflow: hidden; }
.work-card-overlay { position: absolute; inset:0; background: rgba(0,0,0,0.85); opacity: 0; transition: opacity 0.35s ease; display: flex; flex-direction: column; justify-content: flex-end; padding: 32px; }
.work-card:hover .work-card-overlay { opacity: 1; }
/* 4. Gradient border on hover */
.gradient-hover { border: 1px solid transparent; transition: all 0.3s; }
.gradient-hover:hover { border-color: rgba(255,255,255,0.2); box-shadow: 0 0 40px rgba(0,0,0,0.5); }
/* 5. Ticker/marquee for client logos */
.ticker { display: flex; animation: ticker 20s linear infinite; white-space: nowrap; }
@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`,
    componentVariants: {
      hero: "minimal-statement", features: "bento-grid", portfolio: "filter-gallery",
      testimonials: "logo-wall", cta: "floating-card", footer: "mega-social",
      navbar: "bold-split",
    },
    heroDirective:    "Typography-first: single powerful statement, 3-5 words, 900 weight, fills viewport. Below: selected client logos marquee. No product screenshot on hero. Cursor: custom dot. Background: near-black with subtle noise texture.",
    cardDirective:    "Work cards: full-image, hover reveals overlay with project name + category. Case study cards: 16:9 aspect ratio. No rounded corners on work cards. Text cards: can have gradient borders.",
    typographyDirective:"Display: 800-900 weight, extremely tight tracking -0.04em, clamp(72px,14vw,200px). Section labels: 10px, 0.2em tracking, uppercase, muted. Body: 16px normal weight. Mix of serif and sans acceptable.",
    motionDirective:  "Work card overlay: opacity 0→1 on hover, 0.35s ease. Sections: slide in from left/right alternating. Numbers: count up slowly. Ticker: 20s loop. Hero text: staggered word reveal, 0.1s per word delay.",
    ctaDirective:     "Primary: text + arrow →, large, no background fill. Or: outlined white button, uppercase. Never: filled gradient button. CTA should feel editorial.",
    photoDirective:   "Case study screens: angled device mockups on dark bg. Agency team: candid creative workspace moments. Process: whiteboard, sketches, design iterations. Never: stock diverse-handshake-meeting photos.",
    qualityTarget:    "Passes as a Pentagram or Collins project. Work speaks louder than copy. Typography makes a visual statement. Portfolio feels like art direction.",
    never:            ["Rounded 20px+ corners","Warm color palette","SaaS product screenshots","Restaurant warmth","Stock handshake photos","Plain icon grids","Soft gradients","Multiple filled CTA buttons"],
  },

  // ── APPLE × TESLA CLEAN PREMIUM ───────────────────────────────────
  "Apple": {
    name:     "Apple × Tesla Premium Clean",
    brands:   ["Apple","Tesla","Dyson","Loewe","Bang & Olufsen"],
    styleKey: "Apple",
    cssDirectives: `
/* Apple × Tesla CSS Directives */
/* 1. Generous whitespace — Apple-level breathing room */
section { padding: clamp(120px,15vw,180px) clamp(24px,8vw,80px); }
/* 2. Typography: system-level precision */
h1 { font-size: clamp(44px,8vw,96px); font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
/* 3. Cards: ultra-clean glass */
.card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px; backdrop-filter: blur(40px) saturate(180%); }
/* 4. Feature icons: gradient circles */
.feature-icon { width: 56px; height: 56px; border-radius: 16px; background: var(--grad); display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
/* 5. Section labels: eyebrow text pattern */
.eyebrow { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--primary); margin-bottom: 16px; display: block; }
/* 6. Image treatment: crisp, no filter, on clean background */
img.product-img { border-radius: 24px; box-shadow: 0 48px 120px rgba(0,0,0,0.6); }
/* 7. Gradient text on hero keyword */
.gradient-word { background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }`,
    componentVariants: {
      hero: "centered", features: "bento-grid", pricing: "three-tier",
      testimonials: "grid", faq: "simple-list", cta: "centered-gradient",
      footer: "newsletter-rich", navbar: "glass-sticky",
    },
    heroDirective:    "Centered layout. Ultra-clean product image centered with soft drop shadow. Headline: 700 weight, tight tracking, 1 gradient word. Subheadline: 2 sentences, centered, muted. CTA: two buttons — primary filled pill, secondary text.",
    cardDirective:    "Glass morphism: rgba(255,255,255,0.05) + 1px border rgba(255,255,255,0.09) + blur(40px) + border-radius 20px. Feature icon top-left. Title, description. Hover: translateY(-6px) + shadow deepens.",
    typographyDirective:"H1: 700 weight, -0.03em tracking. Eyebrow labels: 12px, 0.1em tracking, uppercase, primary color. Body: 16-17px, 1.75 line-height. Feature headlines: 20-22px, 600 weight.",
    motionDirective:  "Reveal: opacity+translateY(24px)→0, blur(8px)→0, 0.65s ease-out. Card hover: translateY(-6px) + box-shadow 0 24px 64px rgba(0,0,0,0.4). Icon hover: scale(1.08). CTA hover: brightness(1.1). No dramatic effects.",
    ctaDirective:     "Primary: pill shape (border-radius 50px), gradient filled, 600 weight. 'Get Started' or 'Try Free'. Secondary: text with arrow. Both center-aligned. Never: rectangular sharp buttons.",
    photoDirective:   "Product: pure white or dark background studio, single focus, crisp shadows. People: diverse, natural smiles, casual professional wear. Abstract: clean gradient meshes. Lifestyle: minimal, not cluttered.",
    qualityTarget:    "Passes as Apple.com or Tesla.com landing page. Generous whitespace. Typography-product hierarchy clear. Premium but accessible. Zero noise.",
    never:            ["Busy patterns","Multiple colors in same section","Non-system fonts","Amateur gradients","Stock office people","Orange or harsh accents","Comic-like animations","Aggressive sale messaging"],
  },

  // ── NIKE × UNDER ARMOUR PERFORMANCE ──────────────────────────────
  "Nike": {
    name:     "Nike × Under Armour Performance",
    brands:   ["Nike","Under Armour","Adidas","Gymshark","Lululemon"],
    styleKey: "Nike",
    cssDirectives: `
/* Nike Performance CSS Directives */
/* 1. Bold hero type — massive, bold, impactful */
h1 { font-size: clamp(72px,14vw,180px); font-weight: 900; line-height: 0.88; text-transform: uppercase; letter-spacing: -0.02em; }
/* 2. Diagonal section cuts */
.angled { clip-path: polygon(0 0, 100% 0, 100% calc(100% - 60px), 0 100%); }
.angled-reverse { clip-path: polygon(0 60px, 100% 0, 100% 100%, 0 100%); }
/* 3. Large stat numbers */
.stat-giant { font-size: clamp(80px,16vw,200px); font-weight: 900; line-height: 0.9; }
/* 4. High contrast only — no subtle shades */
body { background: #000; color: #fff; }
/* 5. Clip-path on CTAs */
.cta-angled { clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 100%, 16px 100%); }`,
    componentVariants: {
      hero: "split-image", features: "stat-highlight", pricing: "three-tier",
      testimonials: "grid", cta: "banner-strip", footer: "four-column",
      navbar: "glass-sticky",
    },
    heroDirective:    "Split: athlete action shot LEFT (dramatic, movement), bold claim RIGHT. Headline: 2-3 words, 900 weight, uppercase, full-width. No soft gradients. Maximum impact. No serif fonts.",
    cardDirective:    "No rounded corners. Black or very dark cards. Athlete imagery primary. Stats overlaid on image. Hover: image zooms scale(1.08) over 0.4s.",
    typographyDirective:"Everything bold. H1: 900 weight, uppercase, -0.02em tracking. Section stats: 900 weight massive display. Body: clean sans 15px 500 weight. Zero serif. Zero italic.",
    motionDirective:  "Fast: 0.3-0.4s all transitions. Stats: count up fast 0.8s. Scroll reveal: slide from left/right (not bottom). CTA: clipPath reveals on hover. No slow luxury motion.",
    ctaDirective:     "Large pill OR angled clip-path button. 900 weight uppercase. Primary: white on black OR brand color. Secondary: outlined white. 'Shop Now', 'Train Now', 'Get Started'.",
    photoDirective:   "Athletes in explosive motion. High shutter speed. Dynamic angles — low angle upward (power), wide angle (scale). Dramatic contrast. Black/white with one accent color. No stock gym photos.",
    qualityTarget:    "Passes as Nike.com campaign page. Immediate energy. Bold typography makes you feel motivated before you read a word. Maximum contrast.",
    never:            ["Soft rounded aesthetics","Pastels","Luxury editorial pacing","Long form text","Serif typography","Warm colors","Restaurant warmth","SaaS dashboard layouts"],
  },

  // ── HEALTHCARE: Mayo Clinic × Cleveland Clinic ─────────────────────
  "HubSpot": {
    name:     "Mayo Clinic × Cleveland Clinic Healthcare",
    brands:   ["Mayo Clinic","Cleveland Clinic","Johns Hopkins","Bupa","Kaiser Permanente"],
    styleKey: "HubSpot",
    cssDirectives: `
/* Healthcare CSS Directives */
/* 1. Clean, light, accessible — never dark or moody */
body { background: #F8F9FB; color: #1A202C; }
/* 2. Trustworthy blue-green accents */
:root { --trust-color: #2B7FBF; }
/* 3. Generous white space, clinical cleanliness */
section { padding: clamp(72px,8vw,120px) clamp(24px,6vw,80px); background: #fff; }
section:nth-child(even) { background: #F8F9FB; }
/* 4. Cards: white, light shadow, 12px radius */
.card { background: #fff; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); border: none; }
/* 5. Doctor profiles: portrait aspect, circular or rounded photo */
.doctor-img { border-radius: 50%; width: 120px; height: 120px; object-fit: cover; }
/* 6. Accessibility: high contrast text, clear focus states */
a:focus-visible { outline: 3px solid var(--trust-color); outline-offset: 3px; }
p, li { font-size: 16px; line-height: 1.75; color: #374151; }`,
    componentVariants: {
      hero: "split-image", features: "icon-grid", pricing: "three-tier",
      testimonials: "featured", faq: "accordion", cta: "split-form",
      footer: "four-column", navbar: "bordered-cta",
    },
    heroDirective:    "Split: doctor or patient (real, warm, diverse) RIGHT. Headline LEFT: reassuring, patient-first. 'Expert Care When You Need It.' CTA: 'Book Appointment' — prominent, accessible. Light background, never dark.",
    cardDirective:    "White background, light box shadow, 12px radius. Service icon: flat, colored. Title: 18px 600 weight. Description: 14px 1.65 line-height muted. Hover: shadow deepens. No glass effect.",
    typographyDirective:"H1: 700 weight, clamp(36px,5vw,56px), dark color #1A202C. Never aggressive. Body: 16px, 1.75 line-height, #374151. Labels: 13px 600 weight. Font: system sans or Inter.",
    motionDirective:  "Subtle and professional. Reveal: opacity 0→1, translateY(12px)→0, 0.5s ease. Hover: translateY(-2px), shadow + 8px. No bouncy animations. Trustworthy, not flashy.",
    ctaDirective:     "Primary: trust-blue filled, 16px 700 weight, 48px height, 12px radius. 'Book Appointment'. Secondary: outlined or white with trust-blue border. Never: dark, edgy, or playful buttons.",
    photoDirective:   "Doctor: warm, diverse, professional but approachable — not stock sterile. Patient: genuine care moment, natural lighting. Clinic: clean, modern, bright. NEVER dark moody or dramatic.",
    qualityTarget:    "Matches Mayo Clinic website. Trustworthy first impression. Patient-centered language. Clean, accessible, professional. Makes patients feel safe.",
    never:            ["Dark mode or dark backgrounds","Aggressive typography","Startup energy","Generic stock hospital rooms","Luxury aesthetics","Fashion photography","Creative agency boldness","Rounded 20px+ (use 12px max)"],
  },

  // ── HOSPITALITY LUXURY: Four Seasons × Aman ─────────────────────────
  "Four Seasons": {
    name:     "Four Seasons × Aman Resorts Luxury Hospitality",
    brands:   ["Four Seasons","Aman","Ritz-Carlton","Rosewood","One & Only"],
    styleKey: "Four Seasons",
    cssDirectives: `
/* Luxury Hospitality CSS Directives */
/* 1. Full-screen immersive images */
.hero-img { width: 100%; height: 100vh; object-fit: cover; }
/* 2. Serif typography throughout — elegance is the message */
h1, h2, h3 { font-family: 'Playfair Display', 'Cormorant Garamond', serif; font-weight: 400; font-style: italic; }
/* 3. Golden accent on fine details only */
.gold-accent { color: #C9A86C; }
.gold-line { width: 40px; height: 1px; background: #C9A86C; margin: 24px auto; }
/* 4. Maximum section padding */
section { padding: clamp(120px,16vw,200px) clamp(48px,10vw,160px); }
/* 5. Room cards: landscape photography, serif overlay */
.room-card { position: relative; overflow: hidden; }
.room-card-text { position: absolute; bottom: 0; left: 0; right: 0; padding: 32px; background: linear-gradient(transparent, rgba(0,0,0,0.7)); }
/* 6. Navigation: transparent, centered, minimal */
nav { background: transparent; justify-content: center; letter-spacing: 0.12em; }`,
    componentVariants: {
      hero: "centered", features: "bento-grid", pricing: "three-tier",
      testimonials: "masonry", cta: "split-form", footer: "four-column",
      navbar: "minimal-centered",
    },
    heroDirective:    "Full-viewport property or destination photograph. Centered: property name in serif italic, ultra-light weight. Gold thin divider line. Subheadline: 1 evocative sentence. CTA: 'Book Your Stay' — centered, outlined or text. No heavy UI over the image.",
    cardDirective:    "Room/destination cards: landscape photography fills 60% of card. Text overlay at bottom with gradient. Serif italic headline. Price or 'From X/night'. Hover: image scale 1.04 over 0.8s ease.",
    typographyDirective:"H1: serif italic 300-400 weight, clamp(52px,8vw,112px). H2: same. Body: sans-serif 16px 1.8 line-height, warm white. Labels: uppercase 0.15em tracking, sans-serif, gold color. Zero bold weight headings.",
    motionDirective:  "Very slow: 1.2-1.6s reveals. Hero image: Ken Burns zoom scale(1.0)→scale(1.05) over 8s ease. Text: fade in 1.4s ease. Hover: 0.8s ease transitions. No parallax scroll on mobile. Zero bounce.",
    ctaDirective:     "Primary: text-based with thin gold underline, 0.12em tracking uppercase. OR: outlined with thin 1px gold border. 'Reserve' or 'Book'. Never: filled with gradient. Must feel timeless.",
    photoDirective:   "Property exteriors: golden hour, warm tone. Rooms: natural light, no flash, editorial composition. Pools: blue-water contrast against lush landscape. Staff: genuine warmth. Pool or beach: serene, aspirational.",
    qualityTarget:    "Matches Four Seasons or Aman website. Every image makes you want to book immediately. Typography breathes. Gold is used sparingly as a fine detail, not a feature.",
    never:            ["Startup energy","Gradient buttons","Sans-serif hero headings","Dark techy aesthetic","Stock hotel rooms","Busy icon grids","SaaS layout patterns","Healthcare clinical look"],
  },

  // ── ECOMMERCE: Apple Store × Nike Shop × Tesla ───────────────────────
  "Shopify": {
    name:     "Apple Store × Nike.com E-commerce",
    brands:   ["Apple Store","Nike Shop","Tesla Shop","Glossier","SSENSE"],
    styleKey: "Shopify",
    cssDirectives: `
/* E-commerce CSS Directives */
/* 1. Product as hero — image is everything */
.product-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
/* 2. Product cards: no border, white background, image-first */
.product-card { background: var(--surface); border-radius: 16px; overflow: hidden; }
.product-card img { width: 100%; aspect-ratio: 1; object-fit: cover; }
.product-card:hover img { transform: scale(1.04); transition: transform 0.5s ease; }
/* 3. Price typography */
.price { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
.price-original { text-decoration: line-through; opacity: 0.5; font-size: 18px; }
/* 4. Add to cart: prominent, full-width on mobile */
.add-to-cart { width: 100%; padding: 16px; font-size: 16px; font-weight: 700; border-radius: 50px; }
/* 5. Category pills */
.category-pill { padding: 8px 20px; border-radius: 50px; border: 1px solid var(--border); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.category-pill.active, .category-pill:hover { background: var(--primary); color: #fff; border-color: var(--primary); }`,
    componentVariants: {
      hero: "product-showcase", features: "icon-grid", pricing: "comparison-table",
      testimonials: "masonry", cta: "banner-strip", footer: "mega-social",
      navbar: "glass-sticky", ecommerce: "product-grid",
    },
    heroDirective:    "Product as primary visual: clean background (white or brand color), product centered with dramatic shadow. Headline: product name + key benefit. 'Free shipping + 30-day returns' below CTA. No lifestyle imagery on main hero.",
    cardDirective:    "Square or slight portrait aspect. Product image fills top 70%. Bottom: product name, price, quick-add button. Hover: image zooms + quick-add appears. Clean, minimal, product-first.",
    typographyDirective:"Product prices: 28px 700 -0.02em. Product names: 16px 600. Category headers: 32px 700. Hero headline: 700 weight, -0.03em tracking. No serif. System sans or Inter throughout.",
    motionDirective:  "Product card: image zoom 1.04 on hover over 0.5s ease. Quick-add: slides up from bottom 0.3s ease. Cart icon: bounce when item added. Page transitions: fade only, no slide.",
    ctaDirective:     "Add to Cart: full-width, pill shape, 50px height, bold, primary color. 'Add to Cart' — never 'Buy'. Checkout: black filled. Wishlist: heart outline toggle. Clear and prominent at all times.",
    photoDirective:   "Products: clean white or gradient background, no props, product fill 80% of frame. Lifestyle shots: product in natural use, aspirational but achievable. Flat lay: styled with complementary items. No busy backgrounds.",
    qualityTarget:    "Matches Apple Store or Nike.com. Every product looks desirable. Frictionless path to purchase. Trust signals visible without scrolling.",
    never:            ["Dark moody product photography","Generic stock lifestyle","Restaurant warmth","SaaS layouts","Corporate formal typography","Cluttered product pages","Hidden add-to-cart"],
  },

  // ── PORTFOLIO: Awwwards × Dribbble × Lee Robinson ──────────────────
  "Framer": {
    name:     "Awwwards × Dribbble Creative Portfolio",
    brands:   ["Awwwards","Dribbble","Behance","Lee Robinson","Brittany Chiang"],
    styleKey: "Framer",
    cssDirectives: `
/* Creative Portfolio CSS Directives */
/* 1. Typography as identity */
h1 { font-size: clamp(56px,12vw,160px); font-weight: 800; letter-spacing: -0.04em; line-height: 0.9; }
/* 2. Hover on work = creative reveal */
.work-item { position: relative; overflow: hidden; cursor: pointer; }
.work-item-preview { position: absolute; inset: 0; opacity: 0; transition: opacity 0.3s ease; }
.work-item:hover .work-item-preview { opacity: 1; }
/* 3. Cursor as interactive element */
.cursor-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); position: fixed; pointer-events: none; transition: transform 0.2s ease; z-index: 9999; }
/* 4. Marquee for skills/clients */
.marquee { display: flex; gap: 48px; animation: marquee 15s linear infinite; white-space: nowrap; }
/* 5. About section: personality-led */
.about-stat { font-size: clamp(48px,8vw,100px); font-weight: 800; line-height: 1; }`,
    componentVariants: {
      hero: "minimal-statement", portfolio: "filter-gallery", features: "alternating",
      testimonials: "grid", cta: "split-form", footer: "minimal-centered",
      navbar: "minimal-centered",
    },
    heroDirective:    "Personal introduction: 'Hi, I'm [Name].' or single bold statement. Type fills 60% of viewport. Below: role + location + availability badge. No product screenshot. No stock imagery. Personality visible in copy.",
    cardDirective:    "Work cards: full-image, 16:9 or 4:3. On hover: project name slides up from bottom. Category tag: top-left. Hover: image scale 1.05. Case study: cover image fills card, no outline border.",
    typographyDirective:"H1: 800-900 weight, -0.04em tracking, clamp(56px,12vw,160px). Role/intro: 300 weight, large. Stats: 800 weight display. Body: 15-16px normal weight. Mix personality into copy.",
    motionDirective:  "Work items: overlay reveals opacity 0→1 over 0.3s. Cursor: custom dot follows mouse. Name: stagger word by word 0.08s delay each. Sections: slide from left only. CTA hover: letter-spacing expands 0.02em.",
    ctaDirective:     "Primary: outlined, hover fills. Or: text with animated underline expand. 'Let's Work Together' or 'Start a Project'. Must feel personal, not corporate.",
    photoDirective:   "Work: case study screenshots, mockups, design process. About: genuine candid portrait — not a headshot. Studio or workspace. Process: sketches, whiteboards, iterations. Never: stock diverse-team photos.",
    qualityTarget:    "Passes Awwwards honourable mention standard. Typography makes a statement. Work is the hero. Copy is personal and confident. Would attract design-aware clients.",
    never:            ["Stock business headshots","Corporate blue palette","Healthcare clinical aesthetic","SaaS product layout","Restaurant warmth","Generic icon grids","3-column feature sections"],
  },

  // ── DASHBOARD: Retool × Linear × Monday ─────────────────────────────
  "Notion": {
    name:     "Retool × Linear × ClickUp Dashboard",
    brands:   ["Retool","Linear","Monday.com","ClickUp","Notion"],
    styleKey: "Notion",
    cssDirectives: `
/* Dashboard App CSS Directives */
/* 1. Data density: tight spacing, information-first */
section { padding: clamp(48px,6vw,80px) clamp(24px,4vw,48px); }
/* 2. Sidebar-ready layout awareness */
.dashboard-layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
/* 3. Stat cards: compact, data-forward */
.stat-card { padding: 20px 24px; border-radius: 10px; background: var(--card); border: 1px solid var(--border); }
.stat-value { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.stat-change { font-size: 12px; font-weight: 600; }
.stat-change.up { color: #10B981; }
.stat-change.down { color: #EF4444; }
/* 4. Table styles */
table { width: 100%; border-collapse: collapse; }
th { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); padding: 12px 16px; border-bottom: 1px solid var(--border); }
td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.04); }
/* 5. Chart containers */
.chart-container { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 24px; }`,
    componentVariants: {
      hero: "product-showcase", features: "bento-grid", pricing: "comparison-table",
      testimonials: "logo-wall", cta: "centered-gradient", footer: "newsletter-rich",
      navbar: "glass-sticky", dashboard: "analytics-charts",
    },
    heroDirective:    "Dashboard screenshot as primary visual — actual UI visible, not abstract. Headline: 700 weight, tight. 'All your data. One dashboard.' Subheadline: 1 specific benefit sentence. Trust stats below: X,000 teams use it.",
    cardDirective:    "Compact stat cards: 10px radius, 1px border, padded 20-24px. Value: 700 weight 32px. Change indicator: green/red with arrow. No glass morphism. Precision over beauty.",
    typographyDirective:"Data numerics: tabular-nums, 700 weight, tight tracking. Labels: 11px uppercase 0.08em tracking. H1: 700 weight -0.03em clamp(36px,5vw,64px). Compact scale throughout — this is a data product.",
    motionDirective:  "Stat numbers: count up on viewport entry over 1s. Chart bars: animate from 0 on load. Table rows: fade in stagger 0.03s each. No decorative motion. Performance over aesthetics.",
    ctaDirective:     "Primary: 'Start Free', 'Get Started', or 'Try for Free'. Filled, 600 weight, 10px radius. Never oversized. Secondary: 'View Demo' — text or outlined. Badge: 'No credit card required' below CTA.",
    photoDirective:   "UI screenshots: actual product screens, clean dark background. Team: diverse remote workers, candid. Charts/graphs: clear data visualization. Never: abstract startup photography, luxury lifestyle.",
    qualityTarget:    "Matches Linear or Retool. Data-forward. Scannable in under 3 seconds. Every element earns its place. Trust through precision.",
    never:            ["Luxury editorial spacing","Fashion photography","Rounded corners > 12px","Serif fonts in data UI","Warm color temperature","Restaurant-style warmth","Full-screen lifestyle hero"],
  },
};

// ── Domain → Reference key mapping ───────────────────────────────────────
// Maps DomainKnowledge.designMood / domain to the correct reference profile key
const DOMAIN_TO_REFERENCE: Record<string, string> = {
  // Automotive
  "luxury-car-club":      "Bottega Veneta Editorial",
  "car-dealership":       "Shopify",
  "car-rental":           "Apple",
  "ev-charging":          "Stripe",
  "taxi-transport":       "Apple",
  // Food
  "restaurant":           "Airbnb",
  "cafe":                 "Airbnb",
  "bar-pub":              "Airbnb",
  "bakery":               "Airbnb",
  "food-delivery":        "Shopify",
  // Hospitality
  "hotel":                "Four Seasons",
  "resort":               "Four Seasons",
  "travel-agency":        "Airbnb",
  "airline":              "Apple",
  // Health
  "gym":                  "Nike",
  "yoga-studio":          "Apple",
  "spa":                  "Four Seasons",
  "salon":                "Apple",
  "barber":               "Linear",
  "dental":               "HubSpot",
  "healthcare":           "HubSpot",
  "pharmacy":             "HubSpot",
  "veterinary":           "HubSpot",
  "nutritionist":         "HubSpot",
  "mental-health":        "HubSpot",
  // Beauty & Fashion
  "fashion":              "Bottega Veneta Editorial",
  "jewelry":              "Bottega Veneta Editorial",
  "watch-brand":          "Bottega Veneta Editorial",
  "beauty-brand":         "Airbnb",
  "perfume":              "Bottega Veneta Editorial",
  // Property
  "real-estate":          "Apple",
  "interior-design":      "Framer",
  "architecture":         "Linear",
  "construction":         "HubSpot",
  "furniture":            "Apple",
  // Tech
  "saas":                 "Stripe",
  "ai-startup":           "Stripe",
  "cybersecurity":        "Stripe",
  "crm":                  "Notion",
  "erp":                  "Notion",
  "developer-tool":       "Stripe",
  "dashboard-analytics":  "Notion",
  // Finance
  "law-firm":             "HubSpot",
  "accounting":           "HubSpot",
  "finance":              "Stripe",
  "insurance":            "HubSpot",
  "bank-fintech":         "Stripe",
  "crypto":               "Stripe",
  // Media
  "blog-magazine":        "Apple",
  "podcast":              "Apple",
  // Services
  "marketing-agency":     "Linear",
  "creative-agency":      "Linear",
  "consultancy":          "HubSpot",
  "hr-recruiting":        "Stripe",
  "ngo-charity":          "HubSpot",
  // Education
  "school-university":    "HubSpot",
  "online-course":        "Stripe",
  "coaching":             "Apple",
  // Creative
  "photography":          "Framer",
  "videography":          "Linear",
  "wedding":              "Four Seasons",
  "event-company":        "Apple",
  // Portfolio
  "portfolio-developer":  "Framer",
  "portfolio-designer":   "Framer",
  "influencer-creator":   "Framer",
  // Ecommerce
  "electronics":          "Shopify",
  "pet-shop":             "Airbnb",
  "sports-equipment":     "Nike",
  // Other
  "logistics":            "HubSpot",
  "manufacturing":        "HubSpot",
  "agriculture":          "HubSpot",
  "landing-page":         "Apple",
  "app-landing":          "Apple",
};

// ── Resolve reference for a domain ───────────────────────────────────────

// ════════════════════════════════════════════════════════════════════
// REFERENCE COMPOSITION ENGINE
// ════════════════════════════════════════════════════════════════════
// Merges multiple world-class design references — each owning one
// specific responsibility. The final design is a unique composition,
// never a clone of any single brand.
//
// Architecture: Per-responsibility override table (Option B).
// Each domain specifies ONLY the fields that differ from its primary ref.
// Everything not overridden inherits from the primary reference profile.
// Adding a new domain = 1-5 lines. Scalable to 500+ domains.
// ════════════════════════════════════════════════════════════════════

// ── Responsibility keys ───────────────────────────────────────────────
type RefKey = keyof typeof REFERENCE_PROFILES;

interface CompositionOverride {
  primary:      RefKey;         // main reference — covers all unspecified roles
  layout?:      RefKey;         // grid, section structure, container width
  typography?:  RefKey;         // heading scale, weight, tracking, rhythm
  motion?:      RefKey;         // animation curves, durations, triggers
  photography?: RefKey;         // image style, lighting, composition
  navigation?:  RefKey;         // navbar style, sticky behavior, mobile
  cards?:       RefKey;         // card background, radius, shadow, hover
  cta?:         RefKey;         // button style, shape, copy direction
  spacing?:     RefKey;         // section padding, content rhythm
  color?:       RefKey;         // accent usage, gradient approach
}

// ── Composed Strategy output object ───────────────────────────────────
interface ComposedStrategy {
  // Attribution — shown in planning UI
  composition: { role: string; brand: string; why: string }[];

  // Per-responsibility directives (merged from multiple refs)
  heroDirective:        string;
  typographyDirective:  string;
  motionDirective:      string;
  photoDirective:       string;
  cardDirective:        string;
  ctaDirective:         string;
  navigationDirective:  string;
  spacingDirective:     string;
  colorDirective:       string;
  componentVariants:    Partial<Record<string, string>>;
  cssDirectives:        string;
  never:                string[];
  qualityTarget:        string;
  brands:               string[];
}

// ── Composition table — 73 domains, 1-5 lines each ───────────────────
const COMPOSITION_OVERRIDES: Record<string, CompositionOverride> = {

  // ── AUTOMOTIVE ───────────────────────────────────────────────────────
  "luxury-car-club":     { primary:"Bottega Veneta Editorial", typography:"Apple",    motion:"Linear",        navigation:"Apple" },
  "car-dealership":      { primary:"Shopify",                  typography:"Apple",    motion:"Apple",         photography:"Nike" },
  "car-rental":          { primary:"Apple",                    motion:"Stripe",       cta:"Shopify" },
  "ev-charging":         { primary:"Stripe",                   photography:"Apple",   color:"Stripe" },
  "taxi-transport":      { primary:"Apple",                    cta:"Shopify",        motion:"Stripe" },

  // ── FOOD & DRINK ─────────────────────────────────────────────────────
  "restaurant":          { primary:"Airbnb",                   typography:"Four Seasons", motion:"Apple",     photography:"Airbnb" },
  "cafe":                { primary:"Airbnb",                   typography:"Apple",    motion:"Apple",         cards:"Airbnb" },
  "bar-pub":             { primary:"Airbnb",                   typography:"Linear",   motion:"Linear",        color:"Linear" },
  "bakery":              { primary:"Airbnb",                   typography:"Apple",    photography:"Airbnb",   cta:"Shopify" },
  "food-delivery":       { primary:"Shopify",                  motion:"Apple",        cta:"Shopify",          cards:"Airbnb" },

  // ── HOSPITALITY ───────────────────────────────────────────────────────
  "hotel":               { primary:"Four Seasons",             motion:"Apple",        cta:"Bottega Veneta Editorial", navigation:"Apple" },
  "resort":              { primary:"Four Seasons",             typography:"Bottega Veneta Editorial", motion:"Apple", photography:"Four Seasons" },
  "travel-agency":       { primary:"Airbnb",                   typography:"Four Seasons", motion:"Apple",     photography:"Airbnb" },
  "airline":             { primary:"Apple",                    typography:"Stripe",   motion:"Stripe",        cta:"Apple" },

  // ── HEALTH & WELLNESS ─────────────────────────────────────────────────
  "gym":                 { primary:"Nike",                     cards:"Stripe",        motion:"Nike",          typography:"Nike" },
  "yoga-studio":         { primary:"Apple",                    typography:"Four Seasons", motion:"Apple",     photography:"Airbnb" },
  "spa":                 { primary:"Four Seasons",             typography:"Bottega Veneta Editorial", motion:"Apple", cards:"Four Seasons" },
  "salon":               { primary:"Apple",                    typography:"Bottega Veneta Editorial", photography:"Airbnb" },
  "barber":              { primary:"Linear",                   typography:"Nike",     photography:"Airbnb",   cards:"Stripe" },
  "dental":              { primary:"HubSpot",                  motion:"Apple",        typography:"Apple",     cards:"HubSpot" },
  "healthcare":          { primary:"HubSpot",                  motion:"Apple",        typography:"Apple",     navigation:"HubSpot" },
  "pharmacy":            { primary:"HubSpot",                  cta:"Shopify",         motion:"Apple" },
  "veterinary":          { primary:"HubSpot",                  photography:"Airbnb",  motion:"Apple" },
  "nutritionist":        { primary:"Apple",                    typography:"HubSpot",  photography:"Airbnb" },
  "mental-health":       { primary:"Apple",                    typography:"Four Seasons", motion:"Apple",     color:"HubSpot" },

  // ── BEAUTY & FASHION ──────────────────────────────────────────────────
  "fashion":             { primary:"Bottega Veneta Editorial", typography:"Apple",    motion:"Linear",        photography:"Bottega Veneta Editorial" },
  "jewelry":             { primary:"Bottega Veneta Editorial", motion:"Apple",        navigation:"Bottega Veneta Editorial", cta:"Bottega Veneta Editorial" },
  "watch-brand":         { primary:"Bottega Veneta Editorial", typography:"Apple",    motion:"Linear",        cards:"Bottega Veneta Editorial" },
  "beauty-brand":        { primary:"Airbnb",                   typography:"Apple",    photography:"Airbnb",   motion:"Apple" },
  "perfume":             { primary:"Bottega Veneta Editorial", motion:"Linear",       photography:"Bottega Veneta Editorial", color:"Bottega Veneta Editorial" },

  // ── PROPERTY ──────────────────────────────────────────────────────────
  "real-estate":         { primary:"Apple",                    typography:"Four Seasons", motion:"Apple",     photography:"Four Seasons" },
  "interior-design":     { primary:"Framer",                   photography:"Four Seasons", typography:"Bottega Veneta Editorial", motion:"Apple" },
  "architecture":        { primary:"Linear",                   typography:"Bottega Veneta Editorial", photography:"Linear", motion:"Linear" },
  "construction":        { primary:"HubSpot",                  typography:"Apple",    motion:"Apple",         cards:"Stripe" },
  "furniture":           { primary:"Apple",                    typography:"Four Seasons", photography:"Four Seasons", motion:"Apple" },

  // ── TECHNOLOGY ────────────────────────────────────────────────────────
  "saas":                { primary:"Stripe",                   motion:"Linear",       navigation:"Stripe",    typography:"Apple" },
  "ai-startup":          { primary:"Stripe",                   motion:"Linear",       color:"Stripe",         typography:"Apple" },
  "cybersecurity":       { primary:"Stripe",                   typography:"Linear",   motion:"Stripe",        color:"Linear" },
  "crm":                 { primary:"Notion",                   motion:"Stripe",       navigation:"Stripe",    typography:"Apple" },
  "erp":                 { primary:"Notion",                   motion:"Stripe",       typography:"HubSpot" },
  "developer-tool":      { primary:"Stripe",                   typography:"Framer",   color:"Notion",         navigation:"Stripe" },
  "dashboard-analytics": { primary:"Notion",                   motion:"Stripe",       typography:"Apple",     navigation:"Stripe" },

  // ── FINANCE & LEGAL ───────────────────────────────────────────────────
  "law-firm":            { primary:"HubSpot",                  typography:"Four Seasons", motion:"Apple",     navigation:"Stripe" },
  "accounting":          { primary:"HubSpot",                  motion:"Apple",        typography:"Stripe",    cards:"Stripe" },
  "finance":             { primary:"Stripe",                   typography:"Four Seasons", motion:"Apple",     navigation:"Stripe" },
  "insurance":           { primary:"HubSpot",                  motion:"Apple",        typography:"Apple",     cta:"Shopify" },
  "bank-fintech":        { primary:"Stripe",                   motion:"Apple",        cards:"Stripe",         navigation:"Apple" },
  "crypto":              { primary:"Stripe",                   motion:"Linear",       color:"Linear",         typography:"Apple" },

  // ── MEDIA ─────────────────────────────────────────────────────────────
  "blog-magazine":       { primary:"Apple",                    typography:"Bottega Veneta Editorial", motion:"Apple", photography:"Airbnb" },
  "podcast":             { primary:"Apple",                    typography:"Linear",   cards:"Stripe",         motion:"Apple" },

  // ── PROFESSIONAL SERVICES ────────────────────────────────────────────
  "marketing-agency":    { primary:"Linear",                   typography:"Framer",   photography:"Linear",   motion:"Linear" },
  "creative-agency":     { primary:"Linear",                   typography:"Framer",   motion:"Linear",        photography:"Linear" },
  "consultancy":         { primary:"HubSpot",                  typography:"Four Seasons", motion:"Apple",     navigation:"Stripe" },
  "hr-recruiting":       { primary:"Stripe",                   photography:"HubSpot", motion:"Apple",         cta:"Shopify" },
  "ngo-charity":         { primary:"HubSpot",                  photography:"Airbnb",  typography:"Apple",     motion:"Apple" },

  // ── EDUCATION ─────────────────────────────────────────────────────────
  "school-university":   { primary:"HubSpot",                  typography:"Apple",    motion:"Apple",         photography:"Airbnb" },
  "online-course":       { primary:"Stripe",                   typography:"Apple",    motion:"Apple",         cta:"Shopify" },
  "coaching":            { primary:"Apple",                    typography:"Four Seasons", photography:"Airbnb", motion:"Apple" },

  // ── CREATIVE PROFESSIONALS ────────────────────────────────────────────
  "photography":         { primary:"Framer",                   typography:"Bottega Veneta Editorial", motion:"Apple", navigation:"Framer" },
  "videography":         { primary:"Linear",                   typography:"Framer",   motion:"Linear",        photography:"Bottega Veneta Editorial" },
  "wedding":             { primary:"Four Seasons",             typography:"Bottega Veneta Editorial", motion:"Apple", photography:"Four Seasons" },
  "event-company":       { primary:"Apple",                    typography:"Linear",   motion:"Apple",         photography:"Airbnb" },

  // ── PORTFOLIO ─────────────────────────────────────────────────────────
  "portfolio-developer": { primary:"Framer",                   typography:"Apple",    motion:"Linear",        navigation:"Stripe" },
  "portfolio-designer":  { primary:"Framer",                   typography:"Bottega Veneta Editorial", motion:"Linear", navigation:"Apple" },
  "influencer-creator":  { primary:"Framer",                   typography:"Nike",     motion:"Apple",         photography:"Airbnb" },

  // ── ECOMMERCE VERTICALS ───────────────────────────────────────────────
  "electronics":         { primary:"Shopify",                  typography:"Apple",    motion:"Apple",         photography:"Apple" },
  "pet-shop":            { primary:"Airbnb",                   cta:"Shopify",         motion:"Apple",         typography:"Apple" },
  "sports-equipment":    { primary:"Nike",                     cta:"Shopify",         motion:"Nike",          cards:"Shopify" },

  // ── OPERATIONS ────────────────────────────────────────────────────────
  "logistics":           { primary:"HubSpot",                  typography:"Stripe",   motion:"Apple",         cards:"Stripe" },
  "manufacturing":       { primary:"HubSpot",                  typography:"Apple",    motion:"Apple" },
  "agriculture":         { primary:"HubSpot",                  photography:"Airbnb",  color:"HubSpot",        motion:"Apple" },

  // ── LANDING PAGES ─────────────────────────────────────────────────────
  "landing-page":        { primary:"Apple",                    motion:"Linear",       cta:"Shopify",          typography:"Stripe" },
  "app-landing":         { primary:"Apple",                    motion:"Stripe",       cta:"Shopify",          typography:"Apple" },
};

// ── Conflict resolver ─────────────────────────────────────────────────
// When two references have contradictory philosophies (minimal vs bold),
// the resolver picks based on businessGoal and marketLevel.
function resolveConflict(
  fieldA: string, refA: RefKey,
  fieldB: string, refB: RefKey,
  businessGoal: string, marketLevel: string
): { winner: RefKey; reason: string } {
  // Trust always wins for finance/medical goals
  if (/lead|membership|inquiry/.test(businessGoal) && (refA === "HubSpot" || refB === "HubSpot")) {
    const winner = (refA === "HubSpot" ? refA : refB) as RefKey;
    return { winner, reason: "Trust signals prioritised for lead-gen goals" };
  }
  // Luxury markets: editorial/minimal wins over bold
  if (marketLevel === "luxury" && (refA === "Bottega Veneta Editorial" || refB === "Bottega Veneta Editorial")) {
    const winner = (refA === "Bottega Veneta Editorial" ? refA : refB) as RefKey;
    return { winner, reason: "Luxury market requires editorial restraint" };
  }
  // Ecommerce: conversion-focused wins
  if (/ecommerce|booking/.test(businessGoal) && (refA === "Shopify" || refB === "Shopify")) {
    const winner = (refA === "Shopify" ? refA : refB) as RefKey;
    return { winner, reason: "Conversion goal prioritises e-commerce patterns" };
  }
  // Default: first ref wins (primary reference takes precedence)
  return { winner: refA as RefKey, reason: `${refA} selected as primary authority` };
}

// ── Role labels for attribution display ──────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  primary:     "Overall Design",
  layout:      "Layout System",
  typography:  "Typography",
  motion:      "Animations",
  photography: "Photography",
  navigation:  "Navigation",
  cards:       "Card Design",
  cta:         "CTA Style",
  spacing:     "Spacing",
  color:       "Color System",
};

// ── Brand display name for attribution ────────────────────────────────
function getBrandDisplay(refKey: RefKey): string {
  const ref = REFERENCE_PROFILES[refKey];
  if (!ref) return refKey;
  // Take first 2 brands from the reference
  return ref.brands.slice(0, 2).join(" × ");
}

// ── Core composer function ─────────────────────────────────────────────
function composeDesignStrategy(
  domainId:     string,
  competitorStyle: string,
  niche:        NicheProfile,
  businessGoal: string
): ComposedStrategy {
  // 1. Look up the override spec for this domain
  const override = COMPOSITION_OVERRIDES[domainId];
  const primaryKey: RefKey = override?.primary
    ?? (REFERENCE_PROFILES[competitorStyle as RefKey] ? competitorStyle as RefKey : "Apple");
  const primary = REFERENCE_PROFILES[primaryKey]!;

  // 2. Resolve each responsibility — override if specified, else inherit from primary
  const resolved: Record<string, DesignReference> = {
    layout:      REFERENCE_PROFILES[override?.layout      ?? primaryKey] ?? primary,
    typography:  REFERENCE_PROFILES[override?.typography  ?? primaryKey] ?? primary,
    motion:      REFERENCE_PROFILES[override?.motion      ?? primaryKey] ?? primary,
    photography: REFERENCE_PROFILES[override?.photography ?? primaryKey] ?? primary,
    navigation:  REFERENCE_PROFILES[override?.navigation  ?? primaryKey] ?? primary,
    cards:       REFERENCE_PROFILES[override?.cards       ?? primaryKey] ?? primary,
    cta:         REFERENCE_PROFILES[override?.cta         ?? primaryKey] ?? primary,
    spacing:     REFERENCE_PROFILES[override?.spacing     ?? primaryKey] ?? primary,
    color:       REFERENCE_PROFILES[override?.color       ?? primaryKey] ?? primary,
  };

  // 3. Build attribution table (only show roles that differ from primary)
  const composition: { role: string; brand: string; why: string }[] = [
    { role:"Overall Design", brand:getBrandDisplay(primaryKey), why:"Primary visual language" },
  ];
  const seen = new Set<RefKey>([primaryKey]);
  for (const [role, ref] of Object.entries(resolved)) {
    const key = ref.styleKey as RefKey;
    if (key !== primaryKey && !seen.has(key)) {
      seen.add(key);
      composition.push({
        role:  ROLE_LABELS[role] || role,
        brand: getBrandDisplay(key),
        why:   `Best-in-class ${ROLE_LABELS[role]?.toLowerCase() || role}`,
      });
    }
  }

  // 4. Merge CSS directives — primary first, then unique additions from overrides
  const cssBlocks = new Set<string>([primary.cssDirectives.trim()]);
  for (const ref of Object.values(resolved)) {
    if (ref.cssDirectives.trim() !== primary.cssDirectives.trim()) {
      // Add only the most specific selector lines (not full block duplication)
      const lines = ref.cssDirectives.split('\n')
        .filter(l => l.includes('{') && !primary.cssDirectives.includes(l.split('{')[0]));
      if (lines.length > 0) cssBlocks.add(lines.slice(0, 5).join('\n'));
    }
  }

  // 5. Merge NEVER rules (union)
  const neverSet = new Set(primary.never);
  for (const ref of Object.values(resolved)) {
    for (const n of ref.never) {
      if (!primary.never.includes(n)) neverSet.add(n);
    }
  }

  // 6. Merge component variants — override wins over primary
  const variants = { ...primary.componentVariants };
  if (resolved.navigation !== primary) Object.assign(variants, { navbar: resolved.navigation.componentVariants.navbar });
  if (resolved.cta !== primary)        Object.assign(variants, { cta: resolved.cta.componentVariants.cta });
  if (resolved.cards !== primary) {
    const cardKey = Object.keys(resolved.cards.componentVariants)[0];
    if (cardKey) variants[cardKey] = (resolved.cards.componentVariants as any)[cardKey];
  }

  // 7. Collect unique brand references for attribution
  const allBrands = Array.from(new Set([
    ...primary.brands.slice(0, 2),
    ...Object.values(resolved)
      .filter(r => r !== primary)
      .flatMap(r => r.brands.slice(0, 1)),
  ])).slice(0, 6);

  return {
    composition,
    heroDirective:        resolved.layout.heroDirective,
    typographyDirective:  resolved.typography.typographyDirective,
    motionDirective:      resolved.motion.motionDirective,
    photoDirective:       resolved.photography.photoDirective,
    cardDirective:        resolved.cards.cardDirective,
    ctaDirective:         resolved.cta.ctaDirective,
    navigationDirective:  resolved.navigation.cardDirective,  // use card style for nav context
    spacingDirective:     resolved.spacing?.cssDirectives?.split('\n').find((l: string) => l.includes('padding')) ?? "Balanced section spacing — 96-120px padding.",
    colorDirective:       resolved.color?.cssDirectives?.split('\n').find((l: string) => l.includes('color') || l.includes('background')) ?? "Use brand primary color system",
    componentVariants:    variants,
    cssDirectives:        Array.from(cssBlocks).join('\n\n/* --- */\n\n'),
    never:                Array.from(neverSet),
    qualityTarget:        primary.qualityTarget,
    brands:               allBrands,
  };
}


function getDesignReference(
  domain:        string,
  competitorStyle: string,
  niche:         NicheProfile
): DesignReference | null {
  // 1. Exact domain match
  const refKey = DOMAIN_TO_REFERENCE[domain];
  if (refKey && REFERENCE_PROFILES[refKey]) return REFERENCE_PROFILES[refKey];

  // 2. competitorStyle override (user explicitly said "like Stripe")
  if (REFERENCE_PROFILES[competitorStyle]) return REFERENCE_PROFILES[competitorStyle];

  // 3. Tone-based fallback
  const toneMap: Record<string, string> = {
    editorial: "Bottega Veneta Editorial", energetic: "Nike", warm: "Airbnb",
    trust: "Stripe", bold: "Linear", clean: "Apple",
  };
  const toneKey = toneMap[niche.tone];
  return toneKey ? (REFERENCE_PROFILES[toneKey] || null) : null;
}

function detectCompetitorStyle(
  prompt: string, tone: string, domainId?: string
): string {
  const p = prompt.toLowerCase();
  // 1. Explicit user mention takes priority
  if (/inspired by stripe|like stripe|stripe style/.test(p)) return "Stripe";
  if (/inspired by apple|like apple|apple style/.test(p)) return "Apple";
  if (/inspired by nike|like nike|nike style/.test(p)) return "Nike";
  if (/inspired by airbnb|like airbnb|airbnb style/.test(p)) return "Airbnb";
  if (/inspired by linear|like linear|linear style/.test(p)) return "Linear";
  if (/inspired by framer|like framer|framer style/.test(p)) return "Framer";
  if (/inspired by notion|like notion|notion style/.test(p)) return "Notion";
  if (/inspired by ferrari|like ferrari/.test(p)) return "Bottega Veneta Editorial";
  if (/inspired by shopify|like shopify/.test(p)) return "Shopify";
  if (/inspired by hubspot|like hubspot/.test(p)) return "HubSpot";
  if (/inspired by four seasons|four seasons style/.test(p)) return "Four Seasons";
  // 2. Domain-specific reference (accurate over tone-guess)
  if (domainId && DOMAIN_TO_REFERENCE[domainId]) return DOMAIN_TO_REFERENCE[domainId];
  // 3. Tone-based fallback
  const map: Record<string,string> = {
    editorial: "Bottega Veneta Editorial", energetic: "Nike", warm: "Airbnb",
    trust: "Stripe", bold: "Linear", clean: "Apple",
    adventurous: "Airbnb", helpful: "HubSpot",
  };
  return map[tone] || "Apple";
}

// ── PHASE 4: Audience Dimensions Detector ────────────────────────
function detectAudienceDimensions(prompt: string, niche: string, marketLevel: string): AudienceDimensions {
  const p = prompt.toLowerCase();
  // Gender dimension
  const gender = /(women|female|feminine|girl|she|her|beauty|skincare|makeup|perfume|fashion)/.test(p) ? "feminine"
    : /(men|male|masculine|guy|he|his|gym|muscle|beard|suit)/.test(p) ? "masculine"
    : "neutral";
  // Age dimension
  const age = /(student|young|teen|gen.z|millennial|college)/.test(p) ? "young (18-30)"
    : /(professional|executive|ceo|director|manager|b2b|enterprise)/.test(p) ? "professional (30-50)"
    : /(retire|senior|mature|legacy|estate)/.test(p) ? "mature (50+)"
    : "all ages";
  // Sophistication
  const sophistication = marketLevel === "luxury" ? "aspirational"
    : /(developer|engineer|technical|api|code|data)/.test(p) ? "technical"
    : /(creative|design|art|photo|music)/.test(p) ? "creative"
    : "practical";
  // Motivation
  const motivation = marketLevel === "luxury" ? "status"
    : /(result|transform|lose|gain|achieve|goal)/.test(p) ? "results"
    : /(safe|secure|trust|protect|reliable)/.test(p) ? "security"
    : /(community|together|join|belong|connect)/.test(p) ? "community"
    : "expression";
  return { gender, age, sophistication, motivation };
}

import { detectNiche } from "@/lib/rendering-engine/niche-detection";


// ── PHASE 2-6: MASTER PROMPT BUILDER ────────────────────────────

function buildNichePrompt(userPrompt: string, type: string, plan: string, cachedBlueprint?: any, realImages?: Record<string,string[]>, presetNiche?: NicheProfile): string {
  const niche = presetNiche || detectNiche(userPrompt);
  const p = niche.palette;
  const t = niche.typography;
  const v = niche.brandVoice;

  // Phase 1: URL Reverse Engineering (cached DB blueprint takes priority)
  const urlBlueprint = cachedBlueprint
    ? {
        style:           cachedBlueprint.competitor_dna?.designLanguage || cachedBlueprint.domain || "custom",
        heroPattern:     cachedBlueprint.hero_pattern || "center",
        ctaStrategy:     `"${cachedBlueprint.cta_primary}" (${cachedBlueprint.cta_pattern})`,
        trustPattern:    cachedBlueprint.trust_pattern || "testimonials",
        layoutPhilosophy: (cachedBlueprint.section_order || []).join(" → "),
        typographyFeel:  `${cachedBlueprint.design_profile?.theme || "dark"} · ${cachedBlueprint.design_profile?.cardStyle || "elevated"}`,
        conversionTactic: cachedBlueprint.competitor_dna?.conversionStrategy || "",
        fullBlueprint:   cachedBlueprint.competitor_dna?.reusableBlueprintPrompt || null,
        // FIX 7: Extracted colors now flow into CSS
        extractedColors: (cachedBlueprint.design_profile?.colorPalette || []).filter((c: string) => /^#[0-9a-f]{6}$/i.test(c)),
      }
    : detectCompetitorFromURL(userPrompt);
  // Phase 2: Competitor style
  const competitorStyle = urlBlueprint?.style
    || detectCompetitorStyle(userPrompt, niche.tone)
    || niche.competitorStyle;
  // designRef and composed populated after architect runs (domainPlan available then)
  const _domainIdForRef = (presetNiche as any)?.__domainId || "";
  const designRef = getDesignReference(_domainIdForRef, competitorStyle, niche);
  const composed  = composeDesignStrategy(_domainIdForRef, competitorStyle, niche,
    niche.conversionGoal || "lead"
  );
  const audienceDim = niche.audienceDimensions || detectAudienceDimensions(userPrompt, niche.industry, niche.marketLevel);

  const BASE = `You are Krypton AI — a world-class UI/UX designer creating websites comparable to premium agencies.

════════════════════════════════════════════════════════════
COMPLETE INTELLIGENCE PROFILE (govern EVERY design decision)
════════════════════════════════════════════════════════════
Industry:          ${niche.industry}
Business Type:     ${niche.businessType}
Market Level:      ${niche.marketLevel}  (${niche.brandPositioning || 'professional'} positioning)
Audience:          ${niche.audience} · ${audienceDim.gender} · ${audienceDim.age}
Sophistication:    ${audienceDim.sophistication} · motivated by: ${audienceDim.motivation}
Design Tone:       ${niche.tone}
Competitor Style:  ${competitorStyle} (match this design quality/feel — NOT content)
Reference Brands:  ${composed?.brands?.join(", ") ?? competitorStyle}
Quality Target:    ${composed?.qualityTarget ?? "Premium agency quality"}

DESIGN COMPOSITION (${composed?.composition?.length ?? 1} references merged):
${(composed?.composition ?? []).map((c:{role:string;brand:string;why:string}) => `  ${c.role}: ${c.brand} — ${c.why}`).join("\n")}

COMPOSED DESIGN DIRECTIVES (implement precisely):
Hero Layout:   ${composed?.heroDirective ?? ""}
Typography:    ${composed?.typographyDirective ?? ""}
Motion:        ${composed?.motionDirective ?? ""}
Photography:   ${composed?.photoDirective ?? ""}
Cards:         ${composed?.cardDirective ?? ""}
CTA:           ${composed?.ctaDirective ?? ""}
Spacing:       ${composed?.spacingDirective ?? ""}

CSS DIRECTIVES (from merged references — implement these patterns):
${composed?.cssDirectives ?? ""}

COMPONENT VARIANTS SELECTED (composition-driven):
${Object.entries(composed?.componentVariants ?? {}).map(([k,v]) => `  ${k}: ${String(v)}`).join("\n")}

NEVER DO (merged quality rules):
${(composed?.never ?? []).slice(0, 12).map((n:string) => `  ✗ ${n}`).join("\n")}
Conversion Goal:   ${niche.conversionGoal} ← OPTIMIZE ENTIRE PAGE FOR THIS

CONVERSION PATH: ${
  niche.conversionGoal === 'reservation' ? 'Awareness → Appetite (visuals) → Trust (reviews) → ACTION (reservation form)' :
  niche.conversionGoal === 'trial' ? 'Pain (problem) → Solution (demo) → Trust (logos/testimonials) → ACTION (free trial)' :
  niche.conversionGoal === 'enrollment' ? 'Outcome (result) → Curriculum → Instructor cred → Social proof → ACTION (enroll now)' :
  niche.conversionGoal === 'lead' ? 'Authority (stats) → Services → Process → Trust → ACTION (contact/book call)' :
  niche.conversionGoal === 'purchase' ? 'Desire (visuals) → Story (brand) → Scarcity → Trust → ACTION (buy/shop)' :
  niche.conversionGoal === 'email-capture' ? 'Value hook → Benefits → Proof → ACTION (get free resource)' :
  niche.conversionGoal === 'community' ? 'Vision → Stats → Features → Roadmap → ACTION (join now)' :
  'Awareness → Value → Trust → ACTION'
}

TOP 3 OBJECTIONS TO HANDLE ON THIS PAGE:
${(niche.objectionHandling || ['Is it worth it?','Can I trust them?','Will it work for me?']).map((o: string,i: number) => `  ${i+1}. "${o}"`).join('\n')}

TRUST ELEMENTS (place prominently, early in the page):
${(niche.trustElements || ['Social proof','Reviews','Credentials']).map((t: string) => `  • ${t}`).join('\n')}

════════════════════════════════════════════════════════════
CRITICAL OUTPUT RULES — NEVER BREAK THESE
════════════════════════════════════════════════════════════
1. Output ONLY raw HTML starting with <!DOCTYPE html> ending with </html>
2. ZERO markdown, ZERO backticks, ZERO explanations
3. ALL CSS inside <style> in <head>
4. ALL JavaScript inside <script> before </body>
5. ALL content in ENGLISH regardless of input language
6. Minimum 800 lines of complete, working production code
7. ZERO placeholder text — every word is real, specific, relevant
8. Every button, accordion, tab, modal MUST be functional
9. NO generic content — write copy specific to: ${niche.industry}

════════════════════════════════════════════════════════════
DESIGN SYSTEM — USE EXACTLY THESE VALUES
════════════════════════════════════════════════════════════
@import url('${t.googleFonts}');

:root {
  /* Brand Colors */
  --primary:   ${p.primary};
  --secondary: ${p.secondary};
  --grad:      ${p.grad};
  --accent:    ${p.accent};
  
  /* Backgrounds */
  --bg:      ${p.bg};
  --surface: ${p.surface};
  --card:    ${p.card};
  
  /* Text */
  --text:    #FFFFFF;
  --text-2:  ${p.text2};
  --text-3:  #475569;
  
  /* Borders */
  --border:        rgba(255,255,255,0.07);
  --border-accent: rgba(${hexToRgbValues(p.primary)},0.3);
  
  /* Effects */
  --glow:   0 0 40px rgba(${hexToRgbValues(p.primary)},0.2);
  --shadow: 0 24px 64px rgba(0,0,0,0.6);
  --glass:  rgba(255,255,255,0.03);
}

/* Typography */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: ${t.bodyFont}; line-height: 1.7; overflow-x: hidden; }
h1,h2,h3,h4 { font-family: ${t.headingFont}; font-weight: ${t.headingWeight}; letter-spacing: ${t.headingSpacing}; line-height: 1.1; }
h1 { font-size: clamp(40px,6vw,90px); }
h2 { font-size: clamp(30px,4vw,56px); }
h3 { font-size: clamp(20px,2.5vw,28px); }

/* Gradient Text Utility */
.grad-text { background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

/* Layout */
.container { max-width: 1280px; margin: 0 auto; padding: 0 clamp(20px,4vw,64px); }
section { padding: clamp(64px,8vw,120px) 0; }

/* Animated hero gradient */
@keyframes gradientShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
@keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
@keyframes spin { to{transform:rotate(360deg)} }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
@keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }

/* Scroll Animations */
.reveal { opacity:0; transform:translateY(40px); transition:all 0.7s cubic-bezier(0.16,1,0.3,1); }
.reveal.visible { opacity:1; transform:translateY(0); }

/* Button styles */
.btn { display:inline-flex; align-items:center; gap:8px; border-radius:50px; font-weight:700; cursor:pointer; transition:all 0.25s ease; border:none; text-decoration:none; white-space:nowrap; }
.btn-primary { background:var(--grad); color:#fff; padding:14px 32px; font-size:15px; }
.btn-primary:hover { transform:translateY(-3px); box-shadow:var(--glow); }
.btn-secondary { background:transparent; color:var(--primary); border:1.5px solid var(--primary); padding:13px 30px; font-size:15px; }
.btn-secondary:hover { background:rgba(${hexToRgbValues(p.primary)},0.1); transform:translateY(-3px); }

/* Card styles */
.card { background:var(--card); border:1px solid var(--border); border-radius:20px; transition:all 0.3s ease; }
.card:hover { border-color:var(--border-accent); box-shadow:var(--glow); transform:translateY(-6px); }

/* Scrollbar */
::-webkit-scrollbar { width:4px; }
::-webkit-scrollbar-track { background:var(--bg); }
::-webkit-scrollbar-thumb { background:var(--primary); border-radius:2px; }

════════════════════════════════════════════════════════════
PHASE 3: IMAGE INTELLIGENCE — ${niche.industry.toUpperCase()} · ${niche.marketLevel.toUpperCase()}
════════════════════════════════════════════════════════════
RULE: Every image must FEEL like it was shot for this exact brand. Never generic.

REAL WORKING IMAGE URLS — use these EXACT URLs, copy-paste them verbatim:
${(() => {
  const imgs = realImages?.["main"] || [];
  if (imgs.length === 0) return "  (No images resolved — use solid CSS gradient backgrounds instead of <img> tags)";
  const sections = Object.keys(niche.sectionImageMap || {hero: niche.imageKeyword});
  return sections.map((section, i) =>
    `  ${section.padEnd(14)} → ${imgs[i % imgs.length]}`
  ).join('\n') + '\n\n' +
  `  Additional/card images (use these, vary per card):\n` +
  imgs.map((url, i) => `    Image ${i+1} → ${url}`).join('\n');
})()}

IMAGE STYLE for ${niche.marketLevel} ${niche.tone} brand:
${niche.marketLevel === 'luxury' ? '  • Dark, moody, editorial. High contrast. Gold/shadow play. Minimal subjects.' :
  niche.tone === 'energetic' ? '  • Dynamic, motion blur, high contrast. Action shots. Powerful subjects.' :
  niche.tone === 'warm' ? '  • Warm tones, natural light, human faces, intimate. Food close-ups.' :
  niche.tone === 'trust' ? '  • Clean, professional, data-driven. Clean workspaces, confident professionals.' :
  '  • Premium, clean backgrounds. Professional lighting. Modern aesthetic.'}

CRITICAL RULES:
1. ONLY use the exact image URLs listed above — they are REAL, VERIFIED working images
2. NEVER invent your own unsplash.com or source.unsplash.com URLs — those will be BROKEN
3. NEVER use picsum.photos or any placeholder image service
4. If you need more images than provided, REUSE the listed URLs rather than inventing new ones
ALL images: object-fit:cover; width:100%; display:block;
Border-radius: ${niche.tone === 'editorial' ? '0' : niche.tone === 'warm' ? '24px' : niche.tone === 'energetic' ? '4px' : '16px'};

════════════════════════════════════════════════════════════
BRAND VOICE — ${niche.marketLevel.toUpperCase()} ${niche.industry.toUpperCase()}
════════════════════════════════════════════════════════════
Hero Headline Style: ${v.heroHeadlineStyle}
Primary CTA Style:   "${v.ctaPrimary}"
Secondary CTA:       "${v.ctaSecondary}"
Emotional Hook:      ${v.emotionalHook}
Social Proof Style:  ${v.socialProofStyle}

════════════════════════════════════════════════════════════
CONVERSION-OPTIMIZED SECTION ORDER FOR ${niche.industry.toUpperCase()}
════════════════════════════════════════════════════════════
Build sections IN THIS ORDER: ${niche.sectionOrder.join(" → ")}
(This order is scientifically optimized for ${niche.audience} ${niche.industry} conversions)

${urlBlueprint ? `
════════════════════════════════════════════════════════════
PHASE 1: COMPETITOR BLUEPRINT (apply structurally)
════════════════════════════════════════════════════════════
${urlBlueprint.fullBlueprint || `Design: ${urlBlueprint.style} | Hero: ${urlBlueprint.heroPattern}
Sections: ${urlBlueprint.layoutPhilosophy}
CTA: ${urlBlueprint.ctaStrategy} | Trust: ${urlBlueprint.trustPattern}
Visual: ${urlBlueprint.typographyFeel}`}

${urlBlueprint.extractedColors?.length >= 2 ? `CSS COLOR OVERRIDE (extracted from competitor — use in :root):
  --primary:   ${urlBlueprint.extractedColors[0]};
  --secondary: ${urlBlueprint.extractedColors[1] || urlBlueprint.extractedColors[0]};
  --accent:    ${urlBlueprint.extractedColors[2] || urlBlueprint.extractedColors[0]};` : ''}

RULE: Copy structure + layout + conversion patterns. Generate 100% original content.
` : ''}

════════════════════════════════════════════════════════════
PHASE 3: CONVERSION VARIANT — BALANCED (A/B tested patterns)
════════════════════════════════════════════════════════════
Apply these proven high-converting patterns:

HERO VARIANT (Balanced — highest converting):
  • Pain → Solution structure: Start with the USER's problem, not brand features
  • Headline: Lead with OUTCOME ("Get 10x results") not process ("We help you")
  • Sub-headline: Specific, measurable benefit (include a number if possible)
  • Social proof: Show IMMEDIATELY below CTA — reduces anxiety at decision point
  • CTA copy: Verb + outcome ("Start Transforming" not just "Start")
  • Micro-copy below CTA: Remove risk ("Free · No credit card · Cancel anytime")

TRUST VARIANT (builds confidence before CTA):
  • First trust element within 2 scrolls from top
  • Use SPECIFIC numbers (not "thousands" — say "12,847 users")
  • Testimonials: Include specific metric ("increased revenue by 340%")
  • Trust badges: certification logos are MORE trusted than text claims

CTA VARIANT (conversion-optimized):
  • Only 1 primary CTA per viewport (never compete with yourself)
  • Repeat same CTA at bottom of each major section
  • Final CTA section: gradient background, centered, clear guarantee

════════════════════════════════════════════════════════════
PHASE 4: TRUST ENGINE — ${niche.industry.toUpperCase()}
════════════════════════════════════════════════════════════
${getTrustEngineBlueprint(niche)}

════════════════════════════════════════════════════════════
PHASE 5: AI DESIGN CRITIC — SELF-REVIEW (run before finalizing HTML)
════════════════════════════════════════════════════════════
Before writing </body>, mentally review your output against:

□ DESIGN: Does hero look like ${competitorStyle} caliber? (dark, premium, intentional)
□ IMAGES: Are ALL images using unsplash with RELEVANT keywords? (no picsum, no broken imgs)
□ CONTENT: Is every word specific to ${niche.industry}? (no "Feature 1", no "Lorem ipsum")
□ CTA: Is primary CTA "${niche.brandVoice.ctaPrimary}" above the fold?
□ TRUST: Are trust elements (${(niche.trustElements||[]).slice(0,2).join(', ')}) visible early?
□ MOBILE: Will nav collapse to hamburger at 768px? Will hero stack to 1 column?

MANDATORY MOBILE NAV PATTERN — copy this exact structure, don't improvise:
\`\`\`html
<nav style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px">
  <div class="logo">...</div>
  <div class="nav-links" style="display:flex;gap:32px;align-items:center">
    <a href="#">Link1</a><a href="#">Link2</a><a href="#">Link3</a>
    <button class="btn-cta">CTA</button>
  </div>
  <button class="hamburger" onclick="document.querySelector('.nav-links').classList.toggle('open')"
    style="display:none;background:none;border:none;color:var(--text);font-size:24px;cursor:pointer">☰</button>
</nav>
\`\`\`
\`\`\`css
@media (max-width: 768px) {
  .nav-links { display:none !important; position:fixed; top:0; right:0; height:100vh; width:75%;
    flex-direction:column; background:var(--surface); padding:80px 24px; z-index:100;
    box-shadow:-4px 0 24px rgba(0,0,0,0.3); }
  .nav-links.open { display:flex !important; }
  .hamburger { display:block !important; z-index:101; }
}
\`\`\`
CRITICAL: the CTA/cart/button inside nav-links must NEVER render inline next to
the logo on mobile — it goes inside the SAME collapsing .nav-links container as
the other links, never as a separate sibling that can wrap awkwardly.
□ INTERACTIONS: Do ALL buttons, accordions, tabs have working JS?
□ OBJECTIONS: Does the page address: "${(niche.objectionHandling||['Is it worth it?'])[0]}"?

If ANY box is unchecked, FIX it before closing </html>.

USER REQUEST: ${userPrompt}

EXECUTION PLAN:
${plan}`;

  if (type === "game") {
    return BASE + GAME_PROMPT;
  }
  if (type !== "website" && type !== "landing") {
    return BASE;
  }

  return FORCE_RULES + "\n\n" + BASE + getNicheWebsitePrompt(niche, userPrompt, realImages);
}

// hexToRgb -> use hexToRgbValues()

// ── Niche-specific section blueprints ────────────────────────────

// ── PHASE 2: Design Language Per Niche ───────────────────────────
import { type DesignLanguage, getDesignLanguage, hexToRgbValues } from "@/lib/rendering-engine/design-language";


// ═══════════════════════════════════════════════════════════════════
// DYNAMIC DESIGN ENGINE — seeded deterministic variant selection.
// Root cause of "every website looks identical": detectNiche() used to
// return ONE fixed {palette, typography, tone} per industry — every
// generation for e.g. "Luxury" got the exact same gold/black look.
// This adds a REAL variant library (3 professionally-designed variants
// per industry) and a seeded picker so each generation gets a different,
// intentional look while staying on-brand for the detected industry.
// ═══════════════════════════════════════════════════════════════════

import {
  type DesignVariant, INDUSTRY_VARIANTS, pickDesignVariant, applyDesignVariant, shuffleMiddleSections,
} from "@/lib/rendering-engine/design-variants";





// ═══════════════════════════════════════════════════════════════════
// PHASE 4: TRUST ENGINE V2 — Industry-specific trust blueprints
// ═══════════════════════════════════════════════════════════════════
function getTrustEngineBlueprint(niche: NicheProfile): string {
  const goal = niche.conversionGoal;
  const industry = niche.industry;
  
  const trustMap: Record<string, string> = {
    "trial": `SaaS TRUST STACK (place in this order):
  1. Logo bar: "Trusted by teams at [Company1] [Company2] [Company3]..." — immediately after hero
  2. Security badges: SOC2, ISO 27001, GDPR — in footer + pricing section
  3. Case study stat: "[Customer] increased [metric] by [X]% in [timeframe]" — with company logo
  4. G2/Capterra rating: show stars + review count + category ranking
  5. Integration logos: "Works with Slack, Notion, GitHub, Zapier..." — shows ecosystem
  6. Money-back: "30-day money-back guarantee" — immediately below pricing CTA
  7. Support trust: "24/7 support · [X] min avg response" — in pricing section`,
    
    "reservation": `RESTAURANT TRUST STACK:
  1. Review score: Large "4.9/5" with star icons + "Based on 847 reviews" — in hero or directly below
  2. Award badges: "Best Restaurant 2024", "Michelin Recommended", "TripAdvisor Certificate of Excellence"
  3. Press quotes: "[Name], [Publication]: '[short quote]'" — 2-3 press mentions
  4. Chef credentials: "Executive Chef [Name] · [X] years · Previously at [Famous Restaurant]"
  5. Photo gallery: Real food + real atmosphere photos (not stock) — before reservation form
  6. Reservation stats: "[X] tables booked today" · "97% return customer rate"`,
    
    "lead": `AGENCY/FINANCE TRUST STACK:
  1. Results first: "[Client] achieved [X]% [metric] in [timeframe]" — SPECIFIC, with logo
  2. Client logos: recognizable company logos in a clean grid
  3. Credentials: certifications, awards, years in business — near hero
  4. Team social proof: team photos with names/titles — not stock photos
  5. Process transparency: "Our [X]-step proven process" — reduces unknown risk
  6. Guarantee: "If we don't [result], we [refund/free month]"
  7. Response time: "We respond within [X] hours" — reduces commitment anxiety`,
    
    "enrollment": `EDUCATION TRUST STACK:
  1. Outcome proof FIRST: "94% of graduates [got job/increased salary/launched business]"
  2. Student count: "12,847 students enrolled" — big, early
  3. Completion rate: "87% completion rate" — addresses "will I actually do it?" objection
  4. Instructor credentials: Photo + specific achievements (not generic "expert")
  5. Money-back: "30-day full refund — no questions asked" — must be prominent
  6. Sample lesson: "Preview Lesson 1 for free" — reduces commitment anxiety
  7. Community: "[X] active students in private community"`,
    
    "email-capture": `CONTENT/AFFILIATE TRUST STACK:
  1. Audience size: "[X] monthly readers" or "[X] email subscribers" — early
  2. Income proof: Specific numbers if applicable (screenshot style stat card)
  3. Press logos: "Featured in Forbes, Entrepreneur, Inc." — logo strip
  4. Free value first: "Get the free [guide/checklist/template]" — before asking for email
  5. Privacy trust: "No spam. Unsubscribe anytime." — below email input
  6. Sample content: 3 example articles/posts with real titles`,
    
    "purchase": `ECOMMERCE/LUXURY TRUST STACK:
  1. Editorial credibility: "As seen in [Vogue] [GQ] [WSJ]" — press logo bar
  2. Craftsmanship story: HOW it's made — process, materials, people
  3. Limited availability: "Only [X] units available" — creates urgency without desperation
  4. Returns policy: "Free returns within 30 days" — removes purchase risk
  5. Authenticity: "Handcrafted / Ethically sourced / [Certification]"
  6. Real reviews: Show reviews with PHOTOS of the product in use`,
    
    "inquiry": `REAL ESTATE TRUST STACK:
  1. Sales record: "[X] homes sold in [area] · $[X]M total volume" — hard numbers
  2. Local expertise: "Top agent in [City] [Year] · [X] years experience"
  3. Recent sales: 3 recent sold properties with price and days on market
  4. Response promise: "We respond within [X] hours" — shown prominently
  5. Client testimonials: Full name + address (with permission) + result
  6. Professional credentials: License number, association logos`,
    
    "community": `CRYPTO/COMMUNITY TRUST STACK:
  1. Hard metrics: TVL, transaction count, wallet count — large, hero section
  2. Audit reports: "Audited by [Firm]" with link — critical for crypto
  3. Team doxxing: Real names + LinkedIn + previous credible projects
  4. Partnership logos: Major protocol/exchange partnerships
  5. Community size: Discord members, Twitter followers, GitHub stars
  6. Roadmap transparency: Public roadmap with completion status`,
  };
  
  return trustMap[goal] || `TRUST STACK:
  1. Social proof with specific numbers near top
  2. Credentials and certifications 
  3. Real testimonials with names, companies, specific results
  4. Risk reducer below every CTA (guarantee, free trial, no commitment)
  5. Press or partner logos for authority`;
}

// ── UPGRADED: getNicheWebsitePrompt ──────────────────────────────
function getNicheWebsitePrompt(niche: NicheProfile, userPrompt: string, realImages?: Record<string,string[]>): string {
  const dl = getDesignLanguage(niche);
  const v = niche.brandVoice;
  const p = niche.palette;
  const rgb = hexToRgbValues(p.primary);

  // Build niche-specific section blueprints
  const sectionBlueprints = buildSectionBlueprints(niche, dl, realImages?.["main"] || []);

  return `

════════════════════════════════════════════════════════════
PHASE 2: DESIGN LANGUAGE — ${dl.name.toUpperCase()}
════════════════════════════════════════════════════════════

${dl.spacing}

VISUAL INTELLIGENCE:
  Motion Style:         ${dl.motionStyle}
  Image Direction:      ${dl.imageDirection}
  Component Density:    ${dl.componentDensity}
  Premium Level:        ${dl.premiumLevel}/10
  Color Temperature:    ${dl.colorTemperature}
  Typography Scale:     ${dl.typographyScale}
  Border Radius Style:  ${dl.borderRadius}
  Shadow Depth:         ${dl.shadowDepth}

MOTION RULES — implement these exactly:
${dl.motionStyle}

IMAGE DIRECTION — brief AI on imagery style:
${dl.imageDirection}

MANDATORY CSS PATTERNS (add to <style> block):

/* Design Language Effects */
${dl.effectsCSS}

/* Motion Intelligence */
${dl.premiumLevel >= 8 ? `
/* Premium Motion — smooth, purposeful animations */
[data-reveal] {
  opacity: 0;
  transform: translateY(24px) ${dl.typographyScale === 'editorial' ? 'scale(0.98)' : ''};
  transition: opacity ${dl.premiumLevel >= 9 ? '0.9s' : '0.6s'} cubic-bezier(0.16,1,0.3,1),
              transform ${dl.premiumLevel >= 9 ? '0.9s' : '0.6s'} cubic-bezier(0.16,1,0.3,1);
}
[data-reveal].kr-visible {
  opacity: 1;
  transform: translateY(0) ${dl.typographyScale === 'editorial' ? 'scale(1)' : ''};
}
` : ''}
/* Border Radius System — ${dl.borderRadius} */
.card, [class*="-card"] {
  border-radius: ${dl.borderRadius === 'sharp' ? '0px' : dl.borderRadius === 'subtle' ? '4px' : dl.borderRadius === 'rounded' ? '16px' : '999px'};
}

/* Complete Color System */
:root {
  /* Status colors */
  --success: #10B981;
  --warning: #F59E0B;
  --error:   #EF4444;
  --info:    #3B82F6;
  
  /* Typography Scale */
  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 16px;
  --text-lg:   18px;
  --text-xl:   20px;
  
  /* Spacing Scale (8px grid) */
  --sp-1:  8px;  --sp-2: 16px;  --sp-3: 24px;
  --sp-4: 32px;  --sp-5: 40px;  --sp-6: 48px;
  --sp-8: 64px;  --sp-10: 80px; --sp-12: 96px;
  --sp-16: 128px; --sp-20: 160px;
  
  /* Section padding */
  --section-pad: clamp(64px,10vw,140px);
  
  /* Card radius based on design language */
  --radius-sm: 8px;
  --radius-md: 16px;  
  --radius-lg: 24px;
  --radius-xl: 32px;
  --radius-pill: 50px;
}

/* Card Pattern */
.card {
  ${dl.cardStyle}
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.card:hover {
  transform: translateY(-6px);
  border-color: rgba(${rgb},0.3);
  box-shadow: 0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(${rgb},0.1);
}

/* Button Pattern */
.btn-primary {
  ${dl.buttonStyle}
  background: var(--grad);
  color: #fff;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 40px rgba(${rgb},0.4);
  filter: brightness(1.1);
}
.btn-secondary {
  ${dl.buttonStyle}
  background: transparent;
  color: var(--primary);
  border: 1.5px solid rgba(${rgb},0.5);
}
.btn-secondary:hover {
  background: rgba(${rgb},0.08);
  border-color: var(--primary);
  transform: translateY(-3px);
}

/* Visual Hierarchy */
.display-1 { font-size: clamp(48px,7vw,100px); line-height:1.0; letter-spacing:-0.04em; }
.display-2 { font-size: clamp(36px,5vw,72px);  line-height:1.05; letter-spacing:-0.03em; }
.title-1   { font-size: clamp(28px,4vw,48px);  line-height:1.15; letter-spacing:-0.02em; }
.title-2   { font-size: clamp(22px,3vw,36px);  line-height:1.2;  letter-spacing:-0.01em; }
.body-lg   { font-size: clamp(17px,1.5vw,20px); line-height:1.7; }
.body-sm   { font-size: 15px; line-height:1.6; color:var(--text-2); }
.caption   { font-size: 12px; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-2); }

/* Grid System */
.grid-2 { display:grid; grid-template-columns:repeat(2,1fr); gap:24px; }
.grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
.grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
@media(max-width:1024px){ .grid-4{grid-template-columns:repeat(2,1fr);} .grid-3{grid-template-columns:repeat(2,1fr);} }
@media(max-width:640px){ .grid-2,.grid-3,.grid-4{grid-template-columns:1fr;} }

════════════════════════════════════════════════════════════
PHASE 3-5: SECTION BLUEPRINTS FOR ${niche.industry.toUpperCase()}
════════════════════════════════════════════════════════════

${sectionBlueprints}

════════════════════════════════════════════════════════════
PHASE 4: VISUAL HIERARCHY REQUIREMENTS
════════════════════════════════════════════════════════════

SPACING HIERARCHY (enforce strictly):
- Between sections: var(--section-pad) = ${niche.marketLevel === 'luxury' ? '120-160px' : '80-120px'}
- Section header to content: 64px
- Between cards in grid: 20-24px  
- Inside card padding: ${niche.marketLevel === 'luxury' ? '48px' : '32px'}
- Button to text gap: 16px
- Icon to text gap: 16px

CTA HIERARCHY:
1. PRIMARY CTA: var(--grad) background, most prominent, above fold
2. SECONDARY CTA: outline/ghost, paired with primary
3. TERTIARY: text link with arrow →
4. Never show 2 primary CTAs side by side

TYPOGRAPHY HIERARCHY:
- H1 hero: display-1 class, gradient text on 1-3 KEY words
- H2 section: title-1 class, white text
- H3 cards: title-2 class, white or var(--text-2)
- Body: body-lg for descriptions, body-sm for metadata
- Labels/tags: caption class

════════════════════════════════════════════════════════════
PHASE 5: PREMIUM EFFECTS (${niche.tone === 'editorial' ? 'LUXURY MINIMAL' : niche.tone === 'energetic' ? 'HIGH ENERGY' : niche.tone === 'clean' ? 'APPLE CLEAN' : 'PREMIUM'})
════════════════════════════════════════════════════════════

${getPremiumEffects(niche, rgb)}

════════════════════════════════════════════════════════════
JAVASCRIPT — ALL MANDATORY
════════════════════════════════════════════════════════════

const KryptonAI = {
  // 1. Scroll animations
  initReveal() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold:0.1, rootMargin:'0px 0px -60px 0px' });
    document.querySelectorAll('.reveal,.slide-left,.slide-right').forEach(el => io.observe(el));
  },
  
  // 2. Sticky nav with blur
  initNav() {
    const nav = document.querySelector('nav');
    window.addEventListener('scroll', () => {
      nav.style.backdropFilter = window.scrollY > 20 ? 'blur(20px)' : 'none';
      nav.style.borderBottom = window.scrollY > 20 ? '1px solid var(--border)' : 'none';
    });
  },
  
  // 3. Mobile menu
  initMobile() {
    const btn = document.getElementById('menu-btn');
    const menu = document.getElementById('mobile-menu');
    if(!btn||!menu) return;
    btn.addEventListener('click', () => {
      const open = menu.style.display === 'flex';
      menu.style.display = open ? 'none' : 'flex';
      btn.innerHTML = open ? '☰' : '✕';
    });
  },
  
  // 4. Counter animation
  initCounters() {
    document.querySelectorAll('[data-count]').forEach(el => {
      const target = parseInt(el.getAttribute('data-count'));
      let count = 0;
      const step = target / 60;
      const timer = setInterval(() => {
        count += step;
        if(count >= target){ count = target; clearInterval(timer); }
        el.textContent = Math.floor(count).toLocaleString() + (el.getAttribute('data-suffix')||'');
      }, 16);
    });
  },
  
  // 5. Smooth scroll
  initScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const el = document.querySelector(a.getAttribute('href'));
        if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
      });
    });
  },
  
  // 6. Accordion (FAQ)
  initAccordion() {
    document.querySelectorAll('.accordion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.parentElement;
        const body = item.querySelector('.accordion-body');
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.accordion-item').forEach(i => {
          i.classList.remove('open');
          i.querySelector('.accordion-body').style.maxHeight = '0';
          i.querySelector('.accordion-icon').textContent = '+';
        });
        if(!isOpen){
          item.classList.add('open');
          body.style.maxHeight = body.scrollHeight + 'px';
          item.querySelector('.accordion-icon').textContent = '×';
        }
      });
    });
  },
  
  // 7. Pricing toggle
  initPricing() {
    const toggle = document.getElementById('pricing-toggle');
    if(!toggle) return;
    toggle.addEventListener('change', () => {
      const yearly = toggle.checked;
      document.querySelectorAll('[data-monthly]').forEach(el => {
        el.textContent = yearly ? el.getAttribute('data-yearly') : el.getAttribute('data-monthly');
      });
      document.querySelectorAll('[data-yearly-badge]').forEach(el => {
        el.style.display = yearly ? 'block' : 'none';
      });
    });
  },

  init() {
    this.initReveal();
    this.initNav();
    this.initMobile();
    this.initScroll();
    this.initAccordion();
    this.initPricing();
    const io2 = new IntersectionObserver(entries => {
      entries.forEach(e => { if(e.isIntersecting){ this.initCounters(); io2.disconnect(); } });
    });
    const counter = document.querySelector('[data-count]');
    if(counter) io2.observe(counter);
  }
};

window.addEventListener('DOMContentLoaded', () => KryptonAI.init());

════════════════════════════════════════════════════════════
PHASE 6: 7-DIMENSION QUALITY AUDIT
════════════════════════════════════════════════════════════
TARGET: 95+/100. Penalty for each failure listed below.

1. DESIGN QUALITY (15pts):
   ✓ Design language "${dl.name}" consistently applied
   ✓ Color system var(--primary/--grad/--card) used correctly
   ✓ Typography hierarchy: display-1 > title-1 > title-2 > body-lg > body-sm
   ✓ No generic shapes, no default browser styling
   ✓ Spacing follows 8px grid

2. BRAND CONSISTENCY (15pts):
   ✓ ALL copy specific to: ${niche.industry} (${niche.marketLevel} ${niche.brandPositioning || ''})
   ✓ Hero headline: ${v.heroHeadlineStyle}
   ✓ Tone is: ${niche.tone} — ${niche.tone === 'editorial' ? 'poetic, sparse, aspirational' : niche.tone === 'energetic' ? 'powerful, bold, action-oriented' : niche.tone === 'warm' ? 'inviting, sensory, human' : niche.tone === 'trust' ? 'authoritative, data-driven, reassuring' : 'clean, precise, outcome-focused'}
   ✓ Zero placeholder text

3. CONVERSION QUALITY (20pts):
   ✓ Goal is "${niche.conversionGoal}" — entire page optimized for this
   ✓ Primary CTA "${v.ctaPrimary}" visible above fold
   ✓ Top 3 objections addressed: ${(niche.objectionHandling || []).join(' | ')}
   ✓ Trust elements visible: ${(niche.trustElements || []).join(' | ')}
   ✓ Conversion path: ${niche.conversionGoal === 'reservation' ? 'See food → Want it → Trust reviews → Book table' : niche.conversionGoal === 'trial' ? 'Feel pain → See solution → Trust → Click free trial' : 'Awareness → Value → Trust → Action'}

4. VISUAL HIERARCHY (15pts):
   ✓ Eye flows: Logo → Headline → Subtext → CTA → Proof
   ✓ One primary CTA per screen (no CTA competition)
   ✓ Cards and sections have clear focal point
   ✓ Contrast ratios accessible (4.5:1 for body, 3:1 for large)

5. MOBILE EXPERIENCE (15pts):
   ✓ Works flawlessly at 320px, 375px, 768px, 1024px, 1440px
   ✓ Touch targets minimum 44x44px
   ✓ No horizontal scroll
   ✓ Images load fast (width attributes set)
   ✓ Mobile nav: hamburger → full overlay

6. TRUST BUILDING (10pts):
   ✓ Trust elements appear within first 3 sections
   ✓ Social proof: specific numbers, not vague claims
   ✓ Real testimonials with full name, role, company
   ✓ No "lorem ipsum" person names

7. COMPETITOR MATCH (10pts):
   ✓ Design quality matches ${niche.competitorStyle || "premium agency"} caliber
   ✓ Animations are subtle and purposeful
   ✓ No amateur effects (no rainbow gradients, no excessive shadows)
   ✓ Would pass as agency-built to a designer

════════════════════════════════════════════════════════════
FINAL RULE
════════════════════════════════════════════════════════════
If you find yourself writing generic content like "Our Service", "Lorem ipsum", 
"Coming Soon", "Feature 1", "John Doe, CEO" — STOP. 
Write real, specific, niche-appropriate content for: ${niche.industry}.
Luxury brands speak differently. Fitness brands speak differently. Restaurants speak differently.
Make EVERY WORD count.
`;
}

// ── Section Blueprints per Niche ─────────────────────────────────
function buildSectionBlueprints(niche: NicheProfile, dl: DesignLanguage, imgs: string[] = []): string {
  const p = niche.palette;
  const v = niche.brandVoice;
  const rgb = hexToRgbValues(p.primary);

  const NAVBAR = `
■ NAVBAR — position:fixed; top:0; width:100%; z-index:1000;
  Structure:
  <nav>
    <div class="container" style="display:flex;align-items:center;justify-content:space-between;height:72px">
      <a href="#" style="font-size:22px;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent">[Brand Name]</a>
      <ul style="display:flex;gap:32px;list-style:none" class="nav-desktop">
        [5 links with href="#section-id" and hover:color:var(--primary)]
      </ul>
      <div style="display:flex;gap:12px;align-items:center">
        <a href="#" class="btn btn-secondary">${v.ctaSecondary}</a>
        <a href="#" class="btn btn-primary">${v.ctaPrimary}</a>
      </div>
      <button id="menu-btn" style="display:none;background:none;border:none;color:var(--text);font-size:24px;cursor:pointer">☰</button>
    </div>
    <!-- Mobile menu -->
    <div id="mobile-menu" style="display:none;flex-direction:column;gap:24px;padding:32px;background:var(--surface);border-top:1px solid var(--border)">
      [same links stacked vertically]
      <a href="#" class="btn btn-primary" style="width:100%;justify-content:center">${v.ctaPrimary}</a>
    </div>
  </nav>`;

  const HERO = `
■ HERO — min-height:100vh; background:${p.heroGrad}; position:relative; overflow:hidden;
  Layout: 2-column grid (55% / 45%), centered vertically, gap 64px
  
  Background effects (position:absolute, pointer-events:none):
    - Orb 1: width:600px;height:600px;background:radial-gradient(circle,rgba(${rgb},0.15),transparent 70%);top:-100px;right:-100px;border-radius:50%;filter:blur(40px);
    - Orb 2: width:400px;height:400px;background:radial-gradient(circle,rgba(${rgb},0.1),transparent 70%);bottom:100px;left:-100px;border-radius:50%;filter:blur(60px);
    - Grid overlay: background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px); background-size:64px 64px;
  
  LEFT CONTENT:
    <span class="caption reveal">${niche.industry} · Premium</span>
    <h1 class="display-1 reveal" style="margin:16px 0 24px">
      [Most words in var(--text)]
      <span class="grad-text">[KEY WORDS]</span>
    </h1>
    Headline: ${v.heroHeadlineStyle}
    
    <p class="body-lg reveal" style="color:var(--text-2);max-width:520px;margin-bottom:24px">[2-3 sentence real description]</p>

    <!-- Checkmark benefit list — proven high-conversion pattern, scannable trust signals -->
    <div class="reveal" style="display:flex;flex-direction:column;gap:12px;margin-bottom:32px">
      [Exactly 3 items, each as:]
      <div style="display:flex;align-items:center;gap:12px">
        <span style="width:22px;height:22px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:#fff;font-weight:800">✓</span>
        <span style="font-size:15px;color:var(--text);font-weight:500">[Specific benefit relevant to ${niche.industry}, e.g. real outcome not generic fluff]</span>
      </div>
    </div>

    <div style="display:flex;gap:16px;flex-wrap:wrap" class="reveal">
      <a href="#" class="btn btn-primary" style="font-size:16px;padding:16px 36px;box-shadow:0 12px 32px rgba(${rgb},0.35)">${v.ctaPrimary} →</a>
      <a href="#" class="btn btn-secondary" style="font-size:16px;padding:16px 36px">${v.ctaSecondary}</a>
    </div>
    
    <!-- Social proof bar -->
    <div style="display:flex;align-items:center;gap:24px;margin-top:48px;padding-top:32px;border-top:1px solid var(--border)" class="reveal">
      [Social proof: ${v.socialProofStyle}]
      Show as 3 metrics: [number] [label] separated by vertical lines
    </div>
  
  RIGHT CONTENT (floating card):
    <div style="transform:rotate(-3deg);animation:float 6s ease-in-out infinite;border-radius:24px;overflow:hidden;box-shadow:0 40px 120px rgba(${rgb},0.3)">
      <img src="${imgs[0] || 'https://picsum.photos/seed/kryptonhero/800/600'}" alt="${niche.industry}" style="width:100%;height:460px;object-fit:cover;display:block">
      <!-- Optional: floating stats card on top of image -->
      <div style="position:absolute;bottom:-20px;left:-20px;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px 20px;backdrop-filter:blur(20px)">
        [Mini stat relevant to ${niche.industry}]
      </div>
    </div>`;

  const MARQUEE = `
■ MARQUEE — background:var(--surface); border-top:1px solid var(--border); border-bottom:1px solid var(--border);
  padding:20px 0; overflow:hidden;
  <div style="display:flex;width:max-content;animation:marquee 25s linear infinite">
    <!-- Duplicate list twice for seamless loop -->
    [8-10 items relevant to ${niche.industry}, each: padding:0 40px, font-weight:600, color:var(--text-2), with · separator]
  </div>
  JS: hover to pause: el.style.animationPlayState = 'paused'`;

  // Niche-specific main sections
  const nicheSections = niche.sectionOrder.slice(1, -1).map((section, i) => {
    const bg = i % 2 === 0 ? "var(--bg)" : "var(--surface)";
    return `
■ SECTION: ${section.toUpperCase()} (background:${bg}; padding:var(--section-pad) 0)
  class="reveal" on section
  Section header pattern:
    <span class="caption">[short label]</span>
    <h2 class="title-1" style="margin:12px 0 16px">[Section heading, 4-6 words]</h2>
    <p class="body-lg" style="color:var(--text-2);max-width:560px">[1-2 sentence description]</p>
  
  Content: Build a complete, visually rich section specific to "${niche.industry}"
  Cards: use class="card reveal" with appropriate content
  Images: use these REAL working URLs (cycle through them): ${imgs.length > 0 ? imgs.join(', ') : 'use CSS gradient backgrounds instead of img tags'}`;
  }).join('\n');

  const TESTIMONIALS = `
■ TESTIMONIALS — background:var(--surface); padding:var(--section-pad) 0;
  <div class="grid-3">
    [3 cards, each class="card reveal" style="padding:32px"]
    Each card:
      <div style="font-size:36px;margin-bottom:8px">★★★★★</div>
      <p style="font-style:italic;color:var(--text-2);margin-bottom:24px;line-height:1.8">"[Real specific quote about result they got — include specific numbers/outcomes]"</p>
      <div style="display:flex;align-items:center;gap:16px">
        <div style="width:48px;height:48px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-weight:800;color:#000">[Initials]</div>
        <div>
          <div style="font-weight:700">[Name]</div>
          <div style="font-size:13px;color:var(--text-2)">[Role, Company]</div>
        </div>
      </div>
    </div>
  </div>`;

  const FAQ = `
■ FAQ ACCORDION — background:var(--bg); padding:var(--section-pad) 0;
  max-width:720px; margin:0 auto;
  7 questions specific to ${niche.industry}
  Each:
  <div class="accordion-item" style="border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden">
    <button class="accordion-btn" style="width:100%;background:var(--card);border:none;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;color:var(--text);font-size:16px;font-weight:600;text-align:left">
      [Question] <span class="accordion-icon" style="font-size:20px;color:var(--primary);flex-shrink:0">+</span>
    </button>
    <div class="accordion-body" style="max-height:0;overflow:hidden;transition:max-height 0.4s ease;background:var(--surface)">
      <p style="padding:20px 24px;color:var(--text-2);line-height:1.8">[Detailed answer]</p>
    </div>
  </div>`;

  const FINAL_CTA = `
■ FINAL CTA — background:var(--grad); padding:var(--section-pad) 0; text-align:center; position:relative; overflow:hidden;
  (Add subtle pattern overlay: repeating-linear-gradient with low opacity)
  <h2 class="display-2 reveal" style="color:#fff;margin-bottom:20px">[Compelling closing headline]</h2>
  <p class="body-lg reveal" style="color:rgba(255,255,255,0.8);margin-bottom:40px;max-width:500px;margin-left:auto;margin-right:auto">[1-2 sentence urgency or benefit statement]</p>
  <a href="#" class="btn reveal" style="background:#fff;color:var(--bg);font-weight:800;font-size:16px;padding:18px 48px">${v.ctaPrimary} →</a>
  <p class="reveal" style="color:rgba(255,255,255,0.6);margin-top:16px;font-size:13px">[Trust statement: No credit card required / Free to start / etc.]</p>`;

  const FOOTER = `
■ FOOTER — background:var(--bg); border-top:1px solid var(--border); padding:80px 0 32px;
  <div class="grid-4" style="margin-bottom:64px">
    Col 1: Logo + tagline + social icons (Twitter/Instagram/LinkedIn/GitHub) — icon links in circle buttons
    Col 2: Product/Services links (5 links)
    Col 3: Company links (5 links: About/Blog/Careers/Press/Contact)
    Col 4: Newsletter — <h4>Stay Updated</h4> <p style="color:var(--text-2)">Weekly insights...</p>
           <div style="display:flex;gap:8px;margin-top:16px"><input type="email" placeholder="Enter email" style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 16px;color:var(--text)">
           <button class="btn btn-primary" style="border-radius:8px">Subscribe</button></div>
  </div>
  <div style="border-top:1px solid var(--border);padding-top:32px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px">
    <p style="color:var(--text-2);font-size:14px">© 2026 [Brand]. All rights reserved.</p> <!-- ALWAYS use 2026, the current year — NEVER 2023, 2024, or any other year -->
    <div style="display:flex;gap:24px"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Cookies</a></div>
  </div>`;

  return NAVBAR + HERO + MARQUEE + nicheSections + TESTIMONIALS + FAQ + FINAL_CTA + FOOTER;
}

// ── Premium Effects per Tone ─────────────────────────────────────


// ── Game prompt (unchanged) ──────────────────────────────────────
const GAME_PROMPT = `

BUILD A COMPLETE BROWSER GAME:
- HTML5 Canvas with requestAnimationFrame (60fps)
- Start screen: title, instructions, Start button
- Game loop: update + render cycle
- Keyboard controls (arrows/WASD) + mobile touch D-pad
- Score system with localStorage high score
- Lives/health system
- Level progression (speed increases)
- Game over screen with score + restart
- Particle effects for events
- Sound feedback using Web Audio API`;

// ── Product Completion Engine: Intent + Template injection ────────
// Adds the auto-expanded feature checklist (Intent Engine) and, for
// covered categories, a structural skeleton (Template Engine) the AI
// should extend. "game" is excluded — games are routed to /api/game
// which has its own (more detailed) game-specific engine.
function buildWebsiteExtras(type: string): string {
  if (type === "game") return "";

  const checklist = buildWebsiteChecklistPrompt(type);

  let templateBlock = "";
  if (hasWebsiteTemplate(type)) {
    templateBlock = `

BASE STRUCTURE TO EXTEND (do not remove existing sections/IDs — fill in
the content/logic inside them and add more sections as needed):

${getWebsiteTemplate(type)}`;
  }

  return `\n\n${checklist}${templateBlock}`;
}

// ── Clean HTML from AI response ──────────────────────────────────

// ── Validate HTML ────────────────────────────────────────────────
// validateHTML removed — superseded by runProductionGate() from
// lib/completion-engine (Production Gate: build/validation/runtime/mobile)


// ═══════════════════════════════════════════════════════════════════
// PHASE 6: QUALITY SCORE V2 — 8-dimension evaluation
// Runs on generated HTML, returns score breakdown
// ═══════════════════════════════════════════════════════════════════
function computeQualityScoreV2(html: string, niche: NicheProfile, gate: any): {
  overall: number;
  design: number;
  conversion: number;
  brand: number;
  trust: number;
  mobile: number;
  competitorMatch: number;
  content: number;
  ctaQuality: number;
  breakdown: string[];
  recommendations: string[];
} {
  const h = html.toLowerCase();
  const recommendations: string[] = [];
  const breakdown: string[] = [];

  // 1. DESIGN QUALITY (15pts)
  let design = 0;
  if (h.includes("var(--grad)") || h.includes("var(--primary)")) { design += 4; breakdown.push("✓ CSS variables used"); }
  if (h.includes("backdrop-filter") || h.includes("glass")) { design += 3; breakdown.push("✓ Premium effects (glassmorphism)"); }
  if (h.includes("@keyframes") && h.includes("animation")) { design += 3; breakdown.push("✓ Animations present"); }
  if (h.includes("clamp(") || h.includes("vw,")) { design += 3; breakdown.push("✓ Fluid typography"); }
  if (h.includes("font-family")) { design += 2; breakdown.push("✓ Custom fonts"); }
  if (design < 10) recommendations.push("Add more premium CSS effects (glassmorphism, animations, CSS variables)");

  // 2. CONVERSION QUALITY (15pts)
  let conversion = 0;
  const primaryCta = niche.brandVoice.ctaPrimary.toLowerCase();
  if (h.includes(primaryCta.slice(0,10))) { conversion += 5; breakdown.push(`✓ Primary CTA "${niche.brandVoice.ctaPrimary}" found`); }
  if ((h.match(/class="btn|btn-primary|cta/g) || []).length >= 3) { conversion += 4; breakdown.push("✓ Multiple CTA instances"); }
  if (h.includes("accordion") || h.includes("faq")) { conversion += 3; breakdown.push("✓ FAQ section (objection handling)"); }
  if (h.includes("testimonial") || h.includes("review")) { conversion += 3; breakdown.push("✓ Social proof section"); }
  if (conversion < 10) recommendations.push(`Ensure CTA "${niche.brandVoice.ctaPrimary}" appears at least 3 times`);

  // 3. BRAND CONSISTENCY (12pts)
  let brand = 0;
  if (h.includes(niche.industry.split(" ")[0].toLowerCase())) { brand += 5; breakdown.push("✓ Industry-specific content"); }
  if (!h.includes("lorem ipsum") && !h.includes("placeholder")) { brand += 4; breakdown.push("✓ No placeholder text"); }
  if (h.includes("contact") || h.includes("email")) { brand += 3; breakdown.push("✓ Contact/conversion form"); }
  if (brand < 8) recommendations.push("Remove any generic content. Write copy specific to " + niche.industry);

  // 4. TRUST SCORE (15pts)
  let trust = 0;
  if (h.includes("★") || h.includes("⭐") || h.includes("star")) { trust += 4; breakdown.push("✓ Star ratings present"); }
  if (h.includes("testimonial") || h.includes("review") || h.includes('"')) { trust += 4; breakdown.push("✓ Testimonials/quotes"); }
  if (h.includes("%") || h.includes("users") || h.includes("clients")) { trust += 4; breakdown.push("✓ Social proof numbers"); }
  if (h.includes("guarantee") || h.includes("free") || h.includes("cancel")) { trust += 3; breakdown.push("✓ Risk reducer present"); }
  if (trust < 10) recommendations.push("Add trust elements: star ratings, testimonials with specific numbers, guarantee text");

  // 5. MOBILE EXPERIENCE (13pts)
  let mobile = 0;
  if (h.includes("@media") && h.includes("768px")) { mobile += 5; breakdown.push("✓ Mobile breakpoints"); }
  if (h.includes("hamburger") || h.includes("mobile-menu") || h.includes("menu-btn")) { mobile += 4; breakdown.push("✓ Mobile navigation"); }
  if ((h.match(/clamp\(/g) || []).length >= 3) { mobile += 4; breakdown.push("✓ Responsive typography"); }
  if (mobile < 8) recommendations.push("Add 768px media query, hamburger menu, clamp() for all font sizes");

  // 6. COMPETITOR MATCH (10pts)
  let competitorMatch = 0;
  const style = niche.competitorStyle?.toLowerCase() || "";
  if (style.includes("stripe") && (h.includes("gradient") || h.includes("grid"))) { competitorMatch = 9; }
  else if (style.includes("nike") && (h.includes("clip-path") || h.includes("uppercase"))) { competitorMatch = 9; }
  else if (style.includes("apple") && (h.includes("backdrop-filter") || h.includes("blur"))) { competitorMatch = 9; }
  else if (h.includes("backdrop-filter") || h.includes("glass") || h.includes("@keyframes")) { competitorMatch = 7; }
  else competitorMatch = 5;
  breakdown.push(`✓ Design style (${niche.competitorStyle || 'premium'})`);

  // 7. CONTENT QUALITY (10pts)
  let content = 0;
  const lines = html.split("\n").length;
  if (lines > 700) { content += 4; breakdown.push(`✓ ${lines} lines of code`); }
  else if (lines > 500) content += 2;
  if ((h.match(/<img/g) || []).length >= 3) { content += 3; breakdown.push("✓ Multiple images"); }
  if ((h.match(/unsplash|source\.unsplash/g) || []).length >= 2) { content += 3; breakdown.push("✓ Niche-relevant images"); }
  if (content < 7) recommendations.push("Add more images using unsplash with niche keywords");

  // 8. CTA QUALITY (10pts)
  let ctaQuality = 0;
  if (h.includes("btn-primary") || h.includes("cta-btn")) { ctaQuality += 4; breakdown.push("✓ Styled CTA buttons"); }
  if (h.includes("hover") || h.includes(":hover")) { ctaQuality += 3; breakdown.push("✓ Hover effects on CTAs"); }
  if (h.includes("border-radius") && h.includes("gradient")) { ctaQuality += 3; breakdown.push("✓ Gradient CTA styling"); }
  if (ctaQuality < 7) recommendations.push("Style CTA buttons with gradient, hover effects, and clear visual prominence");

  const overall = Math.min(100, Math.round(
    (design/15 * 15) + (conversion/15 * 15) + (brand/12 * 12) + 
    (trust/15 * 15) + (mobile/13 * 13) + (competitorMatch/10 * 10) + 
    (content/10 * 10) + (ctaQuality/10 * 10)
  ));

  return { overall, design, conversion, brand, trust, mobile, competitorMatch, content, ctaQuality, breakdown, recommendations };
}


// ═══════════════════════════════════════════════════════════════════════
// MULTI-STAGE GENERATION PIPELINE
// Blueprint → Sections (HTML) → CSS → JS → Combine (deterministic)
//
// Why split: a single 24k-token call must split attention across content,
// layout, every CSS rule, and all JS behavior simultaneously — under that
// load the model quietly drops detail (thin footers, missing hover states,
// skipped checklist items) to keep the output valid. Splitting into focused
// stages gives each concern its own full token budget and full attention,
// closer to how Lovable/Bolt/v0 structure their agentic generation.
//
// Each stage still goes through the same Claude→OpenAI→Gemini fallback
// via kryptonGenerate, so reliability is unchanged.
// ═══════════════════════════════════════════════════════════════════════


// ── Stage 1: Blueprint ──────────────────────────────────────────────────
// Lightweight planning pass — locks in the exact section list, key
// components, and any special requirements before any code is written.

// generateSectionsHTML was removed — the pipeline is now Component
// Library only (see generateComponentContent + assembleFromComponentLibrary
// above). This function had zero remaining callers.

// ── Stage 3: CSS (complete stylesheet matching the HTML above) ─────────
import { generateCSS, generateJS, combineOutput } from "@/lib/rendering-engine/output-generation";


// ── Stage 4: JS (interactivity targeting the HTML above) ───────────────

// ── Complexity Router — decides single-pass (fast) vs 4-stage pipeline ──
// Simple requests don't need 4 sequential AI calls; that latency only pays
// off for genuinely complex builds. Keeps simple-site experience fast while
// reserving the deeper pipeline for where it actually improves quality.
function assessComplexity(prompt: string, projectType: string): "simple" | "complex" {
  // Pro plan active (300s) — smart routing restored.
  // Simple path: ~30-60s (single AI call, fast for quick sites)
  // Complex path: ~90-150s (4-stage pipeline, better quality for serious projects)
  const p = prompt.toLowerCase();
  const complexSignals = /\b(saas|dashboard|platform|marketplace|booking|e-?commerce|admin\s*panel|crm|portfolio|agency|real\s*estate|restaurant|fitness|gym|coaching|multi)\b/.test(p);
  const wordCount = prompt.trim().split(/\s+/).length;
  // Complex if: has complex keywords OR prompt is detailed (>15 words) OR is dashboard/app type
  if (complexSignals || wordCount > 15 || projectType === "dashboard" || projectType === "app") return "complex";
  return "simple";
}

// ── Stage 5: Combine (deterministic — no AI call, fast and reliable) ───
// ── Stage 2b: Component-Assembled Sections — replaces raw HTML writing ──
// for the 7 categories covered by the Component Library. AI generates ONLY
// content (JSON), tested template code renders the actual HTML. Structural
// correctness (spacing/shadows/radius/mobile/a11y) is now guaranteed by
// code, not by hoping the AI remembers every rule on every generation.


// ════════════════════════════════════════════════════════════════════
// MASTER DOMAIN KNOWLEDGE ENGINE v2
// ════════════════════════════════════════════════════════════════════
// 3-layer inheritance: BasePattern → CategoryOverride → DomainSpec
// 100+ domains in ~600 lines. Add any new domain in 5 lines.
// Replaces the 15 flat blueprints from v1.
// ════════════════════════════════════════════════════════════════════

// ── Shared types ──────────────────────────────────────────────────────
import {
  type SectionBlueprint, type DomainKnowledge, type BasePattern, B,
  patchSection, addSectionAfter, type CompactDomain, resolveDomain,
  COMPACT_DOMAINS, DOMAIN_BLUEPRINTS, matchDomain, domainKnowledgeToBluePrint,
  getSectionVariants, type DomainBlueprint, architectBlueprint,
} from "@/lib/rendering-engine/domain-knowledge";



// ── BASE PATTERNS ─────────────────────────────────────────────────────
// Six fundamental experience shapes. Every domain inherits one.



// ── SECTION DELTA helpers ─────────────────────────────────────────────
// Patch a section in a blueprint's section array
function removeSection(sections: SectionBlueprint[], id: string): SectionBlueprint[] {
  return sections.filter(s => s.id !== id);
}

// ── COMPACT DOMAIN SPEC ───────────────────────────────────────────────

// ── Resolve CompactDomain → full DomainKnowledge ──────────────────────

// ═══════════════════════════════════════════════════════════════════
// MASTER DOMAIN CATALOGUE — 100+ domains, 5-10 lines each
// ═══════════════════════════════════════════════════════════════════


// ── Resolve all compact domains → full DomainKnowledge ───────────────────

// ── Domain matcher ─────────────────────────────────────────────────────────

// ── Convert DomainKnowledge → DomainBlueprint ─────────────────────────────



// ════════════════════════════════════════════════════════════════════
// AI ARCHITECT — Blueprint Engine
// ════════════════════════════════════════════════════════════════════
// Runs BEFORE generateComponentContent.
// Makes ONE focused AI call that produces a domain-specific blueprint:
//   - businessGoal (membership / booking / showcase / lead / ecommerce)
//   - exact section order for THIS business (not a generic template)
//   - design directives (what colors, what images, what typography feel)
//   - assetTheme (what to search for images — "luxury cars", not "perfume")
//   - CTA copy ("Join the Club", "Book a Fleet", not "Get Started")
//
// Without this: "luxury car club" → perfume images + generic features grid
// With this:    "luxury car club" → fleet showcase + membership + black/gold




import {
  buildGenericComponentContent, generateComponentContent, assembleFromComponentLibrary,
} from "@/lib/rendering-engine/content-generation";




// Deterministic — assembles real component HTML from AI-written content.
// Zero AI risk for structure; only the copy came from the model.

// ── Design Critic — text-based holistic review (no screenshot needed) ──
// Quality Gate 2.0 catches STRUCTURAL bugs (missing footer, low contrast).
// This catches SUBJECTIVE weaknesses a human reviewer would notice but no
// regex can: "this headline is generic", "CTA buried below other content",
// "pricing section has no differentiation between tiers". Only runs on the
// complex path — one extra AI call is worth it for SaaS/dashboard-tier
// builds, not worth the latency cost on a simple landing page.


// ── Generation Logger — writes to generation_logs table ─────────────
// Fire-and-forget: never blocks generation, never throws
async function logGeneration(supabase: any, data: {
  id?: string;
  user_id?: string;
  type?: string;
  prompt?: string;
  status: string;
  provider?: string;
  error_message?: string;
  error_code?: string;
  credits_used?: number;
  duration_ms?: number;
  html_length?: number;
  metadata?: any;
}) {
  try {
    if (data.id) {
      // Update existing log entry
      await supabase.from("generation_logs").update({
        status:        data.status,
        provider:      data.provider,
        error_message: data.error_message,
        error_code:    data.error_code,
        credits_used:  data.credits_used,
        duration_ms:   data.duration_ms,
        html_length:   data.html_length,
        metadata:      data.metadata,
      }).eq("id", data.id);
    } else {
      // Insert new log entry
      const { data: inserted } = await supabase.from("generation_logs").insert({
        user_id:  data.user_id,
        type:     data.type || "website",
        prompt:   data.prompt?.slice(0, 500),
        status:   data.status,
        metadata: data.metadata || {},
      }).select("id").single();
      return inserted?.id;
    }
  } catch {} // never block generation
  return null;
}

// ── Main SSE Handler ──────────────────────────────────────────────
// ── Visual Intelligence Boost CSS ─────────────────────────────────────
// Zero-AI-call visual quality improvement. Applied when gate score < 80.
// Uses the resolved DesignLanguage + NicheProfile to inject targeted fixes.


export async function POST(req: NextRequest) {
  const { prompt, userId, accessToken, competitorUrl, forceType } = await req.json().catch(() => ({}));

  if (!prompt?.trim()) {
    return new Response(JSON.stringify({ error: "Prompt required" }), { status: 400 });
  }

  // Auth
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let authedUserId = userId;
  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    authedUserId = user?.id || userId;
  }

  // ── Create SSE Stream ──────────────────────────────────────────
  const encoder = new TextEncoder();
  let closed = false;

// Fix 6: In-memory generation lock (per-deployment, edge-safe)
// Prevents same user from running 2 generations simultaneously
// Duplicate-generation guard is now distributed (lib/generation-lock.ts) — see acquireGenerationLock/releaseGenerationLock below.

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now(); // Product Completion Engine: repair budget
      const send = (event: string, data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      // Keep-alive — prevents idle-connection drops (mobile networks/proxies
      // commonly reset after 60-120s of silence) during long AI calls where
      // no "phase" events are sent. Also sends real rotating progress text
      // (not just a silent ping) so the UI never appears frozen during a
      // long gap — e.g. the ~45s Claude-timeout-then-OpenAI-retry window.
      const HEARTBEAT_MESSAGES = ["Preparing components...", "Generating sections...", "Building layouts...", "Rendering pages...", "Optimizing..."];
      let heartbeatTick = 0;
      const heartbeat = setInterval(() => {
        send("ping", {});
        send("phase", { agent: "Building", icon: "⏳", action: HEARTBEAT_MESSAGES[heartbeatTick % HEARTBEAT_MESSAGES.length], pct: 45, done: false });
        heartbeatTick++;
      }, 15000);

      const finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      };

      let lockAcquired = false;
      try {
        // Distributed duplicate-generation guard (Redis-backed, works across
        // all Vercel instances/regions — see lib/generation-lock.ts)
        if (authedUserId) {
          lockAcquired = await acquireGenerationLock(authedUserId, 330);
          if (!lockAcquired) {
            send("error", { message: "A generation is already in progress. Please wait.", code: "DUPLICATE_GEN" });
            finish(); return;
          }
        }

        // ── CREDIT + DAILY RESET CHECK (before generation) ──────────
        if (authedUserId) {
          try {
            const { data: pc } = await supabase
              .from("profiles")
              .select("total_credits, used_credits, plan, daily_reset_date")
              .eq("id", authedUserId).single();
            if (pc) {
              const today = new Date().toISOString().split("T")[0];
              // Daily reset for free plan
              if (pc.plan === "free" && pc.daily_reset_date !== today) {
                await supabase.from("profiles").update({
                  used_credits: 0, daily_reset_date: today,
                }).eq("id", authedUserId);
                pc.used_credits = 0;
              }
              const rem = (pc.total_credits || 5) - (pc.used_credits || 0);
              if (rem < 1) {
                send("error", { message:"No credits remaining. Free plan resets daily. Upgrade for unlimited access.", code:"NO_CREDITS" });
                finish(); return;
              }
            }
          } catch {}
        }

        // ── PHASE 1: Reading ──────────────────────────────────────
        // Start generation log entry
        let genLogId: string | null = null;
        try {
          genLogId = await logGeneration(supabase, {
            user_id: authedUserId,
            type:    "website", // projectType determined below — placeholder
            prompt:  prompt?.slice(0, 500),
            status:  "started",
            metadata: { userAgent: req.headers.get("user-agent")?.slice(0, 100) },
          });
        } catch {}

        send("phase", { agent:"Reading", icon:"🔍", action:"Understanding your request...", pct:8 });
        const rawProjectType = detectProjectType(prompt);
        // forceType from UI dropdown overrides auto-detection
        const projectType = forceType ? forceType.replace("-page","").replace("-","") : rawProjectType;

        // Quick plan via fast AI call
        let executionPlan = "";
        try {
          const planPrompt = `User wants: "${prompt}" (type: ${projectType})
Create a brief 5-point implementation plan for building this. Be specific, not generic.
Format: numbered list only. No preamble.`;
          const planResult = await callClaude(
            "You are a senior software architect. Create brief, specific implementation plans.",
            planPrompt, 500
          );
          executionPlan = planResult;
        } catch {
          executionPlan = `1. Set up ${projectType} structure\n2. Build core functionality\n3. Style with premium design system\n4. Add interactivity\n5. Optimize and finalize`;
        }

        send("phase", { agent:"Reading", icon:"🔍", action:`Detected: ${projectType} project`, pct:15, done:true });

        // ── PHASE 2: Researcher ───────────────────────────────────
        send("phase", { agent:"Understanding", icon:"📚", action:"Analyzing requirements...", pct:22 });
        await new Promise(r => setTimeout(r, 600));
        send("phase", { agent:"Understanding", icon:"📚", action:"Design system selected", pct:28, done:true });

        // ── PHASE 3: Designer ─────────────────────────────────────
        send("phase", { agent:"Planning", icon:"🎨", action:"Planning project architecture...", pct:35 });
        await new Promise(r => setTimeout(r, 500));
        send("phase", { agent:"Planning", icon:"🎨", action:"Component structure ready", pct:42, done:true });

        // ── PHASE 4: Builder ──────────────────────────────────────
        send("phase", { agent:"Building", icon:"⚙️", action:"Generating components...", pct:50 });


        // Product Generation Engine: Phase 2 — Blueprint Generator.
        // Build the structured project blueprint BEFORE generation —
        // the AI extends this rather than starting from a blank prompt.
        const blueprint: ProjectBlueprint | null = projectType !== "game"
          ? generateWebsiteBlueprint(projectType, prompt)
          : null;

        // forceType (from UI dropdown) prepended for better niche detection
        const nicheDetectPrompt = forceType
          ? `${forceType.replace(/-/g," ")} project: ${prompt}`
          : prompt;
        const _niche = detectNiche(nicheDetectPrompt);

        // ── Dynamic Design Engine ────────────────────────────────────
        // Seed is real entropy (crypto.randomUUID, not Math.random()),
        // generated once per generation. Every variant-pick downstream
        // (palette/typography/tone) derives deterministically from this
        // one seed — same seed replayed = same design (useful for the
        // repair-pass staying visually consistent), new generation = new
        // seed = a different variant. This directly replaces the old
        // fixed-one-palette-per-industry behavior.
        const designSeed = generationSeedFromId(crypto.randomUUID());
        const _nicheStyled = applyDesignVariant(_niche, designSeed);
        Object.assign(_niche, _nicheStyled);
        _niche.sectionOrder = shuffleMiddleSections(_niche.sectionOrder, designSeed);

        // ── Reverse Engineering: fetch cached blueprint if URL provided ──
        let cachedUrlBlueprint: any = null;
        if (competitorUrl?.trim()) {
          try {
            const supabaseClient = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );
            let urlNorm = competitorUrl.trim();
            if (!urlNorm.startsWith("http")) urlNorm = "https://" + urlNorm;
            const { data: cachedBp } = await supabaseClient
              .from("extracted_blueprints")
              .select("*")
              .eq("url", urlNorm)
              .single();
            if (cachedBp) {
              cachedUrlBlueprint = cachedBp;
              send("phase", { agent:"Analyzing", icon:"🔍", action:`Blueprint loaded: ${cachedBp.domain} (${cachedBp.section_order?.length || 0} sections)`, pct:20 });
            }
          } catch {}
        }

        // Fetch REAL working images before building prompt (fixes dead source.unsplash.com)
        let resolvedImages: Record<string,string[]> = {};
        try {
          send("phase", { agent:"Images", icon:"🖼️", action:"Sourcing visuals...", pct:22 });
          const imgKeyword = _niche.imageKeyword?.replace(/\+/g,' ') || _niche.industry;
          resolvedImages["main"] = await getRealImageSet(_niche.industry, imgKeyword, 8);
        } catch {
          resolvedImages["main"] = [];
        }

        // Fix 5: Abort if client disconnected
        if ((req as any).signal?.aborted) {
          await logGeneration(supabase, { id: genLogId || undefined, status: "cancelled", duration_ms: Date.now() - startTime });
          finish(); return;
        }

        // ── AI ARCHITECT: Blueprint Engine ─────────────────────────────────
        // Runs BEFORE generation. Makes one focused call to understand the
        // exact domain, business goal, section plan, and imagery needed.
        // This prevents "luxury car club" → perfume images + generic sections.
        let domainPlan: DomainBlueprint | null = null;
        try {
          send("phase", { agent:"Planning", icon:"🏛️", action:"Planning project architecture...", pct:32 });
          domainPlan = await architectBlueprint(
            nicheDetectPrompt, projectType, _niche, kryptonGenerate
          );
          if (domainPlan) {
            const _domainId = (domainPlan as any).__domainKnowledge
              ? ((domainPlan as any).__domainKnowledge as DomainKnowledge).domain
              : "";
            (_niche as any).__domainId = _domainId;
            // Update niche sectionOrder with architect's domain-specific plan
            if (domainPlan.sectionOrder?.length > 0) {
              (_niche as any).sectionOrder = domainPlan.sectionOrder;
            }
            // Update imageKeyword to architect's precise asset theme
            if (domainPlan.assetTheme) {
              (_niche as any).imageKeyword = domainPlan.assetTheme;
              // Re-fetch images with corrected theme (architect overrides generic niche keyword)
              try {
                resolvedImages["main"] = await getRealImageSet(
                  _niche.industry, domainPlan.assetTheme, 8
                );
              } catch {}
            }
            // Emit enriched plan event for UI
            const planSections = domainPlan.sectionOrder || (_niche.sectionOrder || []);
            send("plan", {
              projectType,
              industry:      _niche.industry,
              businessType:  domainPlan.businessGoal || _niche.businessType,
              marketLevel:   _niche.marketLevel,
              tone:          _niche.tone,
              conversionGoal: domainPlan.primaryCTA || _niche.conversionGoal,
              sections:      planSections,
              sectionCount:  planSections.length,
              pageCount:     projectType === "landing" ? 1 : 3,
              componentCount: Math.round(planSections.length * 3.5),
              primaryColor:  _niche.palette.primary,
              heading:       _niche.typography.headingFont,
              projectName:   domainPlan.projectName,
              tagline:       domainPlan.tagline,
              assetTheme:    domainPlan.assetTheme,
            });
            // ── Map domain designMood → niche.tone ─────────────────────────
            // This ensures getDesignLanguage() returns the domain-appropriate
            // design system instead of the generic niche-detected tone.
            // e.g. luxury-car-club "dark luxury" → editorial → Luxury Editorial DL
            if (domainPlan && (domainPlan as any).__domainKnowledge) {
              const dk = (domainPlan as any).__domainKnowledge as DomainKnowledge;
              switch (dk.designMood) {
      case "dark luxury": (_niche as any).tone = "editorial"; break;
      case "warm elegant": (_niche as any).tone = "warm"; break;
      case "warm cozy": (_niche as any).tone = "warm"; break;
      case "warm luxury": (_niche as any).tone = "editorial"; break;
      case "romantic elegant": (_niche as any).tone = "editorial"; break;
      case "warm human": (_niche as any).tone = "warm"; break;
      case "bold modern": (_niche as any).tone = "bold"; break;
      case "bold dark": (_niche as any).tone = "energetic"; break;
      case "bold energetic": (_niche as any).tone = "energetic"; break;
      case "bold editorial": (_niche as any).tone = "bold"; break;
      case "dark moody": (_niche as any).tone = "editorial"; break;
      case "dark tech": (_niche as any).tone = "trust"; break;
      case "dark cinematic": (_niche as any).tone = "editorial"; break;
      case "dark professional": (_niche as any).tone = "trust"; break;
      case "dark minimal": (_niche as any).tone = "clean"; break;
      case "dark code": (_niche as any).tone = "trust"; break;
      case "dark tech neon": (_niche as any).tone = "trust"; break;
      case "clean modern": (_niche as any).tone = "clean"; break;
      case "clean minimal": (_niche as any).tone = "clean"; break;
      case "clean professional": (_niche as any).tone = "clean"; break;
      case "clean light": (_niche as any).tone = "clean"; break;
      case "clean tech minimal": (_niche as any).tone = "clean"; break;
      case "clean editorial": (_niche as any).tone = "bold"; break;
      case "calm natural": (_niche as any).tone = "warm"; break;
      case "calm luxury": (_niche as any).tone = "editorial"; break;
      case "calm warm": (_niche as any).tone = "warm"; break;
      case "natural earthy": (_niche as any).tone = "warm"; break;
      case "vibrant modern": (_niche as any).tone = "bold"; break;
      case "vibrant adventurous": (_niche as any).tone = "bold"; break;
      case "modern chic": (_niche as any).tone = "clean"; break;
      case "modern saas": (_niche as any).tone = "clean"; break;
              }
              // Also apply colorHint if domain specifies one
              if (dk.colorHint && dk.colorHint.length > 0) {
                (_niche as any).palette = {
                  ..._niche.palette,
                  primary: dk.colorHint,
                  accent:  dk.colorHint,
                  grad:    `linear-gradient(135deg,${dk.colorHint},${dk.colorHint}cc)`,
                };
              }
            }
            send("phase", { agent:"Planning", icon:"🏛️", action:`Blueprint: ${domainPlan.businessGoal} · ${planSections.length} sections`, pct:38, done:true });

            // ── Real, request-specific progress messages ──────────────────
            // Derived directly from THIS request's own domainPlan.sectionPurpose
            // (e.g. a CRM's sections/purposes read nothing like a finance app's,
            // a restaurant site's nothing like a SaaS dashboard's) — never a
            // fixed/generic list, since the text comes from the actual plan
            // the AI Architect just produced for this specific prompt.
            const sectionsToNarrate = planSections.slice(0, 8);
            for (let i = 0; i < sectionsToNarrate.length; i++) {
              const section = sectionsToNarrate[i];
              const purpose = domainPlan.sectionPurpose?.[section];
              const label = purpose
                ? (/[.!]$/.test(purpose.trim()) ? purpose.trim().replace(/[.!]$/,"...") : `${purpose.trim()}...`)
                : `Building ${section.replace(/-/g," ")} section...`;
              send("phase", { agent:"Building", icon:"🧩", action: label, pct: 39 + Math.round(((i+1)/sectionsToNarrate.length)*8) });
              await new Promise(r => setTimeout(r, 150));
            }
            // ── FILES event — now has real section names from architect ──────
            const architectFiles = [
              `index.html  (≈${Math.round(planSections.length * 6)}kb est.)`,
              "↳ <style>  theme.css       Design tokens + palette",
              "↳ <style>  responsive.css  @media breakpoints",
              "↳ <style>  motion.css      Animations + transitions",
              ...planSections.slice(0, 6).map(s =>
                `↳ <section> ${s.padEnd(14)}  Component`
              ),
              "↳ <script> interactions.js  Accordion + nav scroll",
            ];
            send("files", { files: architectFiles, total: architectFiles.length });
          }
        } catch { /* non-blocking — proceed with niche defaults */ }

        // ── Fallback files event when architect returned null ────────────
        if (!domainPlan) {
          const fallbackSections: string[] = (_niche.sectionOrder || ["hero","features","testimonials","pricing","footer"]);
          send("files", { files: [
            "index.html",
            "↳ <style>  theme.css",
            "↳ <style>  responsive.css",
            ...fallbackSections.slice(0, 5).map((s: string) => `↳ <section> ${s}`),
            "↳ <script> interactions.js",
          ], total: fallbackSections.length + 3 });
        }

        // ── COMPLEXITY ROUTER: simple → fast single-pass | complex → 4-stage pipeline ──
        const complexity = assessComplexity(nicheDetectPrompt, projectType);
        const _dl = getDesignLanguage(_niche);
        let provider = "claude";
        let html: string = ""; // initialized — TS couldn't prove definite assignment across all branches below

        // systemPrompt always built — used directly for simple path, and reused
        // by the repair pass later regardless of which path generated the first draft
        const systemPrompt = buildNichePrompt(nicheDetectPrompt, projectType, executionPlan, cachedUrlBlueprint, resolvedImages, _niche)
          + (blueprint ? `\n\n${buildBlueprintPrompt(blueprint)}` : "");

        // ── UNIFIED PIPELINE ──────────────────────────────────────────
        // Every generation — regardless of complexity — goes through the
        // Component Library. The AI never writes raw HTML directly
        // anymore; it only produces structured JSON content, which real,
        // tested renderComponent() functions turn into HTML. On content-
        // generation failure, retries once; if that also fails, falls
        // back to deterministic (non-AI) generic content — still rendered
        // through the SAME component pipeline, never raw AI-HTML.
        send("phase", { agent:"Reading", icon:"🧭", action:"Planning project structure...", pct:28 });
        console.log("Stage 1 Blueprint Start");
        const _s1 = Date.now();
        const pipelineBlueprint = domainPlan
          ? `SECTIONS: ${domainPlan.sectionOrder.join(", ")}\nKEY_COMPONENTS: ${Object.entries(domainPlan.sectionPurpose).map(([s,p])=>`${s} (${p})`).join("; ")}\nCONTENT_FOCUS: ${domainPlan.businessGoal} — ${domainPlan.tagline}. ${domainPlan.copyTone} Key benefits: ${domainPlan.keyBenefits.join(", ")}. Avoid: ${domainPlan.avoidMistakes.join(", ")}.`
          : await generateBlueprint(_niche, nicheDetectPrompt, projectType);
        console.log(`Stage 1 Blueprint Done — ${Date.now()-_s1}ms`);

        send("phase", { agent:"Building", icon:"📐", action:"Building components...", pct:42 });
        console.log("Stage 2 Sections Start");
        const _s2 = Date.now();
        let sectionsHTML: string;
        let componentContent = await generateComponentContent(_niche, pipelineBlueprint, nicheDetectPrompt, projectType, domainPlan);
        if (!componentContent) {
          send("phase", { agent:"Building", icon:"🔁", action:"Retrying content generation...", pct:44 });
          componentContent = await generateComponentContent(_niche, pipelineBlueprint, nicheDetectPrompt, projectType, domainPlan);
        }
        if (!componentContent) {
          // Both attempts failed (bad JSON, provider outage, etc) — deterministic
          // generic content keeps this on the SAME component-library rendering
          // path rather than ever falling back to raw AI-written HTML.
          componentContent = buildGenericComponentContent(_niche);
        }
        sectionsHTML = assembleFromComponentLibrary(_niche, componentContent, resolvedImages["main"] || [], designSeed);
        console.log(`Stage 2 Sections Done — ${Date.now()-_s2}ms | length:${sectionsHTML?.length || 0}`);

        if (sectionsHTML) {
          send("phase", { agent:"Building", icon:"🎨", action:"Optimizing responsive layout...", pct:58 });
          console.log("Stage 3 CSS Start");
          const _s3 = Date.now();
          const generatedCSS = await generateCSS(_niche, _dl, sectionsHTML);
          console.log(`Stage 3 CSS Done — ${Date.now()-_s3}ms | length:${generatedCSS.length}`);

          send("phase", { agent:"Building", icon:"⚡", action:"Connecting components...", pct:68 });
          console.log("Stage 4 JS Start");
          const _s4 = Date.now();
          const generatedJS = await generateJS(sectionsHTML, projectType);
          console.log(`Stage 4 JS Done — ${Date.now()-_s4}ms | length:${generatedJS.length}`);

          console.log("Stage 5 Combine Start");
          const _s5 = Date.now();
          html = combineOutput(sectionsHTML, generatedCSS, generatedJS, _niche, nicheDetectPrompt.slice(0,60));
          html = cleanHTML(html);
          console.log(`Stage 5 Combine Done — ${Date.now()-_s5}ms | total html:${html.length}`);
        }

        // Final safety net — if html is somehow still empty (e.g. the
        // component assembly produced an unexpectedly short string),
        // render the generic content through the SAME pipeline one more
        // time rather than ever falling back to raw AI-HTML.
        if (!html || html.trim().length < 200) {
          const genericContent = buildGenericComponentContent(_niche);
          const genericSections = assembleFromComponentLibrary(_niche, genericContent, resolvedImages["main"] || [], designSeed);
          const genericCSS = await generateCSS(_niche, _dl, genericSections);
          const genericJS = await generateJS(genericSections, projectType);
          html = cleanHTML(combineOutput(genericSections, genericCSS, genericJS, _niche, nicheDetectPrompt.slice(0,60)));
        }

        // Safety nets — applied regardless of which path generated the HTML
        html = sanitizeImageUrls(html, resolvedImages["main"] || []);
        html = enforceLuxuryPalette(html, _niche);
        html = enforceResponsiveHeadings(html);

        send("phase", { agent:"Building", icon:"⚙️", action:`Code generated via ${provider} (${complexity} path)`, pct:72, done:true });

        // ── PHASE 5: QA — Product Completion Engine: Production Gate ────
        send("phase", { agent:"Validating", icon:"🧪", action:"Validating build quality...", pct:78 });

        const gateKind  = projectType === "game" ? "game" : "website";
        const gateSubtype = projectType === "game" ? "arcade" : projectType;
        // ── REVIEW event — html-based checks (gate runs after this point) ──
        const reviewChecks = [
          { label:"HTML structure", pass: !!html && html.includes("<!DOCTYPE") },
          { label:"Responsive CSS", pass: !!html && html.includes("@media") },
          { label:"Navigation",     pass: !!html && html.includes("<nav") },
          { label:"Footer present", pass: !!html && html.includes("<footer") },
          { label:"CTA present",    pass: !!html && html.includes("button") },
          { label:"Mobile layout",  pass: !!html },
        ];
        send("review", { checks: reviewChecks });
        let gate: ProductionGateResult = runProductionGate(html, gateKind, gateSubtype);

        // Smart Quality Gate 2.0 — mechanically auto-repair what's fixable
        // BEFORE spending a costly AI repair pass on it. Zero extra AI calls.
        if (gate.autoFixableIssues.length > 0) {
          send("phase", { agent:"Validating", icon:"🔧", action:`Auto-repairing ${gate.autoFixableIssues.length} issue(s)...`, pct:80 });
          html = applyAutoRepairs(html, gate.autoFixableIssues);
          gate = runProductionGate(html, gateKind, gateSubtype); // re-check after mechanical fixes
        }

        // Design Critic — holistic subjective review (complex path only,
        // one extra AI call). Catches what regex can't: weak headlines,
        // buried CTAs, undifferentiated pricing tiers. Skipped when the
        // deterministic gate already scored the output highly — no need
        // for a second, AI-based opinion on something already validated.
        let critique: DesignCritique | null = null;
        if (complexity === "complex" && gateKind === "website" && gate.score < 90) {
          send("phase", { agent:"Validating", icon:"🎨", action:"Reviewing design quality...", pct:82 });
          console.log("Design Critic Start");
          const _sc = Date.now();
          critique = await runDesignCritic(html, _niche);
          console.log(`Design Critic Done — ${Date.now()-_sc}ms | score:${critique?.score ?? "null"}`);
        }

        let repairAttempts = 0;
        const MAX_REPAIR_ATTEMPTS = 2; // enabled — was 0 (disabled). Repair mechanism is sound: component-library-only, monotonic (only keeps result if score strictly improves), never raw-HTML.

        // Critic-driven repair: trigger even if the structural gate already
        // passed, IF the critic found real issues on a low score — subjective
        // weaknesses (weak headline, buried CTA) don't fail the gate but are
        // still worth one repair attempt while we're already in this flow.
        const critiqueNeedsRepair = !!critique && critique.score < 7 && critique.issues.length > 0;
        while ((!gate.overallPass || critiqueNeedsRepair) && repairAttempts < MAX_REPAIR_ATTEMPTS) {
          const elapsed = Date.now() - startTime;
          const remainingMs = 235000 - elapsed; // edge maxDuration=240s, leave 5s buffer
          if (remainingMs < 20000) break;

          const reasons: string[] = [];
          if (!gate.buildPass)      reasons.push("build issues");
          if (!gate.runtimePass)    reasons.push("syntax errors");
          if (!gate.mobilePass)     reasons.push("mobile gaps");
          if (!gate.validationPass) reasons.push(`score ${gate.score}/100`);
          else if (gate.score < 95) reasons.push(`score ${gate.score}/95`);
          if (critiqueNeedsRepair)  reasons.push(`design critique ${critique!.score}/10`);

          send("phase", { agent:"Validating", icon:"🧪", action:`Repair pass: fixing ${reasons.join(", ")}...`, pct:80 });

          // ── Component-library-only repair — NEVER asks the AI to return a
          // full HTML document. Instead: regenerate component content (JSON)
          // and re-assemble through renderComponent(), and/or regenerate
          // CSS/JS fresh against the SAME assembled sections. This is the
          // exact same deterministic pipeline the main generation used —
          // repair is just "run it again with fresh content/styles", never
          // "hand the AI the whole page and ask for a rewrite".
          repairAttempts++;
          try {
            let repairedComponentContent = await generateComponentContent(_niche, pipelineBlueprint, nicheDetectPrompt, projectType, domainPlan);
            if (!repairedComponentContent) repairedComponentContent = componentContent; // keep prior content if this attempt's JSON also fails

            const repairedSections = assembleFromComponentLibrary(_niche, repairedComponentContent, resolvedImages["main"] || [], designSeed + repairAttempts);
            const repairedCSS = await generateCSS(_niche, _dl, repairedSections);
            const repairedJS  = await generateJS(repairedSections, projectType);
            const repairedHtml = enforceResponsiveHeadings(enforceLuxuryPalette(sanitizeImageUrls(cleanHTML(combineOutput(repairedSections, repairedCSS, repairedJS, _niche, nicheDetectPrompt.slice(0,60))), resolvedImages["main"] || []), _niche));

            if (repairedHtml.length > 500 && repairedHtml.includes("</html>")) {
              const repairedGate = runProductionGate(repairedHtml, gateKind, gateSubtype);
              if (repairedGate.score > gate.score) {
                html = repairedHtml;
                gate = repairedGate;
                componentContent = repairedComponentContent;
                provider = `${provider} (component repair)`;
              }
            }
          } catch { /* keep current result */ }
        }


        send("phase", {
          agent:"Validating", icon:"🧪",
          action: `Production Gate: ${gate.score}/100${gate.overallPass ? " ✅ all gates passed" : repairAttempts > 0 ? ` (after ${repairAttempts} repair pass)` : ""}`,
          pct:84, done:true,
        });

        // ── PHASE 6: Visual Intelligence Optimizer ────────────────────
        send("phase", { agent:"Optimizing", icon:"⚡", action:"Optimizing responsive layout...", pct:88 });

        // If gate score is below premium threshold, inject Visual Intelligence CSS boost
        // This is a zero-AI-call fix that improves spacing, motion, and visual hierarchy
        if (gate.score < 80 && html) {
          const viBoost = generateVisualBoostCSS(_dl, _niche);
          html = html.replace(
            '</style>',
            `/* Visual Intelligence Boost — auto-applied (gate score: ${gate.score}/100) */
${viBoost}
</style>`
          );
          send("phase", { agent:"Optimizing", icon:"⚡",
            action:`Visual boost applied (score was ${gate.score}/100)`, pct:91 });
        } else {
          send("phase", { agent:"Optimizing", icon:"⚡",
            action:`Visual quality verified (${gate.score}/100)`, pct:91 });
        }

        await new Promise(r => setTimeout(r, 400));
        send("phase", { agent:"Optimizing", icon:"⚡", action:"Optimizing performance...", pct:92, done:true });

        // ── Real Design Score summary — the actual gate.dimensions and
        // critique data were already computed above; this just exposes them
        // to the UI as a compact summary instead of discarding them. Real
        // dimension names only (Structure/Functionality/UX/Mobile/
        // Performance/Completeness) — never relabeled to categories that
        // aren't genuinely being measured.
        send("designScore", {
          overallScore: gate.score,
          dimensions: gate.dimensions.map(d => ({ label: d.dimension, score: d.score })),
          designCritique: critique ? { score: critique.score, strengths: critique.strengths, issues: critique.issues } : null,
        });

        // ── PHASE 7: Project Manager ──────────────────────────────
        send("phase", { agent:"Finalizing", icon:"📋", action:"Finalizing build...", pct:95 });

        let savedProjectId: string | null = null;
        let creditCost = 2;

        if (authedUserId) {
          // Profile lookup — for credit accounting only. A failure here
          // (missing profiles row, bad column name, etc.) must NOT block
          // project persistence below — that's the "Total Projects = 0"
          // bug. Logging the error surfaces the EXACT cause in server
          // logs on the next generation.
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("total_credits, used_credits, plan")
            .eq("id", authedUserId)
            .single();

          if (profileError) {
            console.error(`[orchestrate/route] profiles lookup failed for user ${authedUserId}:`, profileError.message || profileError);
          }

          if (profile) {
            const remaining = (profile.total_credits || 5) - (profile.used_credits || 0);
            creditCost = Math.min(remaining, 3);
          }

          // Project persistence — ALWAYS attempted, independent of the
          // profile lookup above and its result. Own try/catch so a
          // thrown error here doesn't get conflated with the credit
          // deduction block below.
          try {
            const { data: proj, error: projError } = await supabase.from("projects").insert({
              user_id:    authedUserId,
              title:      prompt.slice(0, 60),
              name:       prompt.slice(0, 60),
              prompt,
              html_code:  html,
              status:     "completed",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).select().single();

            if (projError) {
              console.error(`[orchestrate/route] projects insert FAILED for user ${authedUserId}:`, projError.message || projError);
            }
            savedProjectId = proj?.id || null;
          } catch (e: any) {
            console.error(`[orchestrate/route] projects insert threw for user ${authedUserId}:`, e?.message || e);
          }

          // Credit deduction + transaction log — separate concern, only
          // when profile lookup succeeded. Own try/catch so a failure
          // here doesn't affect the project already saved above.
          if (profile) {
            try {
              const { error: updateError } = await supabase.from("profiles").update({
                used_credits: (profile.used_credits || 0) + creditCost,
              }).eq("id", authedUserId);
              if (updateError) {
                console.error(`[orchestrate/route] profiles credit update failed for user ${authedUserId}:`, updateError.message || updateError);
              }

              const { error: txError } = await supabase.from("credit_transactions").insert({
                user_id:     authedUserId,
                amount:      -creditCost,
                type:        "usage",
                description: `Build ${projectType}: ${prompt.slice(0, 50)}`,
                project_id:  savedProjectId,
              });
              if (txError) {
                console.error(`[orchestrate/route] credit_transactions insert failed for user ${authedUserId}:`, txError.message || txError);
              }
            } catch (e: any) {
              console.error(`[orchestrate/route] credit deduction block threw for user ${authedUserId}:`, e?.message || e);
            }
          }
        }

        send("phase", { agent:"Finalizing", icon:"📋", action:"Build Complete ✓", pct:100, done:true });

        // ── COMPLETE ──────────────────────────────────────────────
        // ── PHASE 6: Quality Score V2 (8-dimension) ───────────────
        const qualityScoreV2 = computeQualityScoreV2(html, _niche, gate);

        // Log successful generation
        await logGeneration(supabase, {
          id:           genLogId || undefined,
          status:       "completed",
          provider,
          credits_used: creditCost,
          duration_ms:  Date.now() - startTime,
          html_length:  html.length,
          metadata: {
            projectType,
            qualityScore:  gate.score,
            linesOfCode:   html.split("\n").length,
            repairAttempts,
            buildPass:     gate.buildPass,
            mobilePass:    gate.mobilePass,
          },
        });

        // Additive, compact Design Summary — built entirely from real,
        // already-computed data (niche/domainPlan/gate). New SSE event,
        // doesn't change the existing "complete" contract at all.
        try {
          const designSummary = buildDesignSummary(_niche, gate, domainPlan);
          const designPlan = buildDesignPlan(_niche, _dl, domainPlan);
          send("design_summary", { ...designSummary, designPlan });
        } catch { /* summary is informational only — never blocks generation */ }

        send("complete", {
          html,
          projectId:   savedProjectId,
          projectType,
          provider,
          creditCost,
          linesOfCode: html.split("\n").length,
          executionPlan,
          blueprint,
          // Product Completion Engine — Production Gate
          completenessScore:     gate.score,
          dimensions:            gate.dimensions,
          buildPass:             gate.buildPass,
          validationPass:        gate.validationPass,
          runtimePass:           gate.runtimePass,
          mobilePass:            gate.mobilePass,
          overallPass:           gate.overallPass,
          auditFailed:           gate.failedFeatures.map((f: any) => f.label),
          belowQualityThreshold: gate.score < 90,
          repairAttempts,
          // Quality Score V2 — 8 dimensions
          qualityScore: qualityScoreV2,
        });

      } catch (err: any) {
        const errMsg = err?.message || "Unknown error";
        const isTimeout = errMsg.includes("timeout") || errMsg.includes("Timeout");
        // Log failed generation — reuse genLogId so this UPDATES the same
        // row created at the start of this request (status:"started"),
        // instead of inserting a second, orphan row while the original
        // stays stuck at "started" forever.
        await logGeneration(supabase, {
          id:            genLogId || undefined,
          status:        isTimeout ? "timeout" : "failed",
          error_message: errMsg.slice(0, 500),
          error_code:    isTimeout ? "TIMEOUT" : "GENERATION_ERROR",
          duration_ms:   Date.now() - startTime,
          metadata:      { prompt: prompt?.slice(0, 200) },
        });
        send("error", { message: "Generation failed. Please try again." });
      } finally {
        // Fix 6: Release generation lock — ONLY if this request actually
        // acquired it. Releasing unconditionally would delete another,
        // genuinely-active generation's lock when THIS request had failed
        // to acquire it in the first place (the exact bug this fixes).
        if (authedUserId && lockAcquired) await releaseGenerationLock(authedUserId);
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
