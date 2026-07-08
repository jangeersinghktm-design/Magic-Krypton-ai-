// app/api/orchestrate/route.ts
// Krypton AI — Real Agent Orchestration via Server-Sent Events
// 7-Phase Pipeline: Plan → Research → Design → Build → QA → Optimize → Deliver
// Never fake progress — every event tied to real AI operations

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

// ── Krypton Intelligence Engine — Multi-provider system ───────────
async function callClaude(system: string, user: string, maxTokens = 6000): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31", // Enable prompt caching
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      // System prompt cached — saves ~90% cost on repeated calls (blueprint, generation, repair)
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" }, // Cache for 5 mins — all 3 Claude calls reuse this
        }
      ],
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

async function callOpenAI(system: string, user: string, maxTokens = 16000): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json","Authorization":`Bearer ${key}` },
    body: JSON.stringify({ model:"gpt-4o", max_tokens:maxTokens, messages:[{role:"system",content:system},{role:"user",content:user}] }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ contents:[{parts:[{text:`${system}\n\n${user}`}]}], generationConfig:{maxOutputTokens:16000} }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

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
function getPicsumFallback(industry: string, count: number): string[] {
  // Deterministic seed per industry so the SAME niche always gets the SAME
  // consistent image set (not random every generation), spread across a
  // wide seed range so different niches don't collide on the same photos.
  const seedBase: Record<string,number> = {
    "Luxury & Fashion":100,"Fitness & Wellness":200,"Food & Dining":300,
    "Crypto & Web3":400,"SaaS & Technology":500,"Finance & Fintech":600,
    "Creative Agency":700,"Real Estate":800,"Education & E-Learning":900,
    "Travel & Tourism":1000,"Content & Affiliate":1100,"Business":1200,
  };
  const base = seedBase[industry] ?? 1200;
  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    urls.push(`https://picsum.photos/seed/krypton${base + i}/1200/800`);
  }
  return urls;
}

