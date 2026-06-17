// app/api/test-providers/route.ts
import { NextRequest, NextResponse } from "next/server";
export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { provider } = await req.json().catch(() => ({}));

  if (provider === "claude") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY missing" });
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 10, messages: [{ role: "user", content: "Hi" }] }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ ok: false, error: `Claude ${res.status}: ${err?.error?.message || "API error"}` });
      }
      return NextResponse.json({ ok: true, message: "Claude responding ✓" });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message });
    }
  }

  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" });
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 10, messages: [{ role: "user", content: "Hi" }] }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ ok: false, error: `OpenAI ${res.status}: ${err?.error?.message || "API error"}` });
      }
      return NextResponse.json({ ok: true, message: "OpenAI responding ✓" });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message });
    }
  }

  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ ok: false, error: "GEMINI_API_KEY missing" });
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }], generationConfig: { maxOutputTokens: 10 } }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ ok: false, error: `Gemini ${res.status}: ${err?.error?.message || "API error"}` });
      }
      return NextResponse.json({ ok: true, message: "Gemini responding ✓" });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message });
    }
  }

  return NextResponse.json({ ok: false, error: "Unknown provider" });
}

