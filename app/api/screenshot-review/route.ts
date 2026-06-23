// app/api/screenshot-review/route.ts
// Krypton AI — Screenshot Vision Review
// Sends generated HTML + screenshot (base64) to Claude Vision for design review.
// Uses html2canvas client-side (called from create page), result sent here.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function callClaudeVision(imageBase64: string, html: string): Promise<{
  score: number;
  issues: string[];
  passed: string[];
  autoFixInstructions: string;
}> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  // Extract visible text content from HTML for context (no full HTML — too long)
  const textContext = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `You are a senior UI/UX design critic reviewing a generated website screenshot.

Page text content (for context): "${textContext}"

Review this screenshot for these SPECIFIC issues. Be direct and actionable.

Check for:
1. CROPPED/CUT TEXT — any heading or text that gets cut off at edges
2. BUTTON VISIBILITY — buttons hard to see, low contrast, or invisible
3. MOBILE LAYOUT — any horizontal overflow or layout breaking
4. FOOTER QUALITY — is footer complete with multiple columns, or thin/missing?
5. HERO SECTION — is hero strong and compelling, or weak/plain?
6. SPACING — sections too cramped or too spread out?
7. COLOR CONTRAST — text readable against background?
8. OVERALL IMPRESSION — first impression score 1-10

Output ONLY valid JSON (no markdown):
{
  "score": 7,
  "issues": ["specific issue 1", "specific issue 2"],
  "passed": ["what looks good 1", "what looks good 2"],
  "autoFixInstructions": "Single paragraph of specific CSS/HTML fixes needed"
}

Be honest. If score is below 7, list real actionable issues. Max 4 issues, max 3 passed items.`,
          },
        ],
      }],
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude Vision ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback if JSON parse fails
    return {
      score: 0,
      issues: ["Could not parse vision review response"],
      passed: [],
      autoFixInstructions: "",
    };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { screenshot, html } = body;

  if (!screenshot || !html) {
    return NextResponse.json({ error: "screenshot and html required" }, { status: 400 });
  }

  // Remove data URL prefix if present
  const base64 = screenshot.replace(/^data:image\/\w+;base64,/, "");

  try {
    const review = await callClaudeVision(base64, html);
    return NextResponse.json({ review });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Vision review failed" }, { status: 500 });
  }
}

