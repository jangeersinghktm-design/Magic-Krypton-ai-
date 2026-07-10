// app/api/chat-assistant/route.ts
// Pure conversational Q&A — used when the user asks a question rather
// than requesting a build ("How should my app work?", "Compare X vs Y").
// Completely separate from /api/orchestrate, /api/generate, /api/chat,
// /api/multipage — none of those contracts are touched by this file.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { kryptonGenerate } from "@/lib/ai-providers";
import { rateLimit } from "@/lib/api-security";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SYSTEM_PROMPT = `You are Krypton AI's in-app assistant. The user is chatting with you while building a website/app with Krypton AI.

Answer their question directly and helpfully — like a knowledgeable senior engineer/product advisor would. Be concise (a few short paragraphs at most, use bullet points where useful). Do NOT generate HTML, CSS, JS, or any code artifact — this is a conversational answer, not a build request. If the user's question implies they might want something actually built, you can mention they can ask you to "build" or "create" it whenever they're ready, but don't build it yourself here.`;

const EXPLAIN_SYSTEM_PROMPT = `You are Krypton AI's in-app assistant, in EXPLAIN mode. The user is asking about their ACTUAL current project file, which is included below. Read it and answer based on what is really there — do not guess or make up structure that isn't in the code. Be concise, reference actual element/class/section names from the file when relevant. Do NOT generate or rewrite code — this is an explanation, not an edit.`;

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await rateLimit(`chat-assistant:${user.id}`, 20, 60_000);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  const { message, history, mode, fileName, fileContent } = await req.json().catch(() => ({}));
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const isExplain = mode === "explain" && typeof fileContent === "string" && fileContent.trim();

  // Fold a short recent history into the prompt for continuity — no code
  // context is ever included for plain chat; explain mode includes the
  // real current file content so the answer is grounded in reality.
  const historyText = Array.isArray(history)
    ? history.slice(-6).map((h: any) => `${h.role === "user" ? "User" : "Assistant"}: ${String(h.content || "").slice(0, 400)}`).join("\n")
    : "";

  const userPrompt = isExplain
    ? `File: ${fileName || "index.html"}\n\`\`\`\n${fileContent}\n\`\`\`\n\n${historyText ? `Recent conversation:\n${historyText}\n\n` : ""}User's question: ${message.trim()}`
    : (historyText ? `Recent conversation:\n${historyText}\n\nUser's new message: ${message.trim()}` : message.trim());

  try {
    const { text } = await kryptonGenerate(isExplain ? EXPLAIN_SYSTEM_PROMPT : SYSTEM_PROMPT, userPrompt);
    return NextResponse.json({ reply: text || "I'm not sure how to answer that — could you rephrase?" });
  } catch (err: any) {
    return NextResponse.json({ error: "Couldn't get a response right now. Please try again." }, { status: 500 });
  }
}

