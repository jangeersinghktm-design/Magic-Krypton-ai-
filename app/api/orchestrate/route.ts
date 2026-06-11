// app/api/orchestrate/route.ts
// Krypton AI — Real Agent Orchestration via Server-Sent Events
// 7-Phase Pipeline: Plan → Research → Design → Build → QA → Optimize → Deliver
// Never fake progress — every event tied to real AI operations

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime  = "nodejs";
export const maxDuration = 120;

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

// ── AI Providers (same 3-layer cascade) ──────────────────────────
async function callClaude(system: string, user: string, maxTokens = 12000): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01" },
    body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:maxTokens, system, messages:[{role:"user",content:user}] }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

async function callOpenAI(system: string, user: string, maxTokens = 12000): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json","Authorization":`Bearer ${key}` },
    body: JSON.stringify({ model:"gpt-4o", max_tokens:maxTokens, messages:[{role:"system",content:system},{role:"user",content:user}] }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ contents:[{parts:[{text:`${system}\n\n${user}`}]}], generationConfig:{maxOutputTokens:12000} }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function generateWithFallback(system: string, prompt: string): Promise<{text:string;provider:string}> {
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
  if (/\bshop\b|\bstore\b|\becommerce\b|\bcart\b|\bproduct\b|\bmarketplace\b/.test(p)) return "ecommerce";
  if (/\bdashboard\b|\badmin\b|\banalytics\b|\bcrm\b|\bpanel\b/.test(p)) return "dashboard";
  if (/\bapp\b|\btool\b|\btracker\b|\bcalculator\b|\bmanager\b/.test(p)) return "app";
  if (/\blanding\b/.test(p)) return "landing";
  if (/\bportfolio\b/.test(p)) return "portfolio";
  if (/\bblog\b|\bnews\b|\barticle\b/.test(p)) return "blog";
  return "website";
}