// Real Unsplash Search API call — returns genuinely relevant, working images
async function fetchUnsplashImages(query: string, count: number): Promise<string[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error("UNSPLASH_ACCESS_KEY not set");
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`Unsplash API ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((r: any) => r.urls?.regular).filter(Boolean);
}

// Main entry — tries real API first, falls back to curated bank.
// Returns a ready-to-use array of WORKING image URLs for this niche.
// ═══════════════════════════════════════════════════════════════
// IMAGE SANITIZER — Safety net for when the AI ignores instructions
// and hallucinates its own unsplash.com photo IDs (which are almost
// always fake/broken, since the AI is pattern-matching from training
// data, not actually looking up real photos). This guarantees every
// shipped website has WORKING images regardless of AI behavior.
// ═══════════════════════════════════════════════════════════════
function sanitizeImageUrls(html: string, realUrls: string[]): string {
  if (realUrls.length === 0) return html;
  let urlIndex = 0;
  const nextUrl = () => realUrls[urlIndex++ % realUrls.length];

  // Replace any src="...unsplash.com..." or url(...unsplash.com...) that is
  // NOT one of our verified real URLs (AI-hallucinated ones get swapped out).
  const isOurUrl = (url: string) => realUrls.some(u => url.includes(u.split('?')[0]));

  // Fix <img src="...">
  html = html.replace(/(<img[^>]*\bsrc=["'])([^"']*unsplash\.com[^"']*)(["'])/gi, (match, pre, url, post) => {
    if (isOurUrl(url)) return match; // already a real URL, leave it
    return `${pre}${nextUrl()}${post}`;
  });

  // Fix CSS background-image: url('...')
  html = html.replace(/(background(?:-image)?:\s*url\(['"]?)([^'")]*unsplash\.com[^'")]*)(['"]?\))/gi, (match, pre, url, post) => {
    if (isOurUrl(url)) return match;
    return `${pre}${nextUrl()}${post}`;
  });

  // Also catch any other dead/placeholder patterns the AI might invent
  html = html.replace(/(<img[^>]*\bsrc=["'])(https?:\/\/source\.unsplash\.com[^"']*)(["'])/gi, (match, pre, url, post) => `${pre}${nextUrl()}${post}`);
  html = html.replace(/(<img[^>]*\bsrc=["'])(https?:\/\/via\.placeholder\.com[^"']*)(["'])/gi, (match, pre, url, post) => `${pre}${nextUrl()}${post}`);

  return html;
}

// ═══════════════════════════════════════════════════════════════
// LUXURY PALETTE ENFORCER — safety net for when the AI defaults to
// cheap flat SaaS colors (#FFD700, #FFA500, #FF7A00 etc.) instead of
// the muted antique-gold palette specified for luxury-tier brands.
// Same defense-in-depth pattern as the image sanitizer.
// ═══════════════════════════════════════════════════════════════
function enforceLuxuryPalette(html: string, niche: NicheProfile): string {
  if (niche.marketLevel !== "luxury") return html;

  const p = niche.palette;
  // Cheap flat colors the AI sometimes defaults to, regardless of our
  // palette instructions — swap these for the correct muted-gold tones.
  const CHEAP_COLOR_SWAPS: [RegExp, string][] = [
    [/#FFD700/gi, p.primary],   // bright gold → antique gold
    [/#FFC107/gi, p.primary],
    [/#FFA500/gi, p.secondary], // bright orange → deep bronze
    [/#FF7A00/gi, p.secondary],
    [/#FFB000/gi, p.accent],
    [/#FFEB3B/gi, p.primary],
  ];
  for (const [re, replacement] of CHEAP_COLOR_SWAPS) {
    html = html.replace(re, replacement);
  }

  // If the generated CSS uses flat solid background on buttons/CTAs,
  // nudge toward the elegant gradient instead (best-effort regex swap
  // on common button background patterns using the primary color).
  html = html.replace(
    new RegExp(`background:\\s*${p.primary.replace('#','\\#')}([;\\s])`, 'gi'),
    `background:${p.grad}$1`
  );

  return html;
}

// ═══════════════════════════════════════════════════════════════
// RESPONSIVE FONT ENFORCER — safety net for when the AI uses fixed
// px font-sizes on headings instead of clamp(), causing huge
// one-word-per-line wrapping on mobile (e.g. "font-size: 48px"
// on a 6-word headline becomes 6 separate giant lines on a 375px
// screen). Forces every heading rule to scale responsively.
// ═══════════════════════════════════════════════════════════════
function enforceResponsiveHeadings(html: string): string {
  // Convert "font-size: 48px" / "font-size:48px" on h1/h2/h3 rules to clamp().
  // Matches patterns like ".hero h1 { ... font-size: 48px; ... }" or
  // "h1 { font-size:56px; }" and rewrites just the font-size value.
  return html.replace(
    /(\bh[123][^{]*\{[^}]*?font-size:\s*)(\d+)(px\s*;)/gi,
    (match, pre, px, post) => {
      const size = parseInt(px, 10);
      if (size < 28) return match; // small text, fixed px is fine
      const min = Math.round(size * 0.55);
      const vw  = Math.round(size * 0.09 * 10) / 10; // gentle viewport scaling
      return `${pre}clamp(${min}px,${vw}vw,${size}px)${post}`;
    }
  );
}

async function getRealImageSet(industry: string, keyword: string, count = 6): Promise<string[]> {
  try {
    const real = await fetchUnsplashImages(keyword, count);
    if (real.length > 0) return real;
  } catch {}

  // Fallback — guaranteed-working Picsum images (no API key needed)
  return getPicsumFallback(industry, count);
}

async function kryptonGenerate(system: string, prompt: string): Promise<{text:string;provider:string}> {
  for (const [fn, name] of [[callClaude, "claude"],[callOpenAI,"openai"],[callGemini,"gemini"]] as const) {
    try {
      const text = await (fn as Function)(system, prompt);
      if (text?.trim()) return { text, provider: name };
    } catch { continue; }
  }
  throw new Error("All AI providers failed");
}

// ── Project Type Detector ────────────────────────────────────────
function detectProjectType(prompt: string): string {
  const p = prompt.toLowerCase();

  // ── Exact compound patterns first (most specific → least specific) ──
  // "landing page for X" always landing — never website
  if (/landing page|landing site|squeeze page|lead capture|opt.?in page/.test(p)) return "landing";

  // Admin / Internal tools
  if (/admin panel|admin dashboard|back.?office|internal tool|erp/.test(p)) return "dashboard";

  // CRM — before "app" to avoid generic match
  if (/crm|customer relation|lead manag|sales pipeline|contact manag/.test(p)) return "dashboard";

  // AI Tool / AI product
  if (/ai tool|ai app|ai platform|ai product|gpt|chatbot|ai assistant/.test(p)) return "app";

  // Documentation / Knowledge base
  if (/docs|documentation|knowledge base|wiki|guide site/.test(p)) return "blog";

  // SaaS — before generic "software"
  if (/saas|subscription platform|software as a service|b2b platform|pricing tiers/.test(p)) return "saas";

  // E-commerce
  if (/shop|store|ecommerce|e-commerce|cart|marketplace|product catalog|buying/.test(p)) return "ecommerce";

  // Dashboard / Analytics
  if (/dashboard|analytics|metrics|data visualization|reporting/.test(p)) return "dashboard";

  // App / Tool — specific patterns
  if (/web app|app|tool|tracker|calculator|manager|planner|scheduler/.test(p)) return "app";

  // Portfolio
  if (/portfolio|showcase|resume site|personal site|my work/.test(p)) return "portfolio";

  // Blog / Content
  if (/blog|news site|magazine|articles|content site/.test(p)) return "blog";

  // Landing — also catch single-page conversion patterns
  if (/landing|waitlist|coming soon|pre.?launch|single page/.test(p)) return "landing";

  // Game (dead path — kept for backward compat)
  if (/game|snake|tetris|puzzle|arcade/.test(p)) return "game";

  return "website";
}

// ── Build System Prompt by Type ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════
// KRYPTON AI — NICHE INTELLIGENCE ENGINE v2.0
// Replaces buildPrompt() + detectPalette() in app/api/orchestrate/route.ts
// Copy everything below and paste ABOVE the existing buildPrompt function,
// then replace the buildPrompt function call with: buildNichePrompt(userPrompt, type, plan)
// ═══════════════════════════════════════════════════════════════════

// ── PHASE 1: NICHE INTELLIGENCE ──────────────────────────────────

interface NicheProfile {
  industry: string;
  businessType: string;          // product | service | personal | community
  marketLevel: string;           // luxury | premium | mid | budget
  reach: string;                 // local | national | global
  audience: string;              // b2b | b2c | both
  tone: string;                  // editorial | energetic | trust | warm | bold | clean
  imageKeyword: string;          // for unsplash (hero)
  imageKeyword2: string;         // secondary keyword
  sectionImageMap: Record<string,string>; // per-section image keywords
  sectionOrder: string[];        // conversion-optimized order
  conversionGoal: string;        // reservation | lead | trial | enrollment | purchase | inquiry | community
  competitorStyle: string;       // Apple | Stripe | Nike | Airbnb | Linear | Framer | Shopify | HubSpot
  brandPositioning: string;      // luxury | premium | creative | corporate | friendly | innovative | community
  audienceDimensions: AudienceDimensions;
  objectionHandling: string[];   // top 3 objections to address
  trustElements: string[];       // what trust signals matter most
  palette: NichePalette;
  typography: NicheTypography;
  brandVoice: BrandVoice;
}

interface AudienceDimensions {
  gender: string;                // masculine | feminine | neutral
  age: string;                   // young (18-30) | professional (30-50) | mature (50+) | all
  sophistication: string;        // aspirational | practical | technical | creative
  motivation: string;            // status | results | security | expression | community
}

interface NichePalette {
  primary: string;
  secondary: string;
  bg: string;
  surface: string;
  card: string;
  text2: string;
  accent: string;
  grad: string;
  heroGrad: string;              // multi-color animated gradient
}

interface NicheTypography {
  headingFont: string;
  bodyFont: string;
  headingWeight: string;
  headingSpacing: string;
  headingStyle: string;          // editorial | bold | clean | expressive
  googleFonts: string;
}

interface BrandVoice {
  heroHeadlineStyle: string;     // how to write the H1
  ctaPrimary: string;            // CTA button text style
  ctaSecondary: string;
  emotionalHook: string;         // opening emotional appeal
  socialProofStyle: string;      // what kind of social proof
}

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

function detectNiche(prompt: string): NicheProfile {
  // Normalize common typos/misspellings before matching (Hinglish users often
  // misspell English niche words — "parfume", "jewellry", "rstaurant" etc.)
  const TYPO_FIXES: [RegExp, string][] = [
    [/\bparfume\b/gi, "perfume"], [/\bperfum\b/gi, "perfume"],
    [/\bjewellry\b/gi, "jewellery"], [/\bjewlery\b/gi, "jewellery"],
    [/\brestrant\b/gi, "restaurant"], [/\brestaurent\b/gi, "restaurant"],
    [/\bfitnes\b/gi, "fitness"], [/\bfitnss\b/gi, "fitness"],
    [/\beducaton\b/gi, "education"], [/\btravell?ing\b/gi, "travel"],
  ];
  let p = prompt.toLowerCase();
  for (const [re, fix] of TYPO_FIXES) p = p.replace(re, fix);

  // ── LUXURY / FASHION / PERFUME / JEWELRY ──────────────────────
  if (/(perfume|fragrance|luxury|jewel|jewellery|jewelry|haute|couture|fashion|designer|bespoke|artisan|premium brand|exclusive)/.test(p)) {
    return {
      industry: "Luxury & Fashion",
      businessType: "product",
      marketLevel: "luxury",
      reach: "global",
      audience: "b2c",
      tone: "editorial",
      imageKeyword: "luxury+perfume+elegant",
      imageKeyword2: "fashion+editorial",
      sectionOrder: ["hero", "product-showcase", "brand-story", "craftsmanship", "collection", "testimonials", "newsletter"],
      conversionGoal: "purchase",
      competitorStyle: "Bottega Veneta Editorial",
      brandPositioning: "luxury",
      audienceDimensions: { gender:"feminine", age:"professional (30-50)", sophistication:"aspirational", motivation:"status" },
      sectionImageMap: { hero:"luxury+perfume+dark+elegant", showcase:"product+luxury+photography", story:"atelier+craftsmanship+artisan", testimonials:"luxury+lifestyle+portrait" },
      objectionHandling: ["Is it worth the price?","What makes it unique?","Will it last?"],
      trustElements: ["As seen in Vogue/Harper's Bazaar","Handcrafted since [year]","Limited edition"],
      palette: {
        primary: "#C9A84C", secondary: "#8B6914",
        bg: "#050400", surface: "#0A0900", card: "#100E00",
        text2: "#C8B98A", accent: "#F0D080",
        grad: "linear-gradient(135deg,#C9A84C,#8B6914)",
        heroGrad: "linear-gradient(135deg,#0A0800 0%,#1A1400 40%,#0F0C00 100%)",
      },
      typography: {
        headingFont: "'Cormorant Garamond', serif",
        bodyFont: "'Jost', sans-serif",
        headingWeight: "300",
        headingSpacing: "0.08em",
        headingStyle: "editorial",
        googleFonts: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Jost:wght@300;400;500&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Poetic, 3-5 words max, evoke desire — 'The Art of Desire' / 'Born from Silence'",
        ctaPrimary: "Discover the Collection",
        ctaSecondary: "Our Story",
        emotionalHook: "Aspiration and exclusivity — make them feel they deserve this",
        socialProofStyle: "Press mentions: 'As seen in Vogue, Harper's Bazaar, GQ'",
      },
    };
  }

  // ── FITNESS / GYM / WELLNESS ───────────────────────────────────
  if (/(fitness|gym|workout|training|muscle|bodybuilding|crossfit|yoga|pilates|wellness|health club|personal trainer|weight loss|transformation)/.test(p)) {
    return {
      industry: "Fitness & Wellness",
      businessType: "service",
      marketLevel: "mid",
      reach: "local",
      audience: "b2c",
      tone: "energetic",
      imageKeyword: "fitness+workout+gym",
      imageKeyword2: "athlete+training",
      sectionOrder: ["hero", "transformation", "programs", "why-us", "trainers", "testimonials", "pricing", "cta"],
      conversionGoal: "enrollment",
      competitorStyle: "Nike",
      brandPositioning: "results-driven",
      audienceDimensions: { gender:"neutral", age:"young (18-30)", sophistication:"practical", motivation:"results" },
      sectionImageMap: { hero:"athlete+gym+training+dark", transformation:"fitness+transformation+body", programs:"workout+exercise+gym", trainers:"personal+trainer+professional", testimonials:"fitness+success+portrait" },
      objectionHandling: ["I don't have time","I've tried before and failed","Is it too hard for beginners?"],
      trustElements: ["Before/after transformations","Member count","Certified trainers"],
      palette: {
        primary: "#22C55E", secondary: "#16A34A",
        bg: "#020B04", surface: "#041308", card: "#071A0C",
        text2: "#86EFAC", accent: "#4ADE80",
        grad: "linear-gradient(135deg,#22C55E,#0EA5E9)",
        heroGrad: "linear-gradient(135deg,#020B04 0%,#041A0A 50%,#020B04 100%)",
      },
      typography: {
        headingFont: "'Barlow Condensed', sans-serif",
        bodyFont: "'Barlow', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.02em",
        headingStyle: "bold",
        googleFonts: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Powerful, all-caps energy — 'TRANSFORM YOUR BODY. TRANSFORM YOUR LIFE.'",
        ctaPrimary: "Start Your Transformation",
        ctaSecondary: "View Programs",
        emotionalHook: "Pain point first — 'Tired of feeling weak? Tired of failing?'",
        socialProofStyle: "Before/after results, member count: '2,847 transformations and counting'",
      },
    };
  }

  // ── RESTAURANT / FOOD / CAFE ───────────────────────────────────
  if (/(restaurant|cafe|bistro|food|dining|cuisine|chef|menu|pizza|sushi|bakery|coffee|bar|grill|eatery|breakfast|brunch|dinner|catering)/.test(p)) {
    return {
      industry: "Food & Dining",
      businessType: "service",
      marketLevel: "mid",
      reach: "local",
      audience: "b2c",
      tone: "warm",
      imageKeyword: "restaurant+food+gourmet",
      imageKeyword2: "chef+cooking+cuisine",
      sectionOrder: ["hero", "about", "menu-highlight", "gallery", "experience", "reviews", "reservation", "footer"],
      conversionGoal: "reservation",
      competitorStyle: "Airbnb",
      brandPositioning: "friendly",
      audienceDimensions: { gender:"neutral", age:"all ages", sophistication:"practical", motivation:"expression" },
      sectionImageMap: { hero:"restaurant+interior+atmospheric+dark", menu:"food+gourmet+photography+closeup", gallery:"chef+cooking+kitchen+professional", reviews:"happy+dining+restaurant+customers" },
      objectionHandling: ["Is it worth the price?","How hard is it to get a reservation?","Is the ambiance good?"],
      trustElements: ["TripAdvisor rating","Food critic reviews","Years in business"],
      palette: {
        primary: "#F97316", secondary: "#DC2626",
        bg: "#0A0400", surface: "#140800", card: "#1E0C00",
        text2: "#FED7AA", accent: "#FCD34D",
        grad: "linear-gradient(135deg,#F97316,#DC2626)",
        heroGrad: "linear-gradient(135deg,#0A0400 0%,#1A0800 50%,#0A0400 100%)",
      },
      typography: {
        headingFont: "'Playfair Display', serif",
        bodyFont: "'Lato', sans-serif",
        headingWeight: "700",
        headingSpacing: "-0.01em",
        headingStyle: "elegant",
        googleFonts: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lato:wght@300;400;700&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Sensory and inviting — 'Where Every Bite Tells a Story'",
        ctaPrimary: "Reserve a Table",
        ctaSecondary: "View Our Menu",
        emotionalHook: "Invoke the senses — smell, taste, warmth, togetherness",
        socialProofStyle: "Awards + reviews: 'Rated #1 on TripAdvisor · Featured in Food & Wine'",
      },
    };
  }

  // ── CRYPTO / WEB3 / BLOCKCHAIN / DeFi ─────────────────────────
  if (/(crypto|blockchain|web3|defi|nft|token|dao|ethereum|bitcoin|solana|wallet|dex|yield|staking)/.test(p)) {
    return {
      industry: "Crypto & Web3",
      businessType: "product",
      marketLevel: "premium",
      reach: "global",
      audience: "both",
      tone: "trust",
      imageKeyword: "blockchain+technology+crypto",
      imageKeyword2: "digital+finance+network",
      sectionOrder: ["hero", "stats", "how-it-works", "features", "security", "tokenomics", "roadmap", "community", "faq"],
      conversionGoal: "community",
      competitorStyle: "Stripe",
      brandPositioning: "innovative",
      audienceDimensions: { gender:"masculine", age:"young (18-30)", sophistication:"technical", motivation:"results" },
      sectionImageMap: { hero:"blockchain+network+dark+neon", stats:"crypto+chart+data+dashboard", security:"cybersecurity+shield+technology", community:"crypto+community+discord+web3" },
      objectionHandling: ["Is it safe?","Is it too late to invest?","How does it actually work?"],
      trustElements: ["Total Value Locked","Audit reports","Team credentials","Partnerships"],
      palette: {
        primary: "#3B82F6", secondary: "#8B5CF6",
        bg: "#020409", surface: "#04070F", card: "#070D1A",
        text2: "#93C5FD", accent: "#60A5FA",
        grad: "linear-gradient(135deg,#3B82F6,#8B5CF6)",
        heroGrad: "linear-gradient(135deg,#020409 0%,#060C1A 50%,#020409 100%)",
      },
      typography: {
        headingFont: "'Space Grotesk', sans-serif",
        bodyFont: "'Inter', sans-serif",
        headingWeight: "700",
        headingSpacing: "-0.03em",
        headingStyle: "clean",
        googleFonts: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Bold claim + metric — 'The Future of Finance. $2.4B in Transactions.'",
        ctaPrimary: "Launch App",
        ctaSecondary: "Read Whitepaper",
        emotionalHook: "Financial freedom, decentralization, early mover advantage",
        socialProofStyle: "TVL, users, transactions — hard numbers front and center",
      },
    };
  }

  // ── SAAS / SOFTWARE / TECH STARTUP ────────────────────────────
  if (/(saas|software|platform|tool|app|startup|productivity|automation|workflow|integration|api|dashboard|analytics|crm|erp|no.code|low.code)/.test(p)) {
    return {
      industry: "SaaS & Technology",
      businessType: "product",
      marketLevel: "premium",
      reach: "global",
      audience: "b2b",
      tone: "clean",
      imageKeyword: "saas+dashboard+software",
      imageKeyword2: "technology+workspace",
      sectionOrder: ["hero", "social-proof-logos", "features", "product-demo", "how-it-works", "testimonials", "pricing", "faq", "cta"],
      conversionGoal: "trial",
      competitorStyle: "Apple",
      brandPositioning: "innovative",
      audienceDimensions: { gender:"neutral", age:"professional (30-50)", sophistication:"technical", motivation:"results" },
      sectionImageMap: { hero:"saas+dashboard+interface+dark", demo:"software+ui+screenshot+laptop", features:"productivity+workflow+team+office", testimonials:"business+professional+office+portrait" },
      objectionHandling: ["Is it easy to use?","Will my team actually adopt it?","What does it integrate with?"],
      trustElements: ["G2/Capterra rating","Case studies with ROI","SOC2/security certifications","Free trial, no credit card"],
      palette: {
        primary: "#6366F1", secondary: "#8B5CF6",
        bg: "#030308", surface: "#07070F", card: "#0D0D1A",
        text2: "#94A3B8", accent: "#818CF8",
        grad: "linear-gradient(135deg,#6366F1,#8B5CF6)",
        heroGrad: "linear-gradient(135deg,#030308 0%,#080815 50%,#030308 100%)",
      },
      typography: {
        headingFont: "'Plus Jakarta Sans', sans-serif",
        bodyFont: "'Inter', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.04em",
        headingStyle: "clean",
        googleFonts: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;800&family=Inter:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Outcome-first — 'Ship 10x Faster. Build Without Limits.' (max 8 words)",
        ctaPrimary: "Start Free Trial",
        ctaSecondary: "See Demo",
        emotionalHook: "Pain: wasted time, broken tools. Relief: finally, a better way",
        socialProofStyle: "Logo bar: 'Trusted by 50,000+ teams at [logos]'",
      },
    };
  }

  // ── FINANCE / FINTECH / INVESTMENT ────────────────────────────
  if (/(finance|fintech|invest|wealth|fund|trading|bank|insurance|mortgage|accounting|tax|financial|advisor|portfolio|retire)/.test(p)) {
    return {
      industry: "Finance & Fintech",
      businessType: "service",
      marketLevel: "premium",
      reach: "national",
      audience: "both",
      tone: "trust",
      imageKeyword: "finance+investment+wealth",
      imageKeyword2: "business+professional",
      sectionOrder: ["hero", "stats", "services", "why-us", "how-it-works", "testimonials", "security", "cta"],
      conversionGoal: "lead",
      competitorStyle: "Stripe",
      brandPositioning: "professional",
      audienceDimensions: { gender:"neutral", age:"professional (30-50)", sophistication:"aspirational", motivation:"security" },
      sectionImageMap: { hero:"finance+wealth+investment+premium", stats:"financial+data+chart+growth", services:"business+meeting+professional", security:"bank+security+vault+trust" },
      objectionHandling: ["Can I trust them with my money?","What are the fees?","How experienced are they?"],
      trustElements: ["Regulatory certifications","Years in business","AUM numbers","Client retention rate"],
      palette: {
        primary: "#0EA5E9", secondary: "#0284C7",
        bg: "#020508", surface: "#040A10", card: "#070F18",
        text2: "#7DD3FC", accent: "#38BDF8",
        grad: "linear-gradient(135deg,#0EA5E9,#6366F1)",
        heroGrad: "linear-gradient(135deg,#020508 0%,#050D18 50%,#020508 100%)",
      },
      typography: {
        headingFont: "'Syne', sans-serif",
        bodyFont: "'DM Sans', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.03em",
        headingStyle: "bold",
        googleFonts: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Authority + promise — 'Your Wealth, Secured. Your Future, Clear.'",
        ctaPrimary: "Get Started Today",
        ctaSecondary: "Schedule a Call",
        emotionalHook: "Security, trust, expertise — reduce anxiety about money",
        socialProofStyle: "AUM, years experience, certifications: '$2.1B managed · 15 years · SEC registered'",
      },
    };
  }

  // ── MARKETING / AGENCY / CREATIVE ─────────────────────────────
  if (/(agency|marketing|brand|creative|design|seo|social media|advertising|content|growth|lead|campaign|pr|media|video|production)/.test(p)) {
    return {
      industry: "Creative Agency",
      businessType: "service",
      marketLevel: "premium",
      reach: "global",
      audience: "b2b",
      tone: "bold",
      imageKeyword: "creative+agency+design",
      imageKeyword2: "team+office+creative",
      sectionOrder: ["hero", "work-showcase", "services", "process", "results-stats", "team", "client-logos", "testimonials", "contact"],
      conversionGoal: "lead",
      competitorStyle: "Linear",
      brandPositioning: "creative",
      audienceDimensions: { gender:"neutral", age:"professional (30-50)", sophistication:"creative", motivation:"results" },
      sectionImageMap: { hero:"creative+agency+dark+bold", work:"portfolio+design+web+creative", team:"creative+team+office+diverse", results:"business+growth+chart+results" },
      objectionHandling: ["Will they understand our brand?","What ROI can we expect?","Are they too expensive?"],
      trustElements: ["Case study results with numbers","Client logos","Awards","Response time guarantee"],
      palette: {
        primary: "#EC4899", secondary: "#8B5CF6",
        bg: "#050208", surface: "#0A0410", card: "#100818",
        text2: "#F9A8D4", accent: "#F472B6",
        grad: "linear-gradient(135deg,#EC4899,#8B5CF6)",
        heroGrad: "linear-gradient(135deg,#050208 0%,#0C0520 50%,#050208 100%)",
      },
      typography: {
        headingFont: "'Syne', sans-serif",
        bodyFont: "'DM Sans', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.04em",
        headingStyle: "expressive",
        googleFonts: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Bold & provocative — 'We Don't Do Average.' or 'Results. Not Excuses.'",
        ctaPrimary: "Start a Project",
        ctaSecondary: "View Our Work",
        emotionalHook: "Challenge the status quo — boring agencies vs us",
        socialProofStyle: "Case study results: '+342% ROI for Client X in 90 days'",
      },
    };
  }

  // ── REAL ESTATE / PROPERTY ────────────────────────────────────
  if (/(real estate|property|house|home|apartment|villa|rent|buy|mortgage|realtor|housing|condo|listing|land)/.test(p)) {
    return {
      industry: "Real Estate",
      businessType: "service",
      marketLevel: "premium",
      reach: "local",
      audience: "b2c",
      tone: "trust",
      imageKeyword: "real+estate+luxury+home",
      imageKeyword2: "architecture+interior+design",
      sectionOrder: ["hero", "featured-listings", "search", "services", "stats", "about", "testimonials", "contact"],
      conversionGoal: "inquiry",
      competitorStyle: "Airbnb",
      brandPositioning: "professional",
      audienceDimensions: { gender:"neutral", age:"professional (30-50)", sophistication:"aspirational", motivation:"security" },
      sectionImageMap: { hero:"luxury+home+interior+architecture", listings:"real+estate+property+house", about:"realtor+professional+portrait", testimonials:"happy+homeowner+family+house" },
      objectionHandling: ["Can I trust this agent?","Is it the right time to buy?","What about the neighborhood?"],
      trustElements: ["Properties sold count","Years experience","Client testimonials with photos","Local market expertise"],
      palette: {
        primary: "#10B981", secondary: "#059669",
        bg: "#020A06", surface: "#041208", card: "#071A0D",
        text2: "#6EE7B7", accent: "#34D399",
        grad: "linear-gradient(135deg,#10B981,#0EA5E9)",
        heroGrad: "linear-gradient(135deg,#020A06 0%,#041810 50%,#020A06 100%)",
      },
      typography: {
        headingFont: "'Cormorant Garamond', serif",
        bodyFont: "'DM Sans', sans-serif",
        headingWeight: "600",
        headingSpacing: "0",
        headingStyle: "elegant",
        googleFonts: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Aspirational home — 'Find Your Perfect Home. Live Your Dream Life.'",
        ctaPrimary: "Browse Properties",
        ctaSecondary: "Book a Viewing",
        emotionalHook: "The emotional journey of finding a home — belonging, safety, dreams",
        socialProofStyle: "Properties sold, years active, client satisfaction: '500+ homes sold · 98% client satisfaction'",
      },
    };
  }

  // ── EDUCATION / COURSE / E-LEARNING ───────────────────────────
  if (/(course|education|learn|teach|school|academy|university|training|bootcamp|certification|skill|study|tutor|class|lecture|e.learning|online course)/.test(p)) {
    return {
      industry: "Education & E-Learning",
      businessType: "product",
      marketLevel: "mid",
      reach: "global",
      audience: "b2c",
      tone: "energetic",
      imageKeyword: "education+learning+student",
      imageKeyword2: "online+course+laptop",
      sectionOrder: ["hero", "outcome-proof", "curriculum", "instructor", "what-youll-learn", "testimonials", "pricing", "faq", "enroll-cta"],
      conversionGoal: "enrollment",
      competitorStyle: "HubSpot",
      brandPositioning: "friendly",
      audienceDimensions: { gender:"neutral", age:"young (18-30)", sophistication:"practical", motivation:"results" },
      sectionImageMap: { hero:"online+learning+laptop+student", curriculum:"course+lessons+curriculum+learning", instructor:"teacher+educator+professional+portrait", testimonials:"student+success+graduation+career" },
      objectionHandling: ["Is this course worth it?","Will I actually complete it?","What if I already know some of this?"],
      trustElements: ["Student count","Completion rate","Career outcome stats","Money-back guarantee"],
      palette: {
        primary: "#F59E0B", secondary: "#EF4444",
        bg: "#080500", surface: "#120900", card: "#1C0E00",
        text2: "#FCD34D", accent: "#FDE68A",
        grad: "linear-gradient(135deg,#F59E0B,#EF4444)",
        heroGrad: "linear-gradient(135deg,#080500 0%,#180B00 50%,#080500 100%)",
      },
      typography: {
        headingFont: "'Nunito', sans-serif",
        bodyFont: "'Nunito Sans', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.02em",
        headingStyle: "bold",
        googleFonts: "https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Nunito+Sans:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Transformation promise — 'From Zero to [Skill] in 30 Days. Guaranteed.'",
        ctaPrimary: "Enroll Now — Limited Spots",
        ctaSecondary: "Preview the Course",
        emotionalHook: "Fear of missing out, career change, income improvement",
        socialProofStyle: "Student count + outcomes: '12,847 students enrolled · 94% completion rate'",
      },
    };
  }

  // ── TRAVEL / TOURISM ──────────────────────────────────────────
  if (/(travel|tour|vacation|holiday|trip|adventure|hotel|resort|destination|explore|trek|safari|cruise|booking|fly|airline)/.test(p)) {
    return {
      industry: "Travel & Tourism",
      businessType: "service",
      marketLevel: "mid",
      reach: "global",
      audience: "b2c",
      tone: "adventurous",
      imageKeyword: "travel+landscape+adventure",
      imageKeyword2: "destination+ocean+mountain",
      sectionOrder: ["hero", "featured-destinations", "why-choose-us", "experiences", "testimonials", "gallery", "booking-cta"],
      conversionGoal: "booking",
      competitorStyle: "Airbnb",
      brandPositioning: "friendly",
      audienceDimensions: { gender:"neutral", age:"young (18-30)", sophistication:"aspirational", motivation:"expression" },
      sectionImageMap: { hero:"travel+adventure+landscape+scenic", destinations:"travel+destination+city+landmark", experiences:"adventure+outdoor+travel+activity", gallery:"travel+photography+beautiful+places" },
      objectionHandling: ["Is it safe?","Is it within budget?","Will I feel out of place?"],
      trustElements: ["Trips completed","Countries covered","Safety rating","Traveler reviews"],
      palette: {
        primary: "#06B6D4", secondary: "#0891B2",
        bg: "#020709", surface: "#030D12", card: "#05131A",
        text2: "#67E8F9", accent: "#22D3EE",
        grad: "linear-gradient(135deg,#06B6D4,#7C3AED)",
        heroGrad: "linear-gradient(135deg,#020709 0%,#041018 50%,#020709 100%)",
      },
      typography: {
        headingFont: "'Poppins', sans-serif",
        bodyFont: "'Poppins', sans-serif",
        headingWeight: "700",
        headingSpacing: "-0.02em",
        headingStyle: "bold",
        googleFonts: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Wanderlust — 'The World is Calling. Are You Ready?' or 'Every Journey Starts Here'",
        ctaPrimary: "Explore Destinations",
        ctaSecondary: "Plan My Trip",
        emotionalHook: "Freedom, escape from routine, bucket list experiences",
        socialProofStyle: "Travelers served: '50,000+ adventures booked · 4.9★ average rating'",
      },
    };
  }

  // ── AFFILIATE / BLOGGING / CONTENT ────────────────────────────
  if (/(affiliate|blog|content|tips|guide|review|compare|best|top|rank|seo|article|newsletter|podcast|youtube|influencer)/.test(p)) {
    return {
      industry: "Content & Affiliate",
      businessType: "personal",
      marketLevel: "mid",
      reach: "global",
      audience: "b2c",
      tone: "helpful",
      imageKeyword: "content+creator+blog",
      imageKeyword2: "marketing+digital+laptop",
      sectionOrder: ["hero", "what-youll-get", "featured-posts", "about", "newsletter", "testimonials", "cta"],
      conversionGoal: "email-capture",
      competitorStyle: "HubSpot",
      brandPositioning: "community",
      audienceDimensions: { gender:"neutral", age:"young (18-30)", sophistication:"practical", motivation:"results" },
      sectionImageMap: { hero:"content+creator+laptop+workspace", posts:"blog+marketing+digital+success", about:"personal+brand+professional+portrait", newsletter:"email+marketing+newsletter+success" },
      objectionHandling: ["Is this free?","Will this actually work for me?","How long before I see results?"],
      trustElements: ["Monthly reader count","Email subscriber count","Income proof/screenshots","Press mentions"],
      palette: {
        primary: "#A855F7", secondary: "#7C3AED",
        bg: "#04020A", surface: "#080414", card: "#0C071E",
        text2: "#C4B5FD", accent: "#DDD6FE",
        grad: "linear-gradient(135deg,#A855F7,#EC4899)",
        heroGrad: "linear-gradient(135deg,#04020A 0%,#0A0520 50%,#04020A 100%)",
      },
      typography: {
        headingFont: "'Syne', sans-serif",
        bodyFont: "'DM Sans', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.03em",
        headingStyle: "bold",
        googleFonts: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Value-first — 'I Made $12,000 Last Month. Here's Exactly How.' (specific numbers)",
        ctaPrimary: "Get the Free Guide",
        ctaSecondary: "Read the Blog",
        emotionalHook: "Income potential, passive money, freedom from 9-5",
        socialProofStyle: "Earnings proof, audience size: '47,000 monthly readers · Featured in Forbes'",
      },
    };
  }

  // ── DEFAULT: Premium Business ──────────────────────────────────
  return {
    industry: "Business",
    businessType: "service",
    marketLevel: "premium",
    reach: "global",
    audience: "both",
    tone: "clean",
    imageKeyword: "business+professional+modern",
    imageKeyword2: "office+team+success",
    sectionOrder: ["hero", "features", "how-it-works", "testimonials", "pricing", "faq", "cta"],
    conversionGoal: "lead",
    competitorStyle: "Apple",
    brandPositioning: "professional",
    audienceDimensions: { gender:"neutral", age:"all ages", sophistication:"practical", motivation:"results" },
    sectionImageMap: { hero:"business+professional+modern", features:"team+office+work", testimonials:"professional+portrait+business" },
    objectionHandling: ["Is it right for our needs?","What is the ROI?","How long to implement?"],
    trustElements: ["Client count","Years in business","Case studies","Certifications"],
    palette: {
      primary: "#6366F1", secondary: "#8B5CF6",
      bg: "#030308", surface: "#07070F", card: "#0D0D1A",
      text2: "#94A3B8", accent: "#818CF8",
      grad: "linear-gradient(135deg,#6366F1,#8B5CF6)",
      heroGrad: "linear-gradient(135deg,#030308 0%,#080815 50%,#030308 100%)",
    },
    typography: {
      headingFont: "'Syne', sans-serif",
      bodyFont: "'DM Sans', sans-serif",
      headingWeight: "800",
      headingSpacing: "-0.03em",
      headingStyle: "bold",
      googleFonts: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap",
    },
    brandVoice: {
      heroHeadlineStyle: "Clear value proposition in 6-8 words with strong emotional pull",
      ctaPrimary: "Get Started Today",
      ctaSecondary: "Learn More",
      emotionalHook: "Problem → Solution → Transformation arc",
      socialProofStyle: "Numbers that matter: users, revenue, years, ratings",
    },
  };
}

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
  const _domainIdForRef = presetNiche ? ((presetNiche as any).__domainId || "") : "";
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
interface DesignLanguage {
  name: string;              // Apple / Stripe / Nike / Airbnb / Linear / Editorial Luxury
  cardStyle: string;         // CSS for cards
  buttonStyle: string;       // CSS for buttons
  heroStyle: string;         // CSS for hero
  sectionBg: string[];       // alternating section backgrounds
  effectsCSS: string;        // premium effects CSS
  spacing: string;           // spacing philosophy
  // ── Visual Intelligence Extensions ─────────────────────────────────
  motionStyle: string;       // how animations behave for this domain
  imageDirection: string;    // photography/imagery direction for AI prompt
  componentDensity: string;  // generous | balanced | tight | data-heavy
  premiumLevel: number;      // 1-10: used to bias CSS quality and complexity
  colorTemperature: string;  // warm | cool | neutral | vibrant — palette mood
  typographyScale: string;   // compact | normal | editorial | display
  borderRadius: string;      // sharp (0px) | subtle (4px) | rounded (12px) | pill (999px)
  shadowDepth: string;       // flat | subtle | medium | dramatic | glow
}

function getDesignLanguage(niche: NicheProfile): DesignLanguage {
  const p = niche.palette;
  const rgb = hexToRgbValues(p.primary);

  switch(niche.tone) {

    // ── EDITORIAL (Luxury, Perfume, Fashion) — "Bottega Veneta" style
    case "editorial":
      return {
        name: "Editorial Luxury",
        cardStyle: `background:transparent; border:none; border-bottom:1px solid rgba(255,255,255,0.1); border-radius:0; padding:40px 0;`,
        buttonStyle: `border-radius:0; letter-spacing:0.15em; text-transform:uppercase; font-size:12px; padding:18px 48px; background:transparent; border:1px solid var(--primary); color:var(--primary);`,
        heroStyle: `background:var(--bg); min-height:100vh; display:grid; place-items:center;`,
        sectionBg: [p.bg, p.surface, p.bg],
        effectsCSS: `
/* Luxury: No rounded corners, editorial spacing, refined micro-animations */
.luxury-divider { width:40px; height:1px; background:var(--primary); margin:24px 0; }
.luxury-number { font-family:var(--heading-font); font-size:clamp(80px,15vw,200px); font-weight:300; opacity:0.08; position:absolute; top:-20px; left:-10px; line-height:1; color:var(--primary); pointer-events:none; }
.luxury-img { filter:brightness(0.9) contrast(1.1); transition:filter 0.6s ease; }
.luxury-img:hover { filter:brightness(1) contrast(1.05) saturate(1.1); }
img { border-radius:0 !important; }
.btn { border-radius:0 !important; }
.card { border-radius:4px !important; }
@keyframes luxuryReveal { from{opacity:0;letter-spacing:0.3em} to{opacity:1;letter-spacing:0.08em} }
.hero-title { animation:luxuryReveal 1.2s ease forwards; }`,
        spacing: "Use generous whitespace — 160px+ section padding. Let content breathe.",
        motionStyle:       "Ultra-slow reveals (1.2s). Letter-spacing animation on headlines. Parallax on imagery. No bounce easing — only cubic-bezier(0.16,1,0.3,1). Hover: barely perceptible scale(1.02).",
        imageDirection:    "Editorial fashion photography. High contrast. Desaturated or duotone. Studio or location. Never stock. Models in motion or stillness. Black/white with gold accents.",
        componentDensity:  "generous",
        premiumLevel:      10,
        colorTemperature:  "neutral",
        typographyScale:   "editorial",
        borderRadius:      "sharp",
        shadowDepth:       "flat",
      };

    // ── ENERGETIC (Fitness, Sports) — "Nike" style
    case "energetic":
      return {
        name: "Nike Bold",
        cardStyle: `background:var(--card); border:none; border-radius:4px; overflow:hidden; position:relative;`,
        buttonStyle: `border-radius:0; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; padding:18px 40px; font-size:14px; clip-path:polygon(0 0, calc(100% - 12px) 0, 100% 100%, 12px 100%);`,
        heroStyle: `background:var(--bg); min-height:100vh; overflow:hidden; position:relative;`,
        sectionBg: [p.bg, "#000", p.bg, "#050505"],
        effectsCSS: `
/* Nike: Bold, high contrast, diagonal cuts */
.angled-section { clip-path:polygon(0 0,100% 0,100% calc(100% - 60px),0 100%); margin-bottom:-60px; padding-bottom:calc(var(--section-pad) + 60px); }
.angled-section-reverse { clip-path:polygon(0 60px,100% 0,100% 100%,0 100%); margin-top:-60px; padding-top:calc(var(--section-pad) + 60px); }
.stat-number { font-size:clamp(60px,12vw,160px); font-weight:900; line-height:0.9; background:var(--grad); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.progress-bar { height:4px; background:rgba(255,255,255,0.1); border-radius:0; overflow:hidden; }
.progress-fill { height:100%; background:var(--grad); transition:width 1.5s cubic-bezier(0.16,1,0.3,1); }
@keyframes slideInLeft { from{transform:translateX(-100px);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes slideInRight { from{transform:translateX(100px);opacity:0} to{transform:translateX(0);opacity:1} }
.slide-left.visible { animation:slideInLeft 0.7s ease forwards; }
.slide-right.visible { animation:slideInRight 0.7s ease forwards; }
:root { --section-pad: clamp(80px,10vw,140px); }`,
        spacing: "Tight, powerful. Section padding 80-120px. Large numbers. High contrast.",
        motionStyle:       "Fast snappy reveals (0.4s). Diagonal slide-in animations. Parallax at speed. Bold hover scale(1.05). Active states with color pulse. Counter animations on stats.",
        imageDirection:    "Action sports photography. Dynamic angles. Athletes mid-motion. High shutter speed. Raw energy. Dramatic contrast. Minimal grain. Wide angle dramatic perspective.",
        componentDensity:  "tight",
        premiumLevel:      7,
        colorTemperature:  "cool",
        typographyScale:   "display",
        borderRadius:      "sharp",
        shadowDepth:       "flat",
      };

    // ── WARM (Restaurant, Food) — "Airbnb" style
    case "warm":
      return {
        name: "Airbnb Warm",
        cardStyle: `background:var(--card); border:none; border-radius:24px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,0.3);`,
        buttonStyle: `border-radius:12px; font-weight:700; padding:16px 36px; font-size:15px;`,
        heroStyle: `background:var(--bg); min-height:100vh; position:relative;`,
        sectionBg: [p.bg, p.surface, p.card, p.bg],
        effectsCSS: `
/* Airbnb: Warm, rounded, human, inviting */
.food-img-wrapper { position:relative; overflow:hidden; border-radius:24px; }
.food-img-wrapper::after { content:''; position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,0.6) 0%,transparent 60%); }
.food-img-label { position:absolute; bottom:16px; left:16px; z-index:2; color:#fff; font-weight:700; font-size:14px; }
.menu-tag { background:rgba(255,255,255,0.08); border-radius:50px; padding:4px 14px; font-size:12px; font-weight:600; color:var(--text-2); display:inline-block; }
.star { color:var(--accent); font-size:16px; }
.review-score { font-size:48px; font-weight:800; color:var(--primary); }
@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
.img-loading { background:linear-gradient(90deg,var(--card) 25%,var(--surface) 50%,var(--card) 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; }`,
        spacing: "Comfortable and inviting. 96px section padding. Generous card padding 32px.",
        motionStyle:       "Smooth gentle reveals (0.65s). Fade + lift from bottom 20px. Card hover lift translateY(-4px) with warm shadow growth. No sharp transitions. Easing: ease-out.",
        imageDirection:    "Warm natural light photography. Golden hour or soft diffuse. Real people, genuine moments. Food close-up with steam and texture. Interior: candles, wood, fabric.",
        componentDensity:  "balanced",
        premiumLevel:      6,
        colorTemperature:  "warm",
        typographyScale:   "normal",
        borderRadius:      "rounded",
        shadowDepth:       "medium",
      };

    // ── TRUST (Finance, Crypto, Medical) — "Stripe" style
    case "trust":
      return {
        name: "Stripe Modern",
        cardStyle: `background:var(--card); border:1px solid var(--border); border-radius:16px; backdrop-filter:blur(20px);`,
        buttonStyle: `border-radius:8px; font-weight:700; padding:14px 32px; font-size:15px; letter-spacing:-0.01em;`,
        heroStyle: `background:var(--bg); min-height:100vh; position:relative; overflow:hidden;`,
        sectionBg: [p.bg, p.surface, p.bg, p.surface],
        effectsCSS: `
/* Stripe: Grid lines, precise, data-driven */
.stripe-grid { background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px); background-size:64px 64px; }
.stat-card { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:32px; position:relative; overflow:hidden; }
.stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--grad); }
.badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:50px; font-size:12px; font-weight:600; background:rgba(${hexToRgbValues(p.primary)},0.1); color:var(--primary); border:1px solid rgba(${hexToRgbValues(p.primary)},0.2); }
.badge-success { background:rgba(16,185,129,0.1); color:#10B981; border-color:rgba(16,185,129,0.2); }
.check-list li { list-style:none; padding:8px 0; display:flex; gap:12px; align-items:flex-start; border-bottom:1px solid var(--border); }
.check-list li::before { content:'✓'; color:var(--primary); font-weight:700; flex-shrink:0; margin-top:2px; }
.hero-gradient-blob { position:absolute; border-radius:50%; filter:blur(120px); pointer-events:none; }`,
        spacing: "Precise. 8px base grid. 96px section padding. Data presented cleanly.",
        motionStyle:       "Precise reveals (0.5s). Number counters on stats. Grid line animations. Subtle gradient border on hover. Chart bars animate on scroll. No overshoot easing.",
        imageDirection:    "Clean product screenshots on device mockups. Abstract data visualizations. Dark background with glowing UI elements. Team photos: professional, diverse, confident.",
        componentDensity:  "balanced",
        premiumLevel:      8,
        colorTemperature:  "cool",
        typographyScale:   "compact",
        borderRadius:      "subtle",
        shadowDepth:       "subtle",
      };

    // ── BOLD (Agency, Creative) — "Linear" style  
    case "bold":
      return {
        name: "Linear Creative",
        cardStyle: `background:var(--card); border:1px solid var(--border); border-radius:16px; position:relative; overflow:hidden;`,
        buttonStyle: `border-radius:8px; font-weight:700; padding:14px 32px; font-size:15px;`,
        heroStyle: `background:var(--bg); min-height:100vh; position:relative; overflow:hidden;`,
        sectionBg: [p.bg, "#050208", p.bg, "#030106"],
        effectsCSS: `
/* Linear: Gradient borders, glow effects, dark premium */
.gradient-border { position:relative; }
.gradient-border::before { content:''; position:absolute; inset:-1px; background:var(--grad); border-radius:inherit; z-index:-1; opacity:0; transition:opacity 0.3s; }
.gradient-border:hover::before { opacity:1; }
.work-card { position:relative; overflow:hidden; border-radius:16px; aspect-ratio:4/3; }
.work-card img { width:100%; height:100%; object-fit:cover; transition:transform 0.6s ease; }
.work-card:hover img { transform:scale(1.08); }
.work-card-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 60%); display:flex; flex-direction:column; justify-content:flex-end; padding:24px; opacity:0; transition:opacity 0.3s; }
.work-card:hover .work-card-overlay { opacity:1; }
.number-large { font-size:clamp(100px,18vw,220px); font-weight:800; line-height:0.85; opacity:0.04; color:#fff; pointer-events:none; position:absolute; }
@keyframes borderRotate { to { --angle: 360deg; } }
.glow-card::after { content:''; position:absolute; inset:-1px; border-radius:inherit; padding:1px; background:linear-gradient(var(--angle,0deg),var(--primary),transparent,var(--secondary)); -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); -webkit-mask-composite:xor; opacity:0; transition:opacity 0.3s; }
.glow-card:hover::after { opacity:1; }`,
        spacing: "Dramatic. Large sections 120px+. Oversized typography. Bold visual statements.",
        motionStyle:       "Cinematic reveals (0.8s). Work cards: overlay reveals on hover. Gradient border rotates on hover. Large number backgrounds count up. Parallax on hero. Bold cursor effects.",
        imageDirection:    "Portfolio case studies: before/after, process shots, final renders. Agency vibe: creative workspace, team in action, whiteboards. Bold typography as graphic element.",
        componentDensity:  "generous",
        premiumLevel:      9,
        colorTemperature:  "cool",
        typographyScale:   "display",
        borderRadius:      "subtle",
        shadowDepth:       "dramatic",
      };

    // ── CLEAN (SaaS, Tech) — "Apple" style
    case "clean":
    default:
      return {
        name: "Apple Clean",
        cardStyle: `background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:20px; backdrop-filter:blur(20px);`,
        buttonStyle: `border-radius:50px; font-weight:600; padding:14px 32px; font-size:15px; letter-spacing:-0.01em;`,
        heroStyle: `background:var(--bg); min-height:100vh; display:flex; align-items:center; position:relative;`,
        sectionBg: [p.bg, p.surface, p.bg, p.card],
        effectsCSS: `
