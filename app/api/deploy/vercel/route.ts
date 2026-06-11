// app/api/deploy/vercel/route.ts
// Krypton AI — Vercel One-Click Deploy
// Uses Vercel Deploy API v13

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { html, projectName, projectId } = await req.json();

    if (!html?.trim()) {
      return NextResponse.json({ error: "No HTML content to deploy" }, { status: 400 });
    }

    const vercelToken = process.env.VERCEL_TOKEN;
    if (!vercelToken) {
      return NextResponse.json({
        error: "Vercel token not configured. Add VERCEL_TOKEN in Settings → Integrations.",
        code: "NO_TOKEN",
      }, { status: 400 });
    }

    const slug = (projectName || "krypton-project")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 50);

    // ── Create deployment via Vercel API ───────────────────────
    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: slug,
        files: [
          {
            file: "index.html",
            data: html,
            encoding: "utf-8",
          },
        ],
        projectSettings: {
          framework: null,
          buildCommand: null,
          outputDirectory: null,
          installCommand: null,
        },
        target: "production",
      }),
    });

    if (!deployRes.ok) {
      const err = await deployRes.json().catch(() => ({}));
      console.error("[Vercel Deploy]", err);
      return NextResponse.json({
        error: "Vercel deployment failed. Check your token.",
        code: "DEPLOY_FAILED",
      }, { status: 500 });
    }

    const deploy = await deployRes.json();

    // Wait a moment for deployment to be ready
    await new Promise(r => setTimeout(r, 2000));

    // ── Poll for ready state ───────────────────────────────────
    let deployUrl = `https://${deploy.url}`;
    let attempts  = 0;

    while (attempts < 20) {
      const checkRes = await fetch(
        `https://api.vercel.com/v13/deployments/${deploy.id}`,
        { headers: { "Authorization": `Bearer ${vercelToken}` } }
      );

      if (checkRes.ok) {
        const status = await checkRes.json();
        if (status.readyState === "READY") {
          deployUrl = `https://${status.url}`;
          break;
        }
        if (status.readyState === "ERROR") break;
      }

      await new Promise(r => setTimeout(r, 3000));
      attempts++;
    }

    return NextResponse.json({
      success: true,
      url:       deployUrl,
      deployId:  deploy.id,
      projectId: deploy.projectId,
    });

  } catch (err: any) {
    console.error("[Vercel Deploy]", err);
    return NextResponse.json({
      error: "Deployment failed. Please try again.",
    }, { status: 500 });
  }
}