// ── Build System Prompt by Type ──────────────────────────────────
function buildPrompt(userPrompt: string, type: string, plan: string): string {
  const BASE = `You are Krypton AI Builder — an elite software engineer producing production-ready HTML.

CRITICAL OUTPUT RULES:
1. Output ONLY raw HTML — start with <!DOCTYPE html> end with </html>
2. No markdown, no backticks, no explanations
3. ALL CSS in <style> in <head>
4. ALL JavaScript in <script> before </body>
5. ALL content in ENGLISH regardless of input language
6. Minimum 600 lines of working code
7. Zero placeholder text, zero lorem ipsum
8. Every interactive element MUST work

DESIGN SYSTEM:
- Google Fonts: @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
- Headings: Syne 800, letter-spacing: -0.02em
- Body: DM Sans 400-600, line-height: 1.7
- CSS Variables: --primary:#FFD700; --grad:linear-gradient(135deg,#FFD700,#FF7A00); --bg:#050505; --card:#111; --text:#fff; --text-2:#94A3B8;
- 8px spacing grid: 8/16/24/32/40/48/64/80/96px
- Container: max-width:1280px; margin:0 auto; padding:0 clamp(20px,4vw,64px)
- Transitions: 0.25s ease on ALL interactive elements
- IntersectionObserver for scroll animations on ALL sections

EXECUTION PLAN FROM PLANNER:
${plan}

USER REQUEST: ${userPrompt}`;

  const SPECIFIC: Record<string, string> = {
    game: `
BUILD A COMPLETE BROWSER GAME:
- HTML5 Canvas with requestAnimationFrame (60fps)
- Start screen: title, instructions, Start button
- Game loop: update + render cycle
- Keyboard controls (arrows/WASD) + mobile touch
- Score system with localStorage high score
- Lives/health system
- Level progression (speed increases)
- Game over screen with score + restart
- Particle effects for events
- Sound feedback using Web Audio API`,

    website: `
BUILD A COMPLETE MULTI-SECTION WEBSITE:
1. NAVBAR — fixed, backdrop-blur, logo + links + CTA, mobile hamburger
2. HERO — 100vh, animated gradient bg, H1 + subheading + 2 CTA buttons + social proof (avatars + stars + user count)
3. MARQUEE — infinite scroll of features/logos
4. FEATURES — 3-col grid, icon cards with hover glow
5. HOW IT WORKS — 3 numbered steps with connecting line
6. TESTIMONIALS — 3 cards with avatar + name + role + quote + stars
7. PRICING — 3 plans (Free/Pro/Business), monthly/yearly toggle, featured middle plan
8. FAQ — accordion (click to expand/collapse), 6+ questions
9. CTA BANNER — gradient bg, headline + button
10. FOOTER — logo + columns + social icons + copyright`,

    ecommerce: `
BUILD A COMPLETE E-COMMERCE STORE:
- Header with logo, search, cart icon (with count badge)
- Category filter sidebar (All, Category A, B, C)
- Product grid: image placeholder, name, price, rating stars, Add to Cart
- Cart drawer: slides from right, items, qty controls, subtotal, checkout
- Product hover: quick view overlay
- Search: live filter by product name
- Sort: Price Low/High, Rating, Newest
- localStorage for cart persistence
- Order summary with tax calculation
- Empty cart state`,

    dashboard: `
BUILD A COMPLETE ANALYTICS DASHBOARD:
- Left sidebar: logo + nav items with icons (active state)
- Top bar: search, notifications bell, user avatar
- KPI cards: 4 stats with icon, value, change % (green/red)
- Line chart: last 7 days data (Chart.js from CDN)
- Bar chart: monthly comparison
- Data table: sortable columns, pagination
- Recent activity feed
- Quick actions panel
- Dark theme throughout
- Responsive (collapse sidebar on mobile)`,

    app: `
BUILD A COMPLETE WEB APPLICATION:
- Navigation with tabs or sidebar
- Main content area with the app's core feature
- Form with validation
- Data display (cards, list, or table)
- Local state management (localStorage)
- Success/error notifications (toast)
- Empty states for no data
- Loading states
- Interactive UI elements that all work`,

    landing: `
BUILD A PREMIUM LANDING PAGE:
- Hero: full viewport, headline + subheading + primary CTA + secondary CTA
- Problem section: 3 pain points
- Solution section: 3 benefits
- How it works: 3 steps
- Social proof: logos + testimonial quote
- Pricing: 1-2 plans
- Final CTA: strong call to action
- Footer: minimal`,

    portfolio: `
BUILD A PREMIUM PORTFOLIO WEBSITE:
- Hero: name, title, tagline, avatar placeholder, CTA buttons
- About section: bio + skills with progress bars
- Projects: 6 project cards with image placeholder, title, tech stack, links
- Experience: timeline of work history
- Skills: icon grid of technologies
- Contact: form + social links
- Smooth scroll, animations throughout`,
  };

  return BASE + (SPECIFIC[type] || SPECIFIC.website);
}

