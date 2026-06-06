import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an elite full-stack developer and UI/UX designer. Build EXACTLY what the user asks.

USER REQUEST: "${prompt}"

OUTPUT FORMAT:
- Output ONLY raw HTML starting with <!DOCTYPE html>
- End with </html>
- ZERO backticks, ZERO markdown
- Single self-contained HTML file

DESIGN:
- White or light background ALWAYS
- Dark readable text ALWAYS
- Premium fonts from Google Fonts
- Smooth animations and hover effects
- Mobile responsive

FOR GAMES:
- Use HTML5 Canvas
- 60fps with requestAnimationFrame
- Keyboard + touch controls
- Score system and game over screen
- Canvas MUST resize with window

FOR WEBSITES:
- Full multi-section: header, hero, features, pricing, footer
- All sections must be complete
- Working hamburger menu on mobile

FOR APPS:
- Fully functional
- LocalStorage for data persistence
- Beautiful empty states

QUALITY: Think Stripe, Linear, Notion level quality.`;

    const getRepairPrompt = (html: string, issues: string[]): string =>
      `Fix these HTML issues and return ONLY corrected HTML:
${issues.map((issue, n) => `${n + 1}. ${issue}`).join("\n")}
HTML: ${html.substring(0, 10000)}`;

    const isGameRequest = /game|snake|tetris|pong|chess|puzzle|arcade|shooter|runner|platformer/i.test(prompt);
    const isWebsiteRequest = /website|landing|portfolio|business|saas|agency|startup|blog|shop/i.test(prompt);

    const validateHtml = (html: string): { valid: boolean; issues: string[] } => {
      const issues: string[] = [];
      if (!html.startsWith("<!DOCTYPE") || !html.includes("</html>")) {
        issues.push("Invalid HTML structure");
      }
      if (html.length < 1500) {
        issues.push("HTML too short");
      }
      if (isWebsiteRequest) {
        if (!html.includes("<header")) issues.push("Missing header");
        if (!html.includes("<footer")) issues.push("Missing footer");
      }
      if (isGameRequest) {
        if (!html.includes("<canvas")) issues.push("Missing canvas");
        if (!html.includes("requestAnimationFrame")) issues.push("Missing game loop");
      }
      return { valid: issues.length === 0, issues };
    };

    const cleanHtml = (html: string): string => {
      html = html
        .replace(/^```html\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const idx = html.indexOf("<!DOCTYPE");
      if (idx > 0) html = html.substring(idx);
      return html;
    };

    const callClaude = async (content: string): Promise<string | null> => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 12000,
          messages: [{ role: "user", content }],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.content[0].text;
    };

    const processHtml = async (raw: string): Promise<string | null> => {
      const html = cleanHtml(raw);
      const { valid, issues } = validateHtml(html);
      if (valid) return html;

      const repaired = await callClaude(getRepairPrompt(html, issues));
      if (repaired) {
        const fixed = cleanHtml(repaired);
        if (fixed.length > 1500) return fixed;
      }
      return html.length > 1500 ? html : null;
    };

    // Try Claude
    try {
      const raw = await callClaude(systemPrompt);
      if (raw) {
        const html = await processHtml(raw);
        if (html) {
          return NextResponse.json({ html, model: "claude" });
        }
      }
    } catch (e: any) {
      console.log("Claude error:", e.message);
    }

    // Try Gemini
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { maxOutputTokens: 12000 },
          }),
        }
      );
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const html = await processHtml(raw);
        if (html) {
          return NextResponse.json({ html, model: "gemini" });
        }
      }
    } catch (e: any) {
      console.log("Gemini error:", e.message);
    }

    return NextResponse.json(
      { error: "All AI services failed. Please try again." },
      { status: 500 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
