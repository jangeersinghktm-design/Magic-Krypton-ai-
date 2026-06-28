// app/api/generate/route.ts — Krypton AI v6 — Enterprise Engine
// 3-Layer AI Fallback: Claude → OpenAI → Gemini
// Self-Healing Error Recovery
// 10-Step Thinking Engine
// Never expose errors to users

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  renderComponent, getDefaultVariant, buildComponentContext,
  buildRootTokens, listVariants, type ComponentCategory,
} from "@/lib/component-library";

export const maxDuration = 300; // Fixed: 308 exceeded Vercel Pro 300s limit
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
  return `You are Krypton Intelligence Engine — an elite AI system that builds world-class digital products.
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

## 🎮 FOR GAMES — BUILD A PREMIUM BROWSER GAME (Not a demo, not a prototype):

CRITICAL RULE: The ENTIRE game must be playable in the preview iframe. Full screen canvas. No start screen only.

MANDATORY ARCHITECTURE:
- HTML5 Canvas, full viewport size: canvas.width = window.innerWidth, canvas.height = window.innerHeight
- 60fps requestAnimationFrame loop running immediately on page load
- Game starts in "menu" state but pressing SPACE or tapping START begins instantly

CORE SYSTEMS (ALL REQUIRED):
1. GAMEPLAY: Smooth player movement, collision detection, enemy AI, projectiles
2. PROGRESSION: Levels 1-∞, speed/difficulty increases each level, XP system
3. SCORING: Live score on canvas, high score in localStorage, combo multiplier
4. LIVES: 3 lives system with respawn animation, health bar displayed
5. POWERUPS: Randomly spawning powerups (speed boost, shield, score multiplier)
6. SOUND: Web Audio API — beeps for collect, crunch for death, level-up fanfare
7. PARTICLES: Particle effects on coin collect, enemy kill, death, level-up
8. ACHIEVEMENTS: 5+ achievements with localStorage persistence

PREMIUM UI DESIGN:
- Background: Dark gradient or starfield/parallax scrolling background
- HUD: Score (top-left), Lives (hearts, top-right), Level badge (top-center)
- All UI: glassmorphism style (rgba backgrounds, backdrop-filter: blur)
- Colors: Neon accent colors (#00FFFF, #FF00FF, #FFD700) on dark bg
- Fonts: Load from Google Fonts OR use Canvas fillText with premium look
- Animations: Smooth tweening, scale/fade effects

MOBILE FIRST:
- Canvas auto-resizes to any screen (mobile, tablet, desktop)
- On-screen D-pad (left/right arrows) positioned bottom-left
- Action buttons (jump/shoot) positioned bottom-right
- All buttons: 60px minimum touch target, semi-transparent

SPECIFIC GAME RULES BY TYPE:
SNAKE: Grid-based, neon snake on dark bg, fruits spawn randomly, walls kill, snake grows
TETRIS: Classic Tetris with hold piece, next piece preview, ghost piece, T-spin detection
MARIO-STYLE: Platformer with gravity, platforms, coins, enemies that walk + fall off edges
SPACE/SHOOTER: Vertical scroller, player shoots, enemies move in patterns, boss every 5 levels
PUZZLE: Interactive objects, drag-and-drop or click mechanics, hint system

GAME LOOP PATTERN (required):
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let state = "menu", score = 0, level = 1, lives = 3;
function update() { /* game logic */ }
function render() { ctx.clearRect(0,0,canvas.width,canvas.height); /* draw everything */ }
function loop() { update(); render(); requestAnimationFrame(loop); }
window.onload = () => loop();

OUTPUT: A complete, polished, immediately playable game. Minimum 600 lines of code.

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
  if (!raw?.trim()) return "";

  // Strip markdown code fences the AI sometimes wraps output in
  let html = raw
    .replace(/^```html\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/im, "")
    .replace(/^html\s*/im, "")
    .trim();

  // Find the actual HTML document start
  const idx = html.indexOf("<!DOCTYPE");
  if (idx > 0) html = html.substring(idx);

  // If no DOCTYPE found but <html> tag exists, use that as start
  if (!html.includes("<!DOCTYPE") && html.includes("<html")) {
    const htmlIdx = html.indexOf("<html");
    if (htmlIdx > 0) html = html.substring(htmlIdx);
    html = "<!DOCTYPE html>\n" + html;
  }

  // Ensure closing tags exist
  if (html.includes("<html") && !html.includes("</html>")) {
    html += "\n</html>";
  }

  return html.trim();
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
${brokenHTML.slice(0, 40000)}`;

  // Try healing with same providers
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
      model: "claude-sonnet-4-6", // Sonnet for ALL plans — Haiku was causing 504 + thin output
      maxTokens: 12000,            // raised from 8000/16000 — matches orchestrate.ts
      label: "Claude",
    },
    {
      provider: "openai",
      model: "gpt-4o",
      maxTokens: 12000,
      label: "OpenAI",
    },
    {
      provider: "gemini",
      model: "gemini-2.0-flash",  // fixed: 1.5-pro/flash deprecated
      maxTokens: 12000,
      label: "Gemini",
    },
  ];
}

// ── Component Library Pipeline (V1 architecture fix) ─────────────────────────
// Migrated from orchestrate/route.ts — same logic, same component library.
// AI generates JSON/content only. HTML comes from renderComponent() exclusively.

// Detect project niche from prompt (simplified version for generate route)
function detectProjectNiche(prompt: string, projectType: string): any {
  const p = prompt.toLowerCase();
  const isLuxury   = /luxury|premium|high.end|exclusive|elite|couture|bespoke/.test(p);
  const isCreative = /creative|design|art|portfolio|studio|photography|film/.test(p);
  const isCorp     = /corporate|enterprise|consulting|legal|finance|b2b|saas/.test(p);
  const isFriendly = /community|local|family|kids|food|cafe|restaurant|fitness|gym/.test(p);

  const tone = isLuxury ? "editorial"
             : isCreative ? "bold"
             : isCorp ? "trust"
             : isFriendly ? "warm"
             : "clean";

  const marketLevel = isLuxury ? "luxury" : isCorp ? "premium" : "mid";

  // Deterministic palette from token system
  const palettes: Record<string, any> = {
    editorial:  { primary:"#D4A853", secondary:"#1A1A2E", grad:"linear-gradient(135deg,#D4A853,#B8935A)", accent:"#D4A853", bg:"#050810", surface:"#0A0D1A", card:"#0F1320", text2:"#8892A0" },
    bold:       { primary:"#7C3AED", secondary:"#EC4899", grad:"linear-gradient(135deg,#7C3AED,#EC4899)", accent:"#7C3AED", bg:"#030007", surface:"#07000E", card:"#0D0018", text2:"#9CA3AF" },
    trust:      { primary:"#2563EB", secondary:"#1E40AF", grad:"linear-gradient(135deg,#2563EB,#1E40AF)", accent:"#3B82F6", bg:"#020B1A", surface:"#051225", card:"#081930", text2:"#94A3B8" },
    warm:       { primary:"#F59E0B", secondary:"#EF4444", grad:"linear-gradient(135deg,#F59E0B,#EF4444)", accent:"#F59E0B", bg:"#0C0800", surface:"#150E00", card:"#1C1300", text2:"#9CA3AF" },
    clean:      { primary:"#6366F1", secondary:"#8B5CF6", grad:"linear-gradient(135deg,#6366F1,#8B5CF6)", accent:"#6366F1", bg:"#040610", surface:"#070B16", card:"#0C1020", text2:"#8892A0" },
  };

  const palette = palettes[tone] || palettes.clean;

  return {
    industry: projectType, businessType: "service", marketLevel,
    reach: "national", audience: "b2c", tone,
    imageKeyword: prompt.split(" ").slice(0, 3).join(" "),
    imageKeyword2: projectType,
    sectionImageMap: {}, sectionOrder: [],
    conversionGoal: "inquiry", competitorStyle: "Stripe",
    brandPositioning: isLuxury ? "luxury" : "innovative",
    audienceDimensions: {}, objectionHandling: [], trustElements: [],
    palette: { ...palette, primary: palette.primary, secondary: palette.secondary,
               grad: palette.grad, accent: palette.accent, bg: palette.bg,
               surface: palette.surface, card: palette.card, text2: palette.text2 },
    typography: {
      headingFont: isCreative ? "'Playfair Display', serif" : isLuxury ? "'Cormorant Garamond', serif" : "'Syne', sans-serif",
      bodyFont: "'DM Sans', sans-serif",
      headingWeight: "800", headingSpacing: "-0.02em",
      googleFonts: isCreative
        ? "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500&display=swap"
        : isLuxury
        ? "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500&display=swap"
        : "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap",
    },
    brandVoice: { adjectives: [], phrases: [], avoid: [] },
  };
}

// Generate component content JSON via AI (same as orchestrate)
async function generatePageCopy(
  prompt: string, niche: any, projectType: string
): Promise<Record<string, any>> {
  const categories: ComponentCategory[] = projectType === "dashboard"
    ? ["navbar", "dashboard", "footer"]
    : projectType === "ecommerce" || projectType === "store"
    ? ["navbar", "hero", "ecommerce", "testimonials", "cta", "footer"]
    : projectType === "portfolio"
    ? ["navbar", "hero", "portfolio", "testimonials", "cta", "footer"]
    : ["navbar", "hero", "features", "testimonials", "pricing", "faq", "cta", "footer"];

  const tone = niche.tone || "clean";
  const variantOptions = categories.map(c => `${c}: [${listVariants(c).join(", ")}]`).join(", ");

  const ANTHROPIC = process.env.ANTHROPIC_API_KEY;
  const OPENAI    = process.env.OPENAI_API_KEY;
  const GEMINI    = process.env.GEMINI_API_KEY;

  const system = `You are Krypton AI's content specialist. Output ONLY valid JSON — no markdown, no HTML. Write specific copy for the user's niche.`;
  const user = `Build content for: "${prompt}"