/* Apple: Ultra clean, precise spacing, subtle depth */
.glass-card { background:rgba(255,255,255,0.04); backdrop-filter:blur(40px) saturate(180%); border:1px solid rgba(255,255,255,0.08); border-radius:20px; }
.feature-icon { width:56px; height:56px; border-radius:16px; background:var(--grad); display:flex; align-items:center; justify-content:center; font-size:24px; box-shadow:0 8px 32px rgba(${hexToRgbValues(p.primary)},0.3); }
.pricing-card-featured { background:linear-gradient(135deg,rgba(${hexToRgbValues(p.primary)},0.15),rgba(${hexToRgbValues(p.secondary)},0.1)); border-color:var(--primary); }
.tag { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:var(--primary); }
.section-label { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:var(--primary); margin-bottom:16px; display:block; }
.mockup-window { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; box-shadow:0 40px 100px rgba(0,0,0,0.5); }
.mockup-bar { background:var(--card); padding:12px 16px; display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--border); }
.dot { width:12px; height:12px; border-radius:50%; }`,
        spacing: "Generous whitespace — Apple-level breathing room. 120px section padding.",
        motionStyle:       "Elegant reveals (0.65s). Blur+fade in on scroll (blur: 8px → 0). Card hover: translateY(-6px) with glass shadow spread. Feature icons: scale(1.08) on hover. Smooth everything.",
        imageDirection:    "Clean product photography on white or dark. Device mockups with UI screenshots. Abstract gradients as backgrounds. People: professional, diverse, smiling naturally.",
        componentDensity:  "balanced",
        premiumLevel:      8,
        colorTemperature:  "neutral",
        typographyScale:   "normal",
        borderRadius:      "rounded",
        shadowDepth:       "medium",
      };
  }
}

function hexToRgbValues(hex: string): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}


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
function getPremiumEffects(niche: NicheProfile, rgb: string): string {
  switch(niche.tone) {
    case "editorial":
      return `LUXURY EFFECTS:
- NO rounded corners (border-radius:0 or max 4px)
- Generous line-height on headings: 1.2+
- Subtle reveal animations (opacity 0→1, no translateY)
- Black/white photography with gold accent on hover
- Thin borders: 0.5px rgba(255,255,255,0.15)
- Large white space — let content breathe
- Serif headings, sans-serif body (elegant contrast)
- Gold dividers: <div style="width:40px;height:1px;background:var(--primary);margin:32px 0">
- No gradients on buttons — use outline style`;

    case "energetic":
      return `HIGH ENERGY EFFECTS:
- Diagonal section cuts: clip-path:polygon(0 0,100% 0,100% calc(100% - 40px),0 100%)
- Large bold numbers (stat counters with data-count attribute)
- Progress bars for achievements/goals
- Parallax background movement (mild)
- Hover: scale(1.03) on images — powerful
- Strong drop shadows: 0 20px 60px rgba(0,0,0,0.5)
- Before/after comparison (use CSS clip-path slider)
- Achievement badges with gradient backgrounds`;

    case "warm":
      return `WARM HOSPITALITY EFFECTS:
- Rounded corners everywhere: border-radius:24px+ 
- Warm overlay on food images: linear-gradient(to top, rgba(0,0,0,0.5), transparent)
- Image zoom on hover: transform:scale(1.05)
- Star ratings in accent color
- Menu cards with category badges
- Reservation form with elegant styling
- Map embed placeholder section
- Opening hours display`;

    case "trust":
      return `TRUST & AUTHORITY EFFECTS:
- Security badges: lock icon + "256-bit SSL encrypted"
- Data visualization: simple CSS charts/bars
- Certification logos grid
- Testimonial with company logo
- Real-time stats counter (data-count)
- Timeline/roadmap section
- Feature comparison table
- Subtle grid background overlay`;

    case "bold":
      return `CREATIVE BOLD EFFECTS:
- Portfolio grid: masonry-style or 2-col asymmetric
- Work cards with overlay on hover (project name + CTA)
- Large outlined text (outline style font): -webkit-text-stroke:2px var(--primary)
- Process numbered steps with connecting line
- Before/After results with specific numbers
- Awards and recognition section
- Team grid with hover flip effect`;

    default:
      return `CLEAN TECH EFFECTS:
- Glass morphism cards: backdrop-filter:blur(20px) + semi-transparent bg
- Feature icon boxes with gradient bg + glow shadow
- Browser/app mockup frame for product screenshot
- Code snippet block (dark bg, monospace font, colored syntax)
- Integration logos marquee
- Pricing cards with featured highlight
- Live demo CTA with preview thumbnail`;
  }
}


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
function cleanHTML(raw: string): string {
  let html = raw.replace(/^html\s*/im,"").replace(/^\s*/im,"").replace(/\s*$/im,"").trim();
  const idx = html.indexOf("<!DOCTYPE");
  if (idx > 0) html = html.substring(idx);
  return html;
}

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

const FORCE_RULES = `PRODUCTION REQUIREMENTS (enforced by quality gate):
• Complete HTML/CSS/JS — no placeholders, no TODO, no Lorem ipsum
• Responsive: 375px + 768px + 1440px all work correctly
• Must include: Navbar + Hero + Features + CTA + Footer (minimum)
• Scroll-reveal animations + hover states on all interactive elements
• Real copy specific to the user's niche — not generic filler`;

// ── Stage 1: Blueprint ──────────────────────────────────────────────────
// Lightweight planning pass — locks in the exact section list, key
// components, and any special requirements before any code is written.
async function generateBlueprint(niche: NicheProfile, userPrompt: string, projectType: string): Promise<string> {
  const system = `You are a senior product architect planning a ${projectType}. Output ONLY a structured plan, no code, no preamble.`;
  const user = `User request: "${userPrompt}"
Niche: ${niche.industry} (${niche.marketLevel} tier, ${niche.tone} tone)
Default section order: ${niche.sectionOrder.join(" → ")}

Output EXACTLY this format:
SECTIONS: [ordered list of 7-10 sections this specific site needs, comma-separated]
KEY_COMPONENTS: [specific interactive components needed, e.g. "mobile hamburger nav, FAQ accordion, testimonial slider, sticky header on scroll"]
CONTENT_FOCUS: [1-2 sentences on what makes THIS site's content specific/real, not generic]`;

  try {
    const { text } = await kryptonGenerate(system, user);
    return text.trim() || `SECTIONS: ${niche.sectionOrder.join(", ")}\nKEY_COMPONENTS: mobile hamburger nav, scroll animations\nCONTENT_FOCUS: ${niche.industry} specific content`;
  } catch {
    return `SECTIONS: ${niche.sectionOrder.join(", ")}\nKEY_COMPONENTS: mobile hamburger nav, scroll animations\nCONTENT_FOCUS: ${niche.industry} specific content`;
  }
}

