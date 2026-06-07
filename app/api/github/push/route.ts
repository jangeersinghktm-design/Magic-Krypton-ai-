// app/api/github/push/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { projectId, repoName, githubToken } = await req.json();

    if (!projectId || !githubToken) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get project
    const { data: project } = await supabase
      .from("projects")
      .select("title, html_code, prompt")
      .eq("id", projectId)
      .single();

    if (!project?.html_code) {
      return NextResponse.json({ error: "Project not found or empty" }, { status: 404 });
    }

    // Get GitHub username
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${githubToken}` },
    });
    const githubUser = await userRes.json();

    const finalRepoName = repoName || project.title?.toLowerCase().replace(/\s+/g, "-") || "krypton-project";

    // Check if repo exists
    const repoCheck = await fetch(
      `https://api.github.com/repos/${githubUser.login}/${finalRepoName}`,
      { headers: { Authorization: `Bearer ${githubToken}` } }
    );

    let repoUrl: string;

    if (repoCheck.status === 404) {
      // Create repo
      const createRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: finalRepoName,
          description: `Built with Krypton AI: ${project.prompt?.slice(0, 100)}`,
          private: false,
          auto_init: false,
        }),
      });
      const newRepo = await createRes.json();
      repoUrl = newRepo.html_url;
    } else {
      const existingRepo = await repoCheck.json();
      repoUrl = existingRepo.html_url;
    }

    // Push index.html
    const content = Buffer.from(project.html_code).toString("base64");

    // Check if file exists (for update)
    const fileCheck = await fetch(
      `https://api.github.com/repos/${githubUser.login}/${finalRepoName}/contents/index.html`,
      { headers: { Authorization: `Bearer ${githubToken}` } }
    );
    const fileData = fileCheck.ok ? await fileCheck.json() : null;

    await fetch(
      `https://api.github.com/repos/${githubUser.login}/${finalRepoName}/contents/index.html`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Update from Krypton AI: ${new Date().toLocaleDateString()}`,
          content,
          sha: fileData?.sha,
        }),
      }
    );

    // Push README
    const readmeContent = Buffer.from(
      `# ${project.title}\n\nBuilt with [Krypton AI](https://magic-krypton-ai.vercel.app)\n\n## About\n${project.prompt}\n\n## How to use\nOpen \`index.html\` in your browser or deploy to any static host.`
    ).toString("base64");

    const readmeCheck = await fetch(
      `https://api.github.com/repos/${githubUser.login}/${finalRepoName}/contents/README.md`,
      { headers: { Authorization: `Bearer ${githubToken}` } }
    );
    const readmeData = readmeCheck.ok ? await readmeCheck.json() : null;

    await fetch(
      `https://api.github.com/repos/${githubUser.login}/${finalRepoName}/contents/README.md`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Add README",
          content: readmeContent,
          sha: readmeData?.sha,
        }),
      }
    );

    // Save to DB
    await supabase.from("github_repos").upsert({
      user_id: user.id,
      project_id: projectId,
      repo_name: finalRepoName,
      repo_url: repoUrl,
      last_push: new Date().toISOString(),
    }, { onConflict: "project_id" });

    return NextResponse.json({
      success: true,
      repoUrl,
      message: `Pushed to ${repoUrl}`,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

