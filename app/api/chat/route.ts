// app/api/chat/route.ts
// Krypton AI — Production-Grade Intent-Based Editing Engine
// Version: 2.0
//
// ARCHITECTURE:
//   1. Detect intent (STYLE/CONTENT/LAYOUT/COMPONENT/DEBUG/GAME)
//   2. Extract minimum context for that intent
//   3. Claude primary — retry 3x with exponential backoff
//   4. Server patches result into full HTML
//   5. Validate patch — ask Claude to repair if invalid
//   6. OpenAI/Gemini only after all Claude attempts fail
//   7. Return complete valid HTML always

import { NextRequest, NextResponse } from "next/server";

export const runtime    = "nodejs";
export const maxDuration = 120;

// ── Types ────────────────────────────────────────────────────────
type EditIntent =
  | "STYLE_EDIT"
  | "CONTENT_EDIT"
  | "LAYOUT_EDIT"
  | "COMPONENT_EDIT"
  | "DEBUG_EDIT"
  | "GAME_EDIT";

interface EditLog {
  intent:     EditIntent;
  provider:   string;
  attempts:   number;
  repairRan:  boolean;
  patchSize:  number;
  validation: ValidationResult;
  durationMs: number;
}

interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

// ── Section Registry — built ONCE, before any AI call ────────────────────
// Deterministic source of truth for "what sections exist and where".
// Every handler resolves its target against THIS, never against AI guesses.
interface SectionEntry {
  sectionId: string;       // data-section value (or id fallback)
  component: string;       // data-component value (or sectionId fallback)
  outerHTML: string;       // exact current HTML of this <section>...</section>
  hash:      string;       // cheap content fingerprint, used to verify only
                            // the target changed and nothing else did
}

function hashHtml(s: string): string {
  // Non-cryptographic, fast, deterministic — only used to detect "did this
  // exact block of HTML change", not for security.
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return `${s.length}:${h}`;
}

function buildSectionRegistry(html: string): SectionEntry[] {
  const matches = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi)];
  const entries: SectionEntry[] = [];
  for (const m of matches) {
    const outer = m[0];
    const openTag = outer.match(/<section\b[^>]*>/i)?.[0] || "";
    const dataSection = openTag.match(/data-section=["']([^"']+)["']/i)?.[1];
    const dataComponent = openTag.match(/data-component=["']([^"']+)["']/i)?.[1];
    const idAttr = openTag.match(/\bid=["']([^"']+)["']/i)?.[1];
    const sectionId = dataSection || idAttr;
    if (!sectionId) continue; // unidentifiable section — never a valid edit target
    entries.push({
      sectionId,
      component: dataComponent || sectionId,
      outerHTML: outer,
      hash:      hashHtml(outer),
    });
  }
  return entries;
}

// SECTION_KEYWORDS: human phrasing → canonical sectionId. Used ONLY to match
// against sections that ACTUALLY EXIST in the registry — never to invent a
// target that isn't really on the page.
const SECTION_KEYWORDS: Record<string, string[]> = {
  hero:         ["hero","header image","banner","headline","tagline","main section","top section","hero image","hero background"],
  features:     ["feature","benefit","service","why us","why choose","what we do"],
  pricing:      ["pricing","price","plan","tier","cost","subscription"],
  testimonials: ["testimonial","review","feedback","customer","client","social proof"],
  faq:          ["faq","question","answer","frequently asked"],
  cta:          ["cta button","call to action","get started button","cta section"],
  footer:       ["footer","copyright","footer logo"],
  navbar:       ["navbar","nav menu","navigation","header menu","hamburger","top bar"],
  contact:      ["contact form","reach us","get in touch"],
  about:        ["about section","our story","team section","mission","vision","who we are"],
  gallery:      ["gallery","photo grid","image gallery","portfolio grid","showcase"],
  stats:        ["stats section","metric","achievement counter"],
};

// Deterministic resolver: only ever returns a sectionId that is PRESENT in
// the registry. If the message names something not on the page, returns
// null — caller must treat that as "needs a real new section" (LAYOUT_EDIT)
// or report it can't find the target, never silently edit the wrong one.
function resolveSectionTarget(message: string, registry: SectionEntry[]): SectionEntry | null {
  const m = message.toLowerCase();
  const presentIds = new Set(registry.map(e => e.sectionId));

  // Direct match: message literally names a present sectionId or component
  for (const entry of registry) {
    if (m.includes(entry.sectionId.toLowerCase())) return entry;
    if (m.includes(entry.component.toLowerCase())) return entry;
  }

  // Keyword match: only against sections that exist
  for (const [canonicalId, keywords] of Object.entries(SECTION_KEYWORDS)) {
    if (!presentIds.has(canonicalId)) continue;
    if (keywords.some(k => m.includes(k))) {
      return registry.find(e => e.sectionId === canonicalId) || null;
    }
  }

  // "CTA button" special case: most pages have no standalone id="cta"
  // section — the primary CTA usually lives INSIDE hero. If the message
  // says "cta"/"button" and hero exists, target hero (where renderButton()
  // actually renders it) instead of failing.
  if ((m.includes("cta") || m.includes("button")) && presentIds.has("hero")) {
    return registry.find(e => e.sectionId === "hero") || null;
  }

  return null;
}

