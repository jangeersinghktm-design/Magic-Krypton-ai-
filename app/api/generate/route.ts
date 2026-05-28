import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const systemPrompt = `Create a complete beautiful HTML page for: "${prompt}". Return ONLY HTML starting with <!DOCTYPE html>. Include CSS in style tags and JS in script tags.`;

    // Try Gemini first (free)
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
      console.log("Gemini response:", JSON.stringify(data));
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const html = text.replace(/```html/g, "").replace(/```/g, "").trim();
      if (html) {
        return NextResponse.json({ html, model: "gemini" });
      }
    } else {
      const errText = await geminiRes.text();
      console.log("Gemini error:", errText);
    }

    return NextResponse.json({ error: "Generation failed. Check API keys." }, { status: 500 });

  } catch (error: any) {
    console.log("Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
