// app/api/chat/route.ts — Krypton AI v6 — Enterprise Chat Engine
// 3-Layer AI Fallback: Claude → OpenAI → Gemini
// Smart Code Editing: Read → Diff → Patch → Rebuild

import { NextRequest, NextResponse } from "next/server";
import {
  renderComponent, getDefaultVariant, buildComponentContext,
  buildRootTokens, type ComponentCategory,
} from "@/lib/component-library";

export const runtime = "nodejs";
export const maxDuration = 120; // raised from 60s — edits now use 24k max_tokens (was 8k)

// ── System Prompt ────────────────────────────────────────────────
// ── V6: Detect content-only edits ───────────────────────────────────────
// Content edits: change headline, update CTA text, edit pricing, update copy.
// Structural edits: change colors, add animations, fix layout, debug, upgrade.
// Only content edits use the component JSON path — structural edits use full HTML.
function detectContentEdit(message: string): boolean {
  const m = message.toLowerCase();
  const contentSignals = [
    "headline", "heading", "title", "tagline",
    "cta text", "button text", "call to action",
    "pricing", "plan name", "tier", "feature list",
    "testimonial", "quote", "review",
    "faq", "question", "answer",
    "update the text", "change the text", "change the copy",
    "update the copy", "rewrite the", "change the headline",
    "update headline", "update cta", "change cta",
    "subheadline", "description", "paragraph",
    "update the pricing", "change pricing",
  ];
  const structuralSignals = [
    "color", "background", "dark", "light", "theme",
    "animation", "animate", "transition", "fade",
    "layout", "spacing", "padding", "margin",
    "font size", "responsive", "mobile",
    "add section", "remove section", "add a new",
    "debug", "fix", "broken", "error", "issue",
    "upgrade", "improve", "add feature",
    "menu", "navbar", "navigation",
  ];
  const hasContent    = contentSignals.some(s => m.includes(s));
  const hasStructural = structuralSignals.some(s => m.includes(s));
  return hasContent && !hasStructural;
}

// ── V6: Component content edit system prompt ─────────────────────────────
const CONTENT_EDIT_SYSTEM = `You are Krypton AI's content editor. You update website copy — NEVER HTML.

Input: JSON object with component content (hero, features, pricing, etc.)
Task: Update ONLY the fields the user asks to change.
Output: A JSON patch with ONLY the changed fields.

RULES:
- Return ONLY valid JSON — no markdown, no explanation, no HTML
- Include ONLY the fields you are changing
- Preserve all other fields exactly as they are
- If adding a new FAQ item, include the full items array
- Never output HTML, CSS, or JavaScript

OUTPUT FORMAT (only changed fields):
{"hero":{"headline":"new headline here"}}`;

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
      max_tokens: 24000,
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
      max_tokens: 24000,
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
// ── V6 helpers ──────────────────────────────────────────────────────────
function deepMerge(base: Record<string,any>, patch: Record<string,any>): Record<string,any> {
  const result = { ...base };
  for (const key of Object.keys(patch)) {
    if (patch[key] && typeof patch[key] === "object" && !Array.isArray(patch[key]) &&
        base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
      result[key] = deepMerge(base[key], patch[key]);
    } else {
      result[key] = patch[key];
    }
  }
  return result;
}

