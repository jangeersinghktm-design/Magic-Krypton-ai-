// app/api/agent/route.ts
// Krypton AI — Real Agent Orchestrator
// Phase 1: Analyze prompt → real AI thinking + dynamic questions + real plan
// Phase 2: Validate generated HTML + create project summary

import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 45;

// ── Provider helpers (same pattern as generate route) ────────────
async function callClaude(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("no key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

async function callOpenAI(prompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("no key");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no key");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1200 } }),
      signal: AbortSignal.timeout(30000),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callAI(prompt: string): Promise<string> {
  for (const fn of [callClaude, callOpenAI, callGemini]) {
    try { const r = await fn(prompt); if (r.trim()) return r; } catch {}
  }
  throw new Error("all providers failed");
}

function extractJSON(raw: string): any {
  // Try direct parse
  try { return JSON.parse(raw.trim()); } catch {}
  // Extract from markdown code block
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1].trim()); } catch {} }
  // Find first { } block
  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  }
  return null;
}

// ── ANALYZE PROMPT ────────────────────────────────────────────────
async function analyzePrompt(userPrompt: string, history: string) {
  const analysisPrompt = `You are Krypton AI — an expert web developer analyzing a user's build request.

User wants to build: "${userPrompt}"
${history ? `\nConversation context:\n${history}` : ""}

Analyze this request and respond with ONLY a JSON object (no markdown, no explanation):

{
  "thinking": [
    "First thought about what the user wants",
    "Technical consideration about implementation",  
    "Design/architecture decision",
    "Potential challenge or key feature to include"
  ],
  "needsQuestions": false,
  "questions": [],
  "plan": [
    {"id": 1, "task": "Specific task description", "category": "design|frontend|logic|data|optimization"},
    {"id": 2, "task": "Another specific task", "category": "frontend"}
  ],
  "projectType": "website|app|saas|dashboard|ecommerce|tool|landing",
  "complexity": "simple|medium|complex",
  "summary": "One sentence describing exactly what will be built"
}

Rules:
- thinking: 3-5 REAL, specific thoughts about THIS request — not generic
- needsQuestions: true ONLY if the prompt is extremely vague (less than 4 words with no clear intent, like "build something" or "make a website"). For ANY prompt with a clear subject or purpose (restaurant, affiliate marketing, game, dashboard, fitness, portfolio etc.) set needsQuestions to false and just build it. Default is false.
- questions: max 1-2 questions, only if needsQuestions is truly true. Write questions in the SAME LANGUAGE as the user's prompt.
- plan: 6-10 specific tasks based on THIS request. Be concrete.
- All text in English only.
- Return ONLY the JSON. Nothing else.`;

  try {
    const raw  = await callAI(analysisPrompt);
    const data = extractJSON(raw);
    if (data && data.thinking && data.plan) return data;
  } catch {}

  // Fallback if AI fails — smart defaults based on prompt keywords
  return generateFallbackAnalysis(userPrompt);
}

function generateFallbackAnalysis(prompt: string) {
  const lower = prompt.toLowerCase();
  const isShop = /shop|store|ecommerce|cart|product/.test(lower);
  const isApp  = /app|dashboard|crm|tracker|manager/.test(lower);

  const thinking = isGame
    ? ["Game mechanics and controls need to be planned", "Canvas API will handle rendering at 60fps", "Score and level progression system required", "Mobile touch controls should be included"]
    : isShop
    ? ["Product grid and cart system are the core features", "Filtering and search will improve UX significantly", "Checkout flow needs clear steps", "Mobile shopping experience is critical"]
    : isApp
    ? ["Data structure and state management are key", "Navigation and sidebar need clean design", "Interactive charts will show insights", "Responsive layout for all devices"]
    : ["Understanding the main goal and target audience", "Planning the visual hierarchy and layout", "Key sections to include for maximum impact", "Mobile responsiveness is essential"];

  const plan = isGame
    ? [
        { id: 1, task: "Set up HTML5 Canvas game engine", category: "logic" },
        { id: 2, task: "Implement player controls (keyboard + touch)", category: "logic" },
        { id: 3, task: "Build game objects and collision detection", category: "logic" },
        { id: 4, task: "Create scoring and level system", category: "logic" },
        { id: 5, task: "Design start screen and game over screen", category: "design" },
        { id: 6, task: "Add sound effects and animations", category: "frontend" },
        { id: 7, task: "Optimize performance for 60fps", category: "optimization" },
      ]
    : [
        { id: 1, task: "Design premium hero section", category: "design" },
        { id: 2, task: "Build responsive navigation", category: "frontend" },
        { id: 3, task: "Create main content sections", category: "frontend" },
        { id: 4, task: "Add interactive elements and animations", category: "frontend" },
        { id: 5, task: "Implement mobile-first responsive layout", category: "optimization" },
        { id: 6, task: "Add smooth scroll and micro-interactions", category: "frontend" },
        { id: 7, task: "Optimize loading and performance", category: "optimization" },
      ];

  return {
    thinking,
    needsQuestions: false,
    questions: [],
    plan,
    projectType: isGame ? "game" : isShop ? "ecommerce" : isApp ? "app" : "website",
    complexity: "medium",
    summary: `Building a complete, premium ${isGame ? "browser game" : isShop ? "e-commerce store" : isApp ? "web application" : "website"} based on your requirements`,
  };
}

