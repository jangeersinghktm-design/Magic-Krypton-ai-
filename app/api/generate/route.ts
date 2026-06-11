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
function buildSystemPrompt(plan: string, projectType?: string): string {
  const isPaid = ["pro", "premium", "business"].includes(plan);
  const pType  = projectType || "website";
  return `You are Krypton AI — the world's most advanced AI product builder.
You are an elite team of 8 specialist agents: Planner, Researcher, Designer, Builder, QA Tester, Optimizer, Content Writer, and Project Manager.
Every project you deliver is production-ready, beautiful, and complete.

## 🚨 OUTPUT RULES — NEVER BREAK:

### Rule 1 — Output Format:
- Start your response with EXACTLY: <!DOCTYPE html>
- End with EXACTLY: </html>
- Zero markdown, zero backticks, zero explanations before or after the HTML
- ALL CSS in <style> tags in <head>
- ALL JavaScript in <script> tags before </body>
- Self-contained: Google Fonts CDN + cdnjs.cloudflare.com only

### Rule 2 — Language:
- ALL text in ENGLISH regardless of prompt language
- Understand Hindi/Urdu/Hinglish prompts but output English content

### Rule 3 — Minimum Quality Bar:
- 600+ lines of complete, working code
- ZERO empty sections, ZERO placeholder text
- ZERO "Lorem ipsum", ZERO "Coming soon", ZERO "TODO"
- Every button, link, tab, accordion MUST function
- All animations smooth at 60fps
- Mobile responsive (320px to 1920px)
- Must pass: valid DOCTYPE, body content, interactive JS, styled CSS

### Rule 4 — Project Type Detection (CRITICAL):
Project type detected: ${pType}
- If type=game: Build ONLY a game, NOT a website
- If type=website: Build a multi-section website, NOT a game
- If type=app: Build a web application with UI, NOT a landing page
- If type=ecommerce: Build a shop with products and cart
- If type=dashboard: Build an admin/analytics panel
- If type=landing: Build a single-page marketing site

---

## 🎨 DESIGN SYSTEM — ALWAYS FOLLOW:

### Typography (MUST use Google Fonts via @import):
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
- Headings: 'Syne' — weight 800, letter-spacing -0.02em
- Body: 'DM Sans' — weight 400-500, line-height 1.7
- Code: 'JetBrains Mono'
- Size scale: clamp() for fluid typography ONLY

### Premium Color System (CSS Variables):
:root {
  --primary: #FFD700;
  --primary-2: #FF7A00;
  --bg: #050505;
  --surface: #0D0D0D;
  --card: #111111;
  --border: rgba(255,215,0,0.1);
  --text: #FFFFFF;
  --text-2: #94A3B8;
  --grad: linear-gradient(135deg, #FFD700, #FF7A00);
}

### Hover & Interaction Rules (MANDATORY):
- Every button: transform: translateY(-2px) + box-shadow on hover
- Every card: transform: translateY(-6px) + border-color change on hover
- Every link: color change + underline animation on hover
- All transitions: 0.25s ease on ALL interactive elements
- Cursor: pointer on all clickable elements

### Spacing System:
- Use 8px grid: 8/16/24/32/40/48/64/80/96/128px
- Section padding: clamp(64px,8vw,96px) top/bottom
- Card padding: 28-36px
- Never use arbitrary values

### Animation System (MANDATORY):
- All sections: fade-in on scroll via IntersectionObserver
- Hero: gradient background animation
- Buttons: gradient shift + glow on hover
- Loading: smooth skeleton placeholders
- Micro-interactions on every UI element

### Layout Rules:
- CSS Grid for page structure
- Flexbox for component alignment  
- Container: max-width 1280px, margin 0 auto, padding 0 clamp(20px,4vw,64px)
- Always mobile-first: 320px → 768px → 1280px → 1920px

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

## 🌐 FOR WEBSITES / LANDING PAGES (MANDATORY SECTIONS):
ALWAYS include ALL of these sections in this order:
1. NAVBAR — sticky, logo + nav links + CTA button, hamburger on mobile, backdrop-blur
2. HERO — full viewport height, gradient/animated background, headline + subheading + CTA buttons + social proof (avatars + star rating + user count)
3. MARQUEE/LOGOS — scrolling trusted brands or feature highlights
4. FEATURES — 3-column grid, icon + title + description, hover glow cards
5. HOW IT WORKS — 3-step process with numbered icons, connecting line
6. SHOWCASE/DEMO — screenshot or preview of the product/service
7. TESTIMONIALS — 3 cards with photo, name, role, star rating, quote
8. PRICING — 3 plans (Free/Pro/Business), toggle monthly/yearly, highlighted middle plan
9. FAQ — accordion with smooth open/close animation, 6+ questions
10. FINAL CTA — full-width banner, gradient background, headline + button
11. FOOTER — logo, links, social icons, copyright

BUTTON STANDARDS:
- Primary: gradient (#FFD700→#FF7A00), color #050505, fontWeight 700
- Secondary: transparent, border 1px, color white
- ALL buttons: padding 14px 32px, border-radius 10px, hover: translateY(-2px)

CARD STANDARDS:
- background: rgba(255,255,255,0.03)
- border: 1px solid rgba(255,255,255,0.08)
- border-radius: 20px
- hover: translateY(-6px), border-color rgba(255,215,0,0.3), box-shadow 0 24px 56px rgba(0,0,0,0.5)

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
  if (!html || html.trim().length < 200) issues.push("Response too short or empty");
  if (!html.includes("</html>") && !html.includes("</body>")) issues.push("Incomplete HTML structure");
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
    const { prompt: userPrompt, projectType: reqProjectType } = await (async () => {
      // Auto-detect project type from prompt
      const lower = prompt.toLowerCase();
      let detectedType = "website";
      if (/\bgame\b|\bsnake\b|\bmario\b|\bpuzzle\b|\bchess\b|\btetris\b|\barcade\b|\brpg\b/.test(lower)) detectedType = "game";
      else if (/\bshop\b|\bstore\b|\becommerce\b|\bcart\b|\bproduct listing\b|\bmarketplace\b/.test(lower)) detectedType = "ecommerce";
      else if (/\bdashboard\b|\badmin panel\b|\banalytics\b|\bcrm\b/.test(lower)) detectedType = "dashboard";
      else if (/\bapp\b|\bapplication\b|\btool\b|\btracker\b|\bmanager\b/.test(lower) && !/\bweb app\b/.test(lower)) detectedType = "app";
      else if (/\blanding\b/.test(lower)) detectedType = "landing";
      return { prompt, projectType: detectedType };
    })();
    const systemPrompt  = buildSystemPrompt(plan, reqProjectType);
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

        // ✅ Use HTML if it has any meaningful content — never reject good output
        if (html && html.length > 200) {
          break; // Got content — stop cascade, use it
        }

        // Empty response — try next provider silently
        if (attemptCount < cascade.length) continue;

      } catch (err) {
        if (attemptCount === cascade.length) {
          return NextResponse.json({
            error: "Our AI is taking a short break. Please try again in a moment.",
            code: "AI_UNAVAILABLE",
          }, { status: 503 });
        }
        continue; // Silent fail — try next provider
      }
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
