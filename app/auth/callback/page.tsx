"use client";

// app/auth/callback/page.tsx
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
    // Wait for session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      router.push("/auth/login");
      return;
    }

    // Check referral code in URL
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
      } catch (e) {
        // Ignore referral errors
      }
    }

    // Check if onboarding completed
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", session.user.id)
      .single();

    if (!profile?.onboarding_completed) {
      router.push("/onboarding");
    } else {
      router.push("/");
    }
  };

  return (
    <div style={{
      height: "100vh", display: "flex",
      flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#050505", color: "#F5D800",
      fontFamily: "'DM Sans', sans-serif", gap: 16,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        border: "3px solid rgba(245,197,66,0.2)",
        borderTopColor: "#F5D800",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: 14, color: "#666" }}>Setting up your account...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{
        height: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "#050505", color: "#F5D800",
      }}>
        Loading...
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}

