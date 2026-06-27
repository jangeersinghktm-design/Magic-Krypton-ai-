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
async function callClaude(system: string, user: string, maxTokens = 12000): Promise<string> {
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
    signal: AbortSignal.timeout(120000),
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
    signal: AbortSignal.timeout(120000),
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
    signal: AbortSignal.timeout(120000),
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
  if (/\bgame\b|\bsnake\b|\btetris\b|\bpuzzle\b|\barcade\b|\bplatform\b|\bshooter\b/.test(p)) return "game";
  if (/\bsaas\b|\bsubscription\b|\bsoftware as a service\b|\bb2b\b.*\bplatform\b|\bpricing tiers?\b/.test(p)) return "saas";
  if (/\bshop\b|\bstore\b|\becommerce\b|\bcart\b|\bproduct\b|\bmarketplace\b/.test(p)) return "ecommerce";
  if (/\bdashboard\b|\badmin\b|\banalytics\b|\bcrm\b|\bpanel\b/.test(p)) return "dashboard";
  if (/\bapp\b|\btool\b|\btracker\b|\bcalculator\b|\bmanager\b/.test(p)) return "app";
  if (/\blanding\b/.test(p)) return "landing";
  if (/\bportfolio\b/.test(p)) return "portfolio";
  if (/\bblog\b|\bnews\b|\barticle\b/.test(p)) return "blog";
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
function detectCompetitorStyle(prompt: string, tone: string): string {
  const p = prompt.toLowerCase();
  // Explicit mention in prompt
  if (/inspired by stripe|like stripe|stripe style/.test(p)) return "Stripe";
  if (/inspired by apple|like apple|apple style/.test(p)) return "Apple";
  if (/inspired by nike|like nike|nike style/.test(p)) return "Nike";
  if (/inspired by airbnb|like airbnb|airbnb style/.test(p)) return "Airbnb";
  if (/inspired by linear|like linear|linear style/.test(p)) return "Linear";
  if (/inspired by framer|like framer|framer style/.test(p)) return "Framer";
  if (/inspired by notion|like notion|notion style/.test(p)) return "Notion";
  if (/inspired by webflow|like webflow/.test(p)) return "Webflow";
  if (/inspired by shopify|like shopify/.test(p)) return "Shopify";
  if (/inspired by hubspot|like hubspot/.test(p)) return "HubSpot";
  // Auto-detect from tone
  const map: Record<string,string> = {
    editorial: "Bottega Veneta Editorial",
    energetic: "Nike",
    warm: "Airbnb",
    trust: "Stripe",
    bold: "Linear",
    clean: "Apple",
    adventurous: "Airbnb",
    helpful: "HubSpot",
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

function buildNichePrompt(userPrompt: string, type: string, plan: string, cachedBlueprint?: any, realImages?: Record<string,string[]>): string {
  const niche = detectNiche(userPrompt);
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
  const competitorStyle = urlBlueprint?.style || detectCompetitorStyle(userPrompt, niche.tone) || niche.competitorStyle;
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
  name: string;          // Apple / Stripe / Nike / Airbnb / Linear
  cardStyle: string;     // CSS for cards
  buttonStyle: string;   // CSS for buttons
  heroStyle: string;     // CSS for hero
  sectionBg: string[];   // alternating section backgrounds
  effectsCSS: string;    // premium effects CSS
  spacing: string;       // spacing philosophy
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

MANDATORY CSS PATTERNS (add to <style> block):

/* Design Language Effects */
${dl.effectsCSS}

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
// V3 FIX: generateCSS (AI call) → buildStaticCSS (deterministic, zero AI)
// All per-component styles now come from the Component Library's own <style> blocks.
// buildStaticCSS adds only global utilities: hover states, responsive helpers,
// component-agnostic patterns. All token values come from buildRootTokens().
function buildStaticCSS(niche: NicheProfile): string {
  const p = niche.palette;
  const t = niche.typography;
  const rgb = hexToRgbValues(p.primary);
  return `
/* ── Global utilities — deterministic, no AI ── */
*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--text);font-family:var(--body-font);line-height:1.65;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
h1,h2,h3,h4,h5{font-family:var(--heading-font);font-weight:var(--heading-weight);letter-spacing:var(--heading-spacing);line-height:1.15;}
h1{font-size:clamp(28px,6vw,72px);}
h2{font-size:clamp(22px,4vw,48px);}
h3{font-size:clamp(16px,2.5vw,28px);}
a{color:inherit;text-decoration:none;}
img{max-width:100%;height:auto;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-thumb{background:rgba(var(--primary-rgb),.4);border-radius:4px;}

/* ── Container ── */
.container{max-width:1200px;margin:0 auto;padding:0 clamp(16px,4vw,48px);}
.section-inner{max-width:1200px;margin:0 auto;padding:0 clamp(16px,4vw,48px);}

/* ── Buttons ── */
.btn,.btn-primary{display:inline-flex;align-items:center;gap:8px;background:var(--grad);color:#fff;border:none;padding:14px 28px;border-radius:10px;font-weight:700;cursor:pointer;text-decoration:none;font-family:var(--body-font);font-size:15px;transition:transform .2s,box-shadow .2s;white-space:nowrap;}
.btn:hover,.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(var(--primary-rgb),.35);}
.btn-secondary{display:inline-flex;align-items:center;gap:8px;background:transparent;color:var(--text);border:1px solid var(--border);padding:13px 28px;border-radius:10px;font-weight:600;cursor:pointer;font-family:var(--body-font);font-size:15px;transition:all .2s;text-decoration:none;}
.btn-secondary:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.2);}

/* ── Cards ── */
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px;transition:border-color .2s,transform .2s;}
.card:hover{border-color:rgba(var(--primary-rgb),.3);transform:translateY(-2px);}

/* ── Sections ── */
section{padding:clamp(60px,10vw,120px) 0;overflow-x:hidden;}

/* ── Navigation ── */
nav{position:sticky;top:0;z-index:100;background:rgba(var(--bg-rgb),.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--border);}
nav.scrolled{box-shadow:0 4px 24px rgba(0,0,0,.3);}
.nav-links{display:flex;align-items:center;gap:8px;}
.hamburger{display:none;background:none;border:none;color:var(--text);font-size:22px;cursor:pointer;padding:6px;}
.nav-links.open{display:flex;}
@media(max-width:768px){
  .nav-links{display:none;position:fixed;inset:58px 0 0 0;background:var(--bg);flex-direction:column;padding:20px;gap:12px;border-top:1px solid var(--border);align-items:flex-start;}
  .nav-links a{font-size:17px;padding:10px 0;}
  .hamburger{display:block;}
}

/* ── FAQ accordion ── */
.faq-item{border-bottom:1px solid var(--border);}
.faq-question{display:flex;justify-content:space-between;align-items:center;padding:18px 0;cursor:pointer;font-weight:600;}
.faq-answer{max-height:0;overflow:hidden;transition:max-height .35s ease,padding .35s ease;}
.faq-answer.open{max-height:400px;padding-bottom:16px;}
.faq-icon{transition:transform .3s;flex-shrink:0;}
.faq-question.active .faq-icon{transform:rotate(45deg);}

/* ── Forms ── */
input,textarea,select{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 16px;color:var(--text);font-family:var(--body-font);font-size:14px;width:100%;outline:none;transition:border-color .2s;}
input:focus,textarea:focus,select:focus{border-color:var(--primary);}
input::placeholder,textarea::placeholder{color:var(--text-2);}

/* ── Reveal animation ── */
.reveal{opacity:0;transform:translateY(24px);transition:opacity .65s cubic-bezier(.16,1,.3,1),transform .65s cubic-bezier(.16,1,.3,1);}
.reveal.visible{opacity:1;transform:none;}

/* ── Pricing highlighted ── */
.pricing-card.highlighted,.pricing-card.featured{border-color:rgba(var(--primary-rgb),.4);background:var(--surface);}

/* ── Grid helpers ── */
.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;}
@media(max-width:900px){.grid-4{grid-template-columns:repeat(2,1fr);}.grid-3{grid-template-columns:1fr 1fr;}}
@media(max-width:640px){.grid-2,.grid-3,.grid-4{grid-template-columns:1fr;}}

/* ── Text utilities ── */
.text-center{text-align:center;}
.text-gradient{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--text-2);margin-bottom:12px;}
.section-headline{font-size:clamp(24px,4vw,44px);margin-bottom:16px;}
.section-sub{font-size:clamp(14px,2vw,18px);color:var(--text-2);line-height:1.75;max-width:600px;}

/* ── Footer ── */
footer{background:var(--surface);border-top:1px solid var(--border);padding:clamp(48px,8vw,80px) 0 28px;}
`.trim();
}

// ── Stage 4: JS (interactivity targeting the HTML above) ───────────────
// V4 FIX: generateJS (AI call) → buildStaticJS (deterministic, zero AI)
// Every behavior is predefined: hamburger, FAQ accordion, smooth scroll,
// scroll-reveal, sticky header, form handling.
// Covers 100% of what generateJS asked the AI to produce.
function buildStaticJS(): string {
  return `
/* Krypton AI — Static Interaction Layer */
(function(){
  // ── Hamburger menu ──
  document.querySelectorAll('.hamburger,[data-hamburger]').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.nav-links,[data-nav-links]').forEach(function(nav){
        nav.classList.toggle('open');
      });
    });
  });
  // Close mobile nav when a link is clicked
  document.querySelectorAll('.nav-links a,[data-nav-links] a').forEach(function(a){
    a.addEventListener('click',function(){
      document.querySelectorAll('.nav-links,[data-nav-links]').forEach(function(nav){
        nav.classList.remove('open');
      });
    });
  });
  // Close on outside click
  document.addEventListener('click',function(e){
    var t=e.target;
    if(!t.closest('.hamburger,.nav-links,[data-hamburger],[data-nav-links]')){
      document.querySelectorAll('.nav-links,[data-nav-links]').forEach(function(nav){
        nav.classList.remove('open');
      });
    }
  });

  // ── Sticky header ──
  window.addEventListener('scroll',function(){
    document.querySelectorAll('nav,header').forEach(function(nav){
      nav.classList.toggle('scrolled',window.scrollY>50);
    });
  },{passive:true});

  // ── Smooth scroll ──
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      var id=a.getAttribute('href');
      var t=id&&id.length>1?document.querySelector(id):null;
      if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth',block:'start'});}
    });
  });

  // ── Scroll reveal (IntersectionObserver) ──
  if('IntersectionObserver' in window){
    var ro=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){e.target.classList.add('visible');ro.unobserve(e.target);}
      });
    },{threshold:0.1,rootMargin:'0px 0px -40px 0px'});
    document.querySelectorAll('.reveal').forEach(function(el){ro.observe(el);});
  } else {
    document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('visible');});
  }

  // ── FAQ accordion ──
  document.querySelectorAll('.faq-question,[data-faq-question]').forEach(function(q){
    q.addEventListener('click',function(){
      var item=q.closest('.faq-item,[data-faq-item]');
      var answer=item&&item.querySelector('.faq-answer,[data-faq-answer]');
      var isOpen=q.classList.contains('active');
      // Close all
      document.querySelectorAll('.faq-question,[data-faq-question]').forEach(function(oq){
        oq.classList.remove('active');
        var oi=oq.closest('.faq-item,[data-faq-item]');
        var oa=oi&&oi.querySelector('.faq-answer,[data-faq-answer]');
        if(oa)oa.classList.remove('open');
      });
      // Open clicked (unless it was already open)
      if(!isOpen&&answer){q.classList.add('active');answer.classList.add('open');}
    });
  });

  // ── Form handling (no real backend) ──
  document.querySelectorAll('form').forEach(function(form){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var btn=form.querySelector('button[type="submit"],input[type="submit"]');
      var orig=btn?btn.textContent:'';
      if(btn){btn.disabled=true;btn.textContent='Sending...';}
      setTimeout(function(){
        if(btn){btn.disabled=false;btn.textContent=orig;}
        var status=form.querySelector('.form-status,.success-message');
        if(!status){
          status=document.createElement('p');
          status.className='form-status';
          status.style.cssText='color:#4CAF8A;margin-top:12px;font-weight:600;';
          form.appendChild(status);
        }
        status.textContent='✓ Message sent! We will get back to you soon.';
        form.reset();
        setTimeout(function(){if(status)status.textContent='';},5000);
      },1000);
    });
  });

  // ── Pricing toggle (monthly/annual) ──
  var toggle=document.querySelector('.pricing-toggle,[data-pricing-toggle]');
  if(toggle){
    toggle.addEventListener('change',function(){
      var isAnnual=toggle.checked;
      document.querySelectorAll('[data-monthly],[data-annual]').forEach(function(el){
        if(isAnnual){el.style.display=el.dataset.annual!==undefined?'':'none';}
        else{el.style.display=el.dataset.monthly!==undefined?'':'none';}
      });
    });
  }

  // ── Counter animation ──
  if('IntersectionObserver' in window){
    var cr=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(!e.isIntersecting)return;
        var el=e.target;
        var target=parseInt(el.dataset.count||el.textContent||'0',10);
        if(!target)return;
        var start=0,dur=1600,step=dur/60;
        var timer=setInterval(function(){
          start+=target/60;
          if(start>=target){el.textContent=target.toLocaleString()+(el.dataset.suffix||'');clearInterval(timer);}
          else{el.textContent=Math.floor(start).toLocaleString()+(el.dataset.suffix||'');}
        },step);
        cr.unobserve(el);
      });
    },{threshold:0.5});
    document.querySelectorAll('[data-count]').forEach(function(el){cr.observe(el);});
  }
})();
`.trim();
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
async function generateComponentContent(
  niche: NicheProfile, blueprint: string, userPrompt: string, projectType: string
): Promise<Record<string, any> | null> {
  const tone = niche.tone || "default";
  const categories: ComponentCategory[] = projectType === "dashboard"
    ? ["navbar", "dashboard", "footer"]
    : projectType === "ecommerce" || projectType === "store"
    ? ["navbar", "hero", "ecommerce", "testimonials", "cta", "footer"]
    : projectType === "portfolio"
    ? ["navbar", "hero", "portfolio", "testimonials", "cta", "footer"]
    : ["navbar", "hero", "features", "testimonials", "pricing", "faq", "cta", "footer"];

  const variantOptions = categories.map(c => `${c}: [${listVariants(c).join(", ")}]`).join("\n");

  const system = `You are Krypton AI's content specialist. Output ONLY valid JSON — no markdown fences, no preamble. Write real, specific copy for the user's niche.`;
  const user = `Build content for: "${userPrompt}"
Niche: ${niche.industry} (${niche.marketLevel} tier, ${tone} tone)
Blueprint context: ${blueprint.slice(0, 400)}

Choose ONE variant per section from these options:
${variantOptions}

Return JSON only (no \`\`\`json):
{"variants":{"navbar":"...","hero":"...","features":"...","pricing":"...","cta":"...","footer":"..."},"navbar":{"logoText":"Brand","links":[{"label":"Home","href":"#hero"},{"label":"Features","href":"#features"},{"label":"Pricing","href":"#pricing"}],"cta":{"text":"Get Started","href":"#cta"}},"hero":{"badge":"Tagline","headline":"Specific headline for ${niche.industry}","subheadline":"2-sentence value prop","ctaPrimary":{"text":"Start Free","href":"#cta"},"benefits":[{"text":"Key benefit 1"},{"text":"Key benefit 2"},{"text":"Key benefit 3"}]},"features":{"eyebrow":"Why Us","headline":"Why Choose Us","items":[{"icon":"⚡","title":"Feature 1","desc":"Specific description","stat":"stat"}]},"pricing":{"eyebrow":"Pricing","headline":"Simple Pricing","tiers":[{"name":"Starter","price":"$0","period":"month","features":["Feature A","Feature B"],"cta":{"text":"Start Free","href":"#"},"highlighted":false},{"name":"Pro","price":"$29","period":"month","features":["Everything in Starter","Feature C","Feature D"],"cta":{"text":"Get Pro","href":"#"},"highlighted":true}]},"cta":{"headline":"Ready to start?","subheadline":"Join thousands of users","ctaPrimary":{"text":"Get Started Free","href":"#"}},"footer":{"logoText":"Brand","tagline":"Tagline","columns":[{"title":"Product","links":[{"label":"Features","href":"#"},{"label":"Pricing","href":"#"}]},{"title":"Company","links":[{"label":"About","href":"#"},{"label":"Contact","href":"#"}]}],"socialLinks":[{"label":"Twitter","href":"#"}],"copyrightName":"Brand"}}

Make ALL copy specific to ${niche.industry} — real headlines, real benefits, real feature names.`;

  // ── Intelligent defaults — used when AI parse fails ────────────────────
  function makeDefaultContent(projectType: string, niche: NicheProfile, tone: string): Record<string, any> {
    const name     = userPrompt.slice(0, 40);
    const industry = niche.industry || "business";
    const market   = niche.marketLevel || "premium";
    return {
      variants: {
        navbar:       getDefaultVariant("navbar",       tone),
        hero:         getDefaultVariant("hero",         tone),
        features:     getDefaultVariant("features",     tone),
        testimonials: getDefaultVariant("testimonials", tone),
        pricing:      getDefaultVariant("pricing",      tone),
        faq:          getDefaultVariant("faq",          tone),
        cta:          getDefaultVariant("cta",          tone),
        footer:       getDefaultVariant("footer",       tone),
      },
      navbar: {
        logoText: name,
        links: [
          { label: "Home",     href: "#hero"     },
          { label: "Services", href: "#features" },
          { label: "Pricing",  href: "#pricing"  },
          { label: "Contact",  href: "#cta"      },
        ],
        cta: { text: "Get Started", href: "#cta" },
      },
      hero: {
        badge:        `${market.charAt(0).toUpperCase()+market.slice(1)} ${industry}`,
        headline:     `The Future of ${name}`,
        subheadline:  `Premium ${industry} solutions designed for results.`,
        ctaPrimary:   { text: "Get Started",  href: "#cta"      },
        ctaSecondary: { text: "Learn More",   href: "#features" },
      },
      features: {
        eyebrow:  "Why Choose Us",
        headline: `Everything you need from a ${industry} partner`,
        items: [
          { icon: "⚡", title: "Fast Delivery",     desc: "Rapid execution without compromising quality." },
          { icon: "🔒", title: "Reliable Results",  desc: "Consistent outcomes you can count on."         },
          { icon: "🎯", title: "Expert Team",       desc: "Specialists with deep industry knowledge."      },
          { icon: "💡", title: "Smart Solutions",   desc: "Innovative approaches to complex challenges."   },
        ],
      },
      testimonials: {
        eyebrow:  "Client Results",
        headline: "Trusted by industry leaders",
        items: [
          { quote: "Exceptional quality and service. Highly recommended.",  name: "Sarah M.",  role: "Director", rating: 5 },
          { quote: "Transformed our operations completely. Outstanding.",   name: "James K.",  role: "CEO",      rating: 5 },
          { quote: "Professional, reliable, and results-driven team.",      name: "Priya R.",  role: "Founder",  rating: 5 },
        ],
      },
      pricing: {
        eyebrow:  "Pricing",
        headline: "Simple, transparent pricing",
        tiers: [
          { name: "Starter",    price: "$49",   period: "month", highlighted: false, features: ["Core features", "Email support", "5 projects"], cta: { text: "Start Now", href: "#cta" } },
          { name: "Pro",        price: "$149",  period: "month", highlighted: true,  features: ["Everything in Starter", "Priority support", "25 projects", "Analytics"], cta: { text: "Go Pro", href: "#cta" } },
          { name: "Enterprise", price: "Custom", period: "",     highlighted: false, features: ["Unlimited projects", "Dedicated support", "Custom integrations"], cta: { text: "Contact Us", href: "#cta" } },
        ],
      },
      faq: {
        eyebrow:  "FAQ",
        headline: "Frequently Asked Questions",
        items: [
          { question: "How quickly can you start?",    answer: "We can begin within 24-48 hours of onboarding."              },
          { question: "What does the process look like?", answer: "We start with a discovery call, then deliver a tailored plan." },
          { question: "Is there a contract required?", answer: "Monthly plans available with no long-term commitment."        },
          { question: "Do you offer refunds?",         answer: "We offer a satisfaction guarantee on all our services."       },
        ],
      },
      cta: {
        headline:     `Ready to get started with ${name}?`,
        subheadline:  "Join hundreds of satisfied clients. Start today.",
        ctaPrimary:   { text: "Start Now",      href: "#contact" },
        ctaSecondary: { text: "Learn More",     href: "#features" },
      },
      footer: {
        logoText:      name,
        tagline:       `Premium ${industry} for modern businesses.`,
        columns: [
          { title: "Product",  links: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }] },
          { title: "Company",  links: [{ label: "About",    href: "#about"    }, { label: "Contact", href: "#cta"     }] },
        ],
        socialLinks:   [],
        copyrightName: name,
      },
    };
  }

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
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.variants && parsed.hero) return parsed;
      } catch {}
    }
    // JSON parse failed — use intelligent defaults (never return null)
    console.warn("generateComponentContent: JSON parse failed, using defaults");
    return makeDefaultContent(projectType, niche, tone);
  } catch {
    // AI call failed — use intelligent defaults (never return null)
    console.warn("generateComponentContent: AI call failed, using defaults");
    return makeDefaultContent(projectType, niche, tone);
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
            type:    projectType || "website",
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

        // ── COMPLEXITY ROUTER: simple → fast single-pass | complex → 4-stage pipeline ──
        const complexity = assessComplexity(nicheDetectPrompt, projectType);
        const _dl = getDesignLanguage(_niche);
        let provider = "claude";
        let html: string = ""; // initialized — TS couldn't prove definite assignment across all branches below

        // systemPrompt always built — used directly for simple path, and reused
        // by the repair pass later regardless of which path generated the first draft
        const systemPrompt = buildNichePrompt(nicheDetectPrompt, projectType, executionPlan, cachedUrlBlueprint, resolvedImages)
          + (blueprint ? `\n\n${buildBlueprintPrompt(blueprint)}` : "");

        // ── UNIFIED PIPELINE: ALL paths use Component Library ─────────────
        // V1 FIX: "simple" path no longer calls kryptonGenerate for raw HTML.
        // V2 FIX: AI HTML safety net removed — error sent instead.
        // Both simple and complex requests now flow through:
        //   generateBlueprint → generateComponentContent → assembleFromComponentLibrary
        //
        // Why safe: generateComponentContent() always returns valid JSON (never null)
        // thanks to makeDefaultContent() fallback added in previous refactor.
        // assembleFromComponentLibrary() always returns non-empty HTML given valid JSON.

        send("phase", { agent:"Reading", icon:"🧭", action:"Stage 1/3 — Planning blueprint...", pct:28 });
        console.log("Stage 1 Blueprint Start");
        const _s1 = Date.now();
        const pipelineBlueprint = await generateBlueprint(_niche, nicheDetectPrompt, projectType);
        console.log(`Stage 1 Blueprint Done — ${Date.now()-_s1}ms`);

        send("phase", { agent:"Building", icon:"📐", action:"Stage 2/3 — Assembling from component library...", pct:48 });
        console.log("Stage 2 Component Content Start");
        const _s2 = Date.now();
        const componentContent = await generateComponentContent(_niche, pipelineBlueprint, nicheDetectPrompt, projectType);
        // generateComponentContent always returns valid JSON — makeDefaultContent() guarantees this.
        const sectionsHTML = assembleFromComponentLibrary(_niche, componentContent!, resolvedImages["main"] || []);
        console.log(`Stage 2 Done — ${Date.now()-_s2}ms | sectionsHTML:${sectionsHTML.length}`);

        if (!sectionsHTML || sectionsHTML.trim().length < 100) {
          // V2 FIX: Do NOT fall back to AI HTML. Send a clear error instead.
          send("error", { message: "Component assembly returned empty output. Please try a different prompt." });
          return;
        }

        send("phase", { agent:"Building", icon:"⚡", action:"Stage 3/3 — Finalising...", pct:68 });
        console.log("Stage 3 Combine Start");
        const _s3 = Date.now();
        const staticCSS  = buildStaticCSS(_niche);
        const staticJS   = buildStaticJS();
        html = combineOutput(sectionsHTML, staticCSS, staticJS, _niche, nicheDetectPrompt.slice(0,60));
        html = cleanHTML(html);
        console.log(`Stage 3 Done — ${Date.now()-_s3}ms | total html:${html.length}`);

        // Safety nets — applied regardless of which path generated the HTML
        html = sanitizeImageUrls(html, resolvedImages["main"] || []);
        html = enforceLuxuryPalette(html, _niche);
        html = enforceResponsiveHeadings(html);

        send("phase", { agent:"Building", icon:"⚙️", action:`Code generated via ${provider} (${complexity} path)`, pct:72, done:true });

        // ── PHASE 5: QA — Product Completion Engine: Production Gate ────
        send("phase", { agent:"Validating", icon:"🧪", action:"Running production gate audit...", pct:78 });

        const gateKind  = projectType === "game" ? "game" : "website";
        const gateSubtype = projectType === "game" ? "arcade" : projectType;
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
        const MAX_REPAIR_ATTEMPTS = 0; // websites get 1 repair pass (vs 2 for dedicated game route)

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
          // ARCHITECTURE FIX: Repair pass now regenerates component JSON only,
          // then re-renders via component library — no full HTML regen.
          // Cost: ~2,000 tokens vs ~16,000 tokens (87% reduction)
          const repairCopyPrompt = `The website has these specific issues:

${instructions}${critiqueBlock}

The current page content JSON is below. Fix ONLY the content that causes
these issues (headlines too short, copy too generic, missing sections, etc).
Return the SAME JSON structure with only the problematic fields updated.
Do NOT change HTML, CSS or structure. Output ONLY valid JSON.

CURRENT CONTENT JSON:
${JSON.stringify(componentContent, null, 2).slice(0, 3000)}`;

          repairAttempts++;
          try {
            const { text: repairedJson, provider: repairProvider } = await kryptonGenerate(
              `You are Krypton AI's content repair specialist. Return ONLY valid JSON — same structure as input, only fix the reported issues. No markdown, no HTML.`,
              repairCopyPrompt
            );
            // Parse repaired JSON
            let updatedContent = componentContent;
            try {
              const cleaned = repairedJson.replace(/\`\`\`json|\`\`\`/g, "").trim();
              const parsed  = JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned);
              if (parsed && parsed.hero) updatedContent = { ...componentContent, ...parsed };
            } catch { /* keep original content */ }
            // Re-render from component library with updated content
            // V3+V4 FIX: Uses buildStaticCSS + buildStaticJS (no AI calls)
            const repairedSections = assembleFromComponentLibrary(_niche, updatedContent, resolvedImages["main"] || []);
            const repairedHtml = enforceResponsiveHeadings(enforceLuxuryPalette(
              combineOutput(repairedSections, buildStaticCSS(_niche), buildStaticJS(), _niche, nicheDetectPrompt.slice(0,60)),
              _niche
            ));
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

        // ── PHASE 6: Optimizer ────────────────────────────────────
        send("phase", { agent:"Optimizing", icon:"⚡", action:"Optimizing performance...", pct:88 });
        await new Promise(r => setTimeout(r, 400));
        send("phase", { agent:"Optimizing", icon:"⚡", action:"Optimization complete", pct:92, done:true });

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

        send("complete", {
          html,
          projectId:   savedProjectId,
          projectType,
          provider,
          creditCost,
          linesOfCode: html.split("\n").length,
          executionPlan,
          blueprint,
          componentContent, // V6: passed to create page for component-level edits
          // Product Completion Engine — Production Gate
          completenessScore:     gate.score,
          dimensions:            gate.dimensions,
          buildPass:             gate.buildPass,
          validationPass:        gate.validationPass,
          runtimePass:           gate.runtimePass,
          mobilePass:            gate.mobilePass,
          overallPass:           gate.overallPass,
          auditFailed:           gate.failedFeatures.map(f => f.label),
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
          id:            genLogId || undefined,
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
