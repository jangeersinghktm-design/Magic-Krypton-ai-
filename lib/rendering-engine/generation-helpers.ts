// lib/rendering-engine/generation-helpers.ts
// Shared rendering-related helpers required by BOTH orchestrate and
// generate routes: provider-agnostic real image fetching (Unsplash with
// a deterministic Picsum fallback — never a broken image), project-type
// detection, the Stage-1 blueprint fallback, the AI design critic, and
// the final visual-boost CSS safety net.

import type { NicheProfile } from "./types";
import type { DesignLanguage } from "./design-language";
import { kryptonGenerate } from "@/lib/ai-providers";

export function getPicsumFallback(industry: string, count: number): string[] {
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


export async function fetchUnsplashImages(query: string, count: number): Promise<string[]> {
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


// Real, safe memoization — persists for the lifetime of this warm
// serverless instance (not cross-instance/cross-cold-start, which would
// need Redis; this is an honest, bounded optimization, not a fake global
// cache). Prevents an identical Unsplash query from ever repeating within
// one instance's lifetime.
const imageSetCache = new Map<string, string[]>();

export async function getRealImageSet(industry: string, keyword: string, count = 6): Promise<string[]> {
  const cacheKey = `${keyword.toLowerCase().trim()}::${count}`;
  const cached = imageSetCache.get(cacheKey);
  if (cached) return cached;

  let result: string[];
  try {
    const real = await fetchUnsplashImages(keyword, count);
    result = real.length > 0 ? real : getPicsumFallback(industry, count);
  } catch {
    result = getPicsumFallback(industry, count);
  }
  imageSetCache.set(cacheKey, result);
  return result;
}


export function detectProjectType(prompt: string): string {
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


export async function generateBlueprint(niche: NicheProfile, userPrompt: string, projectType: string): Promise<string> {
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


export interface DesignCritique {
  score: number;        // 1-10 holistic first-impression score
  issues: string[];     // specific, actionable weaknesses
  strengths: string[];  // what's already working (informational)
}

export async function runDesignCritic(html: string, niche: NicheProfile): Promise<DesignCritique | null> {
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


export function generateVisualBoostCSS(dl: DesignLanguage, niche: NicheProfile): string {
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
.card, [class*=card], section > div > div { border-radius: ${radius} !important; }
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
  [style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; }
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
img { filter: brightness(1.02) saturate(1.05) warm(2deg); }` : ""}

/* Premium luxury spacing */
${isLuxury ? `.container, .max-w { max-width: 1100px !important; margin-left: auto !important; margin-right: auto !important; }
p, [class*="sub"], [class*="desc"] { line-height: 1.9 !important; font-size: clamp(15px,1.6vw,18px) !important; }` : ""}

/* SaaS data density */
${isSaaS ? `table { font-size: 13px !important; }
.stat { font-variant-numeric: tabular-nums; }` : ""}
`.trim();
}