// ── VALIDATE HTML ─────────────────────────────────────────────────
async function validateHTML(html: string, originalPrompt: string) {
  const checks = [
    { id: "structure",    label: "HTML structure",     pass: html.includes("<!DOCTYPE") && html.includes("</html>") },
    { id: "body",         label: "Body content",       pass: html.includes("<body") && html.length > 500 },
    { id: "responsive",   label: "Mobile responsive",  pass: html.includes("viewport") || html.includes("responsive") || html.includes("@media") },
    { id: "interactive",  label: "Interactive elements", pass: html.includes("<button") || html.includes("onclick") || html.includes("addEventListener") },
    { id: "styled",       label: "Styling applied",    pass: html.includes("<style") || html.includes("style=") },
    { id: "scripts",      label: "JavaScript logic",   pass: html.includes("<script") },
  ];
  const passed = checks.filter(c => c.pass).length;
  const score  = Math.round((passed / checks.length) * 100);
  return { checks, score, passed, total: checks.length };
}

// ── CREATE PROJECT SUMMARY ─────────────────────────────────────────
function createSummary(html: string, plan: any[], projectType: string) {
  const pageCount    = (html.match(/section|<main|<article/gi) || []).length || 1;
  const buttonCount  = (html.match(/<button/gi) || []).length;
  const imageCount   = (html.match(/<img/gi) || []).length;
  const scriptCount  = (html.match(/<script/gi) || []).length;
  const cssRules     = (html.match(/\{[\s\S]*?\}/g) || []).length;
  const hasAnimation = html.includes("animation") || html.includes("transition") || html.includes("@keyframes");
  const hasMobile    = html.includes("@media") || html.includes("responsive");
  const hasJS        = html.includes("<script");

  const features: string[] = [];
  if (hasAnimation)  features.push("Smooth animations");
  if (hasMobile)     features.push("Mobile responsive");
  if (hasJS)         features.push("Interactive JavaScript");
  if (buttonCount > 0) features.push(`${buttonCount} interactive button${buttonCount > 1 ? "s" : ""}`);
  if (imageCount > 0)  features.push(`${imageCount} image element${imageCount > 1 ? "s" : ""}`);

  return {
    pagesGenerated:     Math.max(1, pageCount),
    componentsBuilt:    plan.length,
    linesOfCode:        html.split("\n").length,
    featuresAdded:      features,
    cssRules:           cssRules,
    projectType,
  };
}

// ── MAIN HANDLER ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { phase, prompt, html, plan, projectType, history } = await req.json();

    // ── Phase 1: Analyze prompt ─────────────────────────────────
    if (phase === "analyze") {
      if (!prompt?.trim()) {
        return NextResponse.json({ error: "Prompt required" }, { status: 400 });
      }
      const analysis = await analyzePrompt(prompt, history || "");
      return NextResponse.json({ success: true, ...analysis });
    }

    // ── Phase 2: Validate + summarize ──────────────────────────
    if (phase === "validate") {
      if (!html) return NextResponse.json({ error: "HTML required" }, { status: 400 });
      const validation = await validateHTML(html, prompt || "");
      const summary    = createSummary(html, plan || [], projectType || "website");
      return NextResponse.json({ success: true, validation, summary });
    }

    return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "Analysis unavailable" }, { status: 500 });
  }
}
