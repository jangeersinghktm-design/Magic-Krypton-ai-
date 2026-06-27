// middleware.ts — Route protection
// Runs on every request — blocks unauthorized access

import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/create",
  "/dashboard",
  "/settings",
  "/billing",
  "/team",
  "/stats",
  "/community",
  "/project-manager",
  "/screenshot",
  "/onboarding",
  "/profile",
  "/analytics",
  "/admin",        // P0 FIX: admin pages were completely unprotected
  "/admin-login",  // P0 FIX
];

// Routes that require Pro+ plan
const PRO_ROUTES = [
  "/project-manager",
  "/screenshot",
  "/settings/github",
];

// Routes that require Premium+ plan
const PREMIUM_ROUTES = [
  "/team",
];

// Public routes (no auth needed)
const PUBLIC_ROUTES = [
  "/landing",
  "/auth",
  "/billing",
  "/privacy",
  "/terms",
  "/refund",
  "/about",
  "/contact",
  "/docs",
  "/changelog",
  "/support",
  "/share",
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Allow public routes
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return res;
  }

  // Allow API routes (they handle their own auth)
  if (pathname.startsWith("/api/")) {
    return res;
  }

  // Allow static files
  if (pathname.startsWith("/_next/") || pathname.includes(".")) {
    return res;
  }

  try {
    const supabase = createMiddlewareClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    // Not logged in → redirect to login
    if (!session?.user) {
      const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
      if (isProtected) {
        const loginUrl = new URL("/auth/login", req.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
      }
      return res;
    }

    // Logged in — check plan for premium routes
    const isPremiumRoute = PREMIUM_ROUTES.some(r => pathname.startsWith(r));
    const isProRoute = PRO_ROUTES.some(r => pathname.startsWith(r));

    if (isPremiumRoute || isProRoute) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, is_suspended")
        .eq("id", session.user.id)
        .single();

      // Suspended users
      if (profile?.is_suspended) {
        return NextResponse.redirect(new URL("/auth/suspended", req.url));
      }

      const plan = profile?.plan || "free";
      const planLevel = { free: 0, pro: 1, premium: 2, business: 3 };
      const userLevel = planLevel[plan as keyof typeof planLevel] || 0;

      // Check premium route access
      if (isPremiumRoute && userLevel < 2) {
        const billingUrl = new URL("/billing", req.url);
        billingUrl.searchParams.set("upgrade", "premium");
        billingUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(billingUrl);
      }

      // Check pro route access
      if (isProRoute && userLevel < 1) {
        const billingUrl = new URL("/billing", req.url);
        billingUrl.searchParams.set("upgrade", "pro");
        billingUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(billingUrl);
      }
    }

    return res;

  } catch (err) {
    // P0 FIX: fail-closed — on auth error, redirect to login
    // Fail-open was a security hole: any Supabase outage exposed protected routes
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\..*).)*",
  ],
};

