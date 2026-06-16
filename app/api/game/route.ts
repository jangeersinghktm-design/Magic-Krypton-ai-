/**
 * KRYPTON AI — Dedicated Game Generation API
 * New module — does NOT modify website builder
 * Uses SSE for real-time game building workflow
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  detectGameType,
  buildGameMemory,
  getGameSystemPrompt,
  formatGameMemoryForAI,
  GAME_WORKFLOW_PHASES,
  type GameProjectMemory,
} from "@/lib/game-builder";
import {
  runProductionGate,
  buildRepairInstructions,
  generateGameBlueprint,
  buildBlueprintPrompt,
  type ProductionGateResult,
  type ProjectBlueprint,
} from "@/lib/completion-engine";

export const runtime    = "edge";
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── AI Providers ────────────────────────────────────────────────────
async function callClaude(system: string, prompt: string, maxTokens: number = 8192): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(50000),
  });
  const d = await res.json();
  const text = d.content?.[0]?.text || "";
  // Fix: detect truncation — Claude returns stop_reason "max_tokens" if cut off
  if (d.stop_reason === "max_tokens") {
    return text + "\n<!--TRUNCATED-->";
  }
  return text;
}

async function callOpenAI(system: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 16000,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(50000),
  });
  const d = await res.json();
  const text = d.choices?.[0]?.message?.content || "";
  // Fix: detect truncation
  if (d.choices?.[0]?.finish_reason === "length") {
    return text + "\n<!--TRUNCATED-->";
  }
  return text;
}

async function callGemini(system: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\n${prompt}` }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
      signal: AbortSignal.timeout(50000),
    }
  );
  const d = await res.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  // Fix: detect truncation
  if (d.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    return text + "\n<!--TRUNCATED-->";
  }
  return text;
}

// Fix 2: Strip markdown code fences (handles ```html, ```, leading/trailing)
function stripMarkdownFences(text: string): string {
  let t = text.trim();
  // Remove leading ```html or ``` 
  t = t.replace(/^```(?:html|HTML)?\s*\n?/, "");
  // Remove trailing ```
  t = t.replace(/\n?```\s*$/, "");
  return t.trim();
}

// Fix 2: Validate that HTML is complete and playable — not truncated/broken
function isValidGameHTML(html: string): boolean {
  if (!html || html.length < 500) return false;
  if (html.includes("<!--TRUNCATED-->")) return false;          // explicit truncation flag
  if (!html.trim().startsWith("<!DOCTYPE")) return false;        // must start correctly
  if (!/<\/html>\s*$/i.test(html.trim())) return false;          // must end with </html>
  if (!html.includes("<canvas")) return false;                   // must have canvas
  if (!html.includes("</script>")) return false;                 // script must be closed
  // Check for nested/duplicate doctype (sign of double-wrapping)
  const doctypeCount = (html.match(/<!DOCTYPE/gi) || []).length;
  if (doctypeCount > 1) return false;
  // Check for stray markdown fences anywhere in content
  if (html.includes("```")) return false;
  return true;
}

async function generateGame(system: string, prompt: string, claudeMaxTokens: number = 8192): Promise<{ html: string; provider: string }> {
  const attempts: { provider: string; reason: string }[] = [];

  for (const [fn, name] of [[callClaude, "claude"], [callOpenAI, "openai"], [callGemini, "gemini"]] as const) {
    try {
      // Fix 6 — complex game types get a higher Claude token budget
      // (reduces truncation for skeleton+logic-heavy outputs). OpenAI/
      // Gemini keep their existing limits unchanged.
      const rawText = name === "claude"
        ? await callClaude(system, prompt, claudeMaxTokens)
        : await (fn as Function)(system, prompt);
      if (!rawText?.trim()) {
        attempts.push({ provider: name, reason: "empty response" });
        continue;
      }

      // Strip markdown fences first
      let cleaned = stripMarkdownFences(rawText);

      // Extract HTML document if not already clean
      if (!cleaned.startsWith("<!DOCTYPE")) {
        const match = cleaned.match(/<!DOCTYPE[\s\S]*?<\/html>/i);
        if (match) cleaned = stripMarkdownFences(match[0]);
      }

      // Reject truncated/incomplete output — try next provider instead of returning broken HTML
      if (!isValidGameHTML(cleaned)) {
        attempts.push({
          provider: name,
          reason: cleaned.includes("<!--TRUNCATED-->") ? "truncated (hit token limit)" : "incomplete/invalid HTML",
        });
        continue;
      }

      return { html: cleaned, provider: name };
    } catch (err: any) {
      attempts.push({ provider: name, reason: err?.message || "request failed" });
      continue;
    }
  }

  throw new Error(
    `All AI providers failed to generate a complete game. (${attempts.map(a => `${a.provider}: ${a.reason}`).join("; ")})`
  );
}

// ── Self-Healing Pass (Product Completion Engine) ─────────────────
// Takes a valid-but-incomplete game and asks the AI to add ONLY the
// missing features, without breaking what already works.
// Budget-aware: caller passes remaining ms; if too little time is
// left, this is skipped entirely and the original result is kept.
// ── Repair pass (Product Completion Engine — Auto Repair Loop) ────
// Generalized: takes the FULL repair instruction block from the
// Production Gate (missing features, syntax errors, mobile/visual
// issues), not just missing features. Returns null if budget is
// too low or the repair attempt itself produces invalid HTML.
async function repairGame(
  html: string,
  repairInstructions: string,
  systemPrompt: string,
  remainingMs: number,
  maxTokens: number = 8192
): Promise<{ html: string; provider: string } | null> {
  // Need at least 20s of budget to attempt a repair pass safely
  if (remainingMs < 20000 || !repairInstructions.trim()) return null;

  const fixPrompt = `The game below has the following issues that MUST be fixed:

${repairInstructions}

Fix ALL of the above WITHOUT removing or breaking any feature that
already works. Keep the same game type, controls, and visual style.
If there are SYNTAX ERRORS listed, fixing those is the highest priority
— a syntax error means the whole game is broken/blank. Return the
COMPLETE updated HTML file (starting with <!DOCTYPE html> and ending
with </html>).

EXISTING GAME CODE:
${html}`;

  // Try Claude first only (bounded to one provider to respect time budget)
  try {
    const raw = await callClaude(systemPrompt, fixPrompt, maxTokens);
    if (raw?.trim()) {
      let cleaned = stripMarkdownFences(raw);
      if (!cleaned.startsWith("<!DOCTYPE")) {
        const m = cleaned.match(/<!DOCTYPE[\s\S]*?<\/html>/i);
        if (m) cleaned = stripMarkdownFences(m[0]);
      }
      if (isValidGameHTML(cleaned)) return { html: cleaned, provider: "claude (repair)" };
    }
  } catch { /* fall through */ }

  return null;
}

