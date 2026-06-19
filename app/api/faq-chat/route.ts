// app/api/faq-chat/route.ts
// Krypton AI — FAQ Assistant
// Lightweight Q&A endpoint for the public FAQ page. No auth required.

import { NextRequest, NextResponse } from "next/server";

export const runtime    = "edge";
export const maxDuration = 20;

const FAQ_SYSTEM = `You are the Krypton AI support assistant, answering questions on the public FAQ page.

ABOUT KRYPTON AI:
- An AI platform that builds websites, web apps, browser games, and dashboards from plain English descriptions
- No coding required — describe an idea, AI generates complete, production-ready code in seconds
- Output is real HTML/CSS/JS — downloadable and deployable anywhere (Vercel, Netlify, GitHub Pages)
- Plans: Free (5 generations/day), Pro ($25/mo), Premium ($69/mo), Business ($149/mo)
- Free plan: Website/App/Game generator, live preview, download HTML, community support
- Pro adds: save projects, project history, faster generation, better AI, export code, premium templates
- Powered by Claude, GPT-4o, and Gemini with automatic fallback for reliability

RULES:
1. Answer ONLY questions about Krypton AI — its features, pricing, how it works, capabilities
2. Keep answers SHORT — 2-4 sentences maximum
3. Be friendly, confident, and helpful
4. If asked something unrelated to Krypton AI, politely redirect: "I can help with questions about Krypton AI — what would you like to know?"
5. If asked about specific pricing, encourage checking the /billing page for current numbers
6. Never make up features that don't exist
7. No markdown formatting — plain conversational text only`;

async function callAI(prompt: string): Promise<string> {
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
          max_tokens: 300,
          system: FAQ_SYSTEM,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(12000),
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
          max_tokens: 300,
          messages: [
            { role: "system", content: FAQ_SYSTEM },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(12000),
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
            contents: [{ parts: [{ text: `${FAQ_SYSTEM}\n\nQuestion: ${prompt}` }] }],
            generationConfig: { maxOutputTokens: 300 },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.ok) {
        const d = await res.json();
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch {}
  }

  return "I'm having trouble connecting right now. Please try again in a moment, or check our FAQ section above for common questions.";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { question } = body;

  if (!question?.trim()) {
    return NextResponse.json({ error: "Question required" }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ error: "Question too long" }, { status: 400 });
  }

  try {
    const answer = await callAI(question.trim());
    return NextResponse.json({ answer });
  } catch (err: any) {
    return NextResponse.json(
      { answer: "Something went wrong. Please try again." },
      { status: 200 }
    );
  }
}