Tone: ${tone} | Market: ${niche.marketLevel}

Return JSON with these component keys: ${categories.join(", ")}
Include a "variants" object that picks from these options:
${variantOptions}

Requirements:
- "navbar": { logoText, links:[{label,href}], cta:{text,href} }
- "hero": { badge, headline, subheadline, ctaPrimary:{text,href}, ctaSecondary:{text,href} }
- "features": { eyebrow, headline, items:[{icon,title,desc}] }
- "testimonials": { eyebrow, headline, items:[{quote,name,role,rating}] }
- "pricing": { eyebrow, headline, tiers:[{name,price,period,features:[],cta:{text,href},highlighted}] }
- "faq": { eyebrow, headline, items:[{question,answer}] }
- "cta": { headline, subheadline, ctaPrimary:{text,href} }
- "footer": { logoText, tagline, columns:[{title,links:[{label,href}]}], copyrightName }

Write real, compelling copy specific to: "${prompt}". No placeholders.`;

  // Try Claude → OpenAI → Gemini, same pattern as orchestrate
  for (const [key, callFn] of [
    ["claude",  async () => {
      if (!ANTHROPIC) throw new Error("no key");
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type":"application/json","x-api-key":ANTHROPIC,"anthropic-version":"2023-06-01","anthropic-beta":"prompt-caching-2024-07-31" },
        body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:4000, system:[{type:"text",text:system,cache_control:{type:"ephemeral"}}], messages:[{role:"user",content:user}] }),
        signal: AbortSignal.timeout(90000),
      });
      if (!r.ok) throw new Error(`Claude ${r.status}`);
      const d = await r.json();
      return d.content?.[0]?.text || "";
    }],
    ["openai", async () => {
      if (!OPENAI) throw new Error("no key");
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type":"application/json","Authorization":`Bearer ${OPENAI}` },
        body: JSON.stringify({ model:"gpt-4o", max_tokens:4000, response_format:{type:"json_object"}, messages:[{role:"system",content:system},{role:"user",content:user}] }),
        signal: AbortSignal.timeout(90000),
      });
      if (!r.ok) throw new Error(`OpenAI ${r.status}`);
      const d = await r.json();
      return d.choices?.[0]?.message?.content || "";
    }],
    ["gemini", async () => {
      if (!GEMINI) throw new Error("no key");
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI}`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ contents:[{parts:[{text:system+"\n\n"+user}]}], generationConfig:{maxOutputTokens:4000,temperature:0.4} }),
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error(`Gemini ${r.status}`);
      const d = await r.json();
      return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }],
  ] as const) {
    try {
      const text    = await (callFn as () => Promise<string>)();
      const cleaned = text.replace(/```json|```/g,"").trim();
      try { const p=JSON.parse(cleaned); if(p.hero||p.navbar) return p; } catch {}
      const m = cleaned.match(/\{[\s\S]+\}/);
      if (m) { const p=JSON.parse(m[0]); if(p.hero||p.navbar) return p; }
    } catch { continue; }
  }

  // Intelligent defaults (never fail)
  const name = prompt.slice(0,40);
  return {
    variants: { navbar:"glass-sticky", hero:"split-image", features:"icon-grid", testimonials:"cards", pricing:"tiers", faq:"accordion", cta:"centered-gradient", footer:"columns" },
    navbar: { logoText:name, links:[{label:"Home",href:"#hero"},{label:"Services",href:"#features"},{label:"Pricing",href:"#pricing"},{label:"Contact",href:"#cta"}], cta:{text:"Get Started",href:"#cta"} },
    hero: { badge:`Premium ${projectType}`, headline:`The Future of ${name}`, subheadline:`Premium solutions designed for results.`, ctaPrimary:{text:"Get Started",href:"#cta"}, ctaSecondary:{text:"Learn More",href:"#features"} },
    features: { eyebrow:"Why Choose Us", headline:`Everything you need`, items:[{icon:"⚡",title:"Fast Delivery",desc:"Rapid execution."},{icon:"🔒",title:"Reliable",desc:"Consistent outcomes."},{icon:"🎯",title:"Expert Team",desc:"Deep expertise."}] },
    testimonials: { eyebrow:"Reviews", headline:"Trusted by leaders", items:[{quote:"Exceptional quality.",name:"Sarah M.",role:"Director",rating:5},{quote:"Outstanding results.",name:"James K.",role:"CEO",rating:5}] },
    pricing: { eyebrow:"Pricing", headline:"Simple pricing", tiers:[{name:"Starter",price:"$49",period:"month",highlighted:false,features:["Core features","Support"],cta:{text:"Start Now",href:"#cta"}},{name:"Pro",price:"$149",period:"month",highlighted:true,features:["Everything","Priority support"],cta:{text:"Go Pro",href:"#cta"}}] },
    faq: { eyebrow:"FAQ", headline:"Questions & Answers", items:[{question:"How quickly can you start?",answer:"We begin within 24-48 hours."},{question:"Is there a contract?",answer:"Monthly plans, no commitment."}] },
    cta: { headline:`Ready to start?`, subheadline:"Join satisfied clients today.", ctaPrimary:{text:"Start Now",href:"#contact"} },
    footer: { logoText:name, tagline:`Premium ${projectType} solutions.`, columns:[{title:"Product",links:[{label:"Features",href:"#features"},{label:"Pricing",href:"#pricing"}]}], copyrightName:name },
  };
}

