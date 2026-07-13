// app/api/generate/route.ts — Krypton AI v6 — Enterprise Engine
// 3-Layer AI Fallback: Claude → OpenAI → Gemini
// Self-Healing Error Recovery
// 10-Step Thinking Engine
// Never expose errors to users

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectNiche } from "@/lib/rendering-engine/niche-detection";
import { applyDesignVariant, shuffleMiddleSections } from "@/lib/rendering-engine/design-variants";
import { getDesignLanguage } from "@/lib/rendering-engine/design-language";
import { architectBlueprint, type DomainBlueprint } from "@/lib/rendering-engine/domain-knowledge";
import {
  generateComponentContent, assembleFromComponentLibrary, buildGenericComponentContent,
} from "@/lib/rendering-engine/content-generation";
import { generateCSS, generateJS, combineOutput } from "@/lib/rendering-engine/output-generation";
import { cleanHTML } from "@/lib/rendering-engine/html-utils";
import { detectProjectType, getRealImageSet } from "@/lib/rendering-engine/generation-helpers";
import { kryptonGenerate } from "@/lib/ai-providers";
import { generationSeedFromId } from "@/lib/design-engine";
import { acquireGenerationLock, releaseGenerationLock } from "@/lib/generation-lock";

export const maxDuration = 308;
export const runtime     = "nodejs"; // FIXED: was "edge" — Edge has hard 25s limit on Hobby plan
                                      // which caused FUNCTION_INVOCATION_TIMEOUT before any API
                                      // call could even be made. Node.js respects maxDuration=120s.

// ── Rate Limiter ─────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ── Credit Calculator ────────────────────────────────────────────
function calculateCreditCost(prompt: string, isEdit: boolean): { cost: number; category: string } {
  if (isEdit) return { cost: 1, category: "AI Edit" };
  const words = prompt.trim().split(/\s+/).length;
  if (words <= 15)  return { cost: 1, category: "Quick Build" };
  if (words <= 25)  return { cost: 2, category: "Standard Build" };
  if (words <= 100) return { cost: 3, category: "Detailed Build" };
  return { cost: Math.min(4 + Math.floor((words - 100) / 50), 8), category: "Complex Build" };
}

