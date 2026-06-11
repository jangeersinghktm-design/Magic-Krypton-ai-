// app/api/deploy/netlify/route.ts
// Krypton AI — Netlify One-Click Deploy
// Uses Netlify Deploy API

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { html, projectName } = await req.json();

    if (!html?.trim()) {
      return NextResponse.json({ error: "No HTML content" }, { status: 400 });
    }

    const netlifyToken = process.env.NETLIFY_TOKEN;
    if (!netlifyToken) {
      return NextResponse.json({
        error: "Netlify token not configured. Add NETLIFY_TOKEN in Settings.",
        code: "NO_TOKEN",
      }, { status: 400 });
    }

    const siteName = (projectName || "krypton-project")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 60);

    // ── Create site ────────────────────────────────────────────
    const siteRes = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${netlifyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: `${siteName}-${Date.now()}` }),
    });

    if (!siteRes.ok) {
      return NextResponse.json({ error: "Failed to create Netlify site." }, { status: 500 });
    }

    const site = await siteRes.json();
    const siteId = site.id;

    // ── Deploy HTML ────────────────────────────────────────────
    const deployRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${netlifyToken}`,
          "Content-Type": "application/zip",
        },
        // Netlify expects a ZIP — for simplicity, deploy raw HTML
        // In production, use JSZip to create proper ZIP
        body: html,
      }
    );

    // Alternate approach: use the file digest API
    const htmlEncoder = new TextEncoder();
    const htmlBytes   = htmlEncoder.encode(html);
    const hashBuffer  = await crypto.subtle.digest("SHA-1", htmlBytes);
    const hashArray   = Array.from(new Uint8Array(hashBuffer));
    const sha1        = hashArray.map(b => b.toString(16).padStart(2,"0")).join("");

    // Deploy with file digest
    const digestRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${netlifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: { "/index.html": sha1 },
          async: false,
        }),
      }
    );

    if (!digestRes.ok) {
      return NextResponse.json({ error: "Netlify deploy failed." }, { status: 500 });
    }

    const deploy = await digestRes.json();

    // Upload the actual file
    if (deploy.required?.length > 0) {
      await fetch(
        `https://api.netlify.com/api/v1/deploys/${deploy.id}/files/index.html`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${netlifyToken}`,
            "Content-Type": "application/octet-stream",
          },
          body: html,
        }
      );
    }

    const liveUrl = site.ssl_url || site.url || `https://${site.subdomain}.netlify.app`;

    return NextResponse.json({
      success:  true,
      url:      liveUrl,
      siteId,
      deployId: deploy.id,
    });

  } catch (err: any) {
    console.error("[Netlify Deploy]", err);
    return NextResponse.json({ error: "Deployment failed." }, { status: 500 });
  }
}
