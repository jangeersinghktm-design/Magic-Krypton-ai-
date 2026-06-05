import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const RESPONSE_SCHEMA = `
{
  "score": <number 0-100>,
  "label": <"Excellent"|"Good"|"Fair"|"Needs Work"|"Poor"|"Critical">,
  "summary": <one paragraph string>,
  "issues": [
    { "severity": <"error"|"warning"|"info">, "message": <string> }
  ],
  "metrics": [
    { "label": <string>, "value": <string>, "good": <boolean> }
  ],
  "suggestions": [
    { "title": <string>, "detail": <string>, "priority": <"high"|"medium"|"low"> }
  ]
}`;

function buildSystemPrompt(type: "code" | "seo" | "performance"): string {
  return `You are an expert ${
    type === "code" ? "software engineer and code reviewer" :
    type === "seo"  ? "SEO specialist and content strategist" :
    "web performance engineer"
  } working inside Krypton AI.

Analyze the user input and return ONLY a single valid JSON object.
No markdown, no backticks, no explanation outside JSON.

JSON schema:
${RESPONSE_SCHEMA}

Rules:
- score: 0-100 integer
- issues: 3-8 items ordered by severity
- metrics: 4-6 key metrics
- suggestions: 3-5 actionable improvements
- ONLY return JSON, nothing else`;
}

async function callClaude(systemPrompt: string, userContent: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  const data = await response.json();
  return data.content.map((b: {type: string; text?: string}) => b.text || "").join("");
}

export async function POST(req: NextRequest) {
  try {
    const { type, input } = await req.json();

    if (!["code", "seo", "performance"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (!input || input.trim().length < 10) {
      return NextResponse.json({ error: "Input too short" }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(type);
    const userContent =
      type === "performance" ? `Analyze performance of URL: ${input}` :
      type === "seo" ? `Analyze SEO of this content:\n\n${input}` :
      `Analyze this code:\n\n${input}`;

    const raw = await callClaude(systemPrompt, userContent);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const score = Number(parsed.score) || 0;
    const color = score >= 85 ? "#00D084" : score >= 70 ? "#F5C542" : score >= 50 ? "#f59e0b" : "#ef4444";

    return NextResponse.json({ ...parsed, score, color });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
