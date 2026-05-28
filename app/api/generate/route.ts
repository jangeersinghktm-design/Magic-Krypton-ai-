import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

     const systemPrompt = `Create a complete beautiful HTML page for: "${prompt}". 
IMPORTANT RULES:
- Return ONLY raw HTML code starting with <!DOCTYPE html>
- NO markdown, NO backticks, NO explanation
- Use WHITE or LIGHT background colors
- Include ALL CSS inside <style> tags
- Include ALL JavaScript inside <script> tags  
- Make it visually stunning with modern design
- Mobile responsive design
- Use beautiful colors, gradients, animations`;
    // Try Claude first
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: systemPrompt }],
      }),
    });

    if (claudeRes.ok) {
      const data = await claudeRes.json();
      const html = data.content[0].text.replace(/```html/g, "").replace(/```/g, "").trim();
      return NextResponse.json({ html, model: "claude" });
    } else {
      const err = await claudeRes.text();
      console.log("Claude error:", err);
    }

    // Try Gemini second
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const html = text.replace(/```html/g, "").replace(/```/g, "").trim();
      return NextResponse.json({ html, model: "gemini" });
    } else {
      const err = await geminiRes.text();
      console.log("Gemini error:", err);
    }

    return NextResponse.json({ error: "All AI services failed" }, { status: 500 });

  } catch (error: any) {
    console.log("Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
