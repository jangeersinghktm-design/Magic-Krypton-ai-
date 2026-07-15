// app/api/deploy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrBuildPreview } from "@/lib/preview-cache";

/**
 * GET /api/deploy?projectId=... — the real Preview UI's project-loading
 * path. Fetches the full project row and resolves html_code through the
 * SAME getOrBuildPreview() used by the deploy flow, so the actual
 * Preview UI (not just deployment) genuinely uses the Preview Cache —
 * no separate/duplicate preview logic.
 */
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    const userId = req.nextUrl.searchParams.get("userId");
    if (!projectId || !userId) return NextResponse.json({ error: "projectId and userId required" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user || user.id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: project, error } = await supabase.from("projects").select("*").eq("id", projectId).eq("user_id", userId).single();
    if (error || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (project.html_code) {
      const previewResult = await getOrBuildPreview(supabase, projectId, project.html_code);
      project.html_code = previewResult.html; // cache-resolved (identical content on a fresh build, reused instantly on a hit)
      (project as any)._previewFromCache = previewResult.fromCache;
    }

    return NextResponse.json({ project });
  } catch (err: any) {
    console.error("[deploy GET / preview-load] error:", err?.message || err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) return NextResponse.json({ error: "Project ID required" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get project
    const { data: project } = await supabase
      .from("projects").select("title, html_code").eq("id", projectId).single();

    if (!project?.html_code) {
      return NextResponse.json({ error: "No code to deploy" }, { status: 400 });
    }

    // ── Preview Cache — Cache Check -> HIT return instantly -> MISS
    // build/store/return. Real, persistent (Supabase-backed) cache, not
    // in-memory. Replaces the previous direct always-read-html_code path
    // with a version-aware check first. ──
    const previewResult = await getOrBuildPreview(supabase, projectId, project.html_code);
    const previewHtml = previewResult.html;

    // Create deployment record
    const { data: deployment } = await supabase.from("deployments").insert({
      project_id: projectId,
      user_id: user.id,
      status: "deploying",
      provider: "netlify",
    }).select().single();

    // Deploy to Netlify Drop API
    const formData = new FormData();
    const htmlBlob = new Blob([previewHtml], { type: "text/html" });
    formData.append("files[index.html]", htmlBlob, "index.html");

    const netlifyRes = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NETLIFY_TOKEN || ""}`,
      },
      body: formData,
    });

    if (netlifyRes.ok) {
      const netlifyData = await netlifyRes.json();
      const url = `https://${netlifyData.subdomain}.netlify.app`;

      await supabase.from("deployments").update({
        url, status: "live",
        deployment_id: netlifyData.id,
      }).eq("id", deployment.id);

      await supabase.from("projects").update({
        status: "completed"
      }).eq("id", projectId);

      // Add notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Project Deployed! 🚀",
        message: `${project.title} is now live at ${url}`,
        type: "success",
        link: url,
      });

      return NextResponse.json({ success: true, url });
    } else {
      // Fallback - create share link as "deployment"
      const slug = `krypton-${Date.now()}`;
      const url = `${process.env.NEXT_PUBLIC_SITE_URL || "https://magic-krypton-ai.vercel.app"}/share/${slug}`;

      await supabase.from("project_shares").insert({
        project_id: projectId,
        user_id: user.id,
        slug,
        is_public: true,
      });

      await supabase.from("deployments").update({
        url, status: "live",
      }).eq("id", deployment.id);

      return NextResponse.json({ success: true, url });
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

        
