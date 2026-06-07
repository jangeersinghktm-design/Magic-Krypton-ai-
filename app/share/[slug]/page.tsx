// app/share/[slug]/page.tsx
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export default async function SharePage({ params }: { params: { slug: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get share record
  const { data: share } = await supabase
    .from("project_shares")
    .select("project_id, views")
    .eq("slug", params.slug)
    .eq("is_public", true)
    .single();

  if (!share) notFound();

  // Get project
  const { data: project } = await supabase
    .from("projects")
    .select("title, html_code, prompt, created_at")
    .eq("id", share.project_id)
    .single();

  if (!project) notFound();

  // Increment views
  await supabase.from("project_shares")
    .update({ views: (share.views || 0) + 1 })
    .eq("slug", params.slug);

  return (
    <html lang="en">
      <head>
        <title>{project.title} — Krypton AI</title>
        <meta name="description" content={project.prompt || "Built with Krypton AI"} />
        <meta property="og:title" content={project.title} />
        <meta property="og:description" content={`Built with Krypton AI: ${project.prompt}`} />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'DM Sans', sans-serif; background: #050505; color: #fff; }
          .bar {
            position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
            background: rgba(5,5,5,0.95); backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(245,197,66,0.15);
            padding: 10px 20px;
            display: flex; align-items: center; justify-content: space-between;
            height: 52px;
          }
          .bar-left { display: flex; align-items: center; gap: 10px; }
          .title { font-size: 14px; font-weight: 600; color: #fff; }
          .badge {
            font-size: 10px; padding: 2px 8px; border-radius: 20px;
            background: rgba(245,216,0,0.1); color: #F5D800;
            border: 1px solid rgba(245,216,0,0.2);
          }
          .cta {
            padding: 7px 18px; border-radius: 8px; border: none;
            background: linear-gradient(135deg, #F5D800, #00CC44);
            color: #000; font-size: 13px; font-weight: 700;
            cursor: pointer; text-decoration: none;
            display: inline-flex; align-items: center; gap: 6px;
          }
          iframe {
            position: fixed; top: 52px; left: 0; right: 0; bottom: 0;
            width: 100%; height: calc(100vh - 52px); border: none;
          }
        `}</style>
      </head>
      <body>
        <div className="bar">
          <div className="bar-left">
            <img src="/logo.png" alt="Kr" style={{ height: "28px" }} />
            <span className="title">{project.title}</span>
            <span className="badge">Built with Krypton AI</span>
          </div>
          <a href="https://magic-krypton-ai.vercel.app" className="cta">
            ⚡ Build with AI
          </a>
        </div>
        <iframe
          srcDoc={project.html_code}
          sandbox="allow-scripts allow-same-origin"
          title={project.title}
        />
      </body>
    </html>
  );
}

