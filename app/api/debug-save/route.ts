// app/api/debug-save/route.ts
// Temporary debug route — DELETE after fixing

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { accessToken } = await req.json().catch(() => ({}));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 1: Verify auth
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json({ step: "AUTH FAILED", error: authError?.message || "No user" });
  }

  // Step 2: Try insert
  const { data, error } = await supabase.from("projects").insert({
    user_id:    user.id,
    title:      "DEBUG TEST PROJECT",
    name:       "DEBUG TEST PROJECT",
    prompt:     "debug test",
    html_code:  "<h1>test</h1>",
    status:     "completed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().single();

  if (error) {
    return NextResponse.json({ 
      step: "INSERT FAILED", 
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId: user.id,
    });
  }

  return NextResponse.json({ 
    step: "SUCCESS", 
    projectId: data.id,
    userId: user.id,
    message: "Project saved! Delete this debug route now."
  });
}