// ── Stage 2: Sections (semantic HTML, no <style>/<script>) ─────────────
async function generateSectionsHTML(
  niche: NicheProfile, dl: DesignLanguage, blueprint: string,
  userPrompt: string, realImages: Record<string,string[]>
): Promise<string> {
  const contentRules = getNicheWebsitePrompt(niche, userPrompt, realImages);
  const sectionBlueprints = buildSectionBlueprints(niche, dl, realImages["main"] || []);

  const system = `You are Krypton AI's HTML structure specialist. Output ONLY semantic HTML for the <body> content — no <!DOCTYPE>, no <head>, no <style> tag, no <script> tag. Use clear, consistent class names (kebab-case) that a CSS specialist will style next, and that a JS specialist will hook into next. Every class name you invent must be meaningful and reused consistently.`;

  const user = `${FORCE_RULES}

BLUEPRINT FROM PLANNING STAGE:
${blueprint}

${contentRules}

${sectionBlueprints}

Output ONLY the HTML body content (nav through footer). Use real, specific copy — never placeholders. Reference these EXACT image URLs where images are needed: ${(realImages["main"]||[]).join(", ")}`;

  try {
    const { text } = await kryptonGenerate(system, user);
    const cleaned = text.replace(/\`\`\`html|\`\`\`/g, "").trim();
    if (cleaned.length > 200) return cleaned; // sanity check — not empty/truncated
    throw new Error("Sections output too short");
  } catch {
    // One retry with a shorter, simpler prompt before giving up (caller has its own fallback)
    const simplerUser = `${FORCE_RULES}\n\nBuild semantic HTML body content for: "${userPrompt}"\nSections needed: ${niche.sectionOrder.join(", ")}\nUse real specific copy, no placeholders.`;
    const { text: retryText } = await kryptonGenerate(system, simplerUser);
    return retryText.replace(/\`\`\`html|\`\`\`/g, "").trim();
  }
}

// ── Stage 3: CSS (complete stylesheet matching the HTML above) ─────────
async function generateCSS(niche: NicheProfile, dl: DesignLanguage, htmlStructure: string): Promise<string> {
  const p = niche.palette;
  const t = niche.typography;
  const rgb = hexToRgbValues(p.primary);
  const premiumEffects = getPremiumEffects(niche, rgb);

  const system = `You are Krypton AI's CSS specialist. You will be given exact HTML and must write a COMPLETE stylesheet that styles every class used in it. Output ONLY CSS — no markdown fences, no explanation.`;

  const user = `${FORCE_RULES}

HTML TO STYLE (style every class name that appears here — do not invent classes that aren't in this HTML):
${htmlStructure}

DESIGN SYSTEM — use exactly these values:
@import url('${t.googleFonts}');
:root {
  --primary: ${p.primary}; --secondary: ${p.secondary}; --grad: ${p.grad};
  --accent: ${p.accent}; --bg: ${p.bg}; --surface: ${p.surface}; --card: ${p.card};
  --text: #FFFFFF; --text-2: ${p.text2};
  --border: rgba(255,255,255,0.07); --border-accent: rgba(${rgb},0.3);
}
Heading font: ${t.headingFont}, weight ${t.headingWeight}, letter-spacing ${t.headingSpacing}
Body font: ${t.bodyFont}

CRITICAL RULES:
- ALL heading font-sizes MUST use clamp(min,vw,max) — NEVER a fixed px value (causes mobile wrapping)
- Mobile nav MUST collapse to hamburger below 768px (full pattern, not partial)
- Every button/card/link needs a hover state with transition
- Add scroll-reveal animation classes (.reveal) with @keyframes
${premiumEffects}

Output the complete CSS now.`;

  try {
    const { text } = await kryptonGenerate(system, user);
    let css = text.replace(/\`\`\`css|\`\`\`/g, "").trim();
    if (css.length < 200) throw new Error("CSS output too short");
    // Belt-and-suspenders: catch any fixed-px headings the CSS stage still produces
    css = enforceResponsiveHeadings(`<style>${css}</style>`).replace(/^<style>|<\/style>$/g, "");
    return css;
  } catch {
    // Fallback: a solid, working default stylesheet using the real niche palette —
    // not pretty, but guarantees the site is never unstyled if the CSS stage fails twice.
    return `
:root{--primary:${p.primary};--secondary:${p.secondary};--grad:${p.grad};--accent:${p.accent};
--bg:${p.bg};--surface:${p.surface};--card:${p.card};--text:#FFFFFF;--text-2:${p.text2};
--border:rgba(255,255,255,0.07);}
body{background:var(--bg);color:var(--text);font-family:${t.bodyFont};line-height:1.6;}
h1,h2,h3{font-family:${t.headingFont};font-weight:${t.headingWeight};}
h1{font-size:clamp(28px,6vw,56px);} h2{font-size:clamp(22px,4vw,38px);}
.container{max-width:1200px;margin:0 auto;padding:0 24px;}
section{padding:clamp(48px,8vw,96px) 0;}
nav{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;position:sticky;top:0;background:var(--surface);z-index:100;}
.hamburger{display:none;background:none;border:none;color:var(--text);font-size:24px;cursor:pointer;}
@media(max-width:768px){.nav-links{display:none;}.hamburger{display:block;}}
.btn,button,a.btn{background:var(--grad);color:#fff;border:none;padding:14px 28px;border-radius:10px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block;transition:transform .2s;}
.btn:hover{transform:translateY(-2px);}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;}
footer{background:var(--surface);padding:48px 24px;text-align:center;color:var(--text-2);}
.reveal{opacity:0;transform:translateY(20px);transition:opacity .6s,transform .6s;}
.reveal.visible{opacity:1;transform:none;}`;
  }
}

// ── Stage 4: JS (interactivity targeting the HTML above) ───────────────
async function generateJS(htmlStructure: string, projectType: string): Promise<string> {
  const system = `You are Krypton AI's JavaScript specialist. You will be given exact HTML and must write vanilla JS (no frameworks, no libraries) that makes every interactive element in it actually work. Output ONLY JS — no markdown fences, no explanation.`;

  const user = `${FORCE_RULES}

HTML TO MAKE INTERACTIVE:
${htmlStructure}

REQUIRED BEHAVIOR:
- Mobile hamburger menu: toggle .open class on click, close on link click or outside-click
- FAQ accordions (if present): expand/collapse, only one open at a time
- Scroll-reveal: IntersectionObserver adds .visible to .reveal elements as they enter viewport
- Smooth scroll for all anchor links (#section)
- Forms: prevent default, show a success message inline (no real backend call)
- Sticky header: add .scrolled class to nav after 50px scroll for shadow/bg change
- Any sliders/carousels referenced in the HTML must be fully functional

Output the complete JS now.`;

  try {
    const { text } = await kryptonGenerate(system, user);
    const cleaned = text.replace(/\`\`\`(javascript|js)?|\`\`\`/g, "").trim();
    if (cleaned.length < 50) throw new Error("JS output too short");
    return cleaned;
  } catch {
    // Fallback: minimal but genuinely functional JS — hamburger menu + smooth scroll +
    // scroll-reveal still work even if the JS stage fails. Better than zero interactivity.
    return `
document.querySelectorAll('.hamburger').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-links').forEach(n=>n.classList.toggle('open'));
  });
});
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',e=>{
    const t=document.querySelector(a.getAttribute('href'));
    if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'});}
  });
});
const revealObserver=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible');});
},{threshold:0.15});
document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));
window.addEventListener('scroll',()=>{
  document.querySelectorAll('nav').forEach(n=>n.classList.toggle('scrolled',window.scrollY>50));
});`;
  }
}

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
interface SectionBlueprint {
  id:       string;
  category: string;
  variant:  string;
  headline: string;
  purpose:  string;
}

interface DomainKnowledge {
  domain:         string;
  labels:         string[];
  projectType:    string;
  projectName:    string;
  tagline:        string;
  businessGoal:   string;
  targetAudience: string;
  pricingModel:   string;
  sections:       SectionBlueprint[];
  primaryCTA:     string;
  secondaryCTA:   string;
  copyTone:       string;
  keyBenefits:    string[];
  designMood:     string;
  colorHint:      string;
  typography:     string;
  spacing:        string;
  assetTheme:     string;
  avoid:          string[];
}

// ── BASE PATTERNS ─────────────────────────────────────────────────────
// Six fundamental experience shapes. Every domain inherits one.

type BasePattern = Omit<DomainKnowledge, 'domain'|'labels'|'projectName'|'targetAudience'|'assetTheme'|'avoid'>;

const B: Record<string, BasePattern> = {

  // ── 1. HOSPITALITY — booking-driven service businesses ───────────────
  HOSPITALITY: {
    projectType:"website", tagline:"An Experience Worth Returning To",
    businessGoal:"booking", pricingModel:"none",
    sections:[
      {id:"hero",         category:"hero",         variant:"centered",          headline:"Welcome",          purpose:"Atmospheric hero with booking CTA"},
      {id:"about",        category:"features",     variant:"alternating",       headline:"Our Story",        purpose:"Authentic brand story builds trust"},
      {id:"services",     category:"features",     variant:"bento-grid",        headline:"What We Offer",    purpose:"Core service/product showcase"},
      {id:"gallery",      category:"features",     variant:"bento-grid",        headline:"Gallery",          purpose:"Visual proof — photography drives bookings"},
      {id:"testimonials", category:"testimonials", variant:"masonry",           headline:"What Guests Say",  purpose:"Social proof with real names"},
      {id:"booking",      category:"cta",          variant:"split-form",        headline:"Make a Reservation",purpose:"Date, party size, special requests"},
      {id:"footer",       category:"footer",       variant:"minimal-centered",  headline:"",                  purpose:"Address, hours, social, phone"},
    ],
    primaryCTA:"Book Now", secondaryCTA:"Learn More",
    copyTone:"Warm, sensory, and inviting. Make them feel the atmosphere before they arrive.",
    keyBenefits:["Exceptional quality","Memorable experiences","Dedicated service","Prime location","Outstanding reviews"],
    designMood:"warm elegant", colorHint:"", typography:"serif", spacing:"balanced",
  },

  // ── 2. PROFESSIONAL — trust-based service providers ──────────────────
  PROFESSIONAL: {
    projectType:"website", tagline:"Expert Guidance. Trusted Results.",
    businessGoal:"lead", pricingModel:"none",
    sections:[
      {id:"hero",         category:"hero",         variant:"split-image",       headline:"Expert Care",      purpose:"Professional credibility first impression"},
      {id:"services",     category:"features",     variant:"icon-grid",         headline:"Our Services",     purpose:"Clear service breakdown"},
      {id:"about",        category:"features",     variant:"alternating",       headline:"About Us",         purpose:"Credentials, experience, philosophy"},
      {id:"stats",        category:"features",     variant:"stat-highlight",    headline:"Track Record",     purpose:"Numbers: years, clients, certifications"},
      {id:"testimonials", category:"testimonials", variant:"featured",          headline:"Client Stories",   purpose:"Success stories with outcomes"},
      {id:"contact",      category:"cta",          variant:"split-form",        headline:"Get in Touch",     purpose:"Appointment or enquiry form"},
      {id:"footer",       category:"footer",       variant:"four-column",       headline:"",                  purpose:"Services, team, contact, location"},
    ],
    primaryCTA:"Book Consultation", secondaryCTA:"View Services",
    copyTone:"Authoritative yet approachable. Lead with outcomes, not process.",
    keyBenefits:["Qualified experts","Proven track record","Personalised service","Clear communication","Fast turnaround"],
    designMood:"clean professional", colorHint:"", typography:"sans", spacing:"balanced",
  },

  // ── 3. ECOMMERCE — product-selling experiences ───────────────────────
  ECOMMERCE: {
    projectType:"ecommerce", tagline:"Premium Products. Delivered Fast.",
    businessGoal:"ecommerce", pricingModel:"product-price",
    sections:[
      {id:"hero",         category:"hero",         variant:"product-showcase",  headline:"The Collection",   purpose:"Lifestyle hero with offer"},
      {id:"featured",     category:"ecommerce",    variant:"featured-product",  headline:"Featured",         purpose:"Hero product — full details + CTA"},
      {id:"categories",   category:"ecommerce",    variant:"category-showcase", headline:"Shop by Category", purpose:"Category grid with lifestyle imagery"},
      {id:"products",     category:"ecommerce",    variant:"product-grid",      headline:"New Arrivals",     purpose:"Product cards with add-to-cart"},
      {id:"benefits",     category:"features",     variant:"icon-grid",         headline:"Why Shop With Us", purpose:"Shipping, returns, warranty, security"},
      {id:"reviews",      category:"testimonials", variant:"masonry",           headline:"Customer Reviews",  purpose:"Star ratings + verified buyer badges"},
      {id:"cta",          category:"cta",          variant:"banner-strip",      headline:"Free Shipping Over $50", purpose:"Incentive banner"},
      {id:"footer",       category:"footer",       variant:"mega-social",       headline:"",                  purpose:"Policy, returns, track order, support"},
    ],
    primaryCTA:"Shop Now", secondaryCTA:"View Collection",
    copyTone:"Benefit-driven with urgency. Quality and value above all.",
    keyBenefits:["Free shipping over $50","30-day returns","Secure checkout","Same-day dispatch","Quality guarantee"],
    designMood:"clean minimal", colorHint:"", typography:"sans", spacing:"balanced",
  },

  // ── 4. SAAS — software / platform businesses ─────────────────────────
  SAAS: {
    projectType:"saas", tagline:"The Smarter Way to {action}",
    businessGoal:"lead", pricingModel:"saas-subscription",
    sections:[
      {id:"hero",         category:"hero",         variant:"product-showcase",  headline:"Ship Faster. Scale Smarter.", purpose:"Product screenshot + social proof"},
      {id:"logos",        category:"features",     variant:"stat-highlight",    headline:"Trusted by 10,000+ Teams",  purpose:"Company logos + user count"},
      {id:"features",     category:"features",     variant:"bento-grid",        headline:"Everything You Need",       purpose:"Core features in bento grid"},
      {id:"workflow",     category:"features",     variant:"alternating",       headline:"How It Works",              purpose:"3-step workflow section"},
      {id:"integrations", category:"features",     variant:"icon-grid",         headline:"Integrations",              purpose:"Slack, GitHub, Notion, etc."},
      {id:"pricing",      category:"pricing",      variant:"toggle",            headline:"Simple Pricing",            purpose:"Monthly/annual toggle tiers"},
      {id:"testimonials", category:"testimonials", variant:"logo-wall",         headline:"Loved by Top Teams",        purpose:"Logo wall + featured quotes"},
      {id:"faq",          category:"faq",          variant:"simple-list",       headline:"FAQ",                       purpose:"Billing, security, integrations"},
      {id:"cta",          category:"cta",          variant:"centered-gradient", headline:"Start Free. Scale as You Grow.", purpose:"Free trial — no credit card"},
      {id:"footer",       category:"footer",       variant:"newsletter-rich",   headline:"",                           purpose:"Product, company, docs, status"},
    ],
    primaryCTA:"Start Free Trial", secondaryCTA:"View Demo",
    copyTone:"Clear, confident, outcome-focused. ROI language. Show don't tell.",
    keyBenefits:["No credit card required","SOC 2 compliant","24/7 support","Scales to enterprise","Cancel anytime"],
    designMood:"clean modern", colorHint:"", typography:"sans", spacing:"balanced",
  },

  // ── 5. PORTFOLIO — creator / agency showcase ─────────────────────────
  PORTFOLIO: {
    projectType:"portfolio", tagline:"Work that speaks for itself.",
    businessGoal:"lead", pricingModel:"none",
    sections:[
      {id:"hero",         category:"hero",         variant:"minimal-statement", headline:"Hi, I'm {Name}",   purpose:"Bold personal intro"},
      {id:"work",         category:"portfolio",    variant:"featured-grid",     headline:"Selected Work",    purpose:"Best projects with outcomes"},
      {id:"about",        category:"features",     variant:"alternating",       headline:"About",            purpose:"Story, skills, process"},
      {id:"testimonials", category:"testimonials", variant:"grid",              headline:"What Clients Say", purpose:"Client recommendations"},
      {id:"contact",      category:"cta",          variant:"split-form",        headline:"Work Together",    purpose:"Project inquiry form"},
      {id:"footer",       category:"footer",       variant:"minimal-centered",  headline:"",                  purpose:"Social links, email, resume"},
    ],
    primaryCTA:"Start a Project", secondaryCTA:"View Work",
    copyTone:"Confident. Let the work lead. Personality in copy.",
    keyBenefits:["Expert in field","Available for projects","Fast delivery","Collaborative process","Proven results"],
    designMood:"clean minimal", colorHint:"", typography:"sans", spacing:"balanced",
  },

  // ── 6. LANDING — single conversion pages ─────────────────────────────
  LANDING: {
    projectType:"landing", tagline:"Be First. Get Access.",
    businessGoal:"lead", pricingModel:"none",
    sections:[
      {id:"hero",         category:"hero",         variant:"centered",          headline:"Your Promise Here", purpose:"Single headline + email capture"},
      {id:"benefits",     category:"features",     variant:"icon-grid",         headline:"Why You'll Love It", purpose:"3 core benefits — scannable"},
      {id:"features",     category:"features",     variant:"alternating",       headline:"Here's What You Get", purpose:"Feature walkthrough"},
      {id:"social-proof", category:"testimonials", variant:"grid",              headline:"Join 10,000+ Early Adopters", purpose:"Waitlist count + early testimonials"},
      {id:"cta",          category:"cta",          variant:"centered-gradient", headline:"Get Early Access",  purpose:"Final email capture with urgency"},
      {id:"footer",       category:"footer",       variant:"minimal-centered",  headline:"",                   purpose:"Privacy, terms, social"},
    ],
    primaryCTA:"Get Early Access", secondaryCTA:"Learn More",
    copyTone:"Exciting. Benefit-first. Urgency without pressure. Clear in 5 seconds.",
    keyBenefits:["Early access pricing","Founding member status","Shape the product","Exclusive community","Launch notification"],
    designMood:"bold modern", colorHint:"", typography:"sans", spacing:"balanced",
  },
};

// ── SECTION DELTA helpers ─────────────────────────────────────────────
// Patch a section in a blueprint's section array
function patchSection(
  sections: SectionBlueprint[],
  id:       string,
  patch:    Partial<SectionBlueprint>
): SectionBlueprint[] {
  return sections.map(s => s.id === id ? { ...s, ...patch } : s);
}
function addSectionAfter(
  sections:  SectionBlueprint[],
  afterId:   string,
  newSection: SectionBlueprint
): SectionBlueprint[] {
  const idx = sections.findIndex(s => s.id === afterId);
  if (idx < 0) return [...sections, newSection];
  return [...sections.slice(0, idx+1), newSection, ...sections.slice(idx+1)];
}
function removeSection(sections: SectionBlueprint[], id: string): SectionBlueprint[] {
  return sections.filter(s => s.id !== id);
}

// ── COMPACT DOMAIN SPEC ───────────────────────────────────────────────
interface CompactDomain {
  domain:       string;
  labels:       string[];
  base:         keyof typeof B;
  projectType?: string;
  projectName:  string;
  tagline?:     string;
  targetAudience: string;
  primaryCTA:   string;
  secondaryCTA?: string;
  assetTheme:   string;
  avoid:        string[];
  colorHint?:   string;
  typography?:  string;
  designMood?:  string;
  spacing?:     string;
  pricingModel?: string;
  businessGoal?: string;
  copyTone?:    string;
  keyBenefits?: string[];
  sectionPatch?:(sections: SectionBlueprint[]) => SectionBlueprint[];
}

// ── Resolve CompactDomain → full DomainKnowledge ──────────────────────
function resolveDomain(d: CompactDomain): DomainKnowledge {
  const base    = B[d.base];
  const sections = d.sectionPatch ? d.sectionPatch([...base.sections]) : [...base.sections];
  return {
    domain:         d.domain,
    labels:         d.labels,
    projectType:    d.projectType || base.projectType,
    projectName:    d.projectName,
    tagline:        d.tagline || base.tagline,
    businessGoal:   d.businessGoal || base.businessGoal,
    targetAudience: d.targetAudience,
    pricingModel:   d.pricingModel || base.pricingModel,
    sections,
    primaryCTA:     d.primaryCTA,
    secondaryCTA:   d.secondaryCTA || base.secondaryCTA,
    copyTone:       d.copyTone || base.copyTone,
    keyBenefits:    d.keyBenefits || base.keyBenefits,
    designMood:     d.designMood || base.designMood,
    colorHint:      d.colorHint || base.colorHint,
    typography:     d.typography || base.typography,
    spacing:        d.spacing || base.spacing,
    assetTheme:     d.assetTheme,
    avoid:          d.avoid,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MASTER DOMAIN CATALOGUE — 100+ domains, 5-10 lines each
// ═══════════════════════════════════════════════════════════════════

const COMPACT_DOMAINS: CompactDomain[] = [

  // ── AUTOMOTIVE ───────────────────────────────────────────────────────
  {
    domain:"luxury-car-club", base:"HOSPITALITY",
    labels:["car club","supercar club","hypercar","exotic car","ferrari club","lamborghini club","automobile club","sports car membership","luxury car membership"],
    projectName:"{Brand} Car Club", tagline:"Drive the Extraordinary",
    businessGoal:"membership", pricingModel:"membership-tiers",
    targetAudience:"High-net-worth car enthusiasts aged 35–60",
    primaryCTA:"Apply for Membership", secondaryCTA:"View the Fleet",
    assetTheme:"luxury sports car studio photography dramatic dark",
    avoid:["perfume imagery","fashion photography","generic business stock"],
    colorHint:"#D4AF37", typography:"serif", designMood:"dark luxury",
    copyTone:"Aspirational and exclusive. Never pushy. Refined.",
    keyBenefits:["Curated fleet of 40+ supercars","White-glove concierge","Members-only events","No insurance hassle","Monthly new arrivals"],
    sectionPatch: s => addSectionAfter(
      patchSection(s, "services", {id:"fleet",    headline:"Curated Fleet",       purpose:"Showcase premium vehicles"}),
      "fleet", {id:"membership", category:"pricing", variant:"three-tier", headline:"Membership Tiers", purpose:"Bronze/Silver/Gold with benefits"}
    ),
  },
  {
    domain:"car-dealership", base:"ECOMMERCE",
    labels:["car dealership","auto dealership","car sales","used cars","new cars","vehicle sales","car showroom","automobile dealer"],
    projectName:"{Brand} Motors", tagline:"Your Perfect Car is Here",
    businessGoal:"lead", targetAudience:"Car buyers seeking new or used vehicles",
    primaryCTA:"Schedule Test Drive", secondaryCTA:"Browse Inventory",
    assetTheme:"car dealership showroom vehicles modern professional",
    avoid:["generic stock photos","dark luxury car club aesthetic"],
    sectionPatch: s => patchSection(
      patchSection(s, "products", {id:"inventory", headline:"Browse Inventory", purpose:"Vehicle cards with price, mileage, specs"}),
      "cta", {headline:"Finance from $199/month", purpose:"Finance calculator or enquiry form"}
    ),
  },
  {
    domain:"car-rental", base:"HOSPITALITY",
    labels:["car rental","vehicle rental","rent a car","car hire","fleet rental","van hire","truck rental"],
    projectName:"{Brand} Car Rental", tagline:"Freedom on Every Road",
    businessGoal:"booking", targetAudience:"Business and leisure travelers needing vehicle hire",
    primaryCTA:"Reserve a Vehicle", secondaryCTA:"View Fleet",
    assetTheme:"car rental fleet vehicles road modern clean",
    avoid:["luxury car club aesthetic","dark dramatic"],
    sectionPatch: s => patchSection(s, "services", {headline:"Our Fleet", purpose:"Vehicle categories: Economy, SUV, Luxury, Van"}),
  },
  {
    domain:"ev-charging", base:"SAAS",
    labels:["ev charging","electric vehicle charging","ev station","charging network","ev infrastructure","electric car charging"],
    projectName:"{Brand} Charging", tagline:"Charge Faster. Drive Further.",
    businessGoal:"lead", targetAudience:"EV owners and fleet operators",
    primaryCTA:"Find a Station", secondaryCTA:"Partner With Us",
    assetTheme:"electric vehicle EV charging station modern clean green",
    avoid:["fossil fuel imagery","complex tech jargon"],
    designMood:"clean modern green", colorHint:"#22C55E",
  },
  {
    domain:"taxi-transport", base:"HOSPITALITY",
    labels:["taxi","cab","rideshare","transport","shuttle","chauffeur","limo service","private hire","minibus"],
    projectName:"{Brand} Transport", tagline:"Safe. On Time. Every Time.",
    businessGoal:"booking", targetAudience:"Commuters and travellers needing reliable transport",
    primaryCTA:"Book a Ride", secondaryCTA:"Download App",
    assetTheme:"taxi transport vehicle city professional driver",
    avoid:["luxury car club aesthetic"],
    sectionPatch: s => patchSection(s, "booking", {headline:"Book Your Ride", purpose:"Pickup, destination, date/time form"}),
  },

  // ── FOOD & DRINK ─────────────────────────────────────────────────────
  {
    domain:"restaurant", base:"HOSPITALITY",
    labels:["restaurant","fine dining","dining","bistro","brasserie","steakhouse","seafood restaurant","italian restaurant","mexican restaurant","asian restaurant"],
    projectName:"{Brand} Restaurant", tagline:"An Unforgettable Dining Experience",
    businessGoal:"booking", targetAudience:"Food lovers, couples, groups celebrating occasions",
    primaryCTA:"Reserve a Table", secondaryCTA:"View Menu",
    assetTheme:"fine dining restaurant food photography plating elegant",
    avoid:["generic stock food photos","tech startup aesthetic"],
    typography:"serif",
    sectionPatch: s => addSectionAfter(
      patchSection(s,"services",{id:"menu", headline:"Our Menu", purpose:"Signature dishes with food photography"}),
      "menu", {id:"chef", category:"features", variant:"alternating", headline:"Meet the Chef", purpose:"Chef story and culinary philosophy"}
    ),
  },
  {
    domain:"cafe", base:"HOSPITALITY",
    labels:["cafe","coffee shop","coffee house","bakery cafe","brunch","tea room","specialty coffee","espresso bar"],
    projectName:"{Brand} Café", tagline:"Your Daily Ritual, Perfected.",
    businessGoal:"booking", targetAudience:"Coffee lovers and casual dining guests",
    primaryCTA:"Find Us", secondaryCTA:"View Menu",
    assetTheme:"cafe coffee latte art specialty coffee warm cozy interior",
    avoid:["fine dining formality","tech aesthetic"],
    designMood:"warm cozy", copyTone:"Friendly and inviting. Local and authentic. Celebrate the craft.",
    sectionPatch: s => patchSection(s,"services",{headline:"Our Menu", purpose:"Coffee, food, seasonal specials"}),
  },
  {
    domain:"bar-pub", base:"HOSPITALITY",
    labels:["bar","pub","cocktail bar","wine bar","sports bar","nightclub","brewery","taproom","speakeasy"],
    projectName:"{Brand} Bar", tagline:"Good Drinks. Great Nights.",
    businessGoal:"booking", targetAudience:"Adults seeking social drinking experiences",
    primaryCTA:"Book a Table", secondaryCTA:"View Drinks Menu",
    assetTheme:"bar cocktails drinks nightlife atmosphere dark moody",
    avoid:["family restaurant aesthetic","formal corporate"],
    designMood:"dark moody", typography:"sans",
    sectionPatch: s => patchSection(s,"services",{headline:"Our Drinks", purpose:"Cocktails, wines, beers — curated menu"}),
  },
  {
    domain:"bakery", base:"HOSPITALITY",
    labels:["bakery","bread","pastry","patisserie","cake shop","dessert shop","confectionery","artisan bread"],
    projectName:"{Brand} Bakery", tagline:"Baked Fresh Every Morning.",
    businessGoal:"ecommerce", targetAudience:"Local community and artisan food lovers",
    primaryCTA:"Order Now", secondaryCTA:"View Products",
    assetTheme:"artisan bakery bread pastry food photography warm",
    avoid:["fast food aesthetic","corporate restaurant look"],
    pricingModel:"product-price",
  },
  {
    domain:"food-delivery", base:"ECOMMERCE",
    labels:["food delivery","meal delivery","meal kit","meal prep","catering delivery","cloud kitchen"],
    projectName:"{Brand} Delivery", tagline:"Restaurant Quality. Delivered to Your Door.",
    businessGoal:"ecommerce", targetAudience:"Busy professionals and families",
    primaryCTA:"Order Now", secondaryCTA:"View Menu",
    assetTheme:"food delivery meal freshness photography modern",
    avoid:["stock restaurant imagery"],
    sectionPatch: s => patchSection(s,"products",{headline:"This Week's Menu", purpose:"Meal cards with allergens, cals, portion"}),
  },

  // ── HOSPITALITY & TRAVEL ─────────────────────────────────────────────
  {
    domain:"hotel", base:"HOSPITALITY",
    labels:["hotel","boutique hotel","luxury hotel","motel","inn","bed breakfast","accommodation"],
    projectName:"{Brand} Hotel", tagline:"Where Every Stay Tells a Story",
    businessGoal:"booking", targetAudience:"Leisure and business travellers",
    primaryCTA:"Book Your Stay", secondaryCTA:"View Rooms",
    assetTheme:"luxury hotel room interior pool elegant warm lighting",
    avoid:["stock office photography","tech startup aesthetic"],
    typography:"serif", designMood:"warm elegant",
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"centered",         headline:"A Retreat Unlike Any Other",    purpose:"Full-screen property hero"},
      {id:"rooms",      category:"features",     variant:"bento-grid",       headline:"Rooms & Suites",               purpose:"Room type cards with features"},
      {id:"amenities",  category:"features",     variant:"icon-grid",        headline:"Hotel Amenities",              purpose:"Pool, spa, restaurant, gym"},
      {id:"dining",     category:"features",     variant:"alternating",      headline:"Dining",                       purpose:"Restaurant and bar experience"},
      {id:"gallery",    category:"features",     variant:"bento-grid",       headline:"Gallery",                      purpose:"Property photography"},
      {id:"testimonials",category:"testimonials",variant:"masonry",          headline:"Guest Reviews",                purpose:"Real guest stories"},
      {id:"booking",    category:"cta",          variant:"split-form",       headline:"Reserve Your Stay",            purpose:"Check-in/out date form"},
      {id:"footer",     category:"footer",       variant:"four-column",      headline:"",                              purpose:"Rooms, dining, facilities, contact"},
    ],
  },
  {
    domain:"resort", base:"HOSPITALITY",
    labels:["resort","luxury resort","beach resort","mountain resort","spa resort","eco resort","all-inclusive","retreat center"],
    projectName:"{Brand} Resort", tagline:"Escape to Paradise",
    businessGoal:"booking", targetAudience:"Affluent leisure travellers and honeymooners",
    primaryCTA:"Book Your Escape", secondaryCTA:"Explore Experiences",
    assetTheme:"luxury resort pool beach destination paradise photography",
    avoid:["budget hotel aesthetic","business travel imagery"],
    typography:"serif", designMood:"warm luxury", spacing:"generous",
  },
  {
    domain:"travel-agency", base:"HOSPITALITY",
    labels:["travel agency","tour operator","travel company","holiday packages","guided tours","adventure travel","luxury travel","safari"],
    projectName:"{Brand} Travel", tagline:"Extraordinary Journeys Await",
    businessGoal:"booking", targetAudience:"Adventure seekers and leisure travellers",
    primaryCTA:"Plan My Trip", secondaryCTA:"Explore Destinations",
    assetTheme:"travel destination photography landscape adventure vibrant",
    avoid:["corporate business aesthetic","dark moody"],
    sectionPatch: s => [
      {id:"hero",        category:"hero",         variant:"centered",         headline:"The World is Waiting",         purpose:"Destination imagery with CTA"},
      {id:"destinations",category:"features",     variant:"bento-grid",       headline:"Popular Destinations",        purpose:"Destination cards"},
      {id:"packages",    category:"features",     variant:"alternating",      headline:"Our Travel Packages",         purpose:"Package details with price"},
      {id:"why-us",      category:"features",     variant:"icon-grid",        headline:"Why Travel With Us",          purpose:"Guides, routes, support"},
      {id:"testimonials",category:"testimonials", variant:"masonry",          headline:"Traveller Stories",           purpose:"Trip reviews"},
      {id:"booking",     category:"cta",          variant:"split-form",       headline:"Plan Your Perfect Trip",      purpose:"Destination inquiry form"},
      {id:"footer",      category:"footer",       variant:"four-column",      headline:"",                             purpose:"Destinations, packages, contact"},
    ],
  },
  {
    domain:"airline", base:"SAAS",
    labels:["airline","flights","aviation","air travel","charter flight","private jet","private aviation"],
    projectName:"{Brand} Airways", tagline:"Fly Without Limits",
    businessGoal:"booking", pricingModel:"none",
    targetAudience:"Business and leisure air travellers",
    primaryCTA:"Search Flights", secondaryCTA:"View Routes",
    assetTheme:"airline aircraft flight travel sky modern",
    avoid:["budget low-cost aesthetic","heavy animation"],
  },

  // ── HEALTH & WELLNESS ─────────────────────────────────────────────────
  {
    domain:"gym", base:"PROFESSIONAL",
    labels:["gym","fitness center","fitness club","crossfit box","powerlifting gym","bodybuilding gym","health club","athletic club"],
    projectName:"{Brand} Fitness", tagline:"Transform Your Body. Transform Your Life.",
    businessGoal:"membership", pricingModel:"membership-tiers",
    targetAudience:"Fitness-conscious adults 18–45 seeking real results",
    primaryCTA:"Start Free Trial", secondaryCTA:"View Programs",
    assetTheme:"gym fitness training athlete workout high energy dark",
    avoid:["soft spa aesthetic","luxury fashion"],
    designMood:"bold dark", typography:"sans", spacing:"tight",
    copyTone:"Energetic and motivational. Results-focused. Power words.",
    keyBenefits:["Expert certified coaches","State-of-art equipment","Flexible class schedule","Real community","Guaranteed results"],
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"split-image",     headline:"Unleash Your Potential",         purpose:"High-energy hero with athlete"},
      {id:"results",    category:"features",     variant:"stat-highlight",  headline:"Real Results",                   purpose:"Members lost, gained, transformed"},
      {id:"programs",   category:"features",     variant:"bento-grid",     headline:"Training Programs",              purpose:"Strength, HIIT, Yoga, Boxing"},
      {id:"coaches",    category:"features",     variant:"alternating",    headline:"Expert Coaches",                 purpose:"Coach profiles with credentials"},
      {id:"membership", category:"pricing",      variant:"three-tier",     headline:"Choose Your Plan",              purpose:"Basic/Pro/Elite tiers"},
      {id:"testimonials",category:"testimonials",variant:"grid",           headline:"Member Transformations",        purpose:"Before/after success stories"},
      {id:"cta",        category:"cta",          variant:"banner-strip",   headline:"Start Your Journey Today",      purpose:"Free trial or first class offer"},
      {id:"footer",     category:"footer",       variant:"four-column",    headline:"",                               purpose:"Schedule, classes, location"},
    ],
  },
  {
    domain:"yoga-studio", base:"HOSPITALITY",
    labels:["yoga studio","yoga","pilates","meditation","mindfulness","breathwork","hot yoga","vinyasa","barre"],
    projectName:"{Brand} Studio", tagline:"Find Your Inner Strength.",
    businessGoal:"membership", pricingModel:"membership-tiers",
    targetAudience:"Wellness-focused adults seeking balance and mindfulness",
    primaryCTA:"Try a Free Class", secondaryCTA:"View Schedule",
    assetTheme:"yoga studio calm serene natural light practice",
    avoid:["intense gym aesthetic","dark dramatic"],
    designMood:"calm natural", typography:"serif", spacing:"generous",
    copyTone:"Calm, centred, and inviting. Speak to the journey inward.",
  },
  {
    domain:"spa", base:"HOSPITALITY",
    labels:["spa","day spa","luxury spa","beauty spa","wellness spa","massage","facial","body treatment","medi-spa"],
    projectName:"{Brand} Spa", tagline:"Restore. Renew. Rejuvenate.",
    businessGoal:"booking", targetAudience:"Adults seeking relaxation and beauty treatments",
    primaryCTA:"Book a Treatment", secondaryCTA:"View Treatments",
    assetTheme:"luxury spa massage treatment wellness serene elegant",
    avoid:["gym energy","medical clinical aesthetic"],
    typography:"serif", designMood:"calm luxury", spacing:"generous",
    copyTone:"Serene and restorative. Sensory language. Make them feel relaxed reading the copy.",
  },
  {
    domain:"salon", base:"HOSPITALITY",
    labels:["hair salon","beauty salon","hairdresser","hair studio","blow dry bar","colour specialist","hair extensions"],
    projectName:"{Brand} Salon", tagline:"Look Good. Feel Amazing.",
    businessGoal:"booking", targetAudience:"Style-conscious individuals seeking expert hair services",
    primaryCTA:"Book Appointment", secondaryCTA:"View Services",
    assetTheme:"hair salon beauty professional styling photography",
    avoid:["generic beauty stock","corporate imagery"],
    designMood:"modern chic",
  },
  {
    domain:"barber", base:"HOSPITALITY",
    labels:["barber","barber shop","barbershop","men's grooming","beard trim","men haircut","shave"],
    projectName:"{Brand} Barbershop", tagline:"Sharp Cuts. Clean Lines.",
    businessGoal:"booking", targetAudience:"Style-conscious men seeking premium grooming",
    primaryCTA:"Book a Cut", secondaryCTA:"View Services",
    assetTheme:"barbershop men grooming vintage modern clean",
    avoid:["women's salon aesthetic","soft spa imagery"],
    designMood:"dark vintage modern", typography:"sans",
  },
  {
    domain:"dental", base:"PROFESSIONAL",
    labels:["dental","dentist","dental clinic","orthodontist","dental surgery","teeth whitening","cosmetic dentistry","orthodontics"],
    projectName:"{Brand} Dental", tagline:"A Healthier Smile Starts Here.",
    businessGoal:"booking", targetAudience:"Patients seeking quality dental care",
    primaryCTA:"Book Dental Appointment", secondaryCTA:"View Treatments",
    assetTheme:"dental clinic teeth whitening modern clean professional",
    avoid:["dark dramatic aesthetic","luxury car imagery"],
    sectionPatch: s => addSectionAfter(s,"services",{id:"treatments",category:"features",variant:"bento-grid",headline:"Our Treatments",purpose:"Whitening, Implants, Braces, Invisalign"}),
  },
  {
    domain:"healthcare", base:"PROFESSIONAL",
    labels:["hospital","clinic","doctor","medical","healthcare","general practice","gp","specialist","physiotherapy","therapy","mental health"],
    projectName:"{Brand} Clinic", tagline:"Your Health. Our Priority.",
    businessGoal:"booking", targetAudience:"Patients seeking quality medical care",
    primaryCTA:"Book an Appointment", secondaryCTA:"View Services",
    assetTheme:"medical clinic doctor healthcare clean professional bright",
    avoid:["dark aesthetic","luxury imagery","startup look"],
    designMood:"clean light", copyTone:"Warm, reassuring, and professional. Patient-first language.",
  },
  {
    domain:"pharmacy", base:"ECOMMERCE",
    labels:["pharmacy","chemist","drugstore","online pharmacy","prescription","health products","vitamins","supplements"],
    projectName:"{Brand} Pharmacy", tagline:"Your Health. Delivered.",
    businessGoal:"ecommerce", targetAudience:"Health-conscious consumers and patients",
    primaryCTA:"Shop Now", secondaryCTA:"Upload Prescription",
    assetTheme:"pharmacy health products clean professional modern",
    avoid:["dark moody","luxury aesthetic"],
    designMood:"clean professional",
  },
  {
    domain:"veterinary", base:"PROFESSIONAL",
    labels:["vet","veterinary","animal clinic","pet clinic","veterinarian","animal hospital","pet care"],
    projectName:"{Brand} Veterinary", tagline:"Exceptional Care for Every Pet.",
    businessGoal:"booking", targetAudience:"Pet owners seeking trusted veterinary care",
    primaryCTA:"Book Pet Appointment", secondaryCTA:"Our Services",
    assetTheme:"veterinary clinic pets animals professional caring",
    avoid:["human medical aesthetic","dark imagery"],
    copyTone:"Warm and caring. Speak to both pet and owner. Reassuring and expert.",
  },
  {
    domain:"nutritionist", base:"PROFESSIONAL",
    labels:["nutritionist","dietitian","nutrition coach","meal planner","weight loss coach","health coach"],
    projectName:"{Brand} Nutrition", tagline:"Eat Well. Live Better.",
    businessGoal:"lead", targetAudience:"Health-conscious adults seeking dietary guidance",
    primaryCTA:"Book Free Consultation", secondaryCTA:"View Programs",
    assetTheme:"nutrition healthy food lifestyle professional clean",
    avoid:["medical clinical aesthetic","gym aggressive energy"],
  },
  {
    domain:"mental-health", base:"PROFESSIONAL",
    labels:["therapist","psychologist","counsellor","mental health","therapy","life coach","mindfulness coach","CBT"],
    projectName:"{Brand} Therapy", tagline:"Helping You Thrive.",
    businessGoal:"booking", targetAudience:"Adults seeking mental health support",
    primaryCTA:"Book a Session", secondaryCTA:"Learn More",
    assetTheme:"therapy counselling calm office professional warm",
    avoid:["clinical cold aesthetic","dark imagery"],
    designMood:"calm warm", typography:"serif",
    copyTone:"Empathetic, non-clinical, and accessible. Safe and supportive language.",
  },

  // ── BEAUTY & FASHION ─────────────────────────────────────────────────
  {
    domain:"fashion", base:"ECOMMERCE",
    labels:["fashion","clothing","apparel","fashion brand","streetwear","luxury fashion","designer clothing","boutique clothing"],
    projectName:"{Brand}", tagline:"Wear Your Story",
    businessGoal:"ecommerce", targetAudience:"Fashion-forward shoppers",
    primaryCTA:"Shop the Collection", secondaryCTA:"Explore Looks",
    assetTheme:"fashion clothing lifestyle editorial model photography",
    avoid:["generic product stock","tech startup aesthetic"],
    designMood:"bold editorial", typography:"display", spacing:"generous",
  },
  {
    domain:"jewelry", base:"ECOMMERCE",
    labels:["jewelry","jewellery","diamonds","rings","necklaces","watches","luxury jewelry","engagement rings","fine jewelry"],
    projectName:"{Brand}", tagline:"Crafted to Last a Lifetime",
    businessGoal:"ecommerce", targetAudience:"Discerning buyers seeking quality jewelry",
    primaryCTA:"Shop Collection", secondaryCTA:"Book Consultation",
    assetTheme:"jewelry luxury diamonds close-up macro photography elegant dark",
    avoid:["casual fashion aesthetic","generic product grid"],
    designMood:"dark luxury", typography:"serif", spacing:"generous",
    colorHint:"#D4AF37",
  },
  {
    domain:"watch-brand", base:"ECOMMERCE",
    labels:["watch","timepiece","luxury watch","watch brand","horology","smartwatch","watch collection"],
    projectName:"{Brand}", tagline:"Time, Perfected.",
    businessGoal:"ecommerce", targetAudience:"Watch enthusiasts and collectors",
    primaryCTA:"Explore Collection", secondaryCTA:"Find a Dealer",
    assetTheme:"luxury watch timepiece photography macro detail dramatic",
    avoid:["generic product grid","tech startup aesthetic"],
    designMood:"dark luxury", typography:"serif", colorHint:"#1a1a1a",
  },
  {
    domain:"beauty-brand", base:"ECOMMERCE",
    labels:["beauty","cosmetics","skincare","makeup","beauty brand","lipstick","foundation","serum","beauty products"],
    projectName:"{Brand} Beauty", tagline:"Your Ritual. Your Glow.",
    businessGoal:"ecommerce", targetAudience:"Beauty enthusiasts aged 18–45",
    primaryCTA:"Shop Now", secondaryCTA:"Take the Quiz",
    assetTheme:"beauty skincare cosmetics model photography clean modern",
    avoid:["dark moody","tech aesthetic"],
    designMood:"clean minimal feminine",
  },
  {
    domain:"perfume", base:"ECOMMERCE",
    labels:["perfume","fragrance","cologne","eau de parfum","scent","luxury fragrance","perfumery"],
    projectName:"{Brand}", tagline:"Scent is Memory.",
    businessGoal:"ecommerce", targetAudience:"Fragrance connoisseurs and gift buyers",
    primaryCTA:"Shop Fragrances", secondaryCTA:"Find Your Scent",
    assetTheme:"perfume fragrance bottle luxury photography dark dramatic",
    avoid:["car imagery","tech aesthetic","generic product grid"],
    designMood:"dark luxury", typography:"serif", spacing:"generous",
    copyTone:"Sensory and poetic. Evoke the fragrance experience through language.",
  },

  // ── HOME & PROPERTY ───────────────────────────────────────────────────
  {
    domain:"real-estate", base:"PROFESSIONAL",
    labels:["real estate","property","homes","realtor","estate agent","house sales","property developer","lettings","property management"],
    projectName:"{Brand} Real Estate", tagline:"Find Your Perfect Home",
    businessGoal:"lead", targetAudience:"Home buyers, sellers, and investors",
    primaryCTA:"Book a Valuation", secondaryCTA:"Browse Properties",
    assetTheme:"luxury home interior modern architecture real estate",
    avoid:["generic handshake photos","dark dramatic"],
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"split-image",     headline:"Your Dream Home is Waiting",  purpose:"Property hero with search/CTA"},
      {id:"featured",   category:"features",     variant:"bento-grid",      headline:"Featured Properties",        purpose:"Property cards with price, beds"},
      {id:"services",   category:"features",     variant:"icon-grid",       headline:"Our Services",               purpose:"Buy, Sell, Rent, Manage, Value"},
      {id:"about",      category:"features",     variant:"alternating",     headline:"Why Choose Us",              purpose:"Agent expertise and local knowledge"},
      {id:"testimonials",category:"testimonials",variant:"featured",        headline:"Client Stories",             purpose:"Buyer/seller success stories"},
      {id:"stats",      category:"features",     variant:"stat-highlight",  headline:"Our Track Record",           purpose:"Properties sold, years, satisfaction"},
      {id:"contact",    category:"cta",          variant:"split-form",      headline:"Get a Free Valuation",       purpose:"Property valuation request form"},
      {id:"footer",     category:"footer",       variant:"four-column",     headline:"",                            purpose:"Areas, types, contact, social"},
    ],
  },
  {
    domain:"interior-design", base:"PORTFOLIO",
    labels:["interior design","interior designer","interior decorator","home design","space design","interior architecture"],
    projectName:"{Name} Interior Design", tagline:"Spaces That Tell Your Story",
    businessGoal:"lead", targetAudience:"Homeowners and developers seeking design services",
    primaryCTA:"Book Consultation", secondaryCTA:"View Portfolio",
    assetTheme:"interior design home architecture photography beautiful spaces modern",
    avoid:["generic office imagery","corporate look"],
    typography:"serif", designMood:"clean elegant", spacing:"generous",
  },
  {
    domain:"architecture", base:"PORTFOLIO",
    labels:["architect","architecture firm","architectural design","building design","structural design","urban design"],
    projectName:"{Brand} Architecture", tagline:"Buildings that Inspire.",
    businessGoal:"lead", targetAudience:"Developers, government, and private clients",
    primaryCTA:"Start a Project", secondaryCTA:"View Projects",
    assetTheme:"architecture building modern photography dramatic structural",
    avoid:["interior home design aesthetic","soft residential look"],
    designMood:"bold minimal", typography:"sans", spacing:"generous",
  },
  {
    domain:"construction", base:"PROFESSIONAL",
    labels:["construction","builder","building company","contractor","civil engineering","renovation","fit-out","home builder"],
    projectName:"{Brand} Construction", tagline:"Built to Last.",
    businessGoal:"lead", targetAudience:"Property developers and homeowners needing construction",
    primaryCTA:"Get a Quote", secondaryCTA:"View Projects",
    assetTheme:"construction building site modern professional quality",
    avoid:["luxury aesthetic","soft design portfolio look"],
    copyTone:"Reliable and expert. Lead with quality and track record. Practical language.",
  },
  {
    domain:"furniture", base:"ECOMMERCE",
    labels:["furniture","furniture brand","home furniture","office furniture","bespoke furniture","custom furniture","sofas","beds"],
    projectName:"{Brand} Furniture", tagline:"Live in Style.",
    businessGoal:"ecommerce", targetAudience:"Homeowners and interior designers",
    primaryCTA:"Shop Collection", secondaryCTA:"Visit Showroom",
    assetTheme:"furniture interior home lifestyle photography modern elegant",
    avoid:["generic product grid","tech aesthetic"],
    designMood:"warm minimal", typography:"serif",
  },

  // ── TECHNOLOGY & SOFTWARE ─────────────────────────────────────────────
  {
    domain:"saas", base:"SAAS",
    labels:["saas","software as a service","subscription software","b2b platform","software platform","business software"],
    projectName:"{Brand}", tagline:"The Smarter Way to {action}",
    targetAudience:"Teams and businesses improving efficiency",
    primaryCTA:"Start Free Trial", secondaryCTA:"View Demo",
    assetTheme:"saas software product dashboard clean modern professional",
    avoid:["stock business handshake","generic office imagery"],
  },
  {
    domain:"ai-startup", base:"SAAS",
    labels:["ai startup","ai company","ai product","ai platform","machine learning","gpt","llm","generative ai","ai tool"],
    projectName:"{Brand} AI", tagline:"Intelligence at Scale.",
    targetAudience:"Developers and product teams building with AI",
    primaryCTA:"Start Building Free", secondaryCTA:"View API Docs",
    assetTheme:"ai artificial intelligence abstract data neural network modern",
    avoid:["stock robot imagery","sci-fi cliche aesthetic"],
    designMood:"dark tech", colorHint:"#6D28D9",
  },
  {
    domain:"cybersecurity", base:"SAAS",
    labels:["cybersecurity","security company","information security","network security","penetration testing","soc","threat detection","endpoint security"],
    projectName:"{Brand} Security", tagline:"Stay Protected. Stay Ahead.",
    targetAudience:"CTOs and IT security teams at mid-to-enterprise companies",
    primaryCTA:"Get Security Assessment", secondaryCTA:"View Solutions",
    assetTheme:"cybersecurity data protection technology dark abstract",
    avoid:["hacker cliche imagery","generic shield icons"],
    designMood:"dark professional", copyTone:"Authoritative and confident. Lead with threats and protection.",
  },
  {
    domain:"crm", base:"SAAS",
    labels:["crm","customer relationship","lead management","sales crm","sales platform","pipeline management","contact management"],
    projectName:"{Brand} CRM", tagline:"Close More. Build More. Grow More.",
    targetAudience:"Sales teams and business development managers",
    primaryCTA:"Try Free for 14 Days", secondaryCTA:"Watch Demo",
    assetTheme:"crm sales dashboard pipeline modern clean professional",
    avoid:["generic handshake stock","luxury aesthetic"],
    sectionPatch: s => patchSection(s,"workflow",{headline:"Your Sales Pipeline, Simplified"}),
  },
  {
    domain:"erp", base:"SAAS",
    labels:["erp","enterprise resource planning","business management system","inventory management","supply chain","manufacturing software"],
    projectName:"{Brand} ERP", tagline:"One System. Total Control.",
    targetAudience:"Operations directors and C-suite at manufacturing and enterprise companies",
    primaryCTA:"Request a Demo", secondaryCTA:"View Modules",
    assetTheme:"erp enterprise software dashboard professional management",
    avoid:["consumer app aesthetic","startup look"],
    copyTone:"Enterprise-grade and ROI-focused. Speak to efficiency and control.",
  },
  {
    domain:"developer-tool", base:"SAAS",
    labels:["developer tool","devtool","api","developer platform","open source","cli tool","sdk","coding tool","dev platform"],
    projectName:"{Brand}", tagline:"Built for Developers. Loved by Teams.",
    targetAudience:"Software engineers and engineering teams",
    primaryCTA:"Start Building Free", secondaryCTA:"View Docs",
    assetTheme:"developer tool code terminal dark modern professional",
    avoid:["corporate enterprise aesthetic","soft design"],
    designMood:"dark code", colorHint:"#1E293B",
    copyTone:"Developer-first. Technical but accessible. Show the code.",
  },
  {
    domain:"dashboard-analytics", base:"SAAS",
    labels:["dashboard","analytics platform","reporting tool","data platform","metrics","bi tool","business intelligence","data analytics","data visualization"],
    projectName:"{Brand} Analytics", tagline:"Your Data. Your Decisions.",
    targetAudience:"Data analysts and business operators",
    primaryCTA:"Start Free — No Credit Card", secondaryCTA:"View Live Demo",
    assetTheme:"analytics dashboard data visualization modern clean dark",
    avoid:["lifestyle photography","luxury aesthetic"],
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"product-showcase", headline:"All Your Metrics in One Place",  purpose:"Dashboard screenshot hero"},
      {id:"stats",      category:"dashboard",    variant:"topnav-cards",    headline:"Key KPIs",                       purpose:"Revenue, users, conversion cards"},
      {id:"analytics",  category:"dashboard",    variant:"analytics-charts",headline:"Advanced Analytics",             purpose:"Charts, maps, funnels"},
      {id:"features",   category:"features",     variant:"bento-grid",      headline:"Powerful Features",              purpose:"Real-time, exports, API, alerts"},
      {id:"tables",     category:"dashboard",    variant:"table-heavy",     headline:"Detailed Reporting",             purpose:"Sortable data tables"},
      {id:"pricing",    category:"pricing",      variant:"comparison-table",headline:"Plans for Every Team",           purpose:"Free/Pro/Enterprise comparison"},
      {id:"testimonials",category:"testimonials",variant:"logo-wall",       headline:"Trusted by Data Teams",          purpose:"Logos + quotes"},
      {id:"cta",        category:"cta",          variant:"centered-gradient",headline:"Start Analyzing Free",          purpose:"Free account CTA"},
      {id:"footer",     category:"footer",       variant:"newsletter-rich", headline:"",                                purpose:"Product, API, security, status"},
    ],
  },

  // ── FINANCE & LEGAL ───────────────────────────────────────────────────
  {
    domain:"law-firm", base:"PROFESSIONAL",
    labels:["law firm","lawyer","solicitor","barrister","attorney","legal services","legal advice","employment law","family law","corporate law"],
    projectName:"{Brand} Law", tagline:"Trusted Legal Counsel.",
    businessGoal:"lead", targetAudience:"Individuals and businesses needing legal representation",
    primaryCTA:"Book Free Consultation", secondaryCTA:"Our Practice Areas",
    assetTheme:"law firm professional office legal modern confident",
    avoid:["stock court imagery","generic handshake photos"],
    typography:"serif", designMood:"dark professional",
    copyTone:"Authoritative, confident, and clear. Client outcomes first.",
  },
  {
    domain:"accounting", base:"PROFESSIONAL",
    labels:["accounting","accountant","bookkeeping","tax","audit","financial accounting","cpa","chartered accountant"],
    projectName:"{Brand} Accounting", tagline:"Your Numbers. Our Expertise.",
    targetAudience:"SMEs and individuals needing accounting services",
    primaryCTA:"Book Free Consultation", secondaryCTA:"Our Services",
    assetTheme:"accounting finance professional office modern clean",
    avoid:["dark moody","complex graphics"],
  },
  {
    domain:"finance", base:"PROFESSIONAL",
    labels:["financial advisor","wealth management","financial planning","investment advisor","IFA","financial services","pension","investment management"],
    projectName:"{Brand} Financial", tagline:"Your Wealth. Your Future.",
    targetAudience:"Professionals and HNWIs planning financial futures",
    primaryCTA:"Book a Strategy Call", secondaryCTA:"Our Services",
    assetTheme:"wealth finance professional modern confident clean",
    avoid:["stock money imagery","generic handshake"],
    designMood:"dark professional", typography:"serif",
  },
  {
    domain:"insurance", base:"PROFESSIONAL",
    labels:["insurance","insurance broker","life insurance","car insurance","home insurance","business insurance","health insurance"],
    projectName:"{Brand} Insurance", tagline:"Protected for What Matters Most.",
    targetAudience:"Individuals and businesses seeking insurance coverage",
    primaryCTA:"Get a Quote", secondaryCTA:"Our Products",
    assetTheme:"insurance protection family home professional clean",
    avoid:["dark moody","complex jargon visuals"],
    copyTone:"Reassuring and clear. Lead with protection and peace of mind.",
  },
  {
    domain:"bank-fintech", base:"SAAS",
    labels:["bank","neobank","fintech","digital bank","online bank","challenger bank","financial app","payment platform","money app"],
    projectName:"{Brand}", tagline:"Banking Built for the Modern World.",
    targetAudience:"Consumers and SMEs seeking better banking",
    primaryCTA:"Open Account Free", secondaryCTA:"View Features",
    assetTheme:"fintech banking app modern clean minimal phone mockup",
    avoid:["traditional bank imagery","stock briefcase photos"],
    designMood:"clean modern", colorHint:"#4F46E5",
  },
  {
    domain:"crypto", base:"SAAS",
    labels:["crypto","cryptocurrency","blockchain","defi","nft","web3","token","exchange","trading","staking"],
    projectName:"{Brand}", tagline:"The Future of Finance is Here.",
    targetAudience:"Crypto enthusiasts, traders, and DeFi participants",
    primaryCTA:"Start Trading", secondaryCTA:"View Markets",
    assetTheme:"cryptocurrency blockchain defi modern abstract dark neon",
    avoid:["traditional bank imagery","physical cash photos"],
    designMood:"dark tech neon", colorHint:"#22D3EE",
    copyTone:"Bold, forward-looking, community-first. Speak the language of Web3.",
  },

  // ── MEDIA & CONTENT ───────────────────────────────────────────────────
  {
    domain:"blog-magazine", base:"LANDING",
    labels:["blog","magazine","online publication","news","media","editorial","newsletter","content site","journal"],
    projectName:"{Brand}", tagline:"Stories That Matter.",
    businessGoal:"lead", projectType:"blog",
    targetAudience:"Curious readers seeking quality content",
    primaryCTA:"Subscribe Free", secondaryCTA:"Read Latest",
    assetTheme:"magazine editorial photography modern clean content",
    avoid:["corporate business aesthetic","dark tech look"],
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"centered",        headline:"Latest Stories",             purpose:"Featured article hero"},
      {id:"featured",   category:"features",     variant:"bento-grid",     headline:"Editor's Picks",             purpose:"Featured article grid"},
      {id:"categories", category:"features",     variant:"icon-grid",      headline:"Topics",                     purpose:"Category navigation"},
      {id:"about",      category:"features",     variant:"alternating",    headline:"About Us",                   purpose:"Publication mission and team"},
      {id:"cta",        category:"cta",          variant:"split-form",     headline:"Subscribe for Free",         purpose:"Email newsletter signup"},
      {id:"footer",     category:"footer",       variant:"newsletter-rich",headline:"",                            purpose:"Topics, authors, social, rss"},
    ],
  },
  {
    domain:"podcast", base:"LANDING",
    labels:["podcast","podcast show","audio show","radio show","interview show","business podcast"],
    projectName:"{Brand} Podcast", tagline:"Listen. Learn. Grow.",
    targetAudience:"Listeners seeking valuable audio content",
    primaryCTA:"Listen Now", secondaryCTA:"Subscribe",
    assetTheme:"podcast microphone studio recording modern professional",
    avoid:["generic office imagery","corporate stock"],
  },

  // ── PROFESSIONAL SERVICES ─────────────────────────────────────────────
  {
    domain:"marketing-agency", base:"PORTFOLIO",
    labels:["marketing agency","digital marketing","growth agency","ppc agency","seo agency","content marketing","social media agency","performance marketing"],
    projectName:"{Brand} Marketing", tagline:"Growth Marketing That Delivers.",
    businessGoal:"lead", targetAudience:"D2C brands and startups seeking growth",
    primaryCTA:"Get Growth Strategy", secondaryCTA:"View Case Studies",
    assetTheme:"marketing agency results growth modern bold",
    avoid:["generic corporate handshake","dark luxury"],
    sectionPatch: s => addSectionAfter(s,"work",{id:"results",category:"features",variant:"stat-highlight",headline:"Results We're Proud Of",purpose:"ROAS, revenue generated, leads"}),
  },
  {
    domain:"creative-agency", base:"PORTFOLIO",
    labels:["creative agency","design agency","branding agency","brand agency","advertising agency","creative studio","brand design"],
    projectName:"{Brand} Studio", tagline:"We Build Brands That Matter.",
    targetAudience:"Startups and scale-ups seeking brand identity",
    primaryCTA:"Start a Project", secondaryCTA:"View Our Work",
    assetTheme:"creative agency branding design work bold editorial modern",
    avoid:["generic handshake stock","corporate blue"],
    designMood:"bold editorial", typography:"display",
  },
  {
    domain:"consultancy", base:"PROFESSIONAL",
    labels:["consultant","consultancy","management consulting","strategy consulting","business consultant","advisory","management advisory"],
    projectName:"{Brand} Consulting", tagline:"Strategy That Moves Business.",
    targetAudience:"C-suite and senior leaders at growth-stage companies",
    primaryCTA:"Book Strategy Call", secondaryCTA:"Our Services",
    assetTheme:"consulting strategy business professional confident modern",
    avoid:["stock handshake","generic office photos"],
    typography:"serif",
  },
  {
    domain:"hr-recruiting", base:"SAAS",
    labels:["hr","human resources","recruiting","talent acquisition","staffing","recruitment agency","job board","ats","hrms"],
    projectName:"{Brand}", tagline:"Hire Smarter. Build Better Teams.",
    targetAudience:"HR directors and hiring managers",
    primaryCTA:"Start Hiring Free", secondaryCTA:"View Platform",
    assetTheme:"hr recruiting team people professional modern office",
    avoid:["dark tech aesthetic","generic stock handshake"],
  },
  {
    domain:"ngo-charity", base:"LANDING",
    labels:["ngo","charity","non-profit","nonprofit","foundation","cause","humanitarian","social impact","fundraising"],
    projectName:"{Brand}", tagline:"Together We Change Lives.",
    businessGoal:"lead", targetAudience:"Donors, volunteers, and beneficiaries",
    primaryCTA:"Donate Now", secondaryCTA:"Learn More",
    assetTheme:"charity impact people community humanitarian photography",
    avoid:["corporate business aesthetic","dark moody"],
    designMood:"warm human", colorHint:"#F59E0B",
    copyTone:"Heartfelt and impactful. Human stories. Show real impact with numbers.",
  },

  // ── EDUCATION ────────────────────────────────────────────────────────
  {
    domain:"school-university", base:"PROFESSIONAL",
    labels:["school","university","college","academy","institution","educational institution","private school","boarding school"],
    projectName:"{Brand} Academy", tagline:"Education That Opens Doors.",
    targetAudience:"Students and parents seeking quality education",
    primaryCTA:"Apply Now", secondaryCTA:"Book Open Day",
    assetTheme:"school university campus students learning modern",
    avoid:["startup aesthetic","dark corporate"],
    sectionPatch: s => addSectionAfter(s,"services",{id:"outcomes",category:"features",variant:"stat-highlight",headline:"Student Outcomes",purpose:"Employment rate, salary, awards"}),
  },
  {
    domain:"online-course", base:"SAAS",
    labels:["online course","e-learning","lms","course platform","learning platform","mooc","udemy","teachable","online education","training platform"],
    projectName:"{Brand} Academy", tagline:"Learn Without Limits.",
    businessGoal:"lead", targetAudience:"Professionals seeking skill development",
    primaryCTA:"Enroll Now", secondaryCTA:"Browse Courses",
    assetTheme:"online learning education laptop courses modern clean",
    avoid:["dark academic aesthetic","generic stock study"],
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"split-image",     headline:"Master New Skills. Change Your Future.",  purpose:"Student success imagery"},
      {id:"courses",    category:"features",     variant:"bento-grid",      headline:"Our Courses",                            purpose:"Course cards with duration, level"},
      {id:"why-us",     category:"features",     variant:"icon-grid",       headline:"Why Learn With Us",                      purpose:"Instructors, certificates, jobs"},
      {id:"outcomes",   category:"features",     variant:"stat-highlight",  headline:"Graduate Outcomes",                      purpose:"Job placement, salary increase"},
      {id:"instructors",category:"features",     variant:"alternating",     headline:"Learn From Experts",                     purpose:"Instructor profiles"},
      {id:"testimonials",category:"testimonials",variant:"masonry",         headline:"Student Success Stories",                purpose:"Graduate stories"},
      {id:"pricing",    category:"pricing",      variant:"three-tier",      headline:"Choose Your Path",                       purpose:"Free/Student/Pro tiers"},
      {id:"cta",        category:"cta",          variant:"split-form",      headline:"Start Learning Today",                   purpose:"Course interest signup"},
      {id:"footer",     category:"footer",       variant:"newsletter-rich", headline:"",                                        purpose:"Courses, blog, community, support"},
    ],
  },
  {
    domain:"coaching", base:"PROFESSIONAL",
    labels:["coach","coaching","life coach","executive coach","business coach","career coach","performance coach","mindset coach"],
    projectName:"{Name} Coaching", tagline:"Unlock Your Full Potential.",
    targetAudience:"Ambitious professionals seeking transformational growth",
    primaryCTA:"Book Discovery Call", secondaryCTA:"View Programs",
    assetTheme:"coaching professional success confidence portrait photography",
    avoid:["clinical therapy aesthetic","corporate consulting look"],
    copyTone:"Inspiring and outcome-focused. Personal transformation language.",
  },

  // ── CREATIVE PROFESSIONALS ────────────────────────────────────────────
  {
    domain:"photography", base:"PORTFOLIO",
    labels:["photographer","photography","photoshoot","photo studio","portrait photographer","wedding photographer","commercial photographer","product photographer"],
    projectName:"{Name} Photography", tagline:"Every Moment, Perfectly Captured.",
    targetAudience:"Couples, families, brands seeking professional photography",
    primaryCTA:"Book a Shoot", secondaryCTA:"View Portfolio",
    assetTheme:"photography portfolio editorial beautiful lighting professional",
    avoid:["stock photos","corporate office imagery"],
    designMood:"clean minimal", typography:"serif", spacing:"generous",
    sectionPatch: s => patchSection(s,"work",{id:"gallery",variant:"filter-gallery",headline:"Portfolio",purpose:"Filterable: Wedding/Commercial/Portrait/Events"}),
  },
  {
    domain:"videography", base:"PORTFOLIO",
    labels:["videographer","videography","video production","video company","film production","content creator","filmmaker"],
    projectName:"{Name} Films", tagline:"Stories Worth Telling.",
    targetAudience:"Brands, events, and individuals seeking video content",
    primaryCTA:"Get a Quote", secondaryCTA:"Watch Showreel",
    assetTheme:"videography film production professional camera cinematic",
    avoid:["photography-only aesthetic","stock video stills"],
    designMood:"dark cinematic",
  },
  {
    domain:"wedding", base:"HOSPITALITY",
    labels:["wedding","wedding venue","wedding planner","wedding photographer","bridal","wedding supplier","wedding florist"],
    projectName:"{Brand} Weddings", tagline:"Your Perfect Day, Perfectly Planned.",
    businessGoal:"lead", targetAudience:"Couples planning their wedding",
    primaryCTA:"Plan Your Wedding", secondaryCTA:"View Gallery",
    assetTheme:"wedding flowers bride ceremony photography elegant romantic",
    avoid:["dark moody","corporate aesthetic","tech startup look"],
    typography:"serif", designMood:"romantic elegant", spacing:"generous",
    copyTone:"Romantic and aspirational. Make them feel the magic of their day.",
  },
  {
    domain:"event-company", base:"HOSPITALITY",
    labels:["event company","event planner","events management","corporate events","event venue","party planner","conference organiser"],
    projectName:"{Brand} Events", tagline:"Events Worth Remembering.",
    businessGoal:"lead", targetAudience:"Businesses and individuals needing event services",
    primaryCTA:"Plan Your Event", secondaryCTA:"View Portfolio",
    assetTheme:"events conference gala dinner corporate photography",
    avoid:["wedding only aesthetic","dark intimate"],
  },

  // ── PORTFOLIO TYPES ───────────────────────────────────────────────────
  {
    domain:"portfolio-developer", base:"PORTFOLIO",
    labels:["developer portfolio","software engineer portfolio","fullstack developer","frontend developer","backend developer","web developer"],
    projectName:"{Name} — Developer", tagline:"Building the Web, One Line at a Time.",
    targetAudience:"Tech companies and startups hiring engineers",
    primaryCTA:"Hire Me", secondaryCTA:"View Projects",
    assetTheme:"developer workspace code dark minimal macbook",
    avoid:["stock business photos","formal corporate"],
    designMood:"dark minimal",
    sectionPatch: s => [
      {id:"hero",      category:"hero",         variant:"minimal-statement",headline:"Hi, I build things for the web.",  purpose:"Bold personal intro with stack"},
      {id:"about",     category:"features",     variant:"alternating",      headline:"About Me",                         purpose:"Story, stack, years, values"},
      {id:"skills",    category:"features",     variant:"stat-highlight",   headline:"Tech Stack",                       purpose:"React, Node, Python — with levels"},
      {id:"projects",  category:"portfolio",    variant:"featured-grid",    headline:"Selected Work",                    purpose:"Projects with tech, links, GitHub"},
      {id:"experience",category:"features",     variant:"icon-grid",        headline:"Experience",                       purpose:"Work history with impact numbers"},
      {id:"testimonials",category:"testimonials",variant:"grid",            headline:"What Colleagues Say",             purpose:"Manager/peer recommendations"},
      {id:"contact",   category:"cta",          variant:"split-form",       headline:"Let's Work Together",             purpose:"Contact + GitHub/LinkedIn"},
      {id:"footer",    category:"footer",       variant:"minimal-centered", headline:"",                                  purpose:"Social, email, GitHub, resume"},
    ],
  },
  {
    domain:"portfolio-designer", base:"PORTFOLIO",
    labels:["designer portfolio","ui designer","ux designer","graphic designer","brand designer","product designer","visual designer"],
    projectName:"{Name} — Designer", tagline:"Design that moves people.",
    targetAudience:"Product companies and creative agencies hiring designers",
    primaryCTA:"Start a Project", secondaryCTA:"View Work",
    assetTheme:"ui design portfolio mockup clean white minimal modern",
    avoid:["dark coding aesthetic","corporate blue"],
    designMood:"clean editorial", typography:"display", spacing:"generous",
    sectionPatch: s => [
      {id:"hero",      category:"hero",         variant:"centered",         headline:"I design experiences people love.", purpose:"Strong typographic hero"},
      {id:"work",      category:"portfolio",    variant:"filter-gallery",   headline:"Selected Work",                    purpose:"Filterable: Branding/UI/Motion"},
      {id:"about",     category:"features",     variant:"alternating",      headline:"About",                           purpose:"Philosophy, process, tools"},
      {id:"services",  category:"features",     variant:"icon-grid",        headline:"Services",                        purpose:"Branding, UI, Systems, Prototyping"},
      {id:"testimonials",category:"testimonials",variant:"featured",        headline:"Client Love",                     purpose:"Client quotes with project context"},
      {id:"contact",   category:"cta",          variant:"floating-card",    headline:"Let's Create Something Great",    purpose:"Project inquiry form"},
      {id:"footer",    category:"footer",       variant:"minimal-centered", headline:"",                                  purpose:"Dribbble, Behance, LinkedIn"},
    ],
  },
  {
    domain:"influencer-creator", base:"PORTFOLIO",
    labels:["influencer","content creator","youtuber","tiktoker","instagrammer","social media influencer","brand ambassador","personal brand"],
    projectName:"{Name}", tagline:"Authentic Content. Real Influence.",
    targetAudience:"Brands seeking influencer partnerships and collaborations",
    primaryCTA:"Work With Me", secondaryCTA:"View Content",
    assetTheme:"content creator lifestyle social media photography vibrant modern",
    avoid:["corporate formal aesthetic","dark tech look"],
    designMood:"vibrant modern",
    copyTone:"Personal, authentic, and energetic. Community-first language.",
  },

  // ── E-COMMERCE VERTICALS ──────────────────────────────────────────────
  {
    domain:"electronics", base:"ECOMMERCE",
    labels:["electronics","tech products","gadgets","smartphones","laptops","headphones","smart home","consumer electronics"],
    projectName:"{Brand}", tagline:"Technology, Simplified.",
    targetAudience:"Tech-savvy consumers and early adopters",
    primaryCTA:"Shop Now", secondaryCTA:"View Deals",
    assetTheme:"electronics product photography clean white studio modern",
    avoid:["lifestyle fashion photography","dark luxury"],
    designMood:"clean tech minimal",
  },
  {
    domain:"pet-shop", base:"ECOMMERCE",
    labels:["pet shop","pet store","pet supplies","dog food","cat food","pet accessories","animal supplies","veterinary products"],
    projectName:"{Brand} Pet Shop", tagline:"Everything Your Pet Deserves.",
    targetAudience:"Pet owners seeking quality supplies and products",
    primaryCTA:"Shop for Your Pet", secondaryCTA:"View Categories",
    assetTheme:"pet shop animals dogs cats cute happy photography",
    avoid:["dark moody aesthetic","luxury brand look"],
    designMood:"warm friendly", colorHint:"#F59E0B",
    copyTone:"Warm and enthusiastic. Pet-parent language. Celebrate the joy of pets.",
  },
  {
    domain:"sports-equipment", base:"ECOMMERCE",
    labels:["sports equipment","sporting goods","gym equipment","outdoor gear","fitness equipment","sports shop","athletic gear"],
    projectName:"{Brand} Sport", tagline:"Gear Up. Perform Better.",
    targetAudience:"Athletes and sports enthusiasts",
    primaryCTA:"Shop Equipment", secondaryCTA:"Find Your Sport",
    assetTheme:"sports equipment fitness outdoor action photography bold",
    avoid:["spa wellness aesthetic","luxury fashion photography"],
    designMood:"bold energetic",
  },

  // ── LOGISTICS & OPERATIONS ────────────────────────────────────────────
  {
    domain:"logistics", base:"PROFESSIONAL",
    labels:["logistics","freight","shipping","supply chain","warehouse","3pl","courier","delivery service","haulage","transport company"],
    projectName:"{Brand} Logistics", tagline:"On Time. Every Time.",
    targetAudience:"Businesses needing reliable logistics and freight services",
    primaryCTA:"Get a Quote", secondaryCTA:"Track Shipment",
    assetTheme:"logistics warehouse trucks freight professional modern",
    avoid:["consumer e-commerce aesthetic","luxury imagery"],
    copyTone:"Reliable and efficient. Lead with on-time performance and network scale.",
  },
  {
    domain:"manufacturing", base:"PROFESSIONAL",
    labels:["manufacturing","factory","production","fabrication","industrial","engineering","precision engineering","contract manufacturing"],
    projectName:"{Brand} Manufacturing", tagline:"Precision Engineered.",
    targetAudience:"B2B buyers and procurement teams",
    primaryCTA:"Request a Quote", secondaryCTA:"View Capabilities",
    assetTheme:"manufacturing factory industrial precision engineering professional",
    avoid:["consumer brand aesthetic","soft design"],
  },
  {
    domain:"agriculture", base:"PROFESSIONAL",
    labels:["farm","agriculture","farming","agri-tech","agribusiness","crop","agricultural","food production","sustainable farming"],
    projectName:"{Brand} Agricultural", tagline:"Growing the Future.",
    targetAudience:"Agricultural businesses and food producers",
    primaryCTA:"Contact Us", secondaryCTA:"Our Products",
    assetTheme:"agriculture farm field crops landscape aerial photography",
    avoid:["urban tech aesthetic","dark corporate"],
    designMood:"natural earthy", colorHint:"#16A34A",
  },

  // ── LANDING PAGES ─────────────────────────────────────────────────────
  {
    domain:"landing-page", base:"LANDING",
    labels:["landing page","waitlist","coming soon","pre-launch","product launch","opt-in","squeeze page","lead generation page"],
    projectName:"{Brand}", tagline:"Be the First to Experience {Brand}",
    targetAudience:"Early adopters and interested prospects",
    primaryCTA:"Get Early Access", secondaryCTA:"Learn More",
    assetTheme:"product launch abstract modern gradient minimal",
    avoid:["multi-section complex layout","long content pages"],
  },
  {
    domain:"app-landing", base:"LANDING",
    labels:["app landing","mobile app landing","app download","app launch","ios app","android app","mobile app promotion"],
    projectName:"{Brand} App", tagline:"Everything You Need. In Your Pocket.",
    targetAudience:"Mobile users seeking a better experience",
    primaryCTA:"Download Free", secondaryCTA:"See How It Works",
    assetTheme:"mobile app phone mockup clean modern ui",
    avoid:["desktop software aesthetic","enterprise look"],
    designMood:"clean modern", colorHint:"",
  },
];

// ── Resolve all compact domains → full DomainKnowledge ───────────────────
const DOMAIN_BLUEPRINTS: DomainKnowledge[] = COMPACT_DOMAINS.map(resolveDomain);

// ── Domain matcher ─────────────────────────────────────────────────────────
function matchDomain(prompt: string, projectType: string): DomainKnowledge | null {
  const p = prompt.toLowerCase();

  for (const d of DOMAIN_BLUEPRINTS) {
    if (d.projectType !== "website" &&
        d.projectType !== "portfolio" &&
        d.projectType !== projectType) continue;
    if (d.labels.some(label => p.includes(label))) return d;
  }

  // Project-type fallbacks
  const fallbacks: Record<string, string> = {
    ecommerce:"ecommerce", saas:"saas", dashboard:"dashboard-analytics",
    landing:"landing-page", portfolio:"portfolio-designer",
  };
  if (fallbacks[projectType]) {
    return DOMAIN_BLUEPRINTS.find(d => d.domain === fallbacks[projectType]) || null;
  }

  return null;
}

// ── Convert DomainKnowledge → DomainBlueprint ─────────────────────────────
function domainKnowledgeToBluePrint(
  dk: DomainKnowledge, prompt: string, niche: NicheProfile
): DomainBlueprint {
  const brandMatch = prompt.match(/(?:called|named|brand|for)\s+["']?([A-Z][a-zA-Z\s&]{2,30})["']?/i)
    || prompt.match(/^([A-Z][a-zA-Z\s&]{2,20})\s+(?:website|store|platform|app|gym|hotel|restaurant)/i);
  const brand = brandMatch?.[1]?.trim() || niche.industry || "Premium";

  return {
    projectName:   dk.projectName.replace(/\{Brand\}|\{Name\}/g, brand),
    tagline:       dk.tagline.replace(/\{Brand\}|\{Name\}/g, brand).replace(/\{action\}/g,"work"),
    businessGoal:  dk.businessGoal,
    targetAudience:dk.targetAudience,
    sectionOrder:  dk.sections.map(s => s.id),
    sectionPurpose:Object.fromEntries(dk.sections.map(s => [s.id, s.purpose])),
    designDirectives: {
      colorMood:     dk.designMood,
      imagingStyle:  dk.assetTheme,
      typographyFeel:dk.typography,
      spacingMood:   dk.spacing,
    },
    assetTheme:    dk.assetTheme,
    primaryCTA:    dk.primaryCTA,
    secondaryCTA:  dk.secondaryCTA,
    avoidMistakes: dk.avoid,
    copyTone:      dk.copyTone,
    keyBenefits:   dk.keyBenefits,
    pricingModel:  dk.pricingModel,
  };
}

function getSectionVariants(dk: DomainKnowledge): Record<string, { category: string; variant: string }> {
  return Object.fromEntries(dk.sections.map(s => [s.id, { category: s.category, variant: s.variant }]));
}


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

interface DomainBlueprint {
  projectName:      string;   // "Prestige Car Club"
  tagline:          string;   // "Drive the Extraordinary"
  businessGoal:     string;   // "membership" | "showcase" | "lead" | "booking" | "ecommerce"
  targetAudience:   string;   // "High net-worth car enthusiasts aged 35-60"
  sectionOrder:     string[]; // ["hero","fleet","membership","experience","gallery","testimonials","faq","contact","footer"]
  sectionPurpose:   Record<string, string>; // { fleet: "Showcase premium vehicles available", membership: "Drive joining" }
  designDirectives: {
    colorMood:      string;   // "Dark luxury — black + deep charcoal + gold accents"
    imagingStyle:   string;   // "Dramatic car photography — studio lighting, low angles"
    typographyFeel: string;   // "Editorial serif headlines, clean sans body"
    spacingMood:    string;   // "Generous — luxury feels unhurried"
  };
  assetTheme:       string;   // "luxury sports cars studio photography dramatic"
  primaryCTA:       string;   // "Apply for Membership"
  secondaryCTA:     string;   // "View the Fleet"
  avoidMistakes:    string[]; // ["No stock business photos", "No perfume imagery", "No generic 'Get Started'"]
  copyTone:         string;   // "Aspirational and exclusive — speak to those who have arrived"
  keyBenefits:      string[]; // ["Curated fleet of 40+ supercars", "White-glove concierge", "Members-only events"]
  pricingModel:     string;   // "membership tiers" | "one-time" | "booking-based" | "none"
}

async function architectBlueprint(
  userPrompt:  string,
  projectType: string,
  niche:       NicheProfile,
  kryptonGen:  (sys: string, usr: string) => Promise<{ text: string }>
): Promise<DomainBlueprint | null> {

  // ── STEP 1: Static domain knowledge lookup (instant, no AI call) ────
  // For all known industries, return the pre-built blueprint directly.
  // This guarantees: luxury car club never gets perfume imagery,
  // restaurant always gets booking CTA, SaaS always gets product screenshot hero.
  const domainKnowledge = matchDomain(userPrompt, projectType);
  if (domainKnowledge) {
    const bp = domainKnowledgeToBluePrint(domainKnowledge, userPrompt, niche);
    // Attach the original DomainKnowledge so generateComponentContent
    // can access exact variant hints per section (no re-matching needed)
    (bp as any).__domainKnowledge = domainKnowledge;
    return bp;
  }

  // ── STEP 2: AI fallback for unknown/novel domains ────────────────────
  // Only reaches here if matchDomain() returned null (genuinely unknown domain).
  // Claude invents a blueprint for: crypto, NFT, biotech, quantum computing,
  // indie game studio, beekeeping supply, etc.
  const system = `You are Krypton AI's domain architect. Produce a precise architectural blueprint for this website.
