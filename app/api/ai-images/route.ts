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

  if (!res.ok) {
    const err = await res.text();
    // Content policy or other DALL-E error
    if (res.status === 400) {
      return NextResponse.json({
        error: "Image prompt was rejected. Try a different description.",
        code: "CONTENT_POLICY",
      }, { status: 400 });
    }
    return NextResponse.json({ error: `Image generation failed: ${res.status}` }, { status: 500 });
  }

  const data = await res.json();
  const imageUrl = data.data?.[0]?.url;
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
    // Hint for client: cache this URL and reuse for same type
    cacheKey: `${authedUserId}:${type}:${sitePrompt.slice(0, 30)}`,
  });
}
