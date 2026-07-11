// lib/ai-providers.ts
// Extracted verbatim from app/api/orchestrate/route.ts — same functions,
// same behavior, same retry/fallback logic. Moved here so the new
// /api/chat-assistant route can reuse them without duplicating this
// logic, and so orchestrate's own behavior is completely unchanged
// (it now imports these instead of defining them inline).

export async function callClaude(system: string, user: string, maxTokens = 6000): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
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
  return d.content?.[0]?.text || "";
}

export async function callOpenAI(system: string, user: string, maxTokens = 16000): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json","Authorization":`Bearer ${key}` },
    body: JSON.stringify({ model:"gpt-4o", max_tokens:maxTokens, messages:[{role:"system",content:system},{role:"user",content:user}] }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

export async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ contents:[{parts:[{text:`${system}\n\n${user}`}]}], generationConfig:{maxOutputTokens:16000} }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const d = await res.json();
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

export async function kryptonGenerate(system: string, prompt: string): Promise<{text:string;provider:string}> {
  for (const [fn, name] of [[callClaude, "claude"],[callOpenAI,"openai"],[callGemini,"gemini"]] as const) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await (fn as Function)(system, prompt);
        if (text?.trim()) return { text, provider: name };
        break;
      } catch (e: any) {
        const status = e?.status ?? e?.response?.status ?? "";
        const is429 = status === 429 || String(e?.message||"").includes("429");
        if (attempt === 0 && is429) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        break;
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
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await (fn as Function)(system, userText, imageDataUrl);
        if (text?.trim()) return { text, provider: name };
        break;
      } catch (e: any) {
        const status = e?.status ?? e?.response?.status ?? "";
        const is429 = status === 429 || String(e?.message||"").includes("429");
        if (attempt === 0 && is429) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        break;
      }
    }
  }
  throw new Error("All AI providers failed to analyze the image");
}
