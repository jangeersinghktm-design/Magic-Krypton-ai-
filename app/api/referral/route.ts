// app/api/referral/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function generateCode(userId: string): string {
  return "KR" + userId.slice(0, 6).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get or create referral code
    const { data: profile } = await supabase
      .from("profiles")
      .select("referral_code, total_credits, used_credits")
      .eq("id", user.id)
      .single();

    let code = profile?.referral_code;
    if (!code) {
      code = generateCode(user.id);
      await supabase.from("profiles").update({ referral_code: code }).eq("id", user.id);
    }

    // Get referral stats
    const { data: referrals } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", user.id);

    const totalReferrals = referrals?.length || 0;
    const completedReferrals = referrals?.filter(r => r.status === "completed").length || 0;
    const creditsEarned = referrals?.reduce((sum, r) => sum + (r.credits_given || 0), 0) || 0;

    return NextResponse.json({
      code,
      referralUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://magic-krypton-ai.vercel.app"}?ref=${code}`,
      totalReferrals,
      completedReferrals,
      creditsEarned,
      referrals: referrals || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { referralCode } = await req.json();
    if (!referralCode) return NextResponse.json({ error: "No code" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Find referrer
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id, total_credits")
      .eq("referral_code", referralCode)
      .single();

    if (!referrer) return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    if (referrer.id === user.id) return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });

    // Check if already referred
    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_id", user.id)
      .single();

    if (existing) return NextResponse.json({ error: "Already used a referral" }, { status: 400 });

    // Create referral + give credits to both
    await supabase.from("referrals").insert({
      referrer_id: referrer.id,
      referred_id: user.id,
      referral_code: referralCode,
      status: "completed",
      credits_given: 50,
    });

    // Give 50 credits to referrer
    await supabase.from("profiles")
      .update({ total_credits: (referrer.total_credits || 100) + 50 })
      .eq("id", referrer.id);

    // Give 50 credits to new user
    const { data: newUserProfile } = await supabase
      .from("profiles").select("total_credits").eq("id", user.id).single();
    await supabase.from("profiles")
      .update({ total_credits: (newUserProfile?.total_credits || 100) + 50 })
      .eq("id", user.id);

    // Save referral credit transactions
    await supabase.from("credit_transactions").insert([
      { user_id: referrer.id, amount: 50, type: "referral", description: "Referral bonus — friend joined!" },
      { user_id: user.id, amount: 50, type: "referral", description: "Welcome bonus — joined via referral!" },
    ]);

    // Send notification
    await supabase.from("notifications").insert({
      user_id: referrer.id,
      title: "🎉 Referral Bonus!",
      message: "Your friend joined Krypton AI! +50 credits added.",
      type: "success",
      link: "/settings?tab=billing",
    });

    return NextResponse.json({ success: true, creditsAdded: 50 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

