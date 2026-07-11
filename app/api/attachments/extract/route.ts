// app/api/attachments/extract/route.ts
// Real PDF text extraction — the AI actually receives what's in the PDF,
// not a placeholder. Auth-gated like every other route (no anonymous use).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  // Also allow multipart requests without an Authorization header to still
  // check via cookie-based session if present — but for this app's pattern
  // (Bearer token everywhere else), require it consistently.
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 15MB)." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);

    return NextResponse.json({ text: result.text.slice(0, 50000), pages: result.numpages });
  } catch (err: any) {
    return NextResponse.json({ error: "Couldn't read this PDF. It may be scanned/image-only or corrupted." }, { status: 500 });
  }
}