// Minimal inline JS for component-rebuilt pages
const STATIC_JS_INLINE = `
document.querySelectorAll('.hamburger').forEach(b=>b.addEventListener('click',()=>document.querySelectorAll('.nav-links').forEach(n=>n.classList.toggle('open'))));
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{var t=document.querySelector(a.getAttribute('href'));if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'});}}));
var ro=new IntersectionObserver(e=>{e.forEach(x=>{if(x.isIntersecting){x.target.classList.add('visible');ro.unobserve(x.target);}});},{threshold:0.1});
document.querySelectorAll('.reveal').forEach(el=>ro.observe(el));
document.querySelectorAll('.faq-question').forEach(q=>{q.addEventListener('click',()=>{var a=q.nextElementSibling;var open=q.classList.contains('active');document.querySelectorAll('.faq-question').forEach(oq=>{oq.classList.remove('active');var oa=oq.nextElementSibling;if(oa)oa.classList.remove('open');});if(!open&&a){q.classList.add('active');a.classList.add('open');}});});
window.addEventListener('scroll',()=>document.querySelectorAll('nav').forEach(n=>n.classList.toggle('scrolled',window.scrollY>50)),{passive:true});
`.trim();

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
      componentContent = null, // V6: component JSON from generation (if available)
      niche = null,            // V6: NicheProfile for re-render
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

    // ── V6: Component-level content edit (if componentContent available) ──
    const isContentEdit = !isGameEdit && !isDebugMode && !isUpgradeMode
                        && !!componentContent && !!niche
                        && detectContentEdit(actualMessage);

    if (isContentEdit) {
      // Route: AI patches JSON → renderComponent() rebuilds HTML
      const patchMessages = [
        ...history.slice(-8).map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        })),
        {
          role: "user" as const,
          content: `Current component content JSON:
${JSON.stringify(componentContent, null, 2).slice(0, 6000)}

Edit request: ${actualMessage}

Return ONLY the changed fields as JSON.`,
        },
      ];

      let patchText = "";
      let patchProvider = "claude";
      for (const p of [
        { name: "claude",  fn: () => callClaude(patchMessages,  CONTENT_EDIT_SYSTEM) },
        { name: "openai",  fn: () => callOpenAI(patchMessages,  CONTENT_EDIT_SYSTEM) },
        { name: "gemini",  fn: () => callGemini(patchMessages,  CONTENT_EDIT_SYSTEM) },
      ]) {
        try { patchText = await p.fn(); patchProvider = p.name; break; } catch {}
      }

      if (patchText) {
        try {
          const raw     = patchText.replace(/```json|```/g, "").trim();
          const patch   = JSON.parse(raw.match(/\{[\s\S]+\}/)?.[0] || raw);
          // Deep-merge patch into componentContent
          const updated = deepMerge(componentContent as Record<string, any>, patch);

          // Re-render affected components only
          const nicheProfile = niche as any;
          const ctx          = buildComponentContext(nicheProfile?.palette?.primary || "#6366F1");
          const tone         = nicheProfile?.tone || "default";
          let   rebuiltSections = "";

          const order: ComponentCategory[] = [
            "navbar","hero","features","testimonials","pricing","faq",
            "portfolio","ecommerce","cta","footer",
          ];
          for (const cat of order) {
            const content = (updated as any)[cat];
            if (!content) continue;
            rebuiltSections += renderComponent(cat, getDefaultVariant(cat, tone), ctx, content);
          }

          if (rebuiltSections && rebuiltSections.length > 100) {
            const rootTokens = buildRootTokens(nicheProfile);
            const newHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${rootTokens}</style></head><body>${rebuiltSections}<script>${STATIC_JS_INLINE}</script></body></html>`;
            return NextResponse.json({
              text:             `Updated ${Object.keys(patch).join(", ")} in your website.`,
              reply:            `Updated ${Object.keys(patch).join(", ")} in your website.`,
              codeChanges:      { "index.html": newHtml },
              updatedComponent: updated,
              provider:         patchProvider,
            });
          }
        } catch (e) {
          console.warn("[Chat V6] Component patch failed, falling back to HTML edit:", e);
          // Fall through to standard HTML edit below
        }
      }
    }

    // Build code context — full file content, no artificial truncation.
    // PREVIOUS BUG: this was capped at 5000 chars/file + 8000 chars total.
    // Generated sites are now routinely 25,000-50,000+ chars (Component
    // Library output is richer than before). The AI was editing while
    // BLIND to most of the actual file, then returning a "complete updated
    // file" that hallucinated the unseen portions — causing the Build/
    // Validation/Runtime/Mobile gates to all fail after nearly every edit.
    const codeContext = Object.entries(currentCode as Record<string, string>)
      .map(([file, code]) => `### ${file}\n\`\`\`\n${code.slice(0, 60000)}\n\`\`\``)
      .join("\n")
      .slice(0, 100000);

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
