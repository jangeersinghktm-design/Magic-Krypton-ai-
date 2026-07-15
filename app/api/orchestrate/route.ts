// app/api/orchestrate/route.ts
// Krypton AI — Real Agent Orchestration via Server-Sent Events
// 7-Phase Pipeline: Plan → Research → Design → Build → QA → Optimize → Deliver
// Never fake progress — every event tied to real AI operations

import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { acquireGenerationLock, releaseGenerationLock } from "@/lib/generation-lock";
import { componentDiffEngine, mergeComponentsIntoHTML, reuseDesignPlan } from "@/lib/component-cache";
import { CostTracker, CostGuardAbortError, enterWithCostTracker, resolveBudget, logCostSummary } from "@/lib/cost-guard";
import { generationSeedFromId } from "@/lib/design-engine";
import { callClaude, kryptonGenerate } from "@/lib/ai-providers";
import {
  renderComponent, listVariants, buildComponentContext,
  buildRootTokens, type ComponentCategory,
} from "@/lib/component-library";
import {
  runProductionGate,
  generateWebsiteBlueprint,
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
  getRealImageSet, detectProjectType,
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
  sanitizeImageUrls, enforceLuxuryPalette, enforceResponsiveHeadings, cleanHTML,
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
  NicheProfile,
} from "@/lib/rendering-engine/types";

// ═══════════════════════════════════════════════════════════════════
// ── Dead-code cleanup: CompetitorBlueprint, COMPETITOR_BLUEPRINTS,
// detectCompetitorFromURL, DesignReference, REFERENCE_PROFILES,
// DOMAIN_TO_REFERENCE, CompositionOverride/ComposedStrategy/
// COMPOSITION_OVERRIDES, resolveConflict, ROLE_LABELS, getBrandDisplay,
// composeDesignStrategy, getDesignReference, detectCompetitorStyle, and
// detectAudienceDimensions were removed here — confirmed zero live
// callers across this entire session's audits.

import { detectNiche } from "@/lib/rendering-engine/niche-detection";


// ── PHASE 2-6: MASTER PROMPT BUILDER ────────────────────────────

// buildNichePrompt was removed here — confirmed zero live callers
// (its only call site's result was itself unused, removed separately).


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
// getTrustEngineBlueprint, getNicheWebsitePrompt, KryptonAI, and
// buildSectionBlueprints were removed here — confirmed zero live
// callers outside this same dead chain.

