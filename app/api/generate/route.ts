import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const systemPrompt = `You are an expert web developer. Create a complete, beautiful, modern HTML page for: "${prompt}". Return ONLY HTML code starting with <!DOCTYPE html>. Include all CSS in <style> tags and JS in <script> tags. Make it stunning and mobile responsive.`;

    // Try Claude first
    try {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4096,
          messages: [{ role: "user", content: systemPrompt }],
        }),
      });

      if (claudeRes.ok) {
        const data = await claudeRes.json();
        const html = data.content[0].text;
        return NextResponse.json({ html, model: "claude" });
      }
    } catch (e) {
      console.log("Claude failed, trying OpenAI...");
    }

    // Try OpenAI second
    try {
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 4096,
          messages: [{ role: "user", content: systemPrompt }],
        }),
      });

      if (openaiRes.ok) {
        const data = await openaiRes.json();
        const html = data.choices[0].message.content;
        return NextResponse.json({ html, model: "openai" });
      }
    } catch (e) {
      console.log("OpenAI failed, trying Gemini...");
    }

    // Try Gemini last
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
          }),
        }
      );

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const html = data.candidates[0].content.parts[0].text;
        return NextResponse.json({ html, model: "gemini" });
      }
    } catch (e) {
      console.log("Gemini also failed!");
    }

    return NextResponse.json({ error: "All AI services failed" }, { status: 500 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
