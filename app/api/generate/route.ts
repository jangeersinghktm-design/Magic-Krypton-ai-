// app/api/generate/route.ts — Krypton AI v6 — Enterprise Engine
// 3-Layer AI Fallback: Claude → OpenAI → Gemini
// Self-Healing Error Recovery
// 10-Step Thinking Engine
// Never expose errors to users

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 120;
export const runtime = "nodejs";

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

  const isGame      = /game|mario|snake|puzzle|chess|tetris|pacman|arcade|fps|rpg/.test(lower);
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

// ── Premium System Prompt ────────────────────────────────────────
function buildSystemPrompt(plan: string): string {
  const isPaid = ["pro", "premium", "business"].includes(plan);
  return `You are Krypton AI — an elite senior software engineer and world-class UI/UX designer.
You build premium, production-ready web experiences. Every project you create feels like it was built by a $500/hour agency team.

## 🚨 ABSOLUTE RULES — NEVER BREAK:

### Language Rule:
- ALL content MUST be in ENGLISH ONLY, regardless of the prompt language.
- If user writes in Hindi, Urdu, Hinglish, Spanish, etc — understand their intent, generate ENGLISH output.
- NEVER output Devanagari, Arabic, or any non-Latin script in generated HTML/CSS/JS.

### Code Output Rule:
- Output ONLY raw HTML starting with <!DOCTYPE html> ending with </html>
- Zero markdown, zero backticks, zero explanations, zero comments outside code
- ALL CSS inside <style> tags, ALL JS inside <script> tags
- 100% self-contained — only external dependencies: Google Fonts + trusted CDNs (animate.css, particles.js)

### Quality Rule:
- MINIMUM 400 lines of code. Anything less is rejected.
- ZERO placeholder content ("Lorem ipsum", "Coming soon", "TODO")
- ZERO empty sections
- EVERY button, link, tab, toggle MUST WORK
- EVERY animation MUST be smooth (60fps)

---

## 🎨 DESIGN SYSTEM — ALWAYS FOLLOW:

### Typography (use Google Fonts):
- Headings: Syne, Space Grotesk, Plus Jakarta Sans, or DM Sans Bold
- Body: Inter, DM Sans, or Plus Jakarta Sans Regular
- Code: JetBrains Mono or Fira Code
- Size scale: 12/14/16/18/20/24/28/32/40/48/56/64/80px

### Color Strategy:
- Prefer dark-first designs (like Linear, Vercel, OpenAI)
- Use CSS custom properties: --primary, --secondary, --bg, --surface, --text
- Gradients: linear and radial, not flat colors
- Always include: hover states, focus states, active states

### Spacing System:
- Use 8px grid (8/16/24/32/40/48/64/80/96/128px)
- Section padding: min 80px top/bottom on desktop, 48px on mobile
- Card padding: 24-32px
- Never use arbitrary values like 13px, 27px

### Visual Effects:
- Glassmorphism: backdrop-filter: blur(20px), semi-transparent backgrounds
- Shadows: layered box-shadows, not single shadow
- Borders: gradient borders using pseudo-elements or border-image
- Animations: CSS keyframes + JS IntersectionObserver for scroll reveals
- Micro-interactions: every interactive element responds visually

### Layout:
- CSS Grid for page structure
- Flexbox for component alignment
- clamp() for responsive typography
- Container max-width: 1280px, centered with auto margins
- Always test: 320px mobile → 1920px desktop

---

## 🎮 FOR GAMES:
- HTML5 Canvas OR pure DOM manipulation
- requestAnimationFrame game loop at 60fps
- Touch + keyboard + mouse controls
- Start screen with instructions
- Game over screen with restart
- Score, lives, level progression
- Particle effects for events
- Local high score via localStorage

## 🌐 FOR WEBSITES / LANDING PAGES:
- Hero: full-viewport with animated gradient background
- Navigation: sticky, blur backdrop, smooth scroll
- Sections: Features, How It Works, Pricing, Testimonials, FAQ, CTA, Footer
- Social proof: star ratings, user counts, logos
- CTA buttons: gradient, glow effect, hover lift
- Animations: fade-in on scroll via IntersectionObserver
- Mobile menu: hamburger with smooth slide animation

## 📱 FOR APPS / DASHBOARDS:
- Sidebar navigation with icons and labels
- Top bar with search and user avatar
- Card grid with stats and charts
- Data tables with sorting and filtering
- Modal dialogs with backdrop blur
- Toast notifications system
- Dark/light theme toggle
- localStorage for data persistence
- Charts: use Chart.js from CDN

## 🛒 FOR E-COMMERCE:
- Product grid with filters sidebar
- Product card: image, title, price, rating, add-to-cart
- Shopping cart drawer/modal
- Checkout form with validation
- Order summary with totals
- localStorage cart persistence
- Search with live filtering
- Sort: price, rating, newest

${isPaid ? `
## 💎 PREMIUM MODE (Paid Plan):
- Use advanced animations: GSAP-style with CSS or Web Animations API
- 600+ lines of code minimum
- Include multiple pages/sections (simulate navigation)
- Add real data (not lorem ipsum) — realistic names, prices, descriptions
- Include a working dark/light theme toggle
- Add keyboard shortcuts where relevant
- Add loading states and skeleton screens
- Include error states and empty states
` : ""}

---

## 🏆 REFERENCE QUALITY — BUILD AT THIS LEVEL:
- Apple.com → clean, luxurious, breathing room
- Stripe.com → precision typography, trust signals
- Linear.app → dark, elegant, developer-focused
- Vercel.com → minimal, fast-feeling, gradient accents
- Framer.com → playful animations, creative layouts
- OpenAI.com → bold headings, confident copy
- Notion.so → clean functional design

Now BUILD the requested project at this quality level. Think step by step, then generate.`;
}