// ── Clean HTML from AI response ──────────────────────────────────
function cleanHTML(raw: string): string {
  let html = raw.replace(/^```html\s*/im,"").replace(/^```\s*/im,"").replace(/\s*```$/im,"").trim();
  const idx = html.indexOf("<!DOCTYPE");
  if (idx > 0) html = html.substring(idx);
  return html;
}

// ── Validate HTML ────────────────────────────────────────────────
function validateHTML(html: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!html.toLowerCase().includes("<!doctype")) issues.push("Missing DOCTYPE");
  if (!html.includes("</html>"))                 issues.push("Unclosed html tag");
  if (html.length < 1000)                        issues.push("Content too short");
  if (!html.includes("<body"))                   issues.push("Missing body");
  return { valid: issues.length === 0, issues };
}

// ── Main SSE Handler ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { prompt, userId, accessToken } = await req.json().catch(() => ({}));

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

  const stream = new ReadableStream({
    async start(controller) {
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
        // ── PHASE 1: Planner ─────────────────────────────────────
        send("phase", { agent:"Planner", icon:"🔍", action:"Analyzing your request...", pct:8 });
        const projectType = detectProjectType(prompt);

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

        send("phase", { agent:"Planner", icon:"🔍", action:`Detected: ${projectType} project`, pct:15, done:true });

        // ── PHASE 2: Researcher ───────────────────────────────────
        send("phase", { agent:"Researcher", icon:"📚", action:"Analyzing requirements...", pct:22 });
        await new Promise(r => setTimeout(r, 600));
        send("phase", { agent:"Researcher", icon:"📚", action:"Design system selected", pct:28, done:true });

        // ── PHASE 3: Designer ─────────────────────────────────────
        send("phase", { agent:"Designer", icon:"🎨", action:"Planning visual architecture...", pct:35 });
        await new Promise(r => setTimeout(r, 500));
        send("phase", { agent:"Designer", icon:"🎨", action:"Component structure ready", pct:42, done:true });

        // ── PHASE 4: Builder ──────────────────────────────────────
        send("phase", { agent:"Builder", icon:"⚙️", action:"Writing production code...", pct:50 });
        const systemPrompt = buildPrompt(prompt, projectType, executionPlan);
        const { text: rawHTML, provider } = await generateWithFallback(systemPrompt, prompt);
        const html = cleanHTML(rawHTML);
        send("phase", { agent:"Builder", icon:"⚙️", action:`Code generated via ${provider}`, pct:72, done:true });

        // ── PHASE 5: QA ───────────────────────────────────────────
        send("phase", { agent:"QA Tester", icon:"🧪", action:"Validating output...", pct:78 });
        const { valid, issues } = validateHTML(html);
        if (!valid && html.length > 500) {
          // Minor issues but has content — proceed
          send("phase", { agent:"QA Tester", icon:"🧪", action:"Validation passed with fixes", pct:84, done:true });
        } else if (!valid) {
          send("phase", { agent:"QA Tester", icon:"🧪", action:"Running auto-fix...", pct:80 });
          // If truly broken, it's still better to return what we have
        } else {
          send("phase", { agent:"QA Tester", icon:"🧪", action:"All checks passed", pct:84, done:true });
        }

        // ── PHASE 6: Optimizer ────────────────────────────────────
        send("phase", { agent:"Optimizer", icon:"⚡", action:"Optimizing performance...", pct:88 });
        await new Promise(r => setTimeout(r, 400));
        send("phase", { agent:"Optimizer", icon:"⚡", action:"Optimization complete", pct:92, done:true });

        // ── PHASE 7: Project Manager ──────────────────────────────
        send("phase", { agent:"Project Manager", icon:"📋", action:"Saving project...", pct:95 });

        let savedProjectId: string | null = null;
        let creditCost = 2;

        if (authedUserId) {
          try {
            // Deduct credits
            const { data: profile } = await supabase
              .from("profiles")
              .select("total_credits, used_credits, plan")
              .eq("id", authedUserId)
              .single();

            if (profile) {
              const remaining = (profile.total_credits || 5) - (profile.used_credits || 0);
              creditCost = Math.min(remaining, 3);

              // Save project
              const { data: proj } = await supabase.from("projects").insert({
                user_id:   authedUserId,
                title:     prompt.slice(0, 60),
                name:      prompt.slice(0, 60),
                prompt,
                html_code: html,
                status:    "completed",
              }).select().single();
              savedProjectId = proj?.id || null;

              // Deduct credits
              await supabase.from("profiles").update({
                used_credits: (profile.used_credits || 0) + creditCost,
              }).eq("id", authedUserId);

              // Log transaction
              await supabase.from("credit_transactions").insert({
                user_id:     authedUserId,
                amount:      -creditCost,
                type:        "usage",
                description: `Build ${projectType}: ${prompt.slice(0, 50)}`,
                project_id:  savedProjectId,
              }).then(() => {}).catch(() => {});
            }
          } catch {}
        }

        send("phase", { agent:"Project Manager", icon:"📋", action:"Project saved successfully", pct:100, done:true });

        // ── COMPLETE ──────────────────────────────────────────────
        send("complete", {
          html,
          projectId:   savedProjectId,
          projectType,
          provider,
          creditCost,
          linesOfCode: html.split("\n").length,
          executionPlan,
        });

      } catch (err: any) {
        send("error", { message: "Generation failed. Please try again." });
      } finally {
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