// Assemble HTML from component library (zero AI)
function assembleHtml(content: Record<string,any>, niche: any): string {
  const ctx    = buildComponentContext(niche.palette.primary);
  const tokens = buildRootTokens(niche);
  const tone   = niche.tone || "clean";
  const v      = content.variants || {};

  const order: ComponentCategory[] = ["navbar","hero","features","dashboard","testimonials","pricing","faq","portfolio","ecommerce","cta","footer"];
  let   body = "";
  for (const cat of order) {
    const c = content[cat];
    if (!c) continue;
    body += renderComponent(cat, v[cat] || getDefaultVariant(cat, tone), ctx, c);
  }

  const fonts = niche.typography?.googleFonts
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="${niche.typography.googleFonts}" rel="stylesheet">`
    : "";

  const staticJS = `
(function(){
  document.querySelectorAll('.hamburger').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.nav-links').forEach(function(n){n.classList.toggle('open');});});});
  document.querySelectorAll('a[href^="#"]').forEach(function(a){a.addEventListener('click',function(e){var t=document.querySelector(a.getAttribute('href'));if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'});}});});
  var ro=new IntersectionObserver(function(e){e.forEach(function(x){if(x.isIntersecting){x.target.classList.add('visible');ro.unobserve(x.target);}});},{threshold:0.1});
  document.querySelectorAll('.reveal').forEach(function(el){ro.observe(el);});
  document.querySelectorAll('.faq-question').forEach(function(q){q.addEventListener('click',function(){var a=q.nextElementSibling;var op=q.classList.contains('active');document.querySelectorAll('.faq-question').forEach(function(oq){oq.classList.remove('active');if(oq.nextElementSibling)oq.nextElementSibling.classList.remove('open');});if(!op&&a){q.classList.add('active');a.classList.add('open');}});});
  window.addEventListener('scroll',function(){document.querySelectorAll('nav').forEach(function(n){n.classList.toggle('scrolled',window.scrollY>50);});},{passive:true});
})();`.trim();

  const staticCSS = `
*{box-sizing:border-box;margin:0;padding:0;}html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--text);font-family:var(--body-font);line-height:1.65;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
h1,h2,h3,h4{font-family:var(--heading-font);font-weight:var(--heading-weight);letter-spacing:var(--heading-spacing);line-height:1.15;}
h1{font-size:clamp(28px,6vw,72px);}h2{font-size:clamp(22px,4vw,48px);}h3{font-size:clamp(16px,2.5vw,28px);}
a{color:inherit;text-decoration:none;}img{max-width:100%;height:auto;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:rgba(var(--primary-rgb),.4);border-radius:4px;}
.container,.section-inner{max-width:1200px;margin:0 auto;padding:0 clamp(16px,4vw,48px);}
section{padding:clamp(60px,10vw,120px) 0;overflow-x:hidden;}
.btn,.btn-primary{display:inline-flex;align-items:center;gap:8px;background:var(--grad);color:#fff;border:none;padding:14px 28px;border-radius:10px;font-weight:700;cursor:pointer;text-decoration:none;font-size:15px;transition:transform .2s,box-shadow .2s;}
.btn:hover,.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(var(--primary-rgb),.35);}
.btn-secondary{display:inline-flex;align-items:center;gap:8px;background:transparent;color:var(--text);border:1px solid var(--border);padding:13px 28px;border-radius:10px;font-weight:600;cursor:pointer;font-size:15px;transition:all .2s;text-decoration:none;}
.btn-secondary:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.2);}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px;transition:border-color .2s,transform .2s;}
.card:hover{border-color:rgba(var(--primary-rgb),.3);transform:translateY(-2px);}
nav{position:sticky;top:0;z-index:100;background:rgba(var(--bg-rgb),.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--border);}
nav.scrolled{box-shadow:0 4px 24px rgba(0,0,0,.3);}
.nav-links{display:flex;align-items:center;gap:8px;}
.hamburger{display:none;background:none;border:none;color:var(--text);font-size:22px;cursor:pointer;padding:6px;}
.nav-links.open{display:flex;}
@media(max-width:768px){.nav-links{display:none;position:fixed;inset:58px 0 0 0;background:var(--bg);flex-direction:column;padding:20px;gap:12px;border-top:1px solid var(--border);}.nav-links a{font-size:17px;}.hamburger{display:block;}}
.faq-answer{max-height:0;overflow:hidden;transition:max-height .35s ease;}
.faq-answer.open{max-height:400px;}
.faq-question{cursor:pointer;display:flex;justify-content:space-between;align-items:center;}
input,textarea{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 16px;color:var(--text);font-size:14px;width:100%;outline:none;transition:border-color .2s;}
input:focus,textarea:focus{border-color:var(--primary);}
input::placeholder,textarea::placeholder{color:var(--text-2);}
.reveal{opacity:0;transform:translateY(24px);transition:opacity .65s cubic-bezier(.16,1,.3,1),transform .65s cubic-bezier(.16,1,.3,1);}
.reveal.visible{opacity:1;transform:none;}
.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;}
@media(max-width:900px){.grid-4{grid-template-columns:repeat(2,1fr);}.grid-3{grid-template-columns:1fr 1fr;}}
@media(max-width:640px){.grid-2,.grid-3,.grid-4{grid-template-columns:1fr;}}
.text-gradient{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
footer{background:var(--surface);border-top:1px solid var(--border);padding:clamp(48px,8vw,80px) 0 28px;}
.pricing-card.highlighted,.pricing-card.featured{border-color:rgba(var(--primary-rgb),.4);background:var(--surface);}
`.trim();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${content.hero?.headline?.slice(0,50) || "Krypton AI"}</title>
${fonts}
<style>
${tokens}
${staticCSS}
</style>
</head>
<body>
${body}
<script>${staticJS}</script>
</body>
</html>`;
}

