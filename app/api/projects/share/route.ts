// app/api/projects/share/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function generateSlug(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  const random = Math.random().toString(36).slice(2, 7);
  return `${base}-${random}`;
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

    // Check existing share
    const { data: existing } = await supabase
      .from("project_shares")
      .select("slug")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({ slug: existing.slug });
    }

    // Get project title
    const { data: project } = await supabase
      .from("projects").select("title").eq("id", projectId).single();

    const slug = generateSlug(project?.title || "project");

    const { data, error } = await supabase.from("project_shares").insert({
      project_id: projectId,
      user_id: user.id,
      slug,
      is_public: true,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ slug: data.slug });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