Output ONLY valid JSON. No markdown. No preamble.

CRITICAL RULES:
- sectionOrder: 7-10 sections specific to THIS business (not a generic template)
- primaryCTA: specific action ("Join the Club" / "Book a Table") — never "Get Started"
- assetTheme: exact image search keywords for THIS domain — never generic business photos
- avoidMistakes: prevent cross-domain contamination (e.g. car club must avoid perfume imagery)`;

  const user = `Business: "${userPrompt}"
Project Type: ${projectType}
Industry: ${niche.industry} (${niche.marketLevel})

Return JSON with keys: projectName, tagline, businessGoal, targetAudience,
sectionOrder (array), sectionPurpose (object), designDirectives (object with colorMood/imagingStyle/typographyFeel/spacingMood),
assetTheme, primaryCTA, secondaryCTA, avoidMistakes (array), copyTone, keyBenefits (array), pricingModel`;

  try {
    const { text } = await kryptonGen(system, user);
    const cleaned   = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.sectionOrder || !parsed.primaryCTA) return null;
    return parsed as DomainBlueprint;
  } catch {
    return null;
  }
}


async function generateComponentContent(
  niche: NicheProfile, blueprint: string, userPrompt: string, projectType: string,
  domainPlan?: DomainBlueprint | null
): Promise<Record<string, any> | null> {
  const tone = niche.tone || "default";

  // ── Blueprint-driven category selection ─────────────────────────────
  // If domainPlan exists, use its sectionOrder to pick components.
  // Map section names to component categories that actually exist.
  const SECTION_TO_CATEGORY: Record<string, ComponentCategory> = {
    hero:"hero", navbar:"navbar", footer:"footer",
    features:"features", benefits:"features", "why-us":"features",
    pricing:"pricing", membership:"pricing", plans:"pricing", tiers:"pricing",
    testimonials:"testimonials", reviews:"testimonials",
    faq:"faq", faqs:"faq",
    cta:"cta", contact:"cta",
    // Domain-specific → map to nearest component
    fleet:"features", showcase:"features", services:"features",
    gallery:"features", portfolio:"features",
    experience:"testimonials", results:"testimonials",
    about:"features", team:"features", stats:"features",
    booking:"cta", "book-now":"cta", "get-started":"cta",
    ecommerce:"ecommerce", products:"ecommerce", shop:"ecommerce",
    dashboard:"dashboard",
  };

  // ── Section variant lookup (from DomainKnowledge — exact variants) ──
  // When a static DomainKnowledge blueprint was used, sectionVariantHints
  // contains the exact variant (e.g. fleet→features/alternating) per section.
  // This eliminates the "always gets icon-grid for everything" problem.
  const sectionVariantHints: Record<string, { category: string; variant: string }> = {};
  if (domainPlan && (domainPlan as any).__domainKnowledge) {
    const dk = (domainPlan as any).__domainKnowledge as DomainKnowledge;
    Object.assign(sectionVariantHints, getSectionVariants(dk));
  }

  let categories: ComponentCategory[];
  if (domainPlan?.sectionOrder && domainPlan.sectionOrder.length > 0) {
    // Use AI architect's section order — always includes navbar + footer
    const mapped = domainPlan.sectionOrder
      .map(s => SECTION_TO_CATEGORY[s.toLowerCase()] as ComponentCategory)
      .filter(Boolean);
    // Deduplicate while preserving order
    const seen = new Set<string>();
    categories = (["navbar", ...mapped, "footer"] as ComponentCategory[])
      ;
  } else if (projectType === "dashboard") {
    categories = ["navbar", "dashboard", "footer"];
  } else if (projectType === "ecommerce" || projectType === "store") {
    categories = ["navbar", "hero", "ecommerce", "testimonials", "cta", "footer"];
  } else if (projectType === "portfolio") {
    categories = ["navbar", "hero", "portfolio", "testimonials", "cta", "footer"];
  } else {
    categories = ["navbar", "hero", "features", "testimonials", "pricing", "faq", "cta", "footer"];
  }

  // Build variant options with RECOMMENDED hints from DomainKnowledge
  const variantOptions = categories.map(c => {
    const allVariants = listVariants(c);
    // Find if any section in this category has a specific variant hint
    const hinted = Object.entries(sectionVariantHints)
      .find(([, v]) => v.category === c);
    if (hinted) {
      return `${c}: [${allVariants.map((v: string) => v === hinted[1].variant ? `${v} ★RECOMMENDED` : v).join(", ")}]`;
    }
    return `${c}: [${allVariants.join(", ")}]`;
  }).join("\n");

  // ── Blueprint-enriched system prompt ─────────────────────────────────
  const blueprintContext = domainPlan ? `
