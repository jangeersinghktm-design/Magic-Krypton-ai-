// app/api/project-manager/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const systemPrompt = `You are an expert software architect and project manager.

The user wants to build: "${prompt}"

Generate a COMPLETE project plan in JSON format. Return ONLY valid JSON, no markdown.

{
  "title": "App name",
  "description": "Brief description",
  "techStack": ["React", "Node.js", "PostgreSQL", "..."],
  "screens": [
    {
      "name": "Screen name",
      "description": "What this screen does",
      "prompt": "Build a [specific screen description] with [specific features]. Use dark theme, modern UI. Include all UI elements visible in a real app."
    }
  ],
  "dbSchema": "-- SQL schema\\nCREATE TABLE users (\\n  id UUID PRIMARY KEY,\\n  ...\\n);\\n...",
  "apiDocs": "# API Documentation\\n\\n## POST /api/auth/login\\nDescription...\\n\\n## GET /api/users\\n...",
  "roadmap": [
    {
      "phase": "Phase 1: Foundation (Week 1-2)",
      "tasks": ["Set up project", "Configure database", "..."]
    }
  ]
}

Rules:
- Generate 5-8 screens minimum
- Each screen prompt must be detailed and specific
- DB schema must be real SQL with proper tables
- API docs must cover all main endpoints
- Roadmap must have 4-6 phases
- Tech stack must match the app type
- Return ONLY JSON, no other text`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{ role: "user", content: systemPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `API error: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    let text = data.content[0].text;

    // Clean JSON
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    let plan;
    try {
      plan = JSON.parse(text);
    } catch (e) {
      // Try to extract JSON
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        plan = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
      }
    }

    return NextResponse.json({ plan });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

