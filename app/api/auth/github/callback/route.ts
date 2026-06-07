// app/api/auth/github/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings?tab=github&error=no_code`
    );
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/settings?tab=github&error=${tokenData.error}`
      );
    }

    const accessToken = tokenData.access_token;

    // Get GitHub user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser = await userRes.json();

    // Get cookie to find Supabase user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Save GitHub token to profiles
    // We use a cookie to pass session - redirect with token in URL params
    const redirectUrl = new URL(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings`
    );
    redirectUrl.searchParams.set("tab", "github");
    redirectUrl.searchParams.set("github_token", accessToken);
    redirectUrl.searchParams.set("github_username", githubUser.login);
    redirectUrl.searchParams.set("connected", "true");

    return NextResponse.redirect(redirectUrl.toString());

  } catch (err: any) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings?tab=github&error=${err.message}`
    );
  }
}