// ── Route Handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  // Fix 6: Per-user generation lock
const activeGenerations = new Set<string>();

const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now(); // Product Completion Engine: time budget for self-heal
      const send = (event: string, data: object) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };
      const finish = () => { try { controller.close(); } catch {} };

      let authedUserId = "";  // declared outside try so finally can access it

      try {
        const { prompt, userId, accessToken, gameMemory: prevMemory } = await req.json();
        if (!prompt?.trim()) { send("error", { message: "No prompt provided" }); finish(); return; }

        // ── Auth ────────────────────────────────────────────────────
        authedUserId = userId || "";
        if (accessToken) {
          const { data: { user } } = await supabase.auth.getUser(accessToken);
          authedUserId = user?.id || userId || "";
        }

        // Fix 6: Per-user generation lock (after auth so authedUserId is set)
        if (authedUserId && activeGenerations.has(authedUserId)) {
          send("error", { message: "A generation is already running. Please wait.", code: "DUPLICATE_GEN" });
          finish(); return;
        }
        if (authedUserId) activeGenerations.add(authedUserId);

        // ── Credits ─────────────────────────────────────────────────

        if (authedUserId) {
          const { data: pc } = await supabase
            .from("profiles")
            .select("total_credits, used_credits, plan, daily_reset_date")
            .eq("id", authedUserId).single();

          if (pc) {
            const today = new Date().toISOString().split("T")[0];
            if (pc.plan === "free" && pc.daily_reset_date !== today) {
              await supabase.from("profiles").update({
                used_credits: 0, daily_reset_date: today,
              }).eq("id", authedUserId);
              pc.used_credits = 0;
            }
            const rem = (pc.total_credits || 5) - (pc.used_credits || 0);
            if (rem < 1) {
              send("error", { message: "No credits remaining. Free plan resets daily at midnight.", code: "NO_CREDITS" });
              finish(); return;
            }
          }
        }

        // ── Detect Game Type ────────────────────────────────────────
        send("phase", { ...GAME_WORKFLOW_PHASES[0], action: "Reading game request..." });
        const detected = detectGameType(prompt);

        send("phase", { ...GAME_WORKFLOW_PHASES[1], action: `Detected: ${detected.gameType} game (${detected.theme} theme)`, done: true });
        send("phase", { ...GAME_WORKFLOW_PHASES[2], action: `Designing ${detected.genre} game architecture...` });

        // Fix 5 — edit-mode protection: skip generic skeleton injection
        // when editing an existing (already-customized) game.
        const isEdit = !!prevMemory;

        // Fix 6 — complex game types get a higher Claude token budget
        // to reduce truncation (skeleton + checklist + full game logic
        // all need to fit in one response for these types).
        const COMPLEX_GAME_TYPES = new Set(["platformer", "rpg", "tower-defense", "strategy", "space-shooter"]);
        const claudeMaxTokens = COMPLEX_GAME_TYPES.has(detected.gameType) ? 12000 : 8192;

        const systemPromptBase = getGameSystemPrompt(detected.gameType, detected.theme, prompt, isEdit);

        // Product Generation Engine: Phase 2 — Blueprint Generator.
        // Build the structured project blueprint BEFORE generation —
        // the AI extends this rather than starting from a blank prompt.
        const blueprint: ProjectBlueprint = generateGameBlueprint(detected.gameType, detected.theme, prompt);
        const systemPrompt = systemPromptBase + `\n\n${buildBlueprintPrompt(blueprint)}`;

        // Include previous game memory if editing
        const memCtx = prevMemory ? formatGameMemoryForAI(prevMemory) : "";
        const fullPrompt = memCtx
          ? `${memCtx}\n\nNEW REQUEST: ${prompt}\nPreserve all existing game mechanics. Only add/change what was requested.`
          : prompt;

        send("phase", { ...GAME_WORKFLOW_PHASES[2], done: true });
        send("phase", { ...GAME_WORKFLOW_PHASES[3], action: `Building ${detected.gameType} game engine...` });

        // ── Generate Game ────────────────────────────────────────────
        // generateGame() now validates output internally and rejects
        // truncated/broken HTML, trying the next provider automatically.
        let html: string;
        let provider: string;
        try {
          const result = await generateGame(systemPrompt, fullPrompt, claudeMaxTokens);
          html = result.html;
          provider = result.provider;
        } catch (genErr: any) {
          // All 3 providers failed validation — release lock and report clearly
          if (authedUserId) activeGenerations.delete(authedUserId);
          send("error", {
            message: "Game generation failed — the AI response was incomplete. Please try again, or try a simpler game description.",
            code: "GENERATION_INCOMPLETE",
            detail: genErr?.message,
          });
          finish(); return;
        }

        send("phase", { ...GAME_WORKFLOW_PHASES[3], action: `Game built via ${provider}`, done: true });
        send("phase", { ...GAME_WORKFLOW_PHASES[4], action: "Validating gameplay..." });

        // Ensure full-screen canvas (html already validated as complete)
        if (!html.includes("innerWidth") || !html.includes("innerHeight")) {
          html = html.replace(
            /canvas\.width\s*=\s*\d+/g,
            "canvas.width = window.innerWidth"
          ).replace(
            /canvas\.height\s*=\s*\d+/g,
            "canvas.height = window.innerHeight"
          );
        }

        send("phase", { ...GAME_WORKFLOW_PHASES[4], action: "Validation passed", done: true });

        // ── Product Completion Engine: Production Gate + Auto Repair Loop ──
        send("phase", { ...GAME_WORKFLOW_PHASES[4], agent: "Validating", icon: "🧪", action: "Running production gate audit...", pct: 80 });

        let gate: ProductionGateResult = runProductionGate(html, "game", detected.gameType);
        let repairAttempts = 0;
        const MAX_REPAIR_ATTEMPTS = 2;

        while (!gate.overallPass && repairAttempts < MAX_REPAIR_ATTEMPTS) {
          const elapsed = Date.now() - startTime;
          const remainingMs = 115000 - elapsed; // edge maxDuration=120s, leave 5s buffer
          if (remainingMs < 20000) break; // out of time budget — stop repairing

          const reasons: string[] = [];
          if (!gate.buildPass)      reasons.push("build issues");
          if (!gate.runtimePass)    reasons.push("syntax errors");
          if (!gate.mobilePass)     reasons.push("mobile gaps");
          if (!gate.validationPass) reasons.push(`score ${gate.score}/100`);
          else if (gate.score < 95) reasons.push(`score ${gate.score}/95`);

          send("phase", {
            agent: "Validating", icon: "🧪",
            action: `Repair pass ${repairAttempts + 1}: fixing ${reasons.join(", ")}...`,
            pct: 82 + repairAttempts * 2,
          });

          const instructions = buildRepairInstructions(gate);
          const repaired = await repairGame(html, instructions, systemPrompt, remainingMs, claudeMaxTokens);
          repairAttempts++;

          if (!repaired) break; // repair call failed/timed out — keep current result

          const repairedGate = runProductionGate(repaired.html, "game", detected.gameType);
          // Keep whichever scores higher (never regress)
          if (repairedGate.score > gate.score) {
            html = repaired.html;
            gate = repairedGate;
            provider = `${provider} → ${repaired.provider}`;
            if (!html.includes("innerWidth") || !html.includes("innerHeight")) {
              html = html.replace(/canvas\.width\s*=\s*\d+/g, "canvas.width = window.innerWidth")
                         .replace(/canvas\.height\s*=\s*\d+/g, "canvas.height = window.innerHeight");
            }
          }
        }

        send("phase", {
          agent: "Validating", icon: "🧪",
          action: `Production Gate: ${gate.score}/100${gate.overallPass ? " ✅ all gates passed" : repairAttempts > 0 ? ` (after ${repairAttempts} repair pass${repairAttempts>1?"es":""})` : ""}`,
          pct: 86, done: true,
        });

        send("phase", { ...GAME_WORKFLOW_PHASES[5], action: "Optimizing game performance..." });

        // ── Save to DB ──────────────────────────────────────────────
        let savedProjectId: string | null = null;
        let creditCost = 2;

        if (authedUserId) {
          // Profile lookup — for credit accounting only. A failure here
          // (missing profiles row, bad column name, etc.) must NOT block
          // project persistence below — that's the "Total Projects = 0"
          // bug. Logging the error surfaces the EXACT cause (e.g. a
          // missing column name) in server logs on the next generation.
          const { data: profile, error: profileError } = await supabase.from("profiles")
            .select("total_credits, used_credits, plan, daily_reset_date")
            .eq("id", authedUserId).single();

          if (profileError) {
            console.error(`[game/route] profiles lookup failed for user ${authedUserId}:`, profileError.message || profileError);
          }

          if (profile) {
            const remaining = (profile.total_credits || 5) - (profile.used_credits || 0);
            creditCost = Math.min(remaining, 2);
          }

          // Project persistence — ALWAYS attempted, independent of the
          // profile lookup above and its result.
          const { data: proj, error: projError } = await supabase.from("projects").insert({
            user_id:    authedUserId,
            title:      prompt.slice(0, 60),
            name:       prompt.slice(0, 60),
            prompt,
            html_content: html,
            type: "game",
            status:     "completed",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).select().single();

          if (projError) {
            console.error(`[game/route] projects insert FAILED for user ${authedUserId}:`, projError.message || projError);
          }
          savedProjectId = proj?.id || null;

          // Credit deduction — separate concern, only when profile lookup
          // succeeded. Its own failure is logged but doesn't affect the
          // project that was already saved above.
          if (profile) {
            const today = new Date().toISOString().split("T")[0];
            const { error: updateError } = await supabase.from("profiles").update({
              used_credits: (profile.used_credits || 0) + creditCost,
              daily_reset_date: today,
            }).eq("id", authedUserId);
            if (updateError) {
              console.error(`[game/route] profiles credit update failed for user ${authedUserId}:`, updateError.message || updateError);
            }
          }
        }

        // ── Build Game Memory ───────────────────────────────────────
        const gameMemory = buildGameMemory(html, prompt, detected, prevMemory);

        send("phase", { ...GAME_WORKFLOW_PHASES[5], done: true });
        send("phase", { ...GAME_WORKFLOW_PHASES[6], action: "Game ready!", done: true });

        send("complete", {
          html,
          projectId:  savedProjectId,
          creditCost,
          provider,
          gameType:   detected.gameType,
          genre:      detected.genre,
          theme:      detected.theme,
          techStack:  detected.techStack,
          gameMemory,
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
        send("error", { message: err.message || "Game generation failed. Try again.", code: "GENERATION_ERROR" });
      } finally {
        // Fix 6: Always release lock
        if (authedUserId) activeGenerations.delete(authedUserId);
      }
      finish();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      Connection:      "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