// ── Intent Detection ─────────────────────────────────────────────
function detectIntent(
  message:  string,
  isGame:   boolean,
  isDebug:  boolean,
  registry: SectionEntry[]
): EditIntent {
  if (isGame)  return "GAME_EDIT";
  if (isDebug) return "DEBUG_EDIT";

  const m = message.toLowerCase();
  const target = resolveSectionTarget(message, registry);

  // ── KEY FIX ────────────────────────────────────────────────────────
  // Previously: "add image to hero section" matched the LAYOUT_EDIT regex
  // purely on the words "add" + "hero" + "section", and LAYOUT_EDIT always
  // inserts a brand-new section before the footer — regardless of which
  // section the user actually named. That's why "add X to hero" silently
  // modified the footer.
  //
  // Fix: if the message resolves to a section that ALREADY EXISTS in the
  // registry, this is never a LAYOUT_EDIT (you don't "add a new section"
  // to something that's already there) — it's a CONTENT_EDIT (adding an
  // image/element WITHIN that section). LAYOUT_EDIT is reserved for
  // genuinely new sections (target === null) or explicit "remove section".

  const isExplicitRemove = /\b(remove|delete)\b.{0,20}\b(section)\b/i.test(message);
  const isExplicitAddNew = /\b(add|insert|include)\b.{0,20}\b(a |an |new )?(section)\b/i.test(message) && !target;

  if (isExplicitRemove && target) return "LAYOUT_EDIT";
  if (isExplicitAddNew)           return "LAYOUT_EDIT";

  // COMPONENT: changing a specific component's variant/layout
  if (/\b(change|swap|replace|use|switch)\b.{0,20}\b(layout|variant|style|version|type)\b.{0,30}\b(hero|navbar|footer|pricing|features|testimonial)\b/i.test(message)) {
    return "COMPONENT_EDIT";
  }

  // DEBUG: fixing broken code
  if (/\b(fix|repair|debug|broken|not working|error|crash|blank|white screen|console|issue)\b/i.test(m)) {
    return "DEBUG_EDIT";
  }

  // CONTENT: adding/changing something WITHIN an existing, resolved section
  // ("add image to hero", "change hero heading", "update testimonial text")
  if (target && /\b(add|change|update|replace|edit|rewrite|insert)\b/i.test(m)) {
    return "CONTENT_EDIT";
  }
  if (/\b(change|update|replace|edit|rewrite)\b.{0,30}\b(text|heading|title|copy|content|tagline|description|paragraph|cta text|button text|label|name|logo text|image)\b/i.test(message) ||
      /\b(heading|title|tagline|copy|content)\b.{0,20}\b(change|update|replace|badlo|badal)\b/i.test(message)) {
    return "CONTENT_EDIT";
  }

  // STYLE: colors, fonts, spacing, animations
  if (/color|colour|background|bg|font|size|spacing|padding|margin|border|shadow|gradient|dark|light|theme|animate|animation|transition|rounded|bold|italic|opacity|glow|blur|white|black|red|blue|green|golden|yellow|purple|pink|gray|karo|kar do|bana do|badao|lagao|change to/i.test(message)) {
    return "STYLE_EDIT";
  }

  return "STYLE_EDIT"; // safest default
}

// ── HTML Extraction Utilities ─────────────────────────────────────
function extractStyleBlock(html: string): string {
  return html.match(/<style[\s\S]*?<\/style>/i)?.[0] || "";
}

function extractSection(html: string, id: string): string {
  // Match on data-section (deterministic, new projects) OR id (fallback, old projects)
  const byDataSection = new RegExp(
    `<section[^>]*data-section=["']${id}["'][^>]*>[\\s\\S]*?</section>`,
    "i"
  );
  const byId = new RegExp(
    `<section[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?</section>`,
    "i"
  );
  return html.match(byDataSection)?.[0] || html.match(byId)?.[0] || "";
}

function extractAllSections(html: string): string[] {
  return [...html.matchAll(/<section[^>]*id=["']([^"']+)["'][^>]*>/gi)]
    .map(m => m[1]);
}

// ── HTML Validation ───────────────────────────────────────────────
function validateHtml(html: string, originalHtml: string): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  // 1. Basic structure
  if (!html.includes("<!DOCTYPE") || !html.includes("</html>"))
    errors.push("Missing <!DOCTYPE html> or </html> — document incomplete");

  if (!html.includes("<head>") || !html.includes("</head>"))
    errors.push("Missing <head> block");

  if (!html.includes("<body>") || !html.includes("</body>"))
    errors.push("Missing <body> block");

  // 2. Minimum size — must be at least 70% of original
  const minSize = Math.floor(originalHtml.length * 0.7);
  if (html.length < minSize)
    errors.push(`HTML too short: ${html.length} chars (expected ≥ ${minSize}). Sections may be missing.`);

  // 3. Critical sections preserved
  const origSections = extractAllSections(originalHtml);
  const newSections  = extractAllSections(html);
  const missing      = origSections.filter(id => !newSections.includes(id) && id !== "");
  if (missing.length > 0)
    warnings.push(`Sections missing from output: ${missing.join(", ")}`);

  // 4. Unclosed tags (simple check)
  const openTags  = (html.match(/<(div|section|nav|header|footer|main|article|aside)[^>]*>/gi) || []).length;
  const closeTags = (html.match(/<\/(div|section|nav|header|footer|main|article|aside)>/gi) || []).length;
  if (Math.abs(openTags - closeTags) > 10)
    warnings.push(`Possible unclosed tags: ${openTags} opens vs ${closeTags} closes`);

  // 5. Duplicate IDs
  const idMatches = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m => m[1]);
  const idCounts  = idMatches.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {} as Record<string, number>);
  const dupeIds   = Object.entries(idCounts).filter(([, c]) => c > 1).map(([id]) => id);
  if (dupeIds.length > 0)
    warnings.push(`Duplicate IDs found: ${dupeIds.join(", ")}`);

  // 6. CSS style block present
  if (!html.includes("<style"))
    warnings.push("No <style> block found — page may be unstyled");

  return {
    valid:    errors.length === 0,
    errors,
    warnings,
  };
}

