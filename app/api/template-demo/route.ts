// app/api/template-demo/route.ts
// Krypton AI — Real AI-powered template demos
// Replaces hardcoded fake typewriter text with actual AI generation

import { NextRequest, NextResponse } from "next/server";

export const runtime    = "edge";
export const maxDuration = 25;

// Lightweight system prompts per template — keeps demo fast + focused
const TEMPLATE_SYSTEMS: Record<string, string> = {
  "ai-chatbot": `You are a friendly, helpful AI customer support assistant. Answer the user's support question clearly and concisely in 3-5 sentences. Be warm and professional.`,

  "seo-writer": `You are an expert SEO copywriter. Write SEO-optimized content for the given topic. Keep it concise (3-4 sentences), include relevant keywords naturally, and make it compelling.`,

  "code-gen": `You are an expert software engineer. Write clean, production-ready code for the request. Include brief comments. Output ONLY the code in a markdown code block — no lengthy explanation.`,

  "image-gen": `You are an AI image prompt expert. The user wants to generate an image. Respond with a detailed, vivid image generation prompt (3-4 sentences) describing exactly what the image would look like, as if describing the final artwork in rich detail.`,

  "email-writer": `You are an expert email copywriter. Write a professional, concise email based on the request. Include a subject line. Keep the body under 120 words. Format clearly with Subject: and Body:.`,

  "data-analyst": `You are a data analyst. Given the request, describe 3-4 specific, realistic insights someone would find from this kind of data analysis. Be specific with example metrics and patterns (clearly note these are illustrative example insights, not from real uploaded data).`,
};

async function callAI(system: string, prompt: string): Promise<string> {
  // Claude first
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const d = await res.json();
        const text = d.content?.[0]?.text;
        if (text) return text;
      }
    } catch {}
  }

  // OpenAI fallback
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 500,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const d = await res.json();
        const text = d.choices?.[0]?.message?.content;
        if (text) return text;
      }
    } catch {}
  }

  // Gemini fallback
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${system}\n\n${prompt}` }] }],
            generationConfig: { maxOutputTokens: 500 },
          }),
          signal: AbortSignal.timeout(12000),
        }
      );
      if (res.ok) {
        const d = await res.json();
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch {}
  }

  throw new Error("All AI providers failed");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { templateId, prompt } = body;

  if (!templateId || !TEMPLATE_SYSTEMS[templateId]) {
    return NextResponse.json({ error: "Invalid template" }, { status: 400 });
  }
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  }

  try {
    const output = await callAI(TEMPLATE_SYSTEMS[templateId], prompt.trim());
    return NextResponse.json({ output });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Demo generation failed. Please try again." },
      { status: 500 }
    );
  }
}
