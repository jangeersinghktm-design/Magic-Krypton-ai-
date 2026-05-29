import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const systemPrompt = `You are an expert web developer. Create a complete, beautiful, fully-functional HTML page.

USER REQUEST: "${prompt}"

STRICT RULES - FOLLOW EXACTLY:
1. Output ONLY raw HTML - start with <!DOCTYPE html> and end with </html>
2. NO markdown, NO backticks, NO explanations before or after HTML
3. MUST have white or light background - body background MUST be #ffffff or #f8f9fa
4. ALL text MUST be dark and visible - use #111111 or #333333
5. Include Google Fonts via @import in style tag
6. ALL CSS inside <style> tag in <head>
7. ALL JavaScript inside <script> tag before </body>
8. Mobile responsive with media queries
9. Include real content - NO lorem ipsum

DESIGN:
- Beautiful hero section with gradient
- Professional navigation header
- Feature cards with shadows
- CTA buttons with hover effects
- Professional footer
- Smooth animations

QUALITY: Professional $10,000 agency level design.`;

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
          model: "claude-opus-4-5",
          max_tokens: 8000,
          messages: [{ role: "user", content: systemPrompt }],
        }),
      });

      if (claudeRes.ok) {
        const data = await claudeRes.json();
        let html = data.content[0].text;
        html = html.replace(/^```html\n?/im, "").replace(/^```\n?/im, "").replace(/\n?```$/im, "").trim();
        const start = html.indexOf("<!DOCTYPE");
        if (start > 0) html = html.substring(start);
        html = html.replace(/<body/i, '<body style="background:#ffffff;color:#111111;"');
        console.log("Claude success!");
        return NextResponse.json({ html, model: "claude" });
      } else {
        const err = await claudeRes.text();
        console.log("Claude error:", err);
      }
    } catch (e: any) {
      console.log("Claude exception:", e.message);
    }

    // Try Gemini second
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { maxOutputTokens: 8000, temperature: 0.7 },
          }),
        }
      );

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        let html = text.replace(/^```html\n?/im, "").replace(/^```\n?/im, "").replace(/\n?```$/im, "").trim();
        const start = html.indexOf("<!DOCTYPE");
        if (start > 0) html = html.substring(start);
        html = html.replace(/<body/i, '<body style="background:#ffffff;color:#111111;"');
        console.log("Gemini success!");
        return NextResponse.json({ html, model: "gemini" });
      } else {
        const err = await geminiRes.text();
        console.log("Gemini error:", err);
      }
    } catch (e: any) {
      console.log("Gemini exception:", e.message);
    }

    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });

  } catch (error: any) {
    console.log("Server error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