// ── Patch style block into full HTML ─────────────────────────────
// ── Targeted-edit validation ──────────────────────────────────────────
// Requirement: after patching, verify the requested component actually
// changed AND unrelated sections did not. Uses the same registry hashes
// computed before the AI call — no re-guessing, just a direct comparison.
interface TargetedValidation {
  targetChanged:   boolean;
  unrelatedIntact: boolean;
  unrelatedChanged: string[]; // sectionIds that changed but should not have
}

function validateTargetedEdit(
  beforeRegistry: SectionEntry[],
  patchedHtml:    string,
  targetId:       string | null
): TargetedValidation {
  const afterRegistry = buildSectionRegistry(patchedHtml);
  const afterMap = new Map(afterRegistry.map(e => [e.sectionId, e.hash]));

  let targetChanged = !targetId; // global/theme edits have no single target — always pass
  const unrelatedChanged: string[] = [];

  for (const before of beforeRegistry) {
    const afterHash = afterMap.get(before.sectionId);
    const changed = afterHash !== undefined && afterHash !== before.hash;

    if (before.sectionId === targetId) {
      if (changed) targetChanged = true;
    } else if (changed) {
      unrelatedChanged.push(before.sectionId);
    }
  }

  return {
    targetChanged,
    unrelatedIntact: unrelatedChanged.length === 0,
    unrelatedChanged,
  };
}


function patchStyle(fullHtml: string, updatedStyle: string): string {
  if (!updatedStyle.includes("<style")) return fullHtml;
  const result = fullHtml.replace(/<style[\s\S]*?<\/style>/i, updatedStyle);
  return result !== fullHtml ? result : fullHtml;
}

// ── Patch section into full HTML ─────────────────────────────────
function patchSection(fullHtml: string, sectionId: string, updatedSection: string): string {
  const byDataSection = new RegExp(
    `<section[^>]*data-section=["']${sectionId}["'][^>]*>[\\s\\S]*?</section>`,
    "i"
  );
  const byId = new RegExp(
    `<section[^>]*\\bid=["']${sectionId}["'][^>]*>[\\s\\S]*?</section>`,
    "i"
  );
  let result = fullHtml.replace(byDataSection, updatedSection);
  if (result === fullHtml) result = fullHtml.replace(byId, updatedSection);
  return result !== fullHtml ? result : fullHtml;
}

