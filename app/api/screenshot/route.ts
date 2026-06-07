// app/api/screenshot/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CREDIT_COST = 15;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType, prompt } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Image required" }, { status: 400 });
    }

    // Auth check
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Credit check
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_credits, used_credits")
      .eq("id", user.id)
      .single();

    const remaining = (profile?.total_credits || 100) - (profile?.used_credits || 0);
    if (remaining < CREDIT_COST) {
      return NextResponse.json({ error: `Insufficient credits! Need ${CREDIT_COST}, have ${remaining}.` }, { status: 402 });
    }

    // Claude Vision API
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 12000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/png",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Analyze this UI screenshot and recreate it as a complete, self-contained HTML file.

${prompt ? `Additional instructions: ${prompt}` : ""}

Requirements:
- Output ONLY raw HTML starting with <!DOCTYPE html>
- End with </html>  
- No markdown, no backticks, no explanations
- Match the layout, colors, typography and style from the screenshot exactly
- Make it fully responsive (mobile + desktop)
- Use CSS Grid/Flexbox for layout
- Include all interactive elements with hover effects
- Add smooth animations where appropriate
- Use Google Fonts if needed
- Premium quality production code

Build the COMPLETE page that matches this screenshot as closely as possible.`,
            },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Claude API error: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    let html = data.content[0].text;

    // Clean HTML
    html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const idx = html.indexOf("<!DOCTYPE");
    if (idx > 0) html = html.substring(idx);

    if (!html.includes("<!DOCTYPE") || html.length < 500) {
      return NextResponse.json({ error: "Generated HTML is invalid. Please try again." }, { status: 500 });
    }

    // Deduct credits
    await supabase.from("profiles")
      .update({ used_credits: (profile?.used_credits || 0) + CREDIT_COST })
      .eq("id", user.id);

    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount: -CREDIT_COST,
      type: "usage",
      description: "Screenshot to App generation",
    });

    return NextResponse.json({ html, creditsUsed: CREDIT_COST });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

