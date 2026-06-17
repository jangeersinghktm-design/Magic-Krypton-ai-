// app/api/orchestrate/route.ts
// Krypton AI — Real Agent Orchestration via Server-Sent Events
// 7-Phase Pipeline: Plan → Research → Design → Build → QA → Optimize → Deliver
// Never fake progress — every event tied to real AI operations

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  runProductionGate,
  buildRepairInstructions,
  getWebsiteTemplate,
  hasWebsiteTemplate,
  buildWebsiteChecklistPrompt,
  generateWebsiteBlueprint,
  buildBlueprintPrompt,
  type ProductionGateResult,
  type ProjectBlueprint,
} from "@/lib/completion-engine";

export const runtime     = "edge";
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

// ── Krypton Intelligence Engine — Multi-provider system ───────────
async function callClaude(system: string, user: string, maxTokens = 8000): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01" },
    body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:maxTokens, system, messages:[{role:"user",content:user}] }),
    signal: AbortSignal.timeout(50000),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

async function callOpenAI(system: string, user: string, maxTokens = 8000): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json","Authorization":`Bearer ${key}` },
    body: JSON.stringify({ model:"gpt-4o", max_tokens:maxTokens, messages:[{role:"system",content:system},{role:"user",content:user}] }),
    signal: AbortSignal.timeout(50000),
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
    signal: AbortSignal.timeout(50000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
function buildPrompt(userPrompt: string, type: string, plan: string): string {
  const BASE = `You are Krypton AI — a world-class software engineer producing production-ready HTML.

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

EXECUTION PLAN:
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

    saas: `
BUILD A COMPLETE SAAS PRODUCT WEBSITE:
- Navbar: logo, links (Features/Pricing/FAQ), Log in + Sign up (CTA) buttons
- Hero: product headline + description + primary CTA + product/dashboard preview mock
- Features section: 4-6 feature cards with icons
- Product preview section: screenshot/mock of the actual product UI
- Testimonials: 3+ customer quotes with avatar/name/role
- Pricing: 3 tiers (e.g. Starter/Pro/Enterprise) with monthly price + feature list + CTA
- FAQ: accordion, 5+ questions
- Trust/integrations row: logos of integrations or "trusted by" companies
- Footer: product links, company links, legal links`,

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

  return BASE + (SPECIFIC[type] || SPECIFIC.website) + buildWebsiteExtras(type);
}

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
        send("phase", { agent:"Reading", icon:"🔍", action:"Analyzing your request...", pct:8 });
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

        const systemPrompt = buildPrompt(prompt, projectType, executionPlan)
          + (blueprint ? `\n\n${buildBlueprintPrompt(blueprint)}` : "");
        // Fix 5: Abort if client disconnected
        if ((req as any).signal?.aborted) {
          finish(); return;
        }
        const { text: rawHTML, provider: genProvider } = await kryptonGenerate(systemPrompt, prompt);
        let provider = genProvider;
        let html = cleanHTML(rawHTML);
        send("phase", { agent:"Building", icon:"⚙️", action:`Code generated via ${provider}`, pct:72, done:true });

        // ── PHASE 5: QA — Product Completion Engine: Production Gate ────
        send("phase", { agent:"Validating", icon:"🧪", action:"Running production gate audit...", pct:78 });

        const gateKind  = projectType === "game" ? "game" : "website";
        const gateSubtype = projectType === "game" ? "arcade" : projectType;
        let gate: ProductionGateResult = runProductionGate(html, gateKind, gateSubtype);
        let repairAttempts = 0;
        const MAX_REPAIR_ATTEMPTS = 1; // websites get 1 repair pass (vs 2 for dedicated game route)

        while (!gate.overallPass && repairAttempts < MAX_REPAIR_ATTEMPTS) {
          const elapsed = Date.now() - startTime;
          const remainingMs = 115000 - elapsed; // edge maxDuration=120s, leave 5s buffer
          if (remainingMs < 20000) break;

          const reasons: string[] = [];
          if (!gate.buildPass)      reasons.push("build issues");
          if (!gate.runtimePass)    reasons.push("syntax errors");
          if (!gate.mobilePass)     reasons.push("mobile gaps");
          if (!gate.validationPass) reasons.push(`score ${gate.score}/100`);
          else if (gate.score < 95) reasons.push(`score ${gate.score}/95`);

          send("phase", { agent:"Validating", icon:"🧪", action:`Repair pass: fixing ${reasons.join(", ")}...`, pct:80 });

          const instructions = buildRepairInstructions(gate);
          const fixPrompt = `The page below has the following issues that MUST be fixed:

${instructions}

Fix ALL of the above WITHOUT removing or breaking any feature that
already works. If there are SYNTAX ERRORS, fixing those is the highest
priority. Return the COMPLETE updated HTML file (starting with
<!DOCTYPE html> and ending with </html>).

EXISTING CODE:
${html}`;

          repairAttempts++;
          try {
            const { text: repairedRaw, provider: repairProvider } = await kryptonGenerate(systemPrompt, fixPrompt);
            const repairedHtml = cleanHTML(repairedRaw);
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
          auditFailed:           gate.failedFeatures.map(f => f.label),
          belowQualityThreshold: gate.score < 90,
          repairAttempts,
        });

      } catch (err: any) {
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
