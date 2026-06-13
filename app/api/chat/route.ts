// app/api/chat/route.ts — Krypton AI v6 — Enterprise Chat Engine
// 3-Layer AI Fallback: Claude → OpenAI → Gemini
// Smart Code Editing: Read → Diff → Patch → Rebuild

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── System Prompt ────────────────────────────────────────────────
const CHAT_SYSTEM = `You are Krypton AI — an elite senior software engineer with 20 years of experience.
You are the AI assistant inside a code editor. You have full context of the user's project.

## YOUR CAPABILITIES:
- Read and understand any code instantly
- Make precise, surgical edits without breaking existing functionality
- Add new features seamlessly
- Fix bugs and optimize performance
- Improve design and UX
- Explain technical concepts clearly

## HOW TO HANDLE EDIT REQUESTS:

### For CODE CHANGES ("change button color", "add animation", "fix the navigation"):
1. Identify the exact lines/sections that need changing
2. Return the COMPLETE updated file — not partial snippets
3. Wrap code in: <code_changes>{"filename": "complete updated content"}</code_changes>
4. Explain what you changed in 1-2 sentences

### For QUESTIONS ("how does this work", "explain the structure"):
- Answer concisely and technically
- No code_changes block needed

### For FEATURE ADDITIONS ("add dark mode", "add a login page", "add animations"):
- Plan the feature briefly
- Return full updated code with the new feature integrated
- Wrap in <code_changes> block

## EDIT PRINCIPLES:
- NEVER break existing functionality  
- If KRYPTON PROJECT MEMORY is provided: treat it as absolute truth about the existing design
- ALWAYS preserve: colors, fonts, CSS variables, layout structure, existing sections
- ONLY change what the user explicitly requested — nothing more
- New elements must match the existing design system perfectly
- When in doubt, preserve existing design over introducing new patterns
- Make the minimum change needed to achieve the goal
- Improve code quality opportunistically (fix obvious issues)
- Keep consistent naming conventions and code style

## LANGUAGE RULE:
- ALL generated content MUST be in English
- Never output non-English text in code

## RESPONSE FORMAT:
For code changes:
[Brief 1-2 line explanation of what you changed]
<code_changes>{"index.html": "complete html file content here"}</code_changes>

For questions: Just answer clearly. No code block needed.

Be concise, professional, and precise. You are a senior engineer — not a chatbot.`;

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
      max_tokens: 8000,
      system,
      messages,
    }),
    signal: AbortSignal.timeout(55000),
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
      max_tokens: 8000,
      messages: [{ role: "system", content: system }, ...messages],
    }),
    signal: AbortSignal.timeout(55000),
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: combined,
        generationConfig: { maxOutputTokens: 8000, temperature: 0.5 },
      }),
      signal: AbortSignal.timeout(55000),
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

    // Choose system prompt: game edits get specialized game engineer prompt
    const isGameEdit = framework === "game" || !!gameMemory;

    const actualMessage = userMessage || message || "";
    if (!actualMessage?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build code context (max 8000 chars to save tokens)
    const codeContext = Object.entries(currentCode as Record<string, string>)
      .map(([file, code]) => `### ${file}\n\`\`\`\n${code.slice(0, 5000)}\n\`\`\``)
      .join("\n")
      .slice(0, 8000);

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
    // Game edits use specialized system prompt with strict preservation rules
    const SYSTEM = isGameEdit ? GAME_EDIT_SYSTEM : CHAT_SYSTEM;
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
