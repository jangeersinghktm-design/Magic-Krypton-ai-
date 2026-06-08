"use client";

// app/auth/callback/page.tsx — Production v2
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Handle email verification / OAuth callback
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        router.push("/auth/login?error=callback_failed");
        return;
      }

      const user = session.user;

      // ── Ensure profile exists ─────────────────────────────
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, plan, total_credits, onboarding_completed, referral_code")
        .eq("id", user.id)
        .single();

      if (!profile) {
        // Create profile if missing (safety net)
        await supabase.from("profiles").insert({
          id: user.id,
          email: user.email,
          plan: "free",
          total_credits: 5,
          used_credits: 0,
          credits_last_reset: new Date().toISOString().split("T")[0],
          daily_generations: 0,
        });
      }

      // ── Generate referral code if missing ─────────────────
      if (profile && !profile.referral_code) {
        const code = "KR" + user.id.slice(0, 6).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
        await supabase.from("profiles").update({ referral_code: code }).eq("id", user.id);
      }

      // ── Apply referral code from URL ──────────────────────
      const ref = searchParams.get("ref");
      if (ref) {
        try {
          await fetch("/api/referral", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ referralCode: ref.toUpperCase() }),
          });
        } catch { /* ignore referral errors */ }
      }

      // ── Redirect based on onboarding status ───────────────
      if (!profile?.onboarding_completed) {
        router.push("/onboarding");
      } else {
        const redirect = searchParams.get("redirect") || "/";
        router.push(redirect);
      }

    } catch (err) {
      router.push("/auth/login?error=unexpected");
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#050505", color: "#F5D800", fontFamily: "'DM Sans', sans-serif", gap: 16 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(245,197,66,0.2)", borderTopColor: "#F5D800", animation: "spin 0.8s linear infinite" }} />
      <p style={{ fontSize: 14, color: "#666" }}>Setting up your account...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050505", color: "#F5D800" }}>
        Loading...
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
