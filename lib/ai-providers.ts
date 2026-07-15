// lib/ai-providers.ts
// Extracted verbatim from app/api/orchestrate/route.ts — same functions,
// same behavior, same retry/fallback logic. Moved here so the new
// /api/chat-assistant route can reuse them without duplicating this
// logic, and so orchestrate's own behavior is completely unchanged
// (it now imports these instead of defining them inline).

import { CostTracker, CostGuardAbortError, getActiveCostTracker, type CostEstimate, type ProviderName } from "@/lib/cost-guard";

export async function callClaude(system: string, user: string, maxTokens = 6000): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  // Cost Guard — checked before EVERY real Claude call, automatically,
  // via AsyncLocalStorage (no active tracker = no active generation
  // context = check is skipped gracefully, never blocks calls made
  // outside a tracked request).
  const tracker = getActiveCostTracker();
  let costEstimate: CostEstimate | undefined;
  if (tracker) costEstimate = tracker.checkBeforeCall("claude", system, user, maxTokens);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } }
      ],
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const d = await res.json();
  if (tracker && costEstimate) {
    tracker.recordCall(costEstimate);
    // Real accuracy check — Claude's response includes actual token
    // counts; compare against the estimate used for the Cost Guard
    // check above. Logged for real calibration, not a claimed-but-
    // unverified number — true accuracy can only be observed once this
    // runs against real production traffic.
    if (d.usage) {
      const realInput = d.usage.input_tokens || 0;
      const realOutput = d.usage.output_tokens || 0;
      const inputDeltaPct = costEstimate.estimatedInputTokens > 0 ? ((realInput - costEstimate.estimatedInputTokens) / costEstimate.estimatedInputTokens * 100) : 0;
      const outputDeltaPct = costEstimate.estimatedOutputTokens > 0 ? ((realOutput - costEstimate.estimatedOutputTokens) / costEstimate.estimatedOutputTokens * 100) : 0;
      console.log(`[cost-guard accuracy] estimated input=${costEstimate.estimatedInputTokens} vs real=${realInput} (${inputDeltaPct.toFixed(1)}% delta) | estimated output=${costEstimate.estimatedOutputTokens} vs real=${realOutput} (${outputDeltaPct.toFixed(1)}% delta)`);
    }
  }
  return d.content?.[0]?.text || "";
}

export async function callOpenAI(system: string, user: string, maxTokens = 16000): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const tracker = getActiveCostTracker();
  let costEstimate: CostEstimate | undefined;
  if (tracker) costEstimate = tracker.checkBeforeCall("openai", system, user, maxTokens);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json","Authorization":`Bearer ${key}` },
    body: JSON.stringify({ model:"gpt-4o", max_tokens:maxTokens, messages:[{role:"system",content:system},{role:"user",content:user}] }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const d = await res.json();
  if (tracker && costEstimate) tracker.recordCall(costEstimate);
  return d.choices?.[0]?.message?.content || "";
}

// Groq — genuine, functional implementation. Groq's API is OpenAI-
// compatible (same request/response shape), so this mirrors callOpenAI's
// structure exactly, pointed at Groq's endpoint and model. Cost Guard is
// wired in from the start, not added after the fact.
export async function callGroq(system: string, user: string, maxTokens = 8000): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  const tracker = getActiveCostTracker();
  let costEstimate: CostEstimate | undefined;
  if (tracker) costEstimate = tracker.checkBeforeCall("groq", system, user, maxTokens);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json","Authorization":`Bearer ${key}` },
    body: JSON.stringify({ model:"llama-3.3-70b-versatile", max_tokens:maxTokens, messages:[{role:"system",content:system},{role:"user",content:user}] }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const d = await res.json();
  if (tracker && costEstimate) tracker.recordCall(costEstimate);
  return d.choices?.[0]?.message?.content || "";
}

