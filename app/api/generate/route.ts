import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are an expert web developer. Create a complete, beautiful, modern HTML page based on this request: "${prompt}"
          
Rules:
- Return ONLY the HTML code, nothing else
- Include all CSS inline in <style> tags
- Include all JavaScript inline in <script> tags  
- Make it visually stunning with modern design
- Use gradients, animations, and beautiful colors
- Make it fully functional and interactive
- No external dependencies - everything self contained
- Mobile responsive design

Return only the HTML code starting with <!DOCTYPE html>`,
        },
      ],
    });

    const html = message.content[0].type === "text" 
      ? message.content[0].text 
      : "";

    return NextResponse.json({ html });

  } catch (error: any) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error.message || "Generation failed" },
      { status: 500 }
    );
  }
}
