// app/api/chat/route.ts — Krypton AI v6 — Enterprise Chat Engine
// 3-Layer AI Fallback: Claude → OpenAI → Gemini
// Smart Code Editing: Read → Diff → Patch → Rebuild

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120; // raised from 60s — edits now use 24k max_tokens (was 8k)

// ── System Prompt ────────────────────────────────────────────────
const CHAT_SYSTEM = `You are Krypton AI — an elite website editor. You receive a website's full HTML and a user's edit request in English, Hindi, or Hinglish. You return the complete updated HTML.

## UNDERSTANDING EDIT REQUESTS:
Users may write in English, Hindi, or mixed (Hinglish). Always understand the intent:

### COLOR CHANGES:
- "background change karo golden" → change background-color/background to gold (#D4A853 or golden gradient)
- "button golden bana do" → change button background to gold color  
- "text white kar do" → change text color to #FFFFFF
- "dark theme karo" → change background to dark (#050816 or similar)
- "gradient lagao" → add a linear-gradient background
- Any color name (red/lal, blue/neela, green/hara, golden/sona, white/safed, black/kala) → apply that color

### SIZE/TYPOGRAPHY:
- "heading bada karo" → increase h1/h2 font-size by 20-30%
- "font size badhao" → increase body font-size
- "text chhota karo" → decrease font-size
- "bold karo" → add font-weight: 700 or 800

### LAYOUT/SPACING:
- "spacing badha do" → increase padding/margin
- "full width karo" → make section width 100%
- "center karo" → add text-align: center or margin: auto

### STYLE EFFECTS:
- "animation lagao" → add CSS transitions/keyframes
- "shadow lagao" → add box-shadow
- "border lagao" → add border
- "rounded karo" → add border-radius
- "glassmorphism" → add backdrop-filter: blur + semi-transparent background

## RESPONSE FORMAT:
1. Make the edit in the HTML
2. Return the COMPLETE updated HTML
3. Wrap in: <code_changes>{"index.html": "complete updated html"}</code_changes>
4. One line explanation of what changed

## CRITICAL RULES:
- ALWAYS return the complete HTML — never partial
- Preserve ALL existing sections, content, and functionality
- Only change what was requested
- If color requested: change ONLY those color properties
- If size requested: change ONLY those size properties
- Never remove sections unless explicitly asked
- Keep all existing CSS variables in :root
- New styles should match the existing design quality`;

// ── Provider Calls ───────────────────────────────────────────────
async function callClaude(messages: any[], system: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Claude not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system,
      messages,
    }),
    signal: AbortSignal.timeout(95000),
  });

  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  const text = data.content?.map((b: any) => b.text || "").join("") || "";
  if (!text.trim()) throw new Error("Claude empty response");
  return text;
}

async function callOpenAI(messages: any[], system: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 16000,
      messages: [{ role: "system", content: system }, ...messages],
    }),
    signal: AbortSignal.timeout(95000),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text.trim()) throw new Error("OpenAI empty response");
  return text;
}

async function callGemini(messages: any[], system: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini not configured");

  // Combine history + system for Gemini
  const combined = [
    { role: "user", parts: [{ text: system + "\n\nUser: " + messages[messages.length - 1]?.content || "" }] },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: combined,
        generationConfig: { maxOutputTokens: 24000, temperature: 0.5 },
      }),
      signal: AbortSignal.timeout(95000),
    }
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text.trim()) throw new Error("Gemini empty response");
  return text;
}

// ── Game Edit System Prompt ──────────────────────────────────────
const GAME_EDIT_SYSTEM = `You are Krypton Game Engineer — expert browser game developer making a SURGICAL edit.

ABSOLUTE RULES:
1. Return the COMPLETE updated HTML — every single line, no truncation
2. Preserve ALL existing: game loop, physics, controls, collision, scoring, sound, particles
3. Change ONLY what was explicitly requested — nothing else
4. Keep full-screen canvas: canvas.width = window.innerWidth
5. Keep all: lives, levels, powerups, mobile touch controls, high score localStorage
6. Wrap in: <code_changes>{"index.html": "complete html content"}</code_changes>

Even for large files (800-1200 lines) — return the COMPLETE file, never truncate.
The game must remain fully playable after your edit.`;

// ── Debug Mode System Prompt ────────────────────────────────────
const DEBUG_SYSTEM = `You are Krypton Debug Engineer — expert at finding and fixing web code issues.

TASK: Analyze the provided HTML/CSS/JS code and fix ALL issues found.

WHAT TO LOOK FOR:
1. JavaScript errors (undefined variables, missing functions, broken event listeners)
2. CSS issues (broken layout, overflow, missing styles, z-index conflicts)
3. HTML structure problems (unclosed tags, wrong nesting, missing elements)
4. Mobile/responsive issues (no media queries, overflow, tiny touch targets)
5. Broken interactions (buttons that don't work, forms that don't submit)
6. Console errors (missing resources, failed fetches)
7. Performance issues (heavy DOM operations, missing lazy loading)

OUTPUT:
- List all issues found (numbered)
- Fix ALL of them in the returned code
- Explain each fix briefly
- Return COMPLETE fixed file

RULES:
1. Do NOT change design/colors/fonts unless they're broken
2. Do NOT change content or text
3. Return COMPLETE file: <code_changes>{"index.html": "complete fixed content"}</code_changes>`;

