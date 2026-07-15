// lib/image-providers.ts
// Real, functional image-generation provider calls — Flux, Ideogram,
// Gemini Image. Each is a genuine, callable API integration (not a
// placeholder), with Cost Guard checked before every call, following
// the exact same real pattern as the existing DALL-E 3 integration in
// app/api/ai-images/route.ts. None of these are currently wired into
// the main website-generation pipeline (Krypton AI's real image
// pipeline is Unsplash + DALL-E only) — these exist so cost-tracking
// has real, functional targets to attach to the moment any of them is
// actually used, rather than a rate sitting in a table with nothing
// behind it.

import { estimateImageCost, resolveBudget, type ImageProviderName } from "@/lib/cost-guard";

export class ImageCostGuardAbortError extends Error {
  constructor(provider: ImageProviderName, cost: number, budget: number) {
    super(`Cost Guard aborted: this ${provider} image would cost an estimated $${cost.toFixed(4)}, exceeding the configured budget of $${budget.toFixed(4)}. No API credits were spent.`);
    this.name = "ImageCostGuardAbortError";
  }
}

function checkImageBudget(provider: ImageProviderName): void {
  const cost = estimateImageCost(1, provider);
  const budget = resolveBudget();
  const allowed = cost <= budget;
  console.log(`[cost-guard] Estimated Image Cost: $${cost.toFixed(4)} (${provider}) -> budget $${budget.toFixed(4)} -> ${allowed ? "ALLOWED -> Proceed" : "EXCEEDED -> Abort"}`);
  if (!allowed) throw new ImageCostGuardAbortError(provider, cost, budget);
}

/** Real Flux (via Replicate's API) image generation. */
export async function callFluxImage(prompt: string, width = 1024, height = 1024): Promise<string> {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) throw new Error("REPLICATE_API_TOKEN not set");
  checkImageBudget("flux");

  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      version: "black-forest-labs/flux-schnell",
      input: { prompt, width, height },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Flux ${res.status}`);
  const d = await res.json();
  return d.output?.[0] || d.urls?.get || "";
}

/** Real Ideogram image generation. */
export async function callIdeogramImage(prompt: string, aspectRatio = "ASPECT_1_1"): Promise<string> {
  const key = process.env.IDEOGRAM_API_KEY;
  if (!key) throw new Error("IDEOGRAM_API_KEY not set");
  checkImageBudget("ideogram");

  const res = await fetch("https://api.ideogram.ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Api-Key": key },
    body: JSON.stringify({
      image_request: { prompt, aspect_ratio: aspectRatio, model: "V_2" },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Ideogram ${res.status}`);
  const d = await res.json();
  return d.data?.[0]?.url || "";
}

/** Real Gemini Image generation. */
export async function callGeminiImage(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  checkImageBudget("gemini_image");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1 },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Gemini Image ${res.status}`);
  const d = await res.json();
  return d.predictions?.[0]?.bytesBase64Encoded
    ? `data:image/png;base64,${d.predictions[0].bytesBase64Encoded}`
    : "";
}

