// app/api/chat/route.ts
// Krypton AI — Project Chat with Memory + Context

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const {
      projectName,
      framework = "html",
      currentCode,
      userMessage,
      history = [],
      projectId,
    } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    // Build code context (limit to 6000 chars)
    const codeContext = Object.entries(currentCode as Record<string, string>)
      .map(([file, code]) => `### ${file}\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\``)
      .join("\n");

    // Build conversation history (last 10 messages for memory)
    const historyMessages = history.slice(-10).map((m: any) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.content,
    }));

    // Build messages
    const messages = [
      ...historyMessages,
      {
        role: "user" as const,
        content: `Project: ${projectName} (${framework})\n\nCurrent Code:\n${codeContext}\n\nUser Request: ${userMessage}`,
      },
    ];

    const system = `You are Krypton AI — an expert full-stack developer assistant.
You have full context of the user's project and remember previous instructions in this conversation.

When making code changes:
1. Return the COMPLETE updated file content
2. Wrap changes in: <code_changes>{"filename": "full content"}</code_changes>
3. Explain what you changed briefly
4. List modified files

For edit requests like:
- "Make hero section larger" → increase hero padding/height
- "Add dark mode" → add CSS dark mode variables + toggle
- "Change pricing cards" → update pricing section styling
- "Improve mobile layout" → add responsive CSS breakpoints
- "Add login page" → create login HTML/component

Always maintain project context and remember what was done before.
Be concise, professional, and specific.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Claude error: ${response.status}` }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content
      .map((b: { type: string; text?: string }) => b.text || "")
      .join("");

    // Extract code changes
    const codeMatch = text.match(/<code_changes>([\s\S]*?)<\/code_changes>/);
    let codeChanges: Record<string, string> | null = null;
    if (codeMatch) {
      try { codeChanges = JSON.parse(codeMatch[1].trim()); } catch {}
    }

    // Clean text (remove code_changes block from display)
    const cleanText = text.replace(/<code_changes>[\s\S]*?<\/code_changes>/g, "").trim();

    return NextResponse.json({ text: cleanText, codeChanges });

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
