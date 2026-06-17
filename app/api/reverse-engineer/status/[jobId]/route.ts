// app/api/reverse-engineer/status/[jobId]/route.ts
// Poll this endpoint after submitting a reverse engineering job

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> | { jobId: string } }
) {
  const params = await Promise.resolve(context.params);
  const { jobId } = params;
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("extracted_blueprints")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const isProcessing = data.fetch_status === "processing";
  const isError = data.fetch_status === "error";

  return NextResponse.json({
    jobId,
    status: isProcessing ? "processing" : isError ? "error" : "complete",
    progress: isProcessing ? 50 : 100,
    blueprint: isProcessing ? null : data,
    message: isProcessing
      ? "Analysis in progress... check back in 5 seconds"
      : isError ? "Analysis failed — using domain match fallback"
      : `Analysis complete for ${data.domain}`,
  });
}