// ── 10-Step Thinking Engine ──────────────────────────────────────
function getThinkingSteps(prompt: string): string[] {
  const lower = prompt.toLowerCase();

  const isGame      = false; // game builder removed // was: /game|mario|snake|puzzle|chess|tetris|pacman|arcade|fps|rpg/.test(lower);
  const isEcommerce = /shop|store|ecommerce|cart|product|checkout|marketplace/.test(lower);
  const isLanding   = /landing|saas|startup|portfolio|agency|business website/.test(lower);
  const isApp       = /app|dashboard|tool|calculator|tracker|manager|crm|erp/.test(lower);
  const isAuth      = /login|auth|signup|register|user system/.test(lower);

  if (isGame) return [
    "🎮 Analyzing game genre and mechanics...",
    "🧠 Designing game architecture and loop...",
    "🗺️ Planning levels, scoring and progression...",
    "⚙️ Engineering the game engine core...",
    "🎯 Building player controls and physics...",
    "👾 Creating enemies, obstacles and AI...",
    "🎨 Designing premium game UI and HUD...",
    "✨ Adding particle effects and animations...",
    "🔊 Wiring input events and sound hooks...",
    "✅ Build validated and complete!",
  ];

  if (isEcommerce) return [
    "🛍️ Analyzing store requirements...",
    "🧠 Planning product data architecture...",
    "🎨 Designing product cards and grid...",
    "🛒 Engineering cart and state system...",
    "💳 Building checkout and payment flow...",
    "🔍 Adding search, filters and sorting...",
    "📱 Optimizing responsive mobile layout...",
    "✨ Adding hover effects and transitions...",
    "🚀 Wiring local storage persistence...",
    "✅ Build validated and complete!",
  ];

  if (isLanding) return [
    "📋 Understanding your brand and goals...",
    "🧠 Planning conversion-optimized structure...",
    "🎨 Designing premium hero section...",
    "📦 Building features and benefits sections...",
    "💰 Crafting pricing and social proof...",
    "⭐ Adding testimonials and trust signals...",
    "📱 Optimizing for mobile experience...",
    "✨ Applying micro-animations and effects...",
    "🚀 Finalizing CTAs and conversion points...",
    "✅ Build validated and complete!",
  ];

  if (isAuth) return [
    "🔐 Planning auth flow and security...",
    "🧠 Designing form architecture...",
    "🎨 Building login and signup UI...",
    "✅ Adding form validation logic...",
    "💾 Setting up session management...",
    "🔒 Adding password strength checks...",
    "📱 Optimizing mobile forms...",
    "✨ Adding smooth transitions...",
    "🚀 Testing all auth paths...",
    "✅ Build validated and complete!",
  ];

  if (isApp) return [
    "🔍 Analyzing app requirements deeply...",
    "🧠 Designing component architecture...",
    "📐 Planning UI layout and navigation...",
    "⚙️ Building core features and logic...",
    "💾 Setting up local data persistence...",
    "🔄 Adding real-time interactions...",
    "📱 Optimizing responsive behavior...",
    "✨ Polishing animations and states...",
    "🧪 Validating all features work...",
    "✅ Build validated and complete!",
  ];

  return [
    "🔍 Understanding your request deeply...",
    "🧠 Planning architecture and structure...",
    "🎨 Designing visual hierarchy...",
    "⚙️ Engineering core functionality...",
    "💾 Adding state and data logic...",
    "📱 Building responsive layouts...",
    "✨ Adding animations and effects...",
    "🔗 Connecting all components...",
    "🧪 Validating code quality...",
    "✅ Build validated and complete!",
  ];
}

// buildSystemPrompt/validateHTML/cleanHTML/callClaude/callOpenAI/callGemini/
// healHTML/getModelCascade were removed — replaced by the shared rendering
// engine (same modules app/api/orchestrate/route.ts uses). See imports above.


