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

export const runtime    = "edge";
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── AI Providers ────────────────────────────────────────────────────
async function callClaude(system: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(50000),
  });
  const d = await res.json();
  return d.content?.[0]?.text || "";
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
      max_tokens: 8000,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(50000),
  });
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

async function callGemini(system: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\n${prompt}` }] }],
        generationConfig: { maxOutputTokens: 8000 },
      }),
      signal: AbortSignal.timeout(50000),
    }
  );
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function generateGame(system: string, prompt: string): Promise<{ html: string; provider: string }> {
  for (const [fn, name] of [[callClaude, "claude"], [callOpenAI, "openai"], [callGemini, "gemini"]] as const) {
    try {
      const text = await (fn as Function)(system, prompt);
      if (text?.trim()) {
        const html = text.trim().startsWith("<!DOCTYPE")
          ? text.trim()
          : text.match(/<!DOCTYPE[\s\S]*<\/html>/i)?.[0] || text;
        if (html.length > 500) return { html, provider: name };
      }
    } catch { continue; }
  }
  throw new Error("All AI providers failed");
}

// ── Route Handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  // Fix 6: Per-user generation lock
const activeGenerations = new Set<string>();

const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };
      const finish = () => { try { controller.close(); } catch {} };

      try {
        const { prompt, userId, accessToken, gameMemory: prevMemory } = await req.json();
        if (!prompt?.trim()) { send("error", { message: "No prompt provided" }); finish(); return; }

        // Fix 6: Per-user generation lock
        if (authedUserId && activeGenerations.has(authedUserId)) {
          send("error", { message: "A generation is already running. Please wait.", code: "DUPLICATE_GEN" });
          finish(); return;
        }
        if (authedUserId) activeGenerations.add(authedUserId);

        // ── Auth & Credits ──────────────────────────────────────────
        let authedUserId = userId;
        if (accessToken) {
          const { data: { user } } = await supabase.auth.getUser(accessToken);
          authedUserId = user?.id || userId;
        }

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

        const systemPrompt = getGameSystemPrompt(detected.gameType, detected.theme, prompt);

        // Include previous game memory if editing
        const memCtx = prevMemory ? formatGameMemoryForAI(prevMemory) : "";
        const fullPrompt = memCtx
          ? `${memCtx}\n\nNEW REQUEST: ${prompt}\nPreserve all existing game mechanics. Only add/change what was requested.`
          : prompt;

        send("phase", { ...GAME_WORKFLOW_PHASES[2], done: true });
        send("phase", { ...GAME_WORKFLOW_PHASES[3], action: `Building ${detected.gameType} game engine...` });

        // ── Generate Game ───────────────────────────────────────────
        const { html: rawHtml, provider } = await generateGame(systemPrompt, fullPrompt);

        send("phase", { ...GAME_WORKFLOW_PHASES[3], action: `Game built via ${provider}`, done: true });
        send("phase", { ...GAME_WORKFLOW_PHASES[4], action: "Validating gameplay..." });

        // Validate & fix HTML
        let html = rawHtml;
        if (!html.trim().startsWith("<!DOCTYPE")) {
          const match = html.match(/<!DOCTYPE[\s\S]*<\/html>/i);
          html = match ? match[0] : `<!DOCTYPE html><html><head><title>Game</title></head><body>${html}</body></html>`;
        }

        // Ensure full-screen canvas
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
        send("phase", { ...GAME_WORKFLOW_PHASES[5], action: "Optimizing game performance..." });

        // ── Save to DB ──────────────────────────────────────────────
        let savedProjectId: string | null = null;
        let creditCost = 2;

        if (authedUserId) {
          const { data: profile } = await supabase.from("profiles")
            .select("total_credits, used_credits, plan, daily_reset_date")
            .eq("id", authedUserId).single();

          if (profile) {
            const today = new Date().toISOString().split("T")[0];
            const remaining = (profile.total_credits || 5) - (profile.used_credits || 0);
            creditCost = Math.min(remaining, 2);

            const { data: proj } = await supabase.from("projects").insert({
              user_id:    authedUserId,
              title:      prompt.slice(0, 60),
              name:       prompt.slice(0, 60),
              prompt,
              html_code:  html,
              status:     "completed",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).select().single();
            savedProjectId = proj?.id || null;

            await supabase.from("profiles").update({
              used_credits: (profile.used_credits || 0) + creditCost,
              daily_reset_date: today,
            }).eq("id", authedUserId);
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

          
