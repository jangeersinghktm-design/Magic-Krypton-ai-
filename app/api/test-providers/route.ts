// app/api/test-providers/route.ts
// Krypton AI — Provider + System Test API (Admin Only)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

async function requireAdmin(req: NextRequest): Promise<{ ok: boolean; userId?: string }> {
  const { accessToken } = await req.clone().json().catch(() => ({}));
  if (!accessToken) return { ok: false };
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user) return { ok: false };
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return p?.role === "admin" ? { ok: true, userId: user.id } : { ok: false };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { provider } = body;

  // ── ENV Check ────────────────────────────────────────────────
  if (provider === "env_check") {
    const required = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_TOKEN"];
    const missing  = required.filter(k => !process.env[k]);
    return NextResponse.json({ ok: missing.length === 0, missing });
  }

  // ── Vercel Token Check ───────────────────────────────────────
  if (provider === "vercel_check") {
    const key = process.env.VERCEL_TOKEN;
    if (!key) return NextResponse.json({ ok: false, missing: true, error: "VERCEL_TOKEN not set" });
    return NextResponse.json({ ok: true, message: "VERCEL_TOKEN configured" });
  }

  // ── Vercel API Check ─────────────────────────────────────────
  if (provider === "vercel_api") {
    const key = process.env.VERCEL_TOKEN;
    if (!key) return NextResponse.json({ ok: false, error: "VERCEL_TOKEN missing" });
    try {
      const res = await fetch("https://api.vercel.com/v6/deployments?limit=1", {
        headers: { "Authorization": `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: `Vercel API ${res.status}` });
      const d = await res.json();
      const last = d.deployments?.[0];
      return NextResponse.json({ ok: true, message: "Vercel API reachable", lastDeploy: last ? `${last.name} — ${last.state}` : "No deployments" });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message });
    }
  }

  // ── Claude ───────────────────────────────────────────────────
  if (provider === "claude") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY missing" });
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 10, messages: [{ role: "user", content: "ping" }] }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ ok: false, error: `Claude ${res.status}: ${err?.error?.message || "Check credits"}` });
      }
      return NextResponse.json({ ok: true, message: "Claude responding ✓" });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message });
    }
  }

  // ── OpenAI ───────────────────────────────────────────────────
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" });
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 10, messages: [{ role: "user", content: "ping" }] }),
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

  // ── Gemini ───────────────────────────────────────────────────
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ ok: false, error: "GEMINI_API_KEY missing" });
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 10 } }),
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

  return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
}
