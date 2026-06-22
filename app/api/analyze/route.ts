import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const SCHEMA = `{
  "score": <number 0-100>,
  "label": <"Excellent"|"Good"|"Fair"|"Needs Work"|"Poor"|"Critical">,
  "summary": <string>,
  "issues": [{ "severity": <"error"|"warning"|"info">, "message": <string> }],
  "metrics": [{ "label": <string>, "value": <string>, "good": <boolean> }],
  "suggestions": [{ "title": <string>, "detail": <string>, "priority": <"high"|"medium"|"low"> }]
}`;

function getSystemPrompt(type: string): string {
  const role =
    type === "code"
      ? "expert software engineer and code reviewer"
      : type === "seo"
      ? "expert SEO specialist and content strategist"
      : "expert web performance engineer";

  return `You are a ${role} inside Krypton AI.
Analyze the input and return ONLY a valid JSON object.
No markdown, no backticks, no text outside JSON.
Schema:
${SCHEMA}
Rules:
- score: realistic 0-100 integer
- issues: 3-8 items, errors first
- metrics: 4-6 relevant metrics
- suggestions: 3-5 actionable items
- Return ONLY raw JSON`;
}

function getUserMessage(type: string, input: string): string {
  if (type === "performance")
    return `Analyze performance of this URL: ${input.trim()}`;
  if (type === "seo")
    return `Analyze SEO of this content:\n\n${input}`;
  return `Analyze this code:\n\n${input}`;
}

function getScoreColor(score: number): string {
  if (score >= 85) return "#00D084";
  if (score >= 70) return "#F5C542";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, input } = body;

    if (!type || !["code", "seo", "performance"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Use: code | seo | performance" },
        { status: 400 }
      );
    }

    if (!input || input.trim().length < 5) {
      return NextResponse.json(
        { error: "Input too short" },
        { status: 400 }
      );
    }

    if (input.length > 15000) {
      return NextResponse.json(
        { error: "Input too long. Max 15,000 characters." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const claudeResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: getSystemPrompt(type),
          messages: [
            {
              role: "user",
              content: getUserMessage(type, input),
            },
          ],
        }),
      }
    );

    if (!claudeResponse.ok) {
      return NextResponse.json(
        { error: `Claude API error: ${claudeResponse.status}` },
        { status: 500 }
      );
    }

    const claudeData = await claudeResponse.json();

    const rawText = claudeData.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");

    const cleaned = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    let parsed;
    try {
      console.log("ANALYZE RAW LENGTH:", cleaned.length);
      console.log("ANALYZE RAW FIRST 1000:", cleaned.slice(0, 1000));
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json(
          { error: "Failed to parse Claude response" },
          { status: 500 }
        );
      }
      parsed = JSON.parse(match[0]);
    }

    const score = Math.min(100, Math.max(0, Number(parsed.score) || 0));

    return NextResponse.json({
      ...parsed,
      score,
      color: getScoreColor(score),
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