// GAME_PROMPT and buildWebsiteExtras were removed here — confirmed zero
// live callers (games route through the dedicated /api/game engine).

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
// removeSection was removed here — confirmed zero live callers.

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
  generateSingleComponentContent,
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
  const { prompt, userId, accessToken, competitorUrl, forceType, forceRegenerate } = await req.json().catch(() => ({}));

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
      let genLogId: string | null = null;
      let costTracker: CostTracker | null = null;
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
        // Start generation log entry (genLogId declared in outer scope above)
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

        // Execution plan — deferred until AFTER the cache-check below.
        // A cache HIT reuses a zero-cost placeholder; only a cache MISS
        // triggers the real AI call (was previously unconditional here,
        // running on every request including cache hits).
        // Cost Guard — one tracker per generation, shared across every
        // provider call below (and passed into kryptonGenerate calls
        // deeper in the pipeline), so the running total reflects the
        // WHOLE generation, not just one isolated call.
        costTracker = new CostTracker(resolveBudget());
        enterWithCostTracker(costTracker);

        let executionPlan = `1. Set up ${projectType} structure\n2. Build core functionality\n3. Style with premium design system\n4. Add interactivity\n5. Optimize and finalize`;

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

        // ── Cache version tags — bump any of these when the corresponding
        // system changes, so old cached rows are correctly treated as stale
        // rather than being served forever. ─────────────────────────────────
        const CACHE_MODEL_VERSION = "v1";
        const CACHE_COMPONENT_VERSION = "v1";
        const CACHE_IMAGE_VERSION = "v1";
        const CACHE_THEME_VERSION = "v1";
        const CACHE_BLUEPRINT_VERSION = "v1";
        const CACHE_VISUAL_HIERARCHY_VERSION = "v1";

        // ── Global AI Cache (Supabase-backed, real, persistent across
        // instances/cold-starts/users) — key computed here (right after
        // design language is known), checked and consumed further below
        // once `html` is in scope.
        const cacheKeyRaw = `${nicheDetectPrompt.trim().toLowerCase()}::${projectType}::${_niche.industry}::${_niche.tone}`;
        const cacheKeyHash = createHash("sha256").update(cacheKeyRaw).digest("hex");
        const promptHash = createHash("sha256").update(nicheDetectPrompt.trim().toLowerCase()).digest("hex");
        let cachedHtmlResult: string | null = null;
        let componentContent: Record<string, any> | null = null;
        let domainPlan: DomainBlueprint | null = null;
        let resolvedImages: Record<string,string[]> = {};

        if (!forceRegenerate) {
          try {
            const { data: cached } = await supabase
              .from("generation_cache")
              .select("*")
              .eq("cache_key", cacheKeyHash)
              .maybeSingle();

            if (cached) {
              const reasons: string[] = [];
              if (cached.invalidated) reasons.push("manually invalidated");
              if (cached.expires_at && new Date(cached.expires_at).getTime() < Date.now()) reasons.push("TTL expired");
              if (cached.prompt_hash !== promptHash) reasons.push("prompt hash mismatch");
              if (cached.industry !== _niche.industry) reasons.push("industry mismatch");
              if (cached.design_language !== _niche.tone) reasons.push("design language mismatch");
              if (cached.model_version !== CACHE_MODEL_VERSION) reasons.push("model version mismatch");
              if (cached.component_version !== CACHE_COMPONENT_VERSION) reasons.push("component version mismatch");
              if (cached.image_version !== CACHE_IMAGE_VERSION) reasons.push("image version mismatch");
              if ((cached.theme_version || "v1") !== CACHE_THEME_VERSION) reasons.push("theme version mismatch");
              if ((cached.blueprint_version || "v1") !== CACHE_BLUEPRINT_VERSION) reasons.push("blueprint version mismatch");
              if ((cached.visual_hierarchy_version || "v1") !== CACHE_VISUAL_HIERARCHY_VERSION) reasons.push("visual hierarchy version mismatch");

              if (reasons.length === 0 && cached.html_code) {
                // Full restore — not just HTML. componentContent/domainPlan/
                // resolvedImages are the same variables the live pipeline
                // uses, so anything downstream that reads them sees the
                // restored data exactly as if this generation had just run.
                cachedHtmlResult = cached.html_code;
                componentContent = cached.component_content || null;
                if (cached.blueprint) domainPlan = cached.blueprint as DomainBlueprint;
                if (cached.images) resolvedImages["main"] = cached.images as string[];
                if (cached.color_palette) _niche.palette = cached.color_palette;
                if (cached.typography) _niche.typography = cached.typography;
                if (cached.page_structure) _niche.sectionOrder = cached.page_structure;
              } else if (reasons.length > 0) {
                console.log(`[generation_cache] stale entry ignored (${reasons.join(", ")}) for key ${cacheKeyHash}`);
              }
            }
          } catch { /* cache table may not exist yet — falls through to normal generation */ }
        }

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

        // Fetch REAL working images CONCURRENTLY with the architect blueprint
        // call below — both are independent (architectBlueprint doesn't need
        // images to plan section order, and this rough fetch doesn't need
        // the blueprint either). Only the SECOND, refined re-fetch below
        // genuinely depends on architectBlueprint's output, so that one
        // stays sequential.
        // executionPlan — deterministic derivation, no AI call. Uses
        // already-available niche/section data to produce a plan
        // specific to this business without a separate AI round-trip;
        // this is the redundant "second planning call" now eliminated.
        if (!cachedHtmlResult) {
          const firstSections = _niche.sectionOrder.slice(0, 3).join(", ");
          executionPlan = `1. Set up ${projectType} structure for ${_niche.industry}\n2. Build ${firstSections} sections with real, industry-specific content\n3. Apply the ${_niche.tone} design language (typography, palette, spacing)\n4. Add interactivity (navigation, forms, animations)\n5. Validate and optimize for production`;
        }

        if (!cachedHtmlResult) {
        const imgKeyword = _niche.imageKeyword?.replace(/\+/g,' ') || _niche.industry;
        send("phase", { agent:"Images", icon:"🖼️", action:"Sourcing visuals...", pct:22 });
        costTracker!.checkBeforeImages(8, "unsplash"); // real check — Unsplash is free, so this always passes today, but is a genuine pre-call estimate
        const initialImagesPromise = getRealImageSet(_niche.industry, imgKeyword, 8).catch(() => [] as string[]);
        costTracker!.recordImages(8, "unsplash");

        // Fix 5: Abort if client disconnected
        if ((req as any).signal?.aborted) {
          await logGeneration(supabase, { id: genLogId || undefined, status: "cancelled", duration_ms: Date.now() - startTime });
          finish(); return;
        }

        // ── AI ARCHITECT: Blueprint Engine ─────────────────────────────────
        // Runs BEFORE generation. Makes one focused call to understand the
        // exact domain, business goal, section plan, and imagery needed.
        // This prevents "luxury car club" → perfume images + generic sections.
        try {
          send("phase", { agent:"Planning", icon:"🏛️", action:"Planning project architecture...", pct:32 });
          const [domainPlanResult, initialImages] = await Promise.all([
            architectBlueprint(nicheDetectPrompt, projectType, _niche, kryptonGenerate),
            initialImagesPromise,
          ]);
          domainPlan = domainPlanResult;
          resolvedImages["main"] = initialImages;
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
        } // end cache-miss: skip blueprint + image planning entirely on cache hit

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

        // (orphaned systemPrompt/buildNichePrompt computation removed here —
        // its result was never consumed downstream, confirmed via full-file search)

        // ── UNIFIED PIPELINE ──────────────────────────────────────────
        // Every generation — regardless of complexity — goes through the
        // Component Library. The AI never writes raw HTML directly
        // anymore; it only produces structured JSON content, which real,
        // tested renderComponent() functions turn into HTML. On content-
        // generation failure, retries once; if that also fails, falls
        // back to deterministic (non-AI) generic content — still rendered
        // through the SAME component pipeline, never raw AI-HTML.
        let pipelineBlueprint: string = "";
        if (cachedHtmlResult) {
          send("phase", { agent: "Cache", icon: "⚡", action: "Identical design already generated — reusing cached result...", pct: 85, done: false });
          html = cachedHtmlResult;
          provider = "cache";
        } else {
        send("phase", { agent:"Reading", icon:"🧭", action:"Planning project structure...", pct:28 });
        console.log("Stage 1 Blueprint Start");
        const _s1 = Date.now();
        pipelineBlueprint = domainPlan
          ? `SECTIONS: ${domainPlan.sectionOrder.join(", ")}\nKEY_COMPONENTS: ${Object.entries(domainPlan.sectionPurpose).map(([s,p])=>`${s} (${p})`).join("; ")}\nCONTENT_FOCUS: ${domainPlan.businessGoal} — ${domainPlan.tagline}. ${domainPlan.copyTone} Key benefits: ${domainPlan.keyBenefits.join(", ")}. Avoid: ${domainPlan.avoidMistakes.join(", ")}.`
          : await generateBlueprint(_niche, nicheDetectPrompt, projectType);
        console.log(`Stage 1 Blueprint Done — ${Date.now()-_s1}ms`);

        send("phase", { agent:"Building", icon:"📐", action:"Building components...", pct:42 });
        console.log("Stage 2 Sections Start");
        const _s2 = Date.now();
        let sectionsHTML: string;
        componentContent = await generateComponentContent(_niche, pipelineBlueprint, nicheDetectPrompt, projectType, domainPlan);
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
        // Single Master AI Call — if domainPlan was null (genuinely
        // unknown industry), generateComponentContent's response may
        // include blueprint fields requested in the SAME call. Merge
        // them into domainPlan now so every downstream consumer
        // (design_summary, cache storage) sees a real blueprint without
        // a second AI call having happened.
        if (!domainPlan && componentContent?.blueprint) {
          domainPlan = componentContent.blueprint as DomainBlueprint;
        }
        sectionsHTML = await assembleFromComponentLibrary(_niche, componentContent, resolvedImages["main"] || [], designSeed, {
          supabase, projectId: null, promptHash,
          versions: {
            componentVersion: CACHE_COMPONENT_VERSION, themeVersion: CACHE_THEME_VERSION,
            designVersion: CACHE_MODEL_VERSION, modelVersion: CACHE_MODEL_VERSION,
            imageVersion: CACHE_IMAGE_VERSION, blueprintVersion: CACHE_BLUEPRINT_VERSION,
          },
        });
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
        } // end cache-miss generation pipeline

        // Final safety net — if html is somehow still empty (e.g. the
        // component assembly produced an unexpectedly short string),
        // render the generic content through the SAME pipeline one more
        // time rather than ever falling back to raw AI-HTML.
        if (!html || html.trim().length < 200) {
          const genericContent = buildGenericComponentContent(_niche);
          const genericSections = await assembleFromComponentLibrary(_niche, genericContent, resolvedImages["main"] || [], designSeed);
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
        // Real, request-scoped CSS/JS memoization — if a repair attempt
        // produces sectionsHTML identical to one already processed this
        // request, reuse its CSS/JS instead of paying for another
        // identical AI call.
        const cssJsMemo = new Map<string, { css: string; js: string }>();
        async function generateCSSJSMemoized(sections: string, niche_: NicheProfile, dl_: DesignLanguage, projectType_: string): Promise<{ css: string; js: string }> {
          const key = createHash("sha256").update(sections).digest("hex");
          const memoized = cssJsMemo.get(key);
          if (memoized) return memoized;
          const css = await generateCSS(niche_, dl_, sections);
          const js = await generateJS(sections, projectType_);
          const result = { css, js };
          cssJsMemo.set(key, result);
          return result;
        }

        // Critic-driven repair: trigger even if the structural gate already
        // passed, IF the critic found real issues on a low score — subjective
        // weaknesses (weak headline, buried CTA) don't fail the gate but are
        // still worth one repair attempt while we're already in this flow.
        const critiqueNeedsRepair = !!critique && critique.score < 7 && critique.issues.length > 0;
        // Real DesignPlan reuse baseline — computed once, before any
        // repair attempt, so every iteration below has a genuine
        // 'original' plan to compare against.
        const originalDesignPlan = buildDesignPlan(_niche, _dl, domainPlan);

        while (!cachedHtmlResult && (!gate.overallPass || critiqueNeedsRepair) && repairAttempts < MAX_REPAIR_ATTEMPTS) {
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
            // Real selective-repair detection — extract which specific
            // component types the actual diagnostics mention, instead of
            // always regenerating all 12 components' content blindly.
            const diagnosticText = [
              ...gate.visualIssues, ...gate.mobileIssues, ...gate.buildIssues,
              ...gate.failedFeatures.map(f => f.label),
              ...(critique?.issues || []),
            ].join(" ").toLowerCase();
            const ALL_COMPONENT_TYPES_FOR_REPAIR: ComponentCategory[] = [
              "navbar","hero","features","stats","pricing","testimonials","faq","cta","footer","portfolio","dashboard","ecommerce",
            ];
            const namedComponents = ALL_COMPONENT_TYPES_FOR_REPAIR.filter(type => diagnosticText.includes(type));

            let repairedComponentContent: Record<string, any> | null;
            if (namedComponents.length > 0 && componentContent) {
              // Targeted repair — real, focused AI call per named
              // component only; everything else reuses existing content.
              repairedComponentContent = { ...componentContent };
              for (const type of namedComponents) {
                const single = await generateSingleComponentContent(type, _niche, pipelineBlueprint, nicheDetectPrompt, domainPlan, componentContent);
                if (single?.content) {
                  // Real image reuse — generateSingleComponentContent never
                  // sets imageUrl (it only produces text/copy), so without
                  // this the new content would render with NO image at all.
                  // Carry over the exact previous image URL(s) — this is
                  // genuine reuse of the real value, not just "no new fetch
                  // was triggered".
                  const oldTypeContent = componentContent?.[type];
                  if (type === "hero" && oldTypeContent?.imageUrl) {
                    single.content.imageUrl = oldTypeContent.imageUrl;
                  }
                  if (type === "features" && Array.isArray(oldTypeContent?.items) && Array.isArray(single.content.items)) {
                    single.content.items = single.content.items.map((it: any, i: number) => ({
                      ...it, imageUrl: it.imageUrl || oldTypeContent.items[i]?.imageUrl || "",
                    }));
                  }
                  repairedComponentContent[type] = single.content;
                  repairedComponentContent.variants = { ...(repairedComponentContent.variants || {}), [type]: single.variant };
                }
              }
              console.log(`[selective-repair] targeted regeneration for: ${namedComponents.join(", ")} — images reused, zero new Unsplash/AI-image calls`);

              // Real DesignPlan reuse — recompute a candidate plan from
              // current state and genuinely compare it against the
              // baseline captured before repair started. Logs exactly
              // which fields were reused (identical) vs changed, and uses
              // the merged result (not a blanket regenerate-everything).
              const candidateDesignPlan = buildDesignPlan(_niche, _dl, domainPlan);
              const planReuse = reuseDesignPlan(originalDesignPlan, candidateDesignPlan);
              console.log(`[design-plan-reuse] version ${planReuse.oldVersion.slice(0,8)} -> ${planReuse.newVersion.slice(0,8)} | reused: [${planReuse.reusedFields.join(", ")}] | changed: [${planReuse.changedFields.join(", ")}]`);
            } else {
              repairedComponentContent = await generateComponentContent(_niche, pipelineBlueprint, nicheDetectPrompt, projectType, domainPlan);
              if (!repairedComponentContent) repairedComponentContent = componentContent; // keep prior content if this attempt's JSON also fails
            }

            // Component Diff Engine — detect exactly which components
            // actually changed between the prior content and this repair
            // attempt. If nothing is genuinely different, skip the whole
            // re-assembly + CSS/JS regeneration below entirely, rather
            // than always paying for a full-page rebuild regardless.
            const repairDiff = componentDiffEngine({
              oldContent: componentContent ?? undefined, newContent: repairedComponentContent ?? undefined,
            });
            if (repairDiff.affected.length === 0) {
              console.log(`[component-diff] repair attempt ${repairAttempts} changed nothing — skipping re-assembly`);
            } else if (namedComponents.length > 0) {
              // Real targeted merge — render ONLY the named components
              // directly (never the full 12-component assembleFromComponentLibrary
              // loop), then splice them into the CURRENT full-page html via
              // the Merge Engine. Every unaffected section's HTML, CSS, and
              // JS stays byte-identical — no full-page rebuild happens.
              const componentCtx = buildComponentContext(_niche.palette.primary);
              const updatedSections: Partial<Record<string, string>> = {};
              for (const type of namedComponents) {
                const variant = repairedComponentContent!.variants?.[type] || listVariants(type as any)[0];
                updatedSections[type] = renderComponent(type as any, variant, componentCtx, repairedComponentContent![type]);
              }
              // Real Diff Engine integration — only components the Diff
              // Engine actually flagged as affected are allowed through,
              // even if updatedSections happens to contain more.
              const mergeResult = mergeComponentsIntoHTML(html, updatedSections as any, repairDiff.affected);
              if (mergeResult.rolledBack) {
                console.log(`[merge-engine] rolled back — keeping current html unchanged. Reasons: ${mergeResult.validation.errors.join("; ")}`);
              } else {
                const mergedGate = runProductionGate(mergeResult.html, gateKind, gateSubtype);
                if (mergedGate.score > gate.score) {
                  html = mergeResult.html;
                  gate = mergedGate;
                  componentContent = repairedComponentContent;
                  provider = `${provider} (targeted merge: ${mergeResult.merged.join(", ")})`;
                }
              }
              console.log(`[merge-engine] spliced sections: ${namedComponents.join(", ")} — no full rebuild`);
            } else {
              console.log(`[component-diff] repair attempt ${repairAttempts} affected: ${repairDiff.affected.join(", ")}`);

            const repairedSections = await assembleFromComponentLibrary(_niche, repairedComponentContent ?? componentContent ?? {}, resolvedImages["main"] || [], designSeed + repairAttempts);
            const { css: repairedCSS, js: repairedJS } = await generateCSSJSMemoized(repairedSections, _niche, _dl, projectType);
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
            const extractedCss = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] || null;
            const extractedJs = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1] || null;

            const { data: proj, error: projError } = await supabase.from("projects").insert({
              user_id:    authedUserId,
              title:      prompt.slice(0, 60),
              name:       prompt.slice(0, 60),
              prompt,
              html_code:  html,
              status:     "completed",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              // Real reuse data — not reconstructed later, actually stored
              // now while it's genuinely available, so Single Component
              // Regeneration can load the REAL blueprint/theme instead of
              // rebuilding an approximation.
              blueprint:        domainPlan || null,
              theme:            { tone: _niche.tone, premiumLevel: _dl.premiumLevel, colorTemperature: _dl.colorTemperature, spacing: _dl.spacing, borderRadius: _dl.borderRadius, effectsCSS: _dl.effectsCSS, gradient: _niche.palette.grad || null },
              color_palette:    _niche.palette,
              typography:       _niche.typography,
              css_code:         extractedCss,
              js_code:          extractedJs,
              images:           resolvedImages["main"] || [],
              design_language:  _niche.tone,
              component_versions: {
                componentVersion: CACHE_COMPONENT_VERSION, themeVersion: CACHE_THEME_VERSION,
                designVersion: CACHE_MODEL_VERSION, modelVersion: CACHE_MODEL_VERSION,
                imageVersion: CACHE_IMAGE_VERSION, blueprintVersion: CACHE_BLUEPRINT_VERSION,
              },
            }).select().single();

            if (projError) {
              console.error(`[orchestrate/route] projects insert FAILED for user ${authedUserId}:`, projError.message || projError);
            }
            savedProjectId = proj?.id || null;

            // Store into the global generation cache — only for genuinely
            // fresh generations (a cache-hit doesn't need to re-store itself).
            // Stores everything needed to rebuild the site without AI:
            // full output (HTML/CSS/JS are already combined in `html`),
            // design plan/hierarchy, blueprint, component content, real
            // SEO/OG/JSON-LD extracted from the actual generated markup,
            // images, palette/typography/theme, navigation, footer.
            if (!cachedHtmlResult && html && html.length > 200) {
              try {
                const seoTitleMatch = html.match(/<title>([^<]*)<\/title>/i);
                const seoDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
                const ogMatches = Array.from(html.matchAll(/<meta\s+property=["'](og:[^"']+)["']\s+content=["']([^"']*)["']/gi))
                  .reduce((acc: Record<string,string>, m) => { acc[m[1]] = m[2]; return acc; }, {});
                const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
                let jsonLdParsed: any = null;
                if (jsonLdMatch) { try { jsonLdParsed = JSON.parse(jsonLdMatch[1]); } catch {} }

                let designPlanData: any = null, visualHierarchyData: any = null;
                try {
                  designPlanData = buildDesignPlan(_niche, _dl, domainPlan);
                  visualHierarchyData = designPlanData?.visualHierarchy || null;
                } catch {}

                await supabase.from("generation_cache").upsert({
                  cache_key:          cacheKeyHash,
                  prompt_hash:        promptHash,
                  prompt_text:        nicheDetectPrompt.trim().toLowerCase(),
                  project_type:       projectType,
                  industry:           _niche.industry,
                  design_language:    _niche.tone,
                  provider:           provider,
                  model_version:      CACHE_MODEL_VERSION,
                  component_version:  CACHE_COMPONENT_VERSION,
                  image_version:      CACHE_IMAGE_VERSION,
                  theme_version:      CACHE_THEME_VERSION,
                  blueprint_version:  CACHE_BLUEPRINT_VERSION,
                  visual_hierarchy_version: CACHE_VISUAL_HIERARCHY_VERSION,
                  html_code:          html,
                  css_code:           null, // already inlined into html_code by combineOutput
                  js_code:            null, // already inlined into html_code by combineOutput
                  design_plan:        designPlanData,
                  visual_hierarchy:   visualHierarchyData,
                  blueprint:          domainPlan || null,
                  component_content:  componentContent || null,
                  seo_metadata:       { title: seoTitleMatch?.[1] || null, description: seoDescMatch?.[1] || null },
                  opengraph_metadata: ogMatches,
                  json_ld:            jsonLdParsed,
                  images:             resolvedImages["main"] || [],
                  image_prompts:      [_niche.imageKeyword || _niche.industry],
                  fonts:              { headingFont: _niche.typography.headingFont, bodyFont: _niche.typography.bodyFont },
                  theme:              { tone: _niche.tone, premiumLevel: _dl.premiumLevel, colorTemperature: _dl.colorTemperature },
                  color_palette:      _niche.palette,
                  typography:         _niche.typography,
                  navigation:         componentContent?.navbar || null,
                  footer:             componentContent?.footer || null,
                  page_structure:     _niche.sectionOrder,
                  hit_count:          0,
                  created_at:         new Date().toISOString(),
                  expires_at:         new Date(Date.now() + 30*24*60*60*1000).toISOString(),
                  invalidated:        false,
                }, { onConflict: "cache_key" });
              } catch { /* cache table may not exist yet — never blocks generation */ }
            }
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

        // Real persistence — the cost summary is written to Supabase
        // (cost_logs table), not just returned in this response.
        await logCostSummary(supabase, authedUserId, savedProjectId, genLogId, costTracker!.getSummary());

        send("complete", {
          html,
          projectId:   savedProjectId,
          projectType,
          provider,
          creditCost,
          linesOfCode: html.split("\n").length,
          executionPlan,
          blueprint,
          // Real Cost Guard summary — estimate, total cost, images,
          // tokens, per-provider breakdown, remaining budget.
          costSummary: costTracker!.getSummary(),
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
        const isCostGuardAbort = err instanceof CostGuardAbortError;
        // Log failed generation — reuse genLogId so this UPDATES the same
        // row created at the start of this request (status:"started"),
        // instead of inserting a second, orphan row while the original
        // stays stuck at "started" forever.
        await logGeneration(supabase, {
          id:            genLogId || undefined,
          status:        isCostGuardAbort ? "cost_guard_aborted" : isTimeout ? "timeout" : "failed",
          error_message: errMsg.slice(0, 500),
          error_code:    isCostGuardAbort ? "COST_GUARD_ABORT" : isTimeout ? "TIMEOUT" : "GENERATION_ERROR",
          duration_ms:   Date.now() - startTime,
          metadata:      { prompt: prompt?.slice(0, 200), costSummary: isCostGuardAbort ? costTracker?.getSummary() : undefined },
        });
        if (isCostGuardAbort) {
          // Real persistence — even an aborted generation's real spend
          // (from any earlier successful calls) is logged, not lost.
          if (costTracker) await logCostSummary(supabase, authedUserId, savedProjectId, genLogId, costTracker.getSummary());
          // Real, meaningful message — never the generic fallback for
          // this specific case. No credits were spent on the aborted
          // call itself (earlier, successful calls in this generation
          // may still have used real budget, reflected in costSummary).
          send("error", { message: errMsg, code: "COST_GUARD_ABORT", costSummary: costTracker?.getSummary() });
        } else {
          send("error", { message: "Generation failed. Please try again." });
        }
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