// ── Upgrade Mode System Prompt ───────────────────────────────────
const UPGRADE_SYSTEM = `You are Krypton Upgrade Engineer — expert at enhancing web projects.

TASK: Upgrade the provided project by adding premium features and improvements.

UPGRADES TO APPLY:
1. Add smooth scroll animations (IntersectionObserver on all sections)
2. Add hover micro-interactions on all cards and buttons
3. Improve visual hierarchy (spacing, typography scale)
4. Add loading states and transitions
5. Add keyboard navigation support
6. Improve mobile experience (better touch targets, spacing)
7. Add missing sections if gaps exist (FAQ, testimonials, footer)
8. Improve CTA prominence and conversion elements

RULES:
1. Preserve ALL existing content and design language
2. Only ADD/IMPROVE — never remove existing functionality
3. Match existing color scheme and fonts exactly
4. Return COMPLETE upgraded file

Return: <code_changes>{"index.html": "complete upgraded content"}</code_changes>`;

// ── Main Route ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      projectName = "Untitled Project",
      framework = "html",
      currentCode = {},
      userMessage,
      history = [],
      projectId,
      projectContext = "", // Krypton Project Memory
      gameMemory = null,  // GameProjectMemory object for game edits
      message,
    } = await req.json();

    // Choose system prompt based on mode
    const isGameEdit = framework === "game" || !!gameMemory;
    const isDebugMode   = userMessage?.toLowerCase().startsWith("[debug]") || message?.toLowerCase().startsWith("[debug]");
    const isUpgradeMode = userMessage?.toLowerCase().startsWith("[upgrade]") || message?.toLowerCase().startsWith("[upgrade]");

    const actualMessage = userMessage || message || "";
    if (!actualMessage?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build code context — full file content, no artificial truncation.
    // PREVIOUS BUG: this was capped at 5000 chars/file + 8000 chars total.
    // Generated sites are now routinely 25,000-50,000+ chars (Component
    // Library output is richer than before). The AI was editing while
    // BLIND to most of the actual file, then returning a "complete updated
    // file" that hallucinated the unseen portions — causing the Build/
    // Validation/Runtime/Mobile gates to all fail after nearly every edit.
    const // Send max 25k chars — enough for full HTML while avoiding timeouts
      codeContext = Object.entries(currentCode as Record<string, string>)
      .map(([file, code]) => `### ${file}\n\`\`\`\n${code.slice(0, 25000)}\n\`\`\``)
      .join("\n")
      .slice(0, 30000);

    // Build conversation history
    const historyMessages = history.slice(-8).map((m: any) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: String(m.content).slice(0, 1000),
    }));

    // Build game memory context if this is a game edit
    const gameCtx = gameMemory
      ? `GAME MEMORY:\nType: ${gameMemory.gameType} | Theme: ${gameMemory.theme} | Genre: ${gameMemory.genre}\nFeatures: ${(gameMemory.features||[]).join(", ")}\nControls: ${gameMemory.controls}\nPRESERVE ALL ABOVE EXACTLY\n\n`
      : "";

    const memCtx = gameCtx || (projectContext ? projectContext + "\n\n" : "");

    const userContent = codeContext
      ? `${memCtx}Project: ${projectName} (${isGameEdit ? "browser game" : framework})

${isGameEdit ? "GAME CODE (preserve all mechanics):" : "Current Code:"}
${codeContext}

${isGameEdit ? "GAME EDIT REQUEST" : "Edit Request"}: ${actualMessage}`
      : actualMessage;

    const messages = [
      ...historyMessages,
      { role: "user" as const, content: userContent },
    ];

    // ── 3-Layer AI Cascade ────────────────────────────────────
    const SYSTEM = isGameEdit   ? GAME_EDIT_SYSTEM
                 : isDebugMode   ? DEBUG_SYSTEM
                 : isUpgradeMode ? UPGRADE_SYSTEM
                 : CHAT_SYSTEM;
    const providers = [
      { name: "claude", fn: () => callClaude(messages, SYSTEM) },
      { name: "openai", fn: () => callOpenAI(messages, SYSTEM) },
      { name: "gemini", fn: () => callGemini(messages, SYSTEM) },
    ];

    let responseText = "";
    let usedProvider = "claude";

    for (const provider of providers) {
      try {
        responseText = await provider.fn();
        usedProvider = provider.name;
        break;
      } catch {
        continue;
      }
    }

    if (!responseText) {
      return NextResponse.json({
        text: "I'm having trouble connecting right now. Please try again in a moment.",
        reply: "I'm having trouble connecting right now. Please try again in a moment.",
        codeChanges: null,
      });
    }

    // ── Parse Code Changes ────────────────────────────────────
    const codeMatch = responseText.match(/<code_changes>([\s\S]*?)<\/code_changes>/);
    let codeChanges: Record<string, string> | null = null;

    if (codeMatch) {
      try {
        codeChanges = JSON.parse(codeMatch[1].trim());
      } catch {
        // Try to extract HTML directly if JSON parse fails
        const htmlMatch = codeMatch[1].match(/<!DOCTYPE[\s\S]*<\/html>/i);
        if (htmlMatch) {
          codeChanges = { "index.html": htmlMatch[0] };
        }
      }
    }

    // Clean display text
    const cleanText = responseText
      .replace(/<code_changes>[\s\S]*?<\/code_changes>/g, "")
      .trim();

    return NextResponse.json({
      text: cleanText,
      reply: cleanText,        // Alias for simple chatbot usage
      codeChanges,
      provider: usedProvider,
    });

  } catch (err: any) {
    console.error("[Chat] Error:", err);
    return NextResponse.json({
      text: "Something went wrong. Please try again.",
      reply: "Something went wrong. Please try again.",
      codeChanges: null,
    });
  }
}
