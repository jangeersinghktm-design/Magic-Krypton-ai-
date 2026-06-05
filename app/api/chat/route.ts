import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const {
      projectName,
      framework,
      currentCode,
      userMessage,
      history = [],
    } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const codeContext = Object.entries(currentCode as Record<string, string>)
      .map(([file, code]) => `### ${file}\n\`\`\`\n${code}\n\`\`\``)
      .join("\n");

    const messages = [
      ...history,
      {
        role: "user" as const,
        content: `Project: ${projectName} (${framework})\n\nCode:\n${codeContext}\n\nRequest: ${userMessage}`,
      },
    ];

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
        system: `You are Krypton AI — expert developer assistant.
You know the project code. Help the user improve it.
When modifying code, wrap changes in:
<code_changes>
{"filename.tsx": "full updated content"}
</code_changes>
Be concise and professional.`,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Claude API error: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const text = data.content
      .map((b: { type: string; text?: string }) => b.text || "")
      .join("");

    // Extract code changes
    const codeMatch = text.match(/<code_changes>([\s\S]*?)<\/code_changes>/);
    let codeChanges = null;
    if (codeMatch) {
      try {
        codeChanges = JSON.parse(codeMatch[1].trim());
      } catch {}
    }

    return NextResponse.json({ text, codeChanges });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