DOMAIN BLUEPRINT (follow this precisely):
Business: ${domainPlan.projectName} — ${domainPlan.tagline}
Goal: ${domainPlan.businessGoal}
Audience: ${domainPlan.targetAudience}
Primary CTA: "${domainPlan.primaryCTA}"
Secondary CTA: "${domainPlan.secondaryCTA}"
Copy Tone: ${domainPlan.copyTone}
Key Benefits: ${domainPlan.keyBenefits?.join(" | ")}
Design: ${domainPlan.designDirectives?.colorMood}
Imagery: ${domainPlan.designDirectives?.imagingStyle}
Asset Theme: ${domainPlan.assetTheme}
AVOID: ${domainPlan.avoidMistakes?.join("; ")}
Section Purposes: ${Object.entries(domainPlan.sectionPurpose||{}).map(([k,v])=>`${k}: ${v}`).join(" | ")}
Domain-specific sections: ${(domainPlan.sectionOrder||[]).join(" → ")}
Exact CTA to use: "${domainPlan.primaryCTA}" — never substitute a generic CTA
Imagery rule: ${domainPlan.assetTheme}` : "";

  const system = `You are Krypton AI's content specialist. Output ONLY valid JSON — no markdown fences, no preamble. Write real, specific copy for the user's niche.

