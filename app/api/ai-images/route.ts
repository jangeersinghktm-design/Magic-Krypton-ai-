// app/api/ai-images/route.ts
// Krypton AI — AI Image Generation (DALL-E 3)
//
// ARCHITECTURE:
// - Manual only (never auto-triggered during generation)
// - User requests ONE specific image type at a time
// - Returns single image URL + reuse hint
// - 1 credit per image

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { estimateImageCost, resolveBudget } from "@/lib/cost-guard";
import { callFluxImage, callIdeogramImage } from "@/lib/image-providers";

export const runtime    = "nodejs";
export const maxDuration = 60;

// Valid image types the user can request
const IMAGE_TYPES = {
  hero:        { size: "1792x1024", desc: "cinematic wide hero banner, premium photography" },
  about:       { size: "1024x1024", desc: "professional team or workspace photo" },
  feature:     { size: "1024x1024", desc: "product feature illustration, clean background" },
  gallery:     { size: "1024x1024", desc: "lifestyle or product photography, editorial style" },
  product:     { size: "1024x1024", desc: "clean product showcase on neutral background" },
  background:  { size: "1792x1024", desc: "abstract dark background, subtle texture, no text" },
  testimonial: { size: "1024x1024", desc: "professional headshot placeholder, neutral background" },
};

export type ImageType = keyof typeof IMAGE_TYPES;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { sitePrompt, imageType, accessToken, userId } = body;

  // Validate
  if (!sitePrompt) {
    return NextResponse.json({ error: "sitePrompt required" }, { status: 400 });
  }

  const type = (imageType || "hero") as ImageType;
  if (!IMAGE_TYPES[type]) {
    return NextResponse.json({
      error: `Invalid imageType. Valid: ${Object.keys(IMAGE_TYPES).join(", ")}`,
    }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI image generation not configured" }, { status: 503 });
  }

  // Auth
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let authedUserId = userId;
  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    authedUserId = user?.id || userId;
  }
  if (!authedUserId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Credit check (1 per image)
  const { data: profile } = await supabase
    .from("profiles")
    .select("total_credits, used_credits")
    .eq("id", authedUserId)
    .single();

  const remaining = (profile?.total_credits || 5) - (profile?.used_credits || 0);
  if (remaining < 1) {
    return NextResponse.json({ error: "No credits remaining", code: "NO_CREDITS" }, { status: 402 });
  }

  // Build specific prompt
  const spec = IMAGE_TYPES[type];
  const prompt = `${spec.desc} for: ${sitePrompt}.
Ultra high quality, photorealistic, 8K. Professional photography.
No text, no watermarks, no UI elements, no logos, no borders.
Clean, modern aesthetic. ${type === "background" ? "Very subtle, not distracting." : ""}`;

  // Real Cost Guard check — before the actual DALL-E call, not after.
  const imageCost = estimateImageCost(1, "openai_dalle3");
  const budgetLimit = resolveBudget();
  if (imageCost > budgetLimit) {
    return NextResponse.json({
      error: `Cost Guard aborted: this image would cost an estimated $${imageCost.toFixed(4)}, exceeding the configured budget of $${budgetLimit.toFixed(4)}. No API credits were spent.`,
      code: "COST_GUARD_ABORT",
    }, { status: 402 });
  }
  console.log(`[cost-guard] Estimated Image Cost: $${imageCost.toFixed(4)} (openai_dalle3) -> budget $${budgetLimit.toFixed(4)} -> ALLOWED -> Proceed`);

  // Generate image
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model:           "dall-e-3",
      prompt,
      n:               1,
      size:            spec.size,
      quality:         "standard",
      response_format: "url",
    }),
    signal: AbortSignal.timeout(45000),
  });

  let imageUrl: string | null = null;
  let usedProvider = "openai_dalle3";

  if (!res.ok) {
    const err = await res.text();
    // Content policy — never retried on a different provider, since a
    // rejected prompt would likely be rejected everywhere; ask the user
    // to change the description instead.
    if (res.status === 400) {
      return NextResponse.json({
        error: "Image prompt was rejected. Try a different description.",
        code: "CONTENT_POLICY",
      }, { status: 400 });
    }
    // Real fallback — DALL-E hit a rate-limit/server error (not content
    // policy), so genuinely try Flux, then Ideogram, using the real
    // functions in lib/image-providers.ts. Each already has its own
    // Cost Guard check before it runs.
    console.log(`[ai-images] DALL-E failed (${res.status}: ${err.slice(0,200)}) -> falling back to Flux`);
    try {
      imageUrl = await callFluxImage(prompt, 1024, 1024);
      usedProvider = "flux";
    } catch (fluxErr: any) {
      console.log(`[ai-images] Flux failed (${fluxErr?.message}) -> falling back to Ideogram`);
      try {
        imageUrl = await callIdeogramImage(prompt);
        usedProvider = "ideogram";
      } catch (ideogramErr: any) {
        console.log(`[ai-images] Ideogram also failed (${ideogramErr?.message}) -> no provider available`);
        return NextResponse.json({ error: `Image generation failed on all providers: DALL-E (${res.status}), Flux, Ideogram.` }, { status: 500 });
      }
    }
  }

  if (res.ok && !imageUrl) {
    // DALL-E succeeded — extract its result. If the fallback path above
    // already set imageUrl, this is skipped entirely (res.json() would
    // fail anyway since res.text() already consumed the failed
    // response's body earlier).
    const data = await res.json();
    imageUrl = data.data?.[0]?.url || null;
  }
  if (!imageUrl) {
    return NextResponse.json({ error: "No image returned" }, { status: 500 });
  }

  // Deduct 1 credit
  await supabase.from("profiles")
    .update({ used_credits: (profile?.used_credits || 0) + 1 })
    .eq("id", authedUserId);

  try {
    await supabase.from("credit_transactions").insert({
      user_id:     authedUserId,
      type:        "debit",
      amount:      1,
      description: `AI image (${type})`,
    });
  } catch {}

  return NextResponse.json({
    url:      imageUrl,
    type,
    prompt,
    provider: usedProvider,
    // Hint for client: cache this URL and reuse for same type
    cacheKey: `${authedUserId}:${type}:${sitePrompt.slice(0, 30)}`,
  });
}