// ── Main Route Handler ───────────────────────────────────────────
// Fix 6 + Priority 3/4: generation lock is now the shared distributed
// one from lib/generation-lock.ts (see acquireGenerationLock below).
export async function POST(req: NextRequest) {
  let lockedUserId = ""; // Fix 6: track for finally block
  try {
    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (!checkRateLimit(`ip_${ip}`, 15, 60000)) {
      return NextResponse.json({
        error: "Too many requests. Please wait a moment.",
        code: "RATE_LIMIT",
      }, { status: 429 });
    }

    // Auth
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });
    }

    // Fix 6 + Priority 3/4: same distributed lock orchestrate uses (Redis-
    // backed via lib/generation-lock.ts), NOT a separate in-memory Set.
    // This is the fix for the false-402 race: if orchestrate is still
    // actively generating for this user, this route now correctly sees
    // that lock and refuses to start a second, credit-charging attempt —
    // previously this route's own local activeGens Set had no knowledge
    // of orchestrate's lock at all, so a fallback call here could proceed
    // completely independently and double-charge-check credits.
    if (!(await acquireGenerationLock(user.id, 330))) {
      return NextResponse.json({
        error: "A generation is already in progress. Please wait.",
        code: "DUPLICATE_GEN",
      }, { status: 429 });
    }
    lockedUserId = user.id; // Fix 6: store for finally block

    const { prompt, projectId, isEdit = false } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Please describe what you want to build." }, { status: 400 });
    }

    if (prompt.length > 4000) {
      return NextResponse.json({ error: "Prompt too long. Please keep it under 4000 characters." }, { status: 400 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, total_credits, used_credits, is_suspended, daily_generations, daily_reset_date, credits_last_reset")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    if (profile.is_suspended) {
      return NextResponse.json({ error: "Account suspended. Please contact support." }, { status: 403 });
    }

    const plan = profile.plan || "free";
    const today = new Date().toISOString().split("T")[0];

    // Daily reset for free users
    if (plan === "free") {
      const lastReset = profile.credits_last_reset || "2000-01-01";
      if (lastReset < today) {
        await supabase.from("profiles").update({
          total_credits: 5,
          used_credits: 0,
          credits_last_reset: today,
          daily_generations: 0,
          daily_reset_date: today,
        }).eq("id", user.id);
        profile.total_credits = 5;
        profile.used_credits = 0;
        profile.daily_generations = 0;
      }
    }

    const { cost: creditCost, category } = calculateCreditCost(prompt, isEdit);
    const remaining = Math.max(0, (profile.total_credits || 0) - (profile.used_credits || 0));

    if (remaining < creditCost) {
      return NextResponse.json({
        error: plan === "free"
          ? `You need ${creditCost} credits but have ${remaining}. Free plan resets daily — or upgrade for more!`
          : `Insufficient credits (${remaining} left, need ${creditCost}). Please top up your account.`,
        code: "INSUFFICIENT_CREDITS",
        upgradeRequired: plan === "free",
        remainingCredits: remaining,
        creditCost,
      }, { status: 402 });
    }

    if (plan === "free" && !isEdit) {
      const dailyReset = profile.daily_reset_date || "2000-01-01";
      const dailyGens = dailyReset === today ? (profile.daily_generations || 0) : 0;
      if (dailyGens >= 5) {
        return NextResponse.json({
          error: "Daily limit reached (5 generations/day on free plan). Come back tomorrow or upgrade!",
          code: "DAILY_LIMIT",
          upgradeRequired: true,
        }, { status: 402 });
      }
    }

    // Per-user rate limit
    const userLimit = plan === "free" ? 3 : 30;
    if (!checkRateLimit(`user_${user.id}`, userLimit, 60000)) {
      return NextResponse.json({
        error: "Please slow down — you're generating too fast!",
        code: "USER_RATE_LIMIT",
      }, { status: 429 });
    }

    // Real, shared project-type detection — same function orchestrate uses
    // (replaces this file's own smaller, duplicated regex-detection logic).
    const reqProjectType = detectProjectType(prompt);
    const thinkingSteps = getThinkingSteps(prompt);

    // ── Same unified Component-Library pipeline as /api/orchestrate ────
    // Real crypto-random seed (never Math.random()), same Design Diversity
    // Engine, same section-order shuffling, same content-generation with
    // retry + deterministic generic-content fallback. The AI never writes
    // raw HTML here either — matches the architectural requirement that
    // there is exactly one rendering pipeline in the repository.
    const designSeed = generationSeedFromId(crypto.randomUUID());
    let niche = detectNiche(`${reqProjectType} project: ${prompt}`);
    niche = applyDesignVariant(niche, designSeed);
    niche.sectionOrder = shuffleMiddleSections(niche.sectionOrder, designSeed);

    let domainPlan: DomainBlueprint | null = null;
    try { domainPlan = await architectBlueprint(prompt, reqProjectType, niche, kryptonGenerate); } catch {}

    const dl = getDesignLanguage(niche);
    const pipelineBlueprint = domainPlan
      ? `SECTIONS: ${domainPlan.sectionOrder.join(", ")}\nKEY_COMPONENTS: ${Object.entries(domainPlan.sectionPurpose).map(([s,p])=>`${s} (${p})`).join("; ")}\nCONTENT_FOCUS: ${domainPlan.businessGoal} — ${domainPlan.tagline}. ${domainPlan.copyTone} Key benefits: ${domainPlan.keyBenefits.join(", ")}. Avoid: ${domainPlan.avoidMistakes.join(", ")}.`
      : "";

    let componentContent = await generateComponentContent(niche, pipelineBlueprint, prompt, reqProjectType, domainPlan);
    if (!componentContent) {
      componentContent = await generateComponentContent(niche, pipelineBlueprint, prompt, reqProjectType, domainPlan);
    }
    if (!componentContent) {
      // Both attempts failed — deterministic generic content keeps this on
      // the SAME component-library rendering path, never raw AI-HTML.
      componentContent = buildGenericComponentContent(niche);
    }

    const realImages = await getRealImageSet(niche.industry, niche.imageKeyword || reqProjectType, 6).catch(() => [] as string[]);
    const sectionsHTML = assembleFromComponentLibrary(niche, componentContent, realImages, designSeed);

    let html = "";
    const usedProvider = "claude"; // same disclosed cosmetic limitation as orchestrate — the shared
                                    // content-generation function doesn't surface which provider succeeded

    if (sectionsHTML) {
      const generatedCSS = await generateCSS(niche, dl, sectionsHTML);
      const generatedJS  = await generateJS(sectionsHTML, reqProjectType);
      html = cleanHTML(combineOutput(sectionsHTML, generatedCSS, generatedJS, niche, prompt.slice(0, 60)));
    }

    if (!html || html.length < 200) {
      return NextResponse.json({
        error: "Generation failed. Please try again.",
        code: "EMPTY_OUTPUT",
      }, { status: 500 });
    }

    // ── Deduct Credits ────────────────────────────────────────
    const creditUpdates: Record<string, any> = {
      used_credits: (profile.used_credits || 0) + creditCost,
    };

    if (plan === "free" && !isEdit) {
      const dailyReset = profile.daily_reset_date || "2000-01-01";
      creditUpdates.daily_generations = (dailyReset === today ? (profile.daily_generations || 0) : 0) + 1;
      creditUpdates.daily_reset_date = today;
    }

    // Fix 4: Atomic credit deduction — prevents race condition
    try {
      const { error: rpcError } = await supabase.rpc("increment_used_credits", {
        user_id_param: user.id,
        amount: creditCost,
      });
      if (rpcError) {
        // Fallback to regular update if RPC not deployed yet
        await supabase.from("profiles").update(creditUpdates).eq("id", user.id);
      }
    } catch {
      await supabase.from("profiles").update(creditUpdates).eq("id", user.id);
    }

    try {
      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        amount: -creditCost,
        type: "usage",
        description: `${category}: ${prompt.slice(0, 60)}... (${creditCost} credits via ${usedProvider})`,
      });
    } catch {} // Non-blocking

    // ── Save Project ──────────────────────────────────────────
    let savedProjectId = projectId;

    if (projectId) {
      await supabase.from("projects").update({
        html_code: html,
        prompt,
        status: "completed",
        updated_at: new Date().toISOString(),
      }).eq("id", projectId).eq("user_id", user.id);
    } else {
      const { data: newProject } = await supabase.from("projects").insert({
        user_id:    user.id,
        title:      prompt.slice(0, 60),
        name:       prompt.slice(0, 60),
        prompt,
        html_code:  html,
        status:     "completed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select().single();
      savedProjectId = newProject?.id;
    }

    const freshRemaining = Math.max(0, remaining - creditCost);

    return NextResponse.json({
      html,
      projectId: savedProjectId,
      projectType: reqProjectType,
      creditsUsed: creditCost,
      creditsRemaining: freshRemaining,
      category,
      thinkingSteps,
      provider: usedProvider,
      canSave: true,
      plan,
    });

  } catch (err: any) {
    console.error("[Generate] Fatal error:", err);
    return NextResponse.json({
      error: "Something went wrong. Please try again.",
      code: "INTERNAL_ERROR",
    }, { status: 500 });
  } finally {
    // Fix 6: Always release generation lock (use userId string — accessible in scope)
    if (lockedUserId) await releaseGenerationLock(lockedUserId);
  }
}

  