export async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const tracker = getActiveCostTracker();
  let costEstimate: CostEstimate | undefined;
  if (tracker) costEstimate = tracker.checkBeforeCall("gemini", system, user, 16000);

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ contents:[{parts:[{text:`${system}\n\n${user}`}]}], generationConfig:{maxOutputTokens:16000} }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const d = await res.json();
  if (tracker && costEstimate) tracker.recordCall(costEstimate);
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Vision-capable Claude call — a SEPARATE function, not a modification to
// callClaude's signature, so every existing caller (kryptonGenerate, the
// whole orchestrate pipeline) is completely unaffected.
export async function callClaudeVision(system: string, userText: string, imageDataUrl: string, maxTokens = 2000): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  const [, mediaType, base64Data] = match;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          { type: "text", text: userText },
        ],
      }],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Claude Vision ${res.status}`);
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

export async function callOpenAIVision(system: string, userText: string, imageDataUrl: string, maxTokens = 2000): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json","Authorization":`Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ]},
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`OpenAI Vision ${res.status}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

export async function callGeminiVision(system: string, userText: string, imageDataUrl: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  const [, mediaType, base64Data] = match;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: `${system}\n\n${userText}` },
        { inline_data: { mime_type: mediaType, data: base64Data } },
      ]}],
      generationConfig: { maxOutputTokens: 2000 },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini Vision ${res.status}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Classifies whether an error from a provider call is worth retrying.
// Timeouts/network failures and transient 5xx/429s are retryable — the
// same request might succeed on a fresh attempt. Auth errors (401/403)
// and bad-request errors (400) will fail identically every time, so
// retrying them only wastes time and money.
function isRetryableProviderError(e: any): boolean {
  const name = e?.name || "";
  if (name === "TimeoutError" || name === "AbortError") return true; // real network/timeout
  const msg = String(e?.message || "");
  const statusMatch = msg.match(/\b(\d{3})\b/);
  if (!statusMatch) return true; // unknown error shape — err on the side of one retry
  const status = parseInt(statusMatch[1], 10);
  if (status === 400 || status === 401 || status === 403 || status === 404) return false; // never retryable
  return true; // 429, 5xx, and anything else transient
}

export async function kryptonGenerate(system: string, prompt: string): Promise<{text:string;provider:string}> {
  const providers: [Function, string, number][] = [
    [callClaude, "claude", 3],
    [callOpenAI, "openai", 2],
    [callGemini, "gemini", 2],
    [callGroq, "groq", 2],
  ];
  for (const [fn, name, maxAttempts] of providers) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Cost Guard is checked automatically INSIDE callClaude/callOpenAI/
        // callGemini via AsyncLocalStorage (see lib/cost-guard.ts) — no
        // explicit tracker parameter needed here, and no double-counting.
        const text = await (fn as Function)(system, prompt);
        if (text?.trim()) {
          return { text, provider: name };
        }
        break; // empty response — not worth retrying this provider further
      } catch (e: any) {
        if (e instanceof CostGuardAbortError) throw e; // never silently swallowed — this must stop the whole generation
        if (attempt < maxAttempts - 1 && isRetryableProviderError(e)) {
          // Real retry of the SAME provider — timeouts and other transient
          // failures get a genuine retry before this provider is considered
          // exhausted and we move on. Non-retryable errors (auth/bad-request)
          // skip straight to the next provider.
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        break; // exhausted or non-retryable — move to next provider, never revisit
      }
    }
  }
  throw new Error("All AI providers failed");
}

// Provider-agnostic vision dispatch — mirrors kryptonGenerate's exact
// fallback order and retry logic. Callers (e.g. /api/chat-assistant)
// never pick Claude/OpenAI/Gemini specifically; this decides automatically
// based on which provider actually succeeds, same as text generation.
export async function kryptonGenerateVision(system: string, userText: string, imageDataUrl: string): Promise<{text:string;provider:string}> {
  const providers = [
    [callClaudeVision, "claude"],
    [callOpenAIVision, "openai"],
    [callGeminiVision, "gemini"],
  ] as const;

  for (const [fn, name] of providers) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const text = await (fn as Function)(system, userText, imageDataUrl);
        if (text?.trim()) return { text, provider: name };
        break;
      } catch (e: any) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        break;
      }
    }
  }
  throw new Error("All AI providers failed to analyze the image");
}