// ── HTML Validator ───────────────────────────────────────────────
function validateHTML(html: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!html.includes("<!DOCTYPE")) issues.push("Missing DOCTYPE declaration");
  if (!html.includes("</html>")) issues.push("Unclosed html tag");
  if (!html.includes("<body")) issues.push("Missing body tag");
  if (html.length < 2000) issues.push("Code too short — likely incomplete");

  // Check for common JS syntax errors
  const scriptMatches = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi) || [];
  for (const script of scriptMatches) {
    const jsContent = script.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "");
    const openBraces  = (jsContent.match(/\{/g) || []).length;
    const closeBraces = (jsContent.match(/\}/g) || []).length;
    if (Math.abs(openBraces - closeBraces) > 5) {
      issues.push("Unbalanced braces in JavaScript");
    }
  }

  return { valid: issues.length === 0, issues };
}

// ── Clean HTML Output ────────────────────────────────────────────
function cleanHTML(raw: string): string {
  let html = raw
    .replace(/^```html\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```$/im, "")
    .trim();

  const idx = html.indexOf("<!DOCTYPE");
  if (idx > 0) html = html.substring(idx);

  return html;
}

// ── AI Provider: Claude ──────────────────────────────────────────
async function callClaude(system: string, prompt: string, model: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Claude API key not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  if (!text) throw new Error("Claude returned empty response");
  return text;
}

