// app/api/generate/route.ts — v5 Smart Credit System
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkFeatureGate, deductCredits } from "@/lib/feature-gate";

export const maxDuration = 60;
export const runtime = "nodejs";

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

// ── Smart Credit Calculator ──────────────────────────────────
function calculateCreditCost(prompt: string): { cost: number; category: string } {
  const words = prompt.trim().split(/\s+/).length;

  if (words <= 15) {
    return { cost: 1, category: "Quick Build" };
  } else if (words <= 25) {
    return { cost: 2, category: "Standard Build" };
  } else if (words <= 100) {
    return { cost: 3, category: "Detailed Build" };
  } else {
    // 100+ words: base 4 credits
    const extraWords = words - 100;
    const extraCredits = Math.floor(extraWords / 50);
    return { cost: Math.min(4 + extraCredits, 8), category: "Complex Build" };
  }
}

// ── Thinking Steps Generator ─────────────────────────────────
function getThinkingSteps(prompt: string): string[] {
  const lower = prompt.toLowerCase();

  const isGame = lower.includes("game") || lower.includes("mario") || lower.includes("snake") || lower.includes("puzzle");
  const isLanding = lower.includes("landing") || lower.includes("saas") || lower.includes("website") || lower.includes("portfolio");
  const isApp = lower.includes("app") || lower.includes("dashboard") || lower.includes("tool") || lower.includes("calculator");
  const isEcommerce = lower.includes("shop") || lower.includes("store") || lower.includes("ecommerce") || lower.includes("product");

  if (isGame) return [
    "🎮 Understanding game mechanics...",
    "🗺 Planning game world & levels...",
    "⚙️ Setting up game engine...",
    "🎯 Building player controls...",
    "👾 Creating enemies & obstacles...",
    "💯 Adding score & lives system...",
    "🎨 Designing game UI...",
    "✨ Adding animations & effects...",
    "🔊 Implementing sound system...",
    "✅ Build complete!",
  ];

  if (isLanding) return [
    "📋 Reading your requirements...",
    "🏗 Planning page structure...",
    "🎨 Designing hero section...",
    "📦 Building features section...",
    "💰 Creating pricing cards...",
    "⭐ Adding testimonials...",
    "📱 Optimizing mobile layout...",
    "✨ Applying animations...",
    "🚀 Finalizing CTA sections...",
    "✅ Build complete!",
  ];

  if (isEcommerce) return [
    "🛍 Understanding store requirements...",
    "📦 Planning product layout...",
    "🎨 Designing product cards...",
    "🛒 Building cart system...",
    "💳 Creating checkout flow...",
    "🔍 Adding search & filters...",
    "📱 Mobile responsive design...",
    "✨ Adding hover effects...",
    "🚀 Optimizing performance...",
    "✅ Build complete!",
  ];

  if (isApp) return [
    "🔍 Analyzing app requirements...",
    "📐 Planning UI layout...",
    "🎨 Designing interface...",
    "⚙️ Building core features...",
    "💾 Setting up data storage...",
    "🔄 Adding interactions...",
    "📱 Mobile optimization...",
    "✨ Polishing animations...",
    "🧪 Testing functionality...",
    "✅ Build complete!",
  ];

  return [
    "🔍 Understanding your request...",
    "🧠 Planning the structure...",
    "🎨 Designing the layout...",
    "⚙️ Building core features...",
    "✨ Adding animations...",
    "📱 Making it responsive...",
    "🚀 Optimizing performance...",
    "🧪 Testing everything...",
    "🎯 Final touches...",
    "✅ Build complete!",
  ];
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(`ip_${ip}`, 10, 60000)) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again in 1 minute." }, { status: 429 });
    }

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
      return NextResponse.json({ error: "Invalid session. Please login again." }, { status: 401 });
    }

    const { prompt, projectId, isEdit = false } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (prompt.length > 3000) {
      return NextResponse.json({ error: "Prompt too long. Max 3000 characters." }, { status: 400 });
    }

    // ── Smart credit calculation ─────────────────────────────
    const { cost: creditCost, category } = isEdit
      ? { cost: 1, category: "AI Edit" }
      : calculateCreditCost(prompt);

    // ── Get user profile ─────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, total_credits, used_credits, is_suspended, daily_generations, daily_reset_date, credits_last_reset")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.is_suspended) {
      return NextResponse.json({ error: "Account suspended. Contact support." }, { status: 403 });
    }

    const plan = profile.plan || "free";

    // ── Daily reset check for free users ────────────────────
    const today = new Date().toISOString().split("T")[0];
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

    const remaining = Math.max(0, (profile.total_credits || 0) - (profile.used_credits || 0));

    // ── Credit check ─────────────────────────────────────────
    if (remaining < creditCost) {
      return NextResponse.json({
        error: plan === "free"
          ? `Insufficient credits! This generation costs ${creditCost} credits. You have ${remaining}. Free plan gets 5 credits/day.`
          : `Insufficient credits! This generation costs ${creditCost} credits. You have ${remaining}.`,
        upgradeRequired: plan === "free",
        remainingCredits: remaining,
        creditCost,
        code: "INSUFFICIENT_CREDITS",
      }, { status: 402 });
    }

    // ── Daily limit for free plan ────────────────────────────
    if (plan === "free" && !isEdit) {
      const dailyReset = profile.daily_reset_date || "2000-01-01";
      const dailyGens = dailyReset === today ? (profile.daily_generations || 0) : 0;
      if (dailyGens >= 1) {
        return NextResponse.json({
          error: "Free plan allows 1 generation per day. Come back tomorrow or upgrade!",
          upgradeRequired: true,
          code: "DAILY_LIMIT",
        }, { status: 402 });
      }
    }

    // ── Thinking steps for frontend ──────────────────────────
    const thinkingSteps = getThinkingSteps(prompt);

    // ── Select model ─────────────────────────────────────────
    const model = plan === "business" || plan === "premium"
      ? "claude-sonnet-4-6"
      : "claude-haiku-4-5-20251001";

    // ── Rate limit by user ───────────────────────────────────
    const userLimit = plan === "free" ? 3 : 20;
    if (!checkRateLimit(`user_${user.id}`, userLimit, 60000)) {
      return NextResponse.json({
        error: `Too many requests. Please wait a moment.`,
        upgradeRequired: plan === "free",
      }, { status: 429 });
    }

    // ── System prompt ────────────────────────────────────────
    const systemPrompt = `You are Krypton AI — a world-class creative developer and UI/UX designer.

Your job is to THINK deeply about what the user wants, then BUILD it perfectly.

## THINKING PROCESS (always follow this):
1. ANALYZE the prompt — what exactly does the user want?
2. CLASSIFY — Is it a Game? Website? App? Tool? Dashboard?
3. PLAN — What features, screens, mechanics are needed?
4. BUILD — Write complete, production-quality code

## FOR GAMES:
- Use HTML5 Canvas or DOM-based game engine
- Include: Player movement, enemies, scoring, lives, levels
- Add: animations, particle effects
- Make it: Fully playable, keyboard + touch controls
- Style: Beautiful game UI, start screen, game over screen

## FOR WEBSITES:
- Modern design, glassmorphism or neumorphism
- Smooth animations, parallax effects
- Mobile responsive, pixel perfect
- Real content, not Lorem Ipsum

## FOR APPS:
- Fully functional UI
- Working buttons and interactions
- Local storage for data persistence
- Clean dashboard layout

## QUALITY RULES:
- Minimum 300 lines of code
- No placeholder content
- Everything must WORK and be INTERACTIVE
- Beautiful colors, gradients, shadows
- Smooth 60fps animations
- Professional typography (Google Fonts)

## OUTPUT RULES:
- Output ONLY raw HTML starting with <!DOCTYPE html>
- End with </html>
- No markdown, no backticks, no explanations
- ALL CSS in <style> tags
- ALL JavaScript in <script> tags
- Self-contained — no external dependencies except Google Fonts + CDN

${plan === "free" ? "" : "Use the absolute highest quality code possible."}`;

    // ── Call Claude API ──────────────────────────────────────
    let html = "";
    let usedGemini = false;

    try {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: plan === "free" ? 10000 : 20000,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);
      const data = await claudeRes.json();
      html = data.content[0].text;

    } catch (claudeErr) {
      if (process.env.GEMINI_API_KEY) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${systemPrompt}\n\nUser request: ${prompt}` }] }],
              }),
            }
          );
          const gemData = await geminiRes.json();
          html = gemData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          usedGemini = true;
        } catch {
          throw new Error("AI services unavailable. Please try again.");
        }
      } else {
        throw claudeErr;
      }
    }

    // ── Clean HTML ────────────────────────────────────────────
    html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const idx = html.indexOf("<!DOCTYPE");
    if (idx > 0) html = html.substring(idx);

    if (!html.includes("<!DOCTYPE") || html.length < 500) {
      return NextResponse.json({ error: "Generated code is invalid. Please try again with a more detailed prompt." }, { status: 500 });
    }

    // ── Deduct credits ────────────────────────────────────────
    const updates: any = {
      used_credits: (profile.used_credits || 0) + creditCost,
    };

    if (plan === "free" && !isEdit) {
      const dailyReset = profile.daily_reset_date || "2000-01-01";
      updates.daily_generations = (dailyReset === today ? (profile.daily_generations || 0) : 0) + 1;
      updates.daily_reset_date = today;
    }

    await supabase.from("profiles").update(updates).eq("id", user.id);

    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount: -creditCost,
      type: "usage",
      description: `${category}: ${prompt.slice(0, 50)}... (${creditCost} credits)`,
    });

    // ── Save project ──────────────────────────────────────────
    let savedProjectId = projectId;

    if (projectId) {
      await supabase.from("projects").update({
        html_code: html,
        prompt,
        updated_at: new Date().toISOString(),
      }).eq("id", projectId).eq("user_id", user.id);
    } else {
      const { data: newProject } = await supabase.from("projects").insert({
        user_id: user.id,
        title: prompt.slice(0, 60),
        prompt,
        html_code: html,
        status: "completed",
      }).select().single();
      savedProjectId = newProject?.id;
    }

    const freshRemaining = Math.max(0, remaining - creditCost);

    return NextResponse.json({
      html,
      projectId: savedProjectId,
      creditsUsed: creditCost,
      creditsRemaining: freshRemaining,
      category,
      thinkingSteps,
      model: usedGemini ? "gemini" : model,
      canSave: true,
      plan,
    });

  } catch (err: any) {
    console.error("Generate error:", err);
    return NextResponse.json({ error: err.message || "Generation failed" }, { status: 500 });
  }
}