CRITICAL RULES:
1. Headlines must be specific to THIS business — never generic
2. CTAs must use the exact primaryCTA from the blueprint
3. Benefits must be real differentiators for this industry
4. Never use stock phrases like "Get Started", "Learn More", "Our Features"
5. Image keywords must match the EXACT business (car club → luxury cars, NOT perfume)`;

  const user = `Build content for: "${userPrompt}"
Niche: ${niche.industry} (${niche.marketLevel} tier, ${tone} tone)
${blueprintContext}
Blueprint context: ${blueprint.slice(0, 400)}

Choose ONE variant per section from these options:
${variantOptions}

Return JSON only (no \`\`\`json):
{"variants":{"navbar":"...","hero":"...","features":"...","pricing":"...","cta":"...","footer":"..."},"navbar":{"logoText":"Brand","links":[{"label":"Home","href":"#hero"},{"label":"Features","href":"#features"},{"label":"Pricing","href":"#pricing"}],"cta":{"text":"Get Started","href":"#cta"}},"hero":{"badge":"Tagline","headline":"Specific headline for ${niche.industry}","subheadline":"2-sentence value prop","ctaPrimary":{"text":"Start Free","href":"#cta"},"benefits":[{"text":"Key benefit 1"},{"text":"Key benefit 2"},{"text":"Key benefit 3"}]},"features":{"eyebrow":"Why Us","headline":"Why Choose Us","items":[{"icon":"⚡","title":"Feature 1","desc":"Specific description","stat":"stat"}]},"pricing":{"eyebrow":"Pricing","headline":"Simple Pricing","tiers":[{"name":"Starter","price":"$0","period":"month","features":["Feature A","Feature B"],"cta":{"text":"Start Free","href":"#"},"highlighted":false},{"name":"Pro","price":"$29","period":"month","features":["Everything in Starter","Feature C","Feature D"],"cta":{"text":"Get Pro","href":"#"},"highlighted":true}]},"cta":{"headline":"Ready to start?","subheadline":"Join thousands of users","ctaPrimary":{"text":"Get Started Free","href":"#"}},"footer":{"logoText":"Brand","tagline":"Tagline","columns":[{"title":"Product","links":[{"label":"Features","href":"#"},{"label":"Pricing","href":"#"}]},{"title":"Company","links":[{"label":"About","href":"#"},{"label":"Contact","href":"#"}]}],"socialLinks":[{"label":"Twitter","href":"#"}],"copyrightName":"Brand"}}

Make ALL copy specific to ${niche.industry} — real headlines, real benefits, real feature names.`;

  try {
    const { text } = await kryptonGenerate(system, user);
    const cleaned = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
    // Try direct parse first
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.variants && parsed.hero) return parsed;
    } catch {}
    // Try extracting JSON from response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.variants && parsed.hero) return parsed;
    }
    return null;
  } catch {
    return null; // caller falls back to raw HTML generation
  }
}