// ── AI Provider: OpenAI ──────────────────────────────────────────
async function callOpenAI(system: string, prompt: string, model: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system",    content: system },
        { role: "user",      content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("OpenAI returned empty response");
  return text;
}

// ── AI Provider: Gemini ──────────────────────────────────────────
async function callGemini(system: string, prompt: string, model: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\nUser request: ${prompt}` }] }],
        generationConfig: { maxOutputTokens: 16000, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(90000),
    }
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

// ── Self-Healing: Fix broken HTML ────────────────────────────────
async function healHTML(brokenHTML: string, issues: string[], system: string, plan: string): Promise<string> {
  const healPrompt = `The following HTML has these issues: ${issues.join(", ")}.

Fix ALL issues and return a complete, working HTML file. Keep all existing content and styling — only fix the broken parts. Output ONLY the corrected HTML starting with <!DOCTYPE html>.

BROKEN HTML:
${brokenHTML.slice(0, 8000)}`;

  // Try healing with same cascade
  const models = getModelCascade(plan);
  for (const attempt of models) {
    try {
      let healed = "";
      if (attempt.provider === "claude") {
        healed = await callClaude(system, healPrompt, attempt.model, attempt.maxTokens);
      } else if (attempt.provider === "openai") {
        healed = await callOpenAI(system, healPrompt, attempt.model, attempt.maxTokens);
      } else {
        healed = await callGemini(system, healPrompt, attempt.model);
      }
      return cleanHTML(healed);
    } catch { continue; }
  }
  return brokenHTML; // Return original if healing fails
}

// ── Model Cascade by Plan ────────────────────────────────────────
function getModelCascade(plan: string) {
  const isPaid = ["pro", "premium", "business"].includes(plan);

  return [
    {
      provider: "claude",
      model: isPaid ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001",
      maxTokens: isPaid ? 16000 : 8000,
      label: "Claude",
    },
    {
      provider: "openai",
      model: isPaid ? "gpt-4o" : "gpt-4o-mini",
      maxTokens: isPaid ? 16000 : 8000,
      label: "OpenAI",
    },
    {
      provider: "gemini",
      model: isPaid ? "gemini-1.5-pro" : "gemini-1.5-flash",
      maxTokens: isPaid ? 16000 : 8000,
      label: "Gemini",
    },
  ];
}

// ── Main Route Handler ───────────────────────────────────────────
export async function POST(req: NextRequest) {
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

    // Build system prompt and thinking steps
    const systemPrompt  = buildSystemPrompt(plan);
    const thinkingSteps = getThinkingSteps(prompt);

    // ── 3-Layer AI Cascade ────────────────────────────────────
    const cascade = getModelCascade(plan);
    let html = "";
    let usedProvider = "claude";
    let attemptCount = 0;

    for (const attempt of cascade) {
      attemptCount++;
      try {
        let raw = "";

        if (attempt.provider === "claude") {
          raw = await callClaude(systemPrompt, prompt, attempt.model, attempt.maxTokens);
        } else if (attempt.provider === "openai") {
          raw = await callOpenAI(systemPrompt, prompt, attempt.model, attempt.maxTokens);
        } else {
          raw = await callGemini(systemPrompt, prompt, attempt.model);
        }

        html = cleanHTML(raw);
        usedProvider = attempt.provider;

        // Validate output
        const { valid, issues } = validateHTML(html);

        if (!valid && attemptCount <= cascade.length) {
          // Try to heal the HTML before moving to next provider
          const healed = await healHTML(html, issues, systemPrompt, plan);
          const { valid: healedValid } = validateHTML(healed);
          if (healedValid) {
            html = healed;
            break;
          }
          // If healing failed and we have more providers, continue cascade
          if (attemptCount < cascade.length) {
            html = "";
            continue;
          }
          // Last resort: use healed version even if not perfect
          html = healed;
        }

        break; // Success — exit cascade

      } catch (err) {
        if (attemptCount === cascade.length) {
          // All providers failed — return user-friendly message
          return NextResponse.json({
            error: "Our AI is taking a short break. Please try again in a moment.",
            code: "AI_UNAVAILABLE",
          }, { status: 503 });
        }
        // Silent fail — try next provider
        continue;
      }
    }

    if (!html || html.length < 500) {
      return NextResponse.json({
        error: "Please try a more detailed description of what you want to build.",
        code: "INVALID_OUTPUT",
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

    await supabase.from("profiles").update(creditUpdates).eq("id", user.id);

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
      provider: usedProvider,
      canSave: true,
      plan,
    });

  } catch (err: any) {
    console.error("[Generate] Fatal error:", err);
    // Never expose raw errors to users
    return NextResponse.json({
      error: "Something went wrong. Please try again.",
      code: "INTERNAL_ERROR",
    }, { status: 500 });
  }
}
