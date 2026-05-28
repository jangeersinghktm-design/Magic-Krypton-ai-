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
          content: `You are an expert web developer. Create a complete, beautiful HTML page for: "${prompt}". Return ONLY HTML code starting with <!DOCTYPE html>. Include all CSS in <style> tags and JS in <script> tags. Make it stunning and mobile responsive.`,
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