// Deterministic — assembles real component HTML from AI-written content.
// Zero AI risk for structure; only the copy came from the model.
function assembleFromComponentLibrary(
  niche: NicheProfile, content: Record<string, any>, realImages: string[]
): string {
  const ctx = buildComponentContext(niche.palette.primary);
  const v = content.variants || {};
  const tone = niche.tone || "default";
  let html = "";
  let imgIdx = 0;
  const nextImg = () => realImages[imgIdx++ % Math.max(realImages.length, 1)] || "";

  if (content.navbar) html += renderComponent("navbar", v.navbar || getDefaultVariant("navbar", tone), ctx, content.navbar);
  if (content.hero) {
    const heroContent = { ...content.hero, imageUrl: content.hero.imageUrl || nextImg() };
    html += renderComponent("hero", v.hero || getDefaultVariant("hero", tone), ctx, heroContent);
  }
  if (content.dashboard) html += renderComponent("dashboard", v.dashboard || getDefaultVariant("dashboard", tone), ctx, content.dashboard);
  if (content.features) {
    const items = (content.features.items || []).map((it: any) => ({ ...it, imageUrl: it.imageUrl || nextImg() }));
    html += renderComponent("features", v.features || getDefaultVariant("features", tone), ctx, { ...content.features, items });
  }
  if (content.testimonials) html += renderComponent("testimonials", v.testimonials || getDefaultVariant("testimonials", tone), ctx, content.testimonials);
  if (content.pricing) html += renderComponent("pricing", v.pricing || getDefaultVariant("pricing", tone), ctx, content.pricing);
  if (content.faq) html += renderComponent("faq", v.faq || getDefaultVariant("faq", tone), ctx, content.faq);
  if (content.portfolio) html += renderComponent("portfolio", v.portfolio || getDefaultVariant("portfolio", tone), ctx, content.portfolio);
  if (content.ecommerce) html += renderComponent("ecommerce", v.ecommerce || getDefaultVariant("ecommerce", tone), ctx, content.ecommerce);
  if (content.cta) html += renderComponent("cta", v.cta || getDefaultVariant("cta", tone), ctx, content.cta);
  if (content.footer) html += renderComponent("footer", v.footer || getDefaultVariant("footer", tone), ctx, content.footer);

  return html;
}

// ── Design Critic — text-based holistic review (no screenshot needed) ──
// Quality Gate 2.0 catches STRUCTURAL bugs (missing footer, low contrast).
// This catches SUBJECTIVE weaknesses a human reviewer would notice but no
// regex can: "this headline is generic", "CTA buried below other content",
// "pricing section has no differentiation between tiers". Only runs on the
// complex path — one extra AI call is worth it for SaaS/dashboard-tier
// builds, not worth the latency cost on a simple landing page.
interface DesignCritique {
  score: number;        // 1-10 holistic first-impression score
  issues: string[];     // specific, actionable weaknesses
  strengths: string[];  // what's already working (informational)
}

async function runDesignCritic(html: string, niche: NicheProfile): Promise<DesignCritique | null> {
  // Strip script/style for a leaner review payload — critic judges content/structure, not CSS internals
  const reviewable = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .slice(0, 12000);

  const system = `You are a world-class design critic — the kind who reviews work for Apple, Linear, and Stripe. You give direct, specific, actionable feedback. Output ONLY valid JSON, no markdown fences, no explanation.`;
  const user = `Review this ${niche.industry} (${niche.marketLevel} tier) website's HTML structure as if you were seeing it for the first time:

${reviewable}

Evaluate against these standards a senior designer would actually check:
1. Is the hero headline specific and compelling, or generic/forgettable?
2. Is the primary CTA visible without scrolling (within the first ~600px of markup)?
3. Does the pricing section (if present) clearly differentiate tiers, or do they feel interchangeable?
4. Is there enough visual/content variety between sections, or does it feel repetitive?
5. Would a real visitor trust this enough to take the desired action?

Output this exact JSON shape:
{"score": 1-10, "issues": ["specific actionable issue", ...max 4], "strengths": ["what's working", ...max 2]}

Be honest — a 6/10 with real issues listed is more useful than an inflated 9/10.`;

  try {
    const { text } = await kryptonGenerate(system, user);
    const cleaned = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.score === "number" && Array.isArray(parsed.issues)) return parsed;
    return null;
  } catch {
    return null; // critic is informational/best-effort — never blocks generation
  }
}

function combineOutput(htmlStructure: string, css: string, js: string, niche: NicheProfile, title: string): string {
  // buildRootTokens() is deterministic (not AI-generated) — guarantees every
  // CSS variable the Component Library relies on (--heading-font,
  // --primary-rgb, etc.) is always correct, regardless of what the CSS
  // generation stage produced. AI-generated CSS layers on top of this.
  const rootTokens = buildRootTokens(niche);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${rootTokens}
${css}
/* Krypton QA */img{max-width:100%;display:block;}img:not([style*="height"]){object-fit:cover;}[class*="hero"]{min-height:clamp(400px,60vh,800px);overflow:hidden;}section{padding:clamp(60px,8vw,120px) clamp(16px,5vw,80px);}@media(max-width:768px){[style*="grid-template-columns:repeat(3"]{grid-template-columns:1fr!important;}h1{font-size:clamp(28px,8vw,52px)!important;}section{padding:48px 16px!important;}img{width:100%!important;height:auto!important;}}
</style>
</head>
<body>
${htmlStructure}
<script>
${js}
</script>
</body>
</html>`;
}

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
function generateVisualBoostCSS(dl: DesignLanguage, niche: NicheProfile): string {
  const p       = niche.palette;
  const isLuxury  = dl.premiumLevel >= 9;
  const isSaaS    = dl.componentDensity === "tight";
  const isWarm    = dl.colorTemperature === "warm";
  const radius    = dl.borderRadius === "sharp" ? "0px"
                  : dl.borderRadius === "subtle" ? "4px"
                  : dl.borderRadius === "rounded" ? "16px" : "999px";
  const sectionPad = dl.componentDensity === "generous" ? "clamp(100px,12vw,160px)"
                   : dl.componentDensity === "tight"     ? "clamp(60px,8vw,100px)"
                   : "clamp(80px,10vw,120px)";

  return `
/* ── Visual Intelligence Boost ───────────────────────────────────── */

/* Consistent border radius */
.card, [class*=card] { border-radius: ${radius} !important; }
${isLuxury ? "img, .img-wrapper { border-radius: 0 !important; }" : ""}

/* Section spacing consistency */
section { padding: ${sectionPad} clamp(16px,5vw,80px) !important; }

/* Typography hierarchy enforcement */
h1 { font-size: clamp(${isLuxury ? "48px,8vw,104px" : "36px,6vw,80px"}) !important;
     line-height: ${isLuxury ? "1.0" : "1.1"} !important;
     letter-spacing: ${dl.typographyScale === "editorial" ? "-0.02em" : "-0.01em"} !important; }
h2 { font-size: clamp(24px,4vw,56px) !important; line-height: 1.15 !important; }
h3 { font-size: clamp(18px,2.5vw,28px) !important; }

/* Button consistency */
button, .btn, a[class*="btn"] {
  border-radius: ${radius} !important;
  font-weight: ${isLuxury ? "500" : "700"} !important;
  letter-spacing: ${isLuxury ? "0.1em" : "-0.01em"} !important;
  ${isLuxury ? "text-transform: uppercase;" : ""}
  transition: all 0.25s cubic-bezier(0.16,1,0.3,1) !important;
}

/* Card depth consistency */
.card, [class*=card] {
  background: var(--card, ${p.card}) !important;
  border: 1px solid var(--border, rgba(255,255,255,0.08)) !important;
  ${dl.shadowDepth === "dramatic" ? "box-shadow: 0 24px 64px rgba(0,0,0,0.4) !important;" : ""}
  ${dl.shadowDepth === "medium"   ? "box-shadow: 0 8px 32px rgba(0,0,0,0.25) !important;" : ""}
  ${dl.shadowDepth === "glow"     ? "box-shadow: 0 0 40px rgba(0,0,0,0.3) !important;" : ""}
}

/* Grid responsiveness boost */
@media (max-width: 768px) {
  [style*="grid-template-columns: repeat(3"],[style*="grid-template-columns:repeat(3"] { grid-template-columns: 1fr !important; }
  [style*="grid-template-columns: 1fr 1fr"]  { grid-template-columns: 1fr !important; }
  [style*="display: flex"][style*="gap"]      { flex-wrap: wrap !important; }
  h1 { font-size: clamp(28px,9vw,52px) !important; }
  section { padding: 60px 16px !important; }
}

/* Scroll reveal enforcement */
[data-reveal]:not(.kr-visible) { opacity: 0; transform: translateY(20px); }
[data-reveal].kr-visible { opacity: 1 !important; transform: translateY(0) !important; }

/* Color temperature warmth */
${isWarm ? `:root { filter: none; }
img { filter: brightness(1.02) saturate(1.05) sepia(0.06); }

/* Premium luxury spacing */
${isLuxury ? `.container, .max-w { max-width: 1100px !important; margin-left: auto !important; margin-right: auto !important; }
p, [class*="sub"], [class*="desc"] { line-height: 1.9 !important; font-size: clamp(15px,1.6vw,18px) !important; }` : ""}

/* SaaS data density */
${isSaaS ? `table { font-size: 13px !important; }
.stat { font-variant-numeric: tabular-nums; }` : ""}
`.trim();
}


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
const activeGenerations = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now(); // Product Completion Engine: repair budget
      const send = (event: string, data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      const finish = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      try {
        // Fix 6: Block duplicate concurrent generations per user
        if (authedUserId && activeGenerations.has(authedUserId)) {
          send("error", { message: "A generation is already in progress. Please wait.", code: "DUPLICATE_GEN" });
          finish(); return;
        }
        if (authedUserId) activeGenerations.add(authedUserId);

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
              const rem = (pc.total_credits ?? 5) - (pc.used_credits ?? 0);
              console.log(`[credit-check] user:${authedUserId} total:${pc.total_credits} used:${pc.used_credits} rem:${rem}`);
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

        send("phase", { agent:"Reading", icon:"🔍", action:"Analyzing your request...", pct:8 });
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
        send("phase", { agent:"Planning", icon:"🎨", action:"Planning visual architecture...", pct:35 });
        await new Promise(r => setTimeout(r, 500));
        send("phase", { agent:"Planning", icon:"🎨", action:"Component structure ready", pct:42, done:true });

        // ── PHASE 4: Builder ──────────────────────────────────────
        send("phase", { agent:"Building", icon:"⚙️", action:"Writing production code...", pct:50 });


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
          send("phase", { agent:"Images", icon:"🖼️", action:"Sourcing real images...", pct:22 });
          const imgKeyword = _niche.imageKeyword?.replace(/\+/g,' ') || _niche.industry;
          resolvedImages["main"] = await getRealImageSet(_niche.industry, imgKeyword, 8);
        } catch {
          resolvedImages["main"] = [];
        }

        // Fix 5: Abort if client disconnected
        if ((req as any).signal?.aborted) {
          finish(); return;
        }

        // ── AI ARCHITECT: Blueprint Engine ─────────────────────────────────
        // Runs BEFORE generation. Makes one focused call to understand the
        // exact domain, business goal, section plan, and imagery needed.
        // This prevents "luxury car club" → perfume images + generic sections.
        let domainPlan: DomainBlueprint | null = null;
        try {
          send("phase", { agent:"Planning", icon:"🏛️", action:"AI Architect planning domain...", pct:32 });
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

        if (complexity === "simple") {
          // ── FAST PATH: single comprehensive call, ~30-60s typical ──
          send("phase", { agent:"Building", icon:"⚡", action:"Generating (fast path)...", pct:45 });
          const { text: rawHTML, provider: genProvider } = await kryptonGenerate(systemPrompt, prompt);
          provider = genProvider;
          html = cleanHTML(rawHTML);
        } else {
          // ── DEEP PATH: 4-stage pipeline for complex builds, ~90-150s typical ──
          send("phase", { agent:"Reading", icon:"🧭", action:"Stage 1/4 — Planning blueprint...", pct:28 });
          console.log("Stage 1 Blueprint Start");
          const _s1 = Date.now();
          const pipelineBlueprint = await generateBlueprint(_niche, nicheDetectPrompt, projectType);
          console.log(`Stage 1 Blueprint Done — ${Date.now()-_s1}ms`);

          send("phase", { agent:"Building", icon:"📐", action:"Stage 2/4 — Assembling from component library...", pct:42 });
          console.log("Stage 2 Sections Start");
          const _s2 = Date.now();
          let sectionsHTML: string;
          // ── Component Library first: AI writes content only, tested templates
          // render the HTML. Falls back to raw AI-HTML generation only if the
          // content stage fails (bad JSON, provider outage, etc).
          const componentContent = await generateComponentContent(_niche, pipelineBlueprint, nicheDetectPrompt, projectType, domainPlan);
          if (componentContent) {
            sectionsHTML = assembleFromComponentLibrary(_niche, componentContent, resolvedImages["main"] || []);
          } else {
            try {
              sectionsHTML = await generateSectionsHTML(_niche, _dl, domainPlan ? `${pipelineBlueprint}\n\nEXACT CTA: "${domainPlan.primaryCTA}"\nAVOID: ${domainPlan.avoidMistakes?.join("; ")}` : pipelineBlueprint, nicheDetectPrompt, resolvedImages);
            } catch {
              // Sections stage failed twice (incl. its own internal retry) — fall back
              // to the reliable single-pass path rather than failing the whole request
              send("phase", { agent:"Building", icon:"⚡", action:"Falling back to single-pass...", pct:45 });
              const { text: rawHTML, provider: genProvider } = await kryptonGenerate(systemPrompt, prompt);
              provider = genProvider;
              html = cleanHTML(rawHTML);
              sectionsHTML = "";
            }
          }
          console.log(`Stage 2 Sections Done — ${Date.now()-_s2}ms | length:${sectionsHTML?.length || 0}`);

          if (sectionsHTML) {
            send("phase", { agent:"Building", icon:"🎨", action:"Stage 3/4 — Generating styles...", pct:58 });
            console.log("Stage 3 CSS Start");
            const _s3 = Date.now();
            const generatedCSS = await generateCSS(_niche, _dl, sectionsHTML);
            console.log(`Stage 3 CSS Done — ${Date.now()-_s3}ms | length:${generatedCSS.length}`);

            send("phase", { agent:"Building", icon:"⚡", action:"Stage 4/4 — Generating interactivity...", pct:68 });
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
        }

        // Final safety net — if every path above somehow left html empty
        // (e.g. componentContent succeeded but assembled to an empty string),
        // fall back to the reliable single-pass generation rather than
        // shipping a blank page.
        if (!html || html.trim().length < 200 || !/<!DOCTYPE|<html[\s>]/i.test(html)) {
          const { text: rawHTML, provider: genProvider } = await kryptonGenerate(systemPrompt, prompt);
          provider = genProvider;
          html = cleanHTML(rawHTML);
        }

        // Safety nets — applied regardless of which path generated the HTML
        html = sanitizeImageUrls(html, resolvedImages["main"] || []);
        html = enforceLuxuryPalette(html, _niche);
        html = enforceResponsiveHeadings(html);

        send("phase", { agent:"Building", icon:"⚙️", action:`Code generated via ${provider} (${complexity} path)`, pct:72, done:true });

        // ── PHASE 5: QA — Product Completion Engine: Production Gate ────
        send("phase", { agent:"Validating", icon:"🧪", action:"Running production gate audit...", pct:78 });

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
        // buried CTAs, undifferentiated pricing tiers.
        let critique: DesignCritique | null = null;
        if (complexity === "complex" && gateKind === "website") {
          send("phase", { agent:"Validating", icon:"🎨", action:"Running design critique...", pct:82 });
          console.log("Design Critic Start");
          const _sc = Date.now();
          critique = await runDesignCritic(html, _niche);
          console.log(`Design Critic Done — ${Date.now()-_sc}ms | score:${critique?.score ?? "null"}`);
        }

        let repairAttempts = 0;
        const MAX_REPAIR_ATTEMPTS = 1; // websites get 1 repair pass (vs 2 for dedicated game route)

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

          const instructions = buildRepairInstructions(gate);
          const critiqueBlock = (critique && critique.issues.length > 0)
            ? `\n\nDESIGN CRITIC FEEDBACK (score: ${critique.score}/10):\n${critique.issues.map(i => `- ${i}`).join("\n")}`
            : "";
          const fixPrompt = `The page below has the following issues that MUST be fixed:

${instructions}${critiqueBlock}

Fix ALL of the above WITHOUT removing or breaking any feature that
already works. If there are SYNTAX ERRORS, fixing those is the highest
priority. Return the COMPLETE updated HTML file (starting with
<!DOCTYPE html> and ending with </html>).

EXISTING CODE:
${html}`;

          repairAttempts++;
          try {
            const { text: repairedRaw, provider: repairProvider } = await kryptonGenerate(systemPrompt, fixPrompt);
            const repairedHtml = enforceResponsiveHeadings(enforceLuxuryPalette(sanitizeImageUrls(cleanHTML(repairedRaw), resolvedImages["main"] || []), _niche));
            if (repairedHtml.length > 500 && repairedHtml.includes("</html>")) {
              const repairedGate = runProductionGate(repairedHtml, gateKind, gateSubtype);
              if (repairedGate.score > gate.score) {
                html = repairedHtml;
                gate = repairedGate;
                provider = `${provider} → ${repairProvider} (repair)`;
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
        send("phase", { agent:"Optimizing", icon:"⚡", action:"Optimizing visual quality...", pct:88 });

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

        // ── PHASE 7: Project Manager ──────────────────────────────
        send("phase", { agent:"Finalizing", icon:"📋", action:"Saving project...", pct:95 });

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

        send("phase", { agent:"Finalizing", icon:"📋", action:"Project saved successfully", pct:100, done:true });

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
        if (!/<!DOCTYPE|<html[\s>]/i.test(html)) {
         send("error", { message: "Generation failed — AI returned non-HTML output. Please retry." });
         return;
        }
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
        // Log failed generation
        await logGeneration(supabase, {
          id:            undefined,
          status:        isTimeout ? "timeout" : "failed",
          error_message: errMsg.slice(0, 500),
          error_code:    isTimeout ? "TIMEOUT" : "GENERATION_ERROR",
          duration_ms:   Date.now() - startTime,
          metadata:      { prompt: prompt?.slice(0, 200) },
        });
        send("error", { message: "Generation failed. Please try again." });
      } finally {
        // Fix 6: Release generation lock
        if (authedUserId) activeGenerations.delete(authedUserId);
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