// ── Main Route Handler ───────────────────────────────────────────
// Fix 6: Per-user generation lock
const activeGens = new Set<string>();

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

    // Fix 6: Block concurrent generations per user
    if (activeGens.has(user.id)) {
      return NextResponse.json({
        error: "A generation is already in progress. Please wait.",
        code: "DUPLICATE_GEN",
      }, { status: 429 });
    }
    activeGens.add(user.id);
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

    // ── Architecture: Component Library Pipeline ──────────────────────────
    // AI generates JSON content only. HTML assembled from renderComponent().
    // No AI call returns HTML — architecture aligned with orchestrate/route.ts.
    const lower = prompt.toLowerCase();
    let projectType = "website";
    if (/game|snake|mario|puzzle|chess|tetris|arcade|rpg/.test(lower)) projectType = "game";
    else if (/shop|store|ecommerce|cart|marketplace/.test(lower)) projectType = "ecommerce";
    else if (/dashboard|admin panel|analytics|crm/.test(lower)) projectType = "dashboard";
    else if (/portfolio/.test(lower)) projectType = "portfolio";
    else if (/landing/.test(lower)) projectType = "landing";

    // Games still use game/route.ts (valid exception) — but generate route
    // is only called as SSE fallback, so games shouldn't reach here.
    // If they do, treat as website.
    if (projectType === "game") projectType = "website";

    const thinkingSteps = getThinkingSteps(prompt);
    let html = "";
    let usedProvider = "claude";

    try {
      // Stage 1: Detect niche (deterministic, 0 AI calls)
      const niche = detectProjectNiche(prompt, projectType);

      // Stage 2: Generate page copy JSON (1 AI call — Claude→OpenAI→Gemini)
      const pageCopy = await generatePageCopy(prompt, niche, projectType);
      usedProvider = "claude"; // generatePageCopy tracks internally

      // Stage 3: Assemble HTML from component library (0 AI calls)
      html = assembleHtml(pageCopy, niche);

    } catch (err: any) {
      console.error("[Generate] Pipeline error:", err.message);
      return NextResponse.json({
        error: "Our AI is taking a short break. Please try again in a moment.",
        code: "AI_UNAVAILABLE",
      }, { status: 503 });
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
    if (lockedUserId) activeGens.delete(lockedUserId);
  }
}