// ── AI Provider Calls ─────────────────────────────────────────────
async function callClaude(
  messages:  any[],
  system:    string,
  maxTokens: number,
  timeoutMs: number
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta":    "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system:     [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Claude ${res.status}: ${body.slice(0, 200)}`);
  }
  const d = await res.json();
  const text = d.content?.[0]?.text || "";
  if (!text.trim()) throw new Error("Claude returned empty response");
  return text;
}

async function callOpenAI(
  messages:  any[],
  system:    string,
  maxTokens: number
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model:      "gpt-4o",
      max_tokens: maxTokens,
      messages:   [{ role: "system", content: system }, ...messages],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const d = await res.json();
  const text = d.choices?.[0]?.message?.content || "";
  if (!text.trim()) throw new Error("OpenAI empty response");
  return text;
}

async function callGemini(messages: any[], system: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const prompt = system + "\n\n" + messages.map((m: any) => m.content).join("\n");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        contents:         [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4000, temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ── Claude with exponential backoff ──────────────────────────────
async function claudeWithBackoff(
  messages:  any[],
  system:    string,
  maxTokens: number,
  maxRetries = 3
): Promise<{ text: string; attempts: number }> {
  const timeouts = [28000, 32000, 38000]; // increasing timeouts per attempt
  let lastErr: Error = new Error("Unknown");

  for (let i = 0; i < maxRetries; i++) {
    try {
      const text = await callClaude(messages, system, maxTokens, timeouts[i] || 38000);
      return { text, attempts: i + 1 };
    } catch (err: any) {
      lastErr = err;
      const isTimeout   = err?.name === "TimeoutError" || String(err?.message).includes("timeout");
      const isRateLimit = String(err?.message).includes("429") || String(err?.message).includes("rate");
      const isAuth      = String(err?.message).includes("401") || String(err?.message).includes("403");

      if (isAuth) throw err; // No retry on auth errors

      if (i < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, i) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ── System Prompts ────────────────────────────────────────────────
const STYLE_SYSTEM = `You are Krypton AI's CSS editor. You receive a website <style> block and an edit request in English, Hindi, or Hinglish.

INTENT MAPPING:
- "background golden karo" → change --bg or body background to #D4A853 or linear-gradient(135deg,#F5E6C8,#FFF8E7,#F0D4A0)
- "background dark karo" / "dark theme" → --bg:#050816; --surf:#070B16; --card:#0C1020; body{background:#050816}
- "background light karo" / "light theme" → --bg:#FFFFFF; --surf:#F8F9FA; --card:#F0F0F0; body{color:#111}
- "button red karo" → .btn or button: background:#EF4444 or red gradient
- "button golden bana do" → .btn: background:linear-gradient(135deg,#D4A853,#B8935A)
- "heading bada karo" → h1{font-size: increase by 20-30%}
- "text white kar do" → color:#FFFFFF on body or specified selector
- "animation lagao" → add @keyframes fadeSlideIn, apply to .reveal or hero
- "shadow lagao" → box-shadow on cards or specified element
- "rounded karo" → border-radius increase on buttons/cards
- Any color in Hindi/English/Hinglish → apply to the correct element

OUTPUT FORMAT:
Return ONLY the complete updated <style>...</style> block.
No explanation. No markdown. Start with <style> and end with </style>.`;

const CONTENT_SYSTEM = `You are Krypton AI's content editor. You receive a single HTML section and an edit request.

Return ONLY the updated section wrapped in:
<section_update>UPDATED_SECTION_HTML_HERE</section_update>

RULES:
- Change ONLY the text/content requested
- Preserve all CSS classes, IDs, inline styles, data attributes
- Never restructure or remove elements
- Return the complete section including opening and closing <section> tags`;

const LAYOUT_SYSTEM = `You are Krypton AI's layout editor. You receive the current page structure and an edit request.

For ADD: Return new section HTML wrapped in:
<layout_update>{"action":"add","position":"before-footer","html":"SECTION_HTML_HERE"}</layout_update>

For REMOVE: Return:
<layout_update>{"action":"remove","sectionId":"SECTION_ID"}</layout_update>

RULES:
- New sections must match the existing design system (use same CSS variables)
- Always include section id attribute
- Match premium quality of existing sections`;

const DEBUG_SYSTEM = `You are Krypton AI's debugger. Fix only what is broken — never redesign.

Return the complete fixed HTML wrapped in:
<code_changes>{"index.html":"COMPLETE_FIXED_HTML"}</code_changes>

RULES:
- Fix the reported issue only
- Preserve all existing sections, content, and styling
- Do not change anything not related to the bug`;

const GAME_EDIT_SYSTEM = `You are Krypton AI's game editor. Edit game code surgically.

PRESERVE: All game mechanics, controls, scoring, collision detection, game loop.
CHANGE: Only what was requested.

Return COMPLETE updated game HTML wrapped in:
<code_changes>{"index.html":"COMPLETE_GAME_HTML"}</code_changes>`;

const UPGRADE_SYSTEM = `You are Krypton AI's upgrade engine. Enhance quality without changing purpose.

Return COMPLETE enhanced HTML wrapped in:
<code_changes>{"index.html":"ENHANCED_HTML"}</code_changes>`;

const REPAIR_SYSTEM = `You are Krypton AI's repair engine. You receive broken HTML and a list of validation errors.

Fix ALL listed errors while preserving all content and design.
Return ONLY the complete repaired HTML wrapped in:
<code_changes>{"index.html":"REPAIRED_COMPLETE_HTML"}</code_changes>`;

// ── Intent Handlers ───────────────────────────────────────────────

async function handleStyleEdit(
  fullHtml: string,
  message:  string,
  memCtx:   string,
  projName: string,
  target:   SectionEntry | null
): Promise<{ raw: string; patchedHtml: string; attempts: number }> {
  // ── KEY FIX ────────────────────────────────────────────────────────
  // The component library renders colors/spacing/shadows as INLINE
  // style="" attributes (e.g. background:var(--grad) on buttons), not
  // CSS classes. Patching only the global <style> block can never change
  // an inline-styled element — that's why "CTA button dark yellow karo"
  // visually did nothing. When a specific section is the target, send
  // and patch THAT section's actual HTML (inline styles included), the
  // same deterministic mechanism CONTENT_EDIT already uses successfully.
  if (target) {
    const userContent = `${memCtx}Project: ${projName}

Current HTML of the "${target.sectionId}" section (edit ONLY colors/spacing/visual styles here — both inline style="" attributes AND any CSS — do not change text content or structure):
${target.outerHTML.slice(0, 6000)}

Style edit request: ${message}

Return the updated section wrapped in: <section_update>UPDATED_SECTION_HTML</section_update>`;

    const { text, attempts } = await claudeWithBackoff(
      [{ role: "user" as const, content: userContent }],
      CONTENT_SYSTEM,
      4500
    );

    const match   = text.match(/<section_update>([\s\S]*?)<\/section_update>/i);
    const updated = match?.[1]?.trim() || text.match(/<section[\s\S]*?<\/section>/i)?.[0] || "";
    if (!updated) throw new Error("No section_update in style response");

    return {
      raw:         updated,
      patchedHtml: patchSection(fullHtml, target.sectionId, updated),
      attempts,
    };
  }

  // No specific section resolved — global theme-level edit (e.g. "dark theme
  // karo" with no named section): patch the shared <style> block as before.
  const styleBlock = extractStyleBlock(fullHtml);
  if (!styleBlock) throw new Error("No <style> block in HTML");

  const userContent = `${memCtx}Project: ${projName}

Current CSS:
${styleBlock.slice(0, 6000)}

Edit request: ${message}

Return ONLY the complete updated <style>...</style> block.`;

  const { text, attempts } = await claudeWithBackoff(
    [{ role: "user" as const, content: userContent }],
    STYLE_SYSTEM,
    4000
  );

  const updated = text.match(/<style[\s\S]*?<\/style>/i)?.[0];
  if (!updated) throw new Error("No <style> block in Claude response");

  return {
    raw:        updated,
    patchedHtml: patchStyle(fullHtml, updated),
    attempts,
  };
}

async function handleContentEdit(
  fullHtml: string,
  message:  string,
  memCtx:   string,
  projName: string,
  target:   SectionEntry | null
): Promise<{ raw: string; patchedHtml: string; attempts: number }> {
  // ── KEY FIX ────────────────────────────────────────────────────────
  // Previously this silently fell back to "hero" when no section matched
  // — a guess, exactly what this architecture exists to eliminate. Now:
  // target was already resolved deterministically from the registry
  // BEFORE this handler was even called. If it's null, the requested
  // section genuinely doesn't exist on the page — fail loudly so the
  // caller can report that clearly, instead of editing a random section.
  if (!target) {
    throw new Error("Could not determine which section to edit — the named section was not found on this page");
  }

  const userContent = `${memCtx}Project: ${projName}

Current section HTML ("${target.sectionId}"):
${target.outerHTML.slice(0, 5000)}

Content edit: ${message}

Return the updated section wrapped in: <section_update>HTML</section_update>`;

  const { text, attempts } = await claudeWithBackoff(
    [{ role: "user" as const, content: userContent }],
    CONTENT_SYSTEM,
    4000
  );

  const match   = text.match(/<section_update>([\s\S]*?)<\/section_update>/i);
  const updated = match?.[1]?.trim() || text.match(/<section[\s\S]*?<\/section>/i)?.[0] || "";
  if (!updated) throw new Error("No section_update in Claude response");

  return {
    raw:         updated,
    patchedHtml: patchSection(fullHtml, target.sectionId, updated),
    attempts,
  };
}

async function handleLayoutEdit(
  fullHtml: string,
  message:  string,
  memCtx:   string,
  projName: string
): Promise<{ raw: string; patchedHtml: string; attempts: number }> {
  const sectionIds  = extractAllSections(fullHtml);
  const styleSnip   = extractStyleBlock(fullHtml).slice(0, 2000);

  const userContent = `${memCtx}Project: ${projName}
Current sections: ${sectionIds.join(", ")}

CSS variables (for design consistency):
${styleSnip}

Layout edit: ${message}

Return: <layout_update>{"action":"add|remove","position":"before-footer","sectionId":"ID","html":"HTML"}</layout_update>`;

  const { text, attempts } = await claudeWithBackoff(
    [{ role: "user" as const, content: userContent }],
    LAYOUT_SYSTEM,
    6000
  );

  const match = text.match(/<layout_update>([\s\S]*?)<\/layout_update>/i);
  if (!match) throw new Error("No layout_update in response");

  let parsed: { action: string; sectionId?: string; html?: string; position?: string };
  try { parsed = JSON.parse(match[1].trim()); }
  catch { throw new Error("Invalid layout_update JSON"); }

  let patched = fullHtml;
  if (parsed.action === "add" && parsed.html) {
    const footer = fullHtml.match(/<section[^>]*id=["']footer["'][^>]*>[\s\S]*?<\/section>/i)?.[0] || "";
    patched = footer
      ? fullHtml.replace(footer, parsed.html + "\n" + footer)
      : fullHtml.replace(/<\/body>/i, parsed.html + "\n</body>");
  } else if (parsed.action === "remove" && parsed.sectionId) {
    const re = new RegExp(`<section[^>]*id=["']${parsed.sectionId}["'][^>]*>[\\s\\S]*?</section>`, "i");
    patched  = fullHtml.replace(re, "");
  }

  return { raw: parsed.html || parsed.sectionId || "", patchedHtml: patched, attempts };
}

async function handleComponentEdit(
  fullHtml: string,
  message:  string,
  memCtx:   string,
  projName: string,
  target:   SectionEntry | null
): Promise<{ raw: string; patchedHtml: string; attempts: number }> {
  // Component edit = targeted section replacement with specific variant request
  // Treat same as content edit with section context
  return handleContentEdit(fullHtml, message, memCtx, projName, target);
}

async function handleDebugEdit(
  fullHtml: string,
  message:  string,
  history:  any[],
  memCtx:   string,
  projName: string
): Promise<{ raw: string; patchedHtml: string; attempts: number }> {
  // Send compressed version for large files
  const compressed = fullHtml.length > 18000
    ? fullHtml.slice(0, 10000) + "\n\n/* ... truncated for brevity ... */\n\n" + fullHtml.slice(-5000)
    : fullHtml;

  const histMsgs = history.slice(-4).map((m: any) => ({
    role:    (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
    content: String(m.content).slice(0, 500),
  }));

  const userContent = `${memCtx}Project: ${projName}

HTML to debug:
${compressed}

Bug: ${message}

Return the COMPLETE fixed HTML in: <code_changes>{"index.html":"FIXED_HTML"}</code_changes>`;

  const { text, attempts } = await claudeWithBackoff(
    [...histMsgs, { role: "user" as const, content: userContent }],
    DEBUG_SYSTEM,
    16000
  );

  const match = text.match(/<code_changes>([\s\S]*?)<\/code_changes>/i);
  if (!match) throw new Error("No code_changes in debug response");

  let html = "";
  try {
    html = JSON.parse(match[1].trim())["index.html"] || "";
  } catch {
    html = match[1].match(/<!DOCTYPE[\s\S]*<\/html>/i)?.[0] || "";
  }
  if (!html || !html.includes("<!DOCTYPE")) throw new Error("Debug response has no valid HTML");

  return { raw: html, patchedHtml: html, attempts };
}

// ── Repair pass (Claude only) ─────────────────────────────────────
async function repairWithClaude(
  brokenHtml:   string,
  originalHtml: string,
  errors:       string[]
): Promise<string> {
  const userContent = `The following HTML has validation errors that must be fixed:

ERRORS:
${errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}

BROKEN HTML (first 12000 chars):
${brokenHtml.slice(0, 12000)}

Fix ALL errors. Ensure all original sections are preserved (original had ${extractAllSections(originalHtml).length} sections: ${extractAllSections(originalHtml).join(", ")}).

Return COMPLETE repaired HTML in:
<code_changes>{"index.html":"REPAIRED_HTML"}</code_changes>`;

  const { text } = await claudeWithBackoff(
    [{ role: "user" as const, content: userContent }],
    REPAIR_SYSTEM,
    16000,
    1  // single repair attempt
  );

  const match = text.match(/<code_changes>([\s\S]*?)<\/code_changes>/i);
  if (!match) throw new Error("Repair produced no code_changes");
  try {
    return JSON.parse(match[1].trim())["index.html"] || "";
  } catch {
    return match[1].match(/<!DOCTYPE[\s\S]*<\/html>/i)?.[0] || "";
  }
}

// ── OpenAI fallback ───────────────────────────────────────────────
async function openAIFallback(
  intent:   EditIntent,
  fullHtml: string,
  message:  string,
  memCtx:   string,
  projName: string
): Promise<string> {
  // For OpenAI, always send style block or compressed section
  // Never send full HTML
  const styleBlock  = extractStyleBlock(fullHtml).slice(0, 5000);
  const fallbackTarget = resolveSectionTarget(message, buildSectionRegistry(fullHtml));
  const section      = fallbackTarget ? fallbackTarget.outerHTML.slice(0, 5000) : "";

  let system = STYLE_SYSTEM;
  let ctx    = styleBlock;

  if (intent === "CONTENT_EDIT" && section) {
    system = CONTENT_SYSTEM;
    ctx    = section;
  } else if (intent === "DEBUG_EDIT") {
    system = DEBUG_SYSTEM;
    ctx    = fullHtml.slice(0, 10000);
  }

  const text = await callOpenAI(
    [{ role: "user" as const, content: `${memCtx}Project: ${projName}\n\nContext:\n${ctx}\n\nEdit: ${message}` }],
    system,
    8000
  );

  // DEBUG LOGS — remove after root cause identified

  // Try to extract a style block first
  const updatedStyle = text.match(/<style[\s\S]*?<\/style>/i)?.[0];
  if (updatedStyle && intent === "STYLE_EDIT") {
    return patchStyle(fullHtml, updatedStyle);
  }
  // Try section update
  const sectionMatch = text.match(/<section_update>([\s\S]*?)<\/section_update>/i);
  if (sectionMatch && fallbackTarget) {
    return patchSection(fullHtml, fallbackTarget.sectionId, sectionMatch[1].trim());
  }
  // Try code_changes
  const codeMatch = text.match(/<code_changes>([\s\S]*?)<\/code_changes>/i);
  if (codeMatch) {
    try { return JSON.parse(codeMatch[1].trim())["index.html"] || ""; } catch {}
    const h = codeMatch[1].match(/<!DOCTYPE[\s\S]*<\/html>/i)?.[0];
    if (h) return h;
  }
  throw new Error("OpenAI fallback produced no usable output");
}

// ── Gemini emergency fallback ─────────────────────────────────────
async function geminiFallback(
  fullHtml: string,
  message:  string,
  projName: string
): Promise<string> {
  const styleBlock = extractStyleBlock(fullHtml).slice(0, 4000);
  const text = await callGemini(
    [{ role: "user" as const, content: `Project: ${projName}\n\nCSS:\n${styleBlock}\n\nEdit: ${message}\n\nReturn ONLY updated <style>...</style> block.` }],
    STYLE_SYSTEM
  );
  const updated = text.match(/<style[\s\S]*?<\/style>/i)?.[0];
  if (updated) return patchStyle(fullHtml, updated);
  throw new Error("Gemini produced no usable output");
}

// ── Game edit (unchanged from original) ──────────────────────────
async function handleGameEdit(
  fullHtml: string,
  message:  string,
  history:  any[],
  gameMemory: any,
  memCtx:   string,
  projName: string
): Promise<{ patchedHtml: string; provider: string; attempts: number }> {
  const gameCtx = gameMemory
    ? `GAME MEMORY:\nType: ${gameMemory.gameType} | Theme: ${gameMemory.theme}\nFeatures: ${(gameMemory.features || []).join(", ")}\nControls: ${gameMemory.controls}\nPRESERVE ALL ABOVE\n\n`
    : "";
  const compressed = fullHtml.slice(0, 5000) + "\n\n/* ... */\n\n" + fullHtml.slice(-3000);
  const histMsgs   = history.slice(-4).map((m: any) => ({
    role:    (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
    content: String(m.content).slice(0, 500),
  }));

  const userContent = `${gameCtx}${memCtx}Project: ${projName}\n\nGAME CODE:\n${compressed}\n\nGAME EDIT: ${message}`;

  let patchedHtml = "";
  let provider    = "claude";
  let attempts    = 0;

  try {
    const { text, attempts: a } = await claudeWithBackoff(
      [...histMsgs, { role: "user" as const, content: userContent }],
      GAME_EDIT_SYSTEM,
      16000
    );
    attempts = a;
    const match = text.match(/<code_changes>([\s\S]*?)<\/code_changes>/i);
    if (match) {
      try { patchedHtml = JSON.parse(match[1].trim())["index.html"] || ""; }
      catch { patchedHtml = match[1].match(/<!DOCTYPE[\s\S]*<\/html>/i)?.[0] || ""; }
    }
  } catch {
    provider = "openai";
    const text = await callOpenAI(
      [...histMsgs, { role: "user" as const, content: userContent }],
      GAME_EDIT_SYSTEM,
      16000
    );
    const match = text.match(/<code_changes>([\s\S]*?)<\/code_changes>/i);
    if (match) {
      try { patchedHtml = JSON.parse(match[1].trim())["index.html"] || ""; }
      catch { patchedHtml = match[1].match(/<!DOCTYPE[\s\S]*<\/html>/i)?.[0] || ""; }
    }
  }

  return { patchedHtml, provider, attempts };
}

// ── Upgrade edit ──────────────────────────────────────────────────
async function handleUpgradeEdit(
  fullHtml: string,
  message:  string,
  memCtx:   string,
  projName: string
): Promise<{ patchedHtml: string; provider: string; attempts: number }> {
  const compressed = fullHtml.length > 20000
    ? fullHtml.slice(0, 12000) + "\n\n/* ... */\n\n" + fullHtml.slice(-4000)
    : fullHtml;

  const { text, attempts } = await claudeWithBackoff(
    [{ role: "user" as const, content: `${memCtx}Project: ${projName}\n\nCurrent:\n${compressed}\n\nUpgrade: ${message}` }],
    UPGRADE_SYSTEM,
    16000
  );

  const match = text.match(/<code_changes>([\s\S]*?)<\/code_changes>/i);
  let html = "";
  if (match) {
    try { html = JSON.parse(match[1].trim())["index.html"] || ""; }
    catch { html = match[1].match(/<!DOCTYPE[\s\S]*<\/html>/i)?.[0] || ""; }
  }
  return { patchedHtml: html || fullHtml, provider: "claude", attempts };
}

// ── Main POST handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const startMs = Date.now();

  try {
    const {
      projectName     = "Untitled Project",
      framework       = "html",
      currentCode     = {},
      userMessage,
      history         = [],
      projectContext  = "",
      gameMemory      = null,
      message,
    } = await req.json();

    const actualMessage = (userMessage || message || "").trim();
    if (!actualMessage) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const isGameEdit    = framework === "game" || !!gameMemory;
    const isUpgradeMode = actualMessage.toLowerCase().startsWith("[upgrade]");
    const isDebugMode   = /^\[debug\]/i.test(actualMessage) ||
                          /\b(fix|repair|broken|not working|white screen|blank|error in|console)\b/i.test(actualMessage);

    const fullHtml = (currentCode as Record<string, string>)["index.html"] || "";
    const memCtx   = projectContext ? projectContext.slice(0, 800) + "\n\n" : "";

    const log: Partial<EditLog> = {
      intent:    "STYLE_EDIT",
      provider:  "claude",
      attempts:  0,
      repairRan: false,
      patchSize: 0,
    };

    // ── Upgrade path ────────────────────────────────────────────
    if (isUpgradeMode) {
      const msg = actualMessage.replace(/^\[upgrade\]\s*/i, "");
      const { patchedHtml, provider, attempts } = await handleUpgradeEdit(fullHtml, msg, memCtx, projectName);
      log.intent = "STYLE_EDIT"; log.provider = provider; log.attempts = attempts;
      const v = validateHtml(patchedHtml, fullHtml);
      log.validation = v; log.patchSize = patchedHtml.length; log.durationMs = Date.now() - startMs;
      if (patchedHtml && patchedHtml.includes("<!DOCTYPE")) {
        return NextResponse.json({ text: "Upgrade applied.", reply: "Upgrade applied.", codeChanges: { "index.html": patchedHtml }, provider, log });
      }
      return NextResponse.json({ text: "Upgrade failed. Try again.", reply: "Upgrade failed.", codeChanges: null });
    }

    // ── Game edit path ──────────────────────────────────────────
    if (isGameEdit) {
      const { patchedHtml, provider, attempts } = await handleGameEdit(
        fullHtml, actualMessage, history, gameMemory, memCtx, projectName
      );
      log.intent = "GAME_EDIT"; log.provider = provider; log.attempts = attempts;
      if (patchedHtml && patchedHtml.includes("<!DOCTYPE")) {
        return NextResponse.json({ text: "Game updated.", reply: "Game updated.", codeChanges: { "index.html": patchedHtml }, provider, log });
      }
      return NextResponse.json({ text: "Game edit failed.", reply: "Game edit failed.", codeChanges: null });
    }

    // ── Build Section Registry — deterministic, built ONCE before any AI call ──
    const registry = buildSectionRegistry(fullHtml);
    const target    = resolveSectionTarget(actualMessage, registry);

    // ── Detect intent ────────────────────────────────────────────
    const intent = detectIntent(actualMessage, false, isDebugMode, registry);
    log.intent = intent;

    // ── Run intent handler (Claude primary) ──────────────────────
    let patchedHtml = "";
    let provider    = "claude";
    let attempts    = 0;
    let claudeFailed = false;

    try {
      let result: { raw: string; patchedHtml: string; attempts: number };

      switch (intent) {
        case "STYLE_EDIT":
          result = await handleStyleEdit(fullHtml, actualMessage, memCtx, projectName, target);
          break;
        case "CONTENT_EDIT":
          result = await handleContentEdit(fullHtml, actualMessage, memCtx, projectName, target);
          break;
        case "LAYOUT_EDIT":
          result = await handleLayoutEdit(fullHtml, actualMessage, memCtx, projectName);
          break;
        case "COMPONENT_EDIT":
          result = await handleComponentEdit(fullHtml, actualMessage, memCtx, projectName, target);
          break;
        case "DEBUG_EDIT":
          result = await handleDebugEdit(fullHtml, actualMessage, history, memCtx, projectName);
          break;
        default:
          result = await handleStyleEdit(fullHtml, actualMessage, memCtx, projectName, target);
      }

      patchedHtml = result.patchedHtml;
      attempts    = result.attempts;

    } catch (claudeErr: any) {
      console.warn(`[Chat] Claude failed for ${intent}: ${claudeErr.message}`);
      claudeFailed = true;
    }

    // ── Validate (if Claude succeeded) ──────────────────────────
    let validation = validateHtml(patchedHtml, fullHtml);

    // ── Targeted-edit validation ──────────────────────────────────────
    // Confirms the requested section actually changed and no unrelated
    // section was touched. A section-targeted edit that silently changed
    // the WRONG section (the original bug) is treated the same as any
    // other validation failure — repair, then fallback if repair fails.
    if (patchedHtml && validation.valid && target) {
      const targeted = validateTargetedEdit(registry, patchedHtml, target.sectionId);
      if (!targeted.targetChanged || !targeted.unrelatedIntact) {
        const reasons: string[] = [];
        if (!targeted.targetChanged) reasons.push(`The "${target.sectionId}" section was not actually modified`);
        if (!targeted.unrelatedIntact) reasons.push(`Unrelated sections were changed: ${targeted.unrelatedChanged.join(", ")} (only "${target.sectionId}" should change)`);
        validation = { valid: false, errors: reasons, warnings: validation.warnings };
      }
    }

    if (patchedHtml && !validation.valid) {
      // Ask Claude to repair before falling back
      log.repairRan = true;
      try {
        const repaired = await repairWithClaude(patchedHtml, fullHtml, validation.errors);
        if (repaired && repaired.includes("<!DOCTYPE")) {
          patchedHtml = repaired;
          validation  = validateHtml(repaired, fullHtml);
          if (validation.valid && target) {
            const targetedRepair = validateTargetedEdit(registry, patchedHtml, target.sectionId);
            if (!targetedRepair.targetChanged || !targetedRepair.unrelatedIntact) {
              validation = { valid: false, errors: ["Repair did not correctly target the requested section"], warnings: [] };
            }
          }
          provider    = "claude";
        }
      } catch (repairErr: any) {
        console.warn("[Chat] Claude repair failed:", repairErr.message);
        claudeFailed = true;
      }
    }

    // ── OpenAI fallback (only if Claude fully failed or repair failed) ──
    if (claudeFailed || !patchedHtml || !validation.valid) {
      try {
        provider    = "openai";
        patchedHtml = await openAIFallback(intent, fullHtml, actualMessage, memCtx, projectName);
        validation  = validateHtml(patchedHtml, fullHtml);
        // GAP FIX: fallback output must pass the SAME "only target section
        // changed" check as the Claude path — applies to every edit, not
        // just the primary engine.
        if (validation.valid && target) {
          const t = validateTargetedEdit(registry, patchedHtml, target.sectionId);
          if (!t.targetChanged || !t.unrelatedIntact) {
            validation = {
              valid: false,
              errors: [
                ...(!t.targetChanged ? [`OpenAI fallback did not modify the "${target.sectionId}" section`] : []),
                ...(!t.unrelatedIntact ? [`OpenAI fallback changed unrelated sections: ${t.unrelatedChanged.join(", ")}`] : []),
              ],
              warnings: [],
            };
          }
        }
      } catch (openaiErr: any) {
        console.warn("[Chat] OpenAI fallback failed:", openaiErr.message);
        validation = { valid: false, errors: [openaiErr.message], warnings: [] };
      }

      // ── Gemini emergency — only if OpenAI also failed or mis-targeted ──
      if (!patchedHtml || !validation.valid) {
        try {
          provider    = "gemini";
          patchedHtml = await geminiFallback(fullHtml, actualMessage, projectName);
          validation  = validateHtml(patchedHtml, fullHtml);
          if (validation.valid && target) {
            const t = validateTargetedEdit(registry, patchedHtml, target.sectionId);
            if (!t.targetChanged || !t.unrelatedIntact) {
              validation = {
                valid: false,
                errors: [
                  ...(!t.targetChanged ? [`Gemini did not modify the "${target.sectionId}" section`] : []),
                  ...(!t.unrelatedIntact ? [`Gemini changed unrelated sections: ${t.unrelatedChanged.join(", ")}`] : []),
                ],
                warnings: [],
              };
            }
          }
        } catch (geminiErr: any) {
          console.error("[Chat] All providers failed:", geminiErr.message);
          return NextResponse.json({
            text:        "All AI providers failed. Please try again in a moment.",
            reply:       "All AI providers failed. Please try again in a moment.",
            codeChanges: null,
          });
        }
      }

      // ── Final guard: no provider produced a correctly-targeted edit ────
      // Never let a wrong-section edit reach the browser — fail clearly
      // instead, exactly per the "wrong section must never be edited" rule.
      if (!patchedHtml || !validation.valid) {
        return NextResponse.json({
          text:        "Could not apply the edit reliably. Please try again or rephrase the request.",
          reply:       "Could not apply the edit reliably. Please try again or rephrase the request.",
          codeChanges: null,
        });
      }
    }

    // ── Final safety: must return complete HTML ──────────────────
    if (!patchedHtml || patchedHtml.length < 500 || !patchedHtml.includes("<!DOCTYPE")) {
      return NextResponse.json({
        text:        "Edit could not produce valid HTML. Try a more specific request.",
        reply:       "Edit could not produce valid HTML. Try a more specific request.",
        codeChanges: null,
      });
    }

    // ── Build log ────────────────────────────────────────────────
    log.provider   = provider;
    log.attempts   = attempts;
    log.patchSize  = patchedHtml.length - fullHtml.length;
    log.validation = validation;
    log.durationMs = Date.now() - startMs;

    const explanation = (() => {
      switch (intent) {
        case "STYLE_EDIT":     return `Style updated: ${actualMessage}`;
        case "CONTENT_EDIT":   return `Content updated: ${actualMessage}`;
        case "LAYOUT_EDIT":    return `Layout changed: ${actualMessage}`;
        case "COMPONENT_EDIT": return `Component updated: ${actualMessage}`;
        case "DEBUG_EDIT":     return `Bug fixed: ${actualMessage}`;
        default:               return `Edit applied: ${actualMessage}`;
      }
    })();

    return NextResponse.json({
      text:        explanation,
      reply:       explanation,
      codeChanges: { "index.html": patchedHtml },
      provider,
      log,
    });

  } catch (err: any) {
    console.error("[Chat] Unhandled error:", err.message);
    return NextResponse.json({
      text:        "Something went wrong. Please try again.",
      reply:       "Something went wrong. Please try again.",
      codeChanges: null,
    });
  }
}
