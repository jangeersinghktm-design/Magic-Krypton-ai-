// app/api/email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const FROM_EMAIL = "Krypton AI <onboarding@resend.dev>";

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });
  return res.json();
}

// ── Email Templates ───────────────────────────────────────────────
const emailTemplates = {
  welcome: (name: string) => ({
    subject: "Welcome to Krypton AI! ⚡",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:32px;font-weight:900;background:linear-gradient(135deg,#F5D800,#00CC44);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
        ⚡ Krypton AI
      </div>
    </div>
    <div style="background:#0D0D0D;border:1px solid rgba(245,197,66,0.15);border-radius:16px;padding:32px;">
      <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 12px;">
        Welcome, ${name}! 🎉
      </h1>
      <p style="color:#888;font-size:15px;line-height:1.7;margin:0 0 24px;">
        You're now part of Krypton AI — the fastest way to build websites, apps, and games with AI.
      </p>
      <div style="background:#161616;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="color:#F5D800;font-size:13px;font-weight:700;margin:0 0 12px;">🚀 You get FREE:</p>
        <p style="color:#888;font-size:13px;margin:0 0 6px;">✅ 100 Credits to start</p>
        <p style="color:#888;font-size:13px;margin:0 0 6px;">✅ Website, App & Game Generator</p>
        <p style="color:#888;font-size:13px;margin:0 0 6px;">✅ Live Preview & Export</p>
        <p style="color:#888;font-size:13px;margin:0;">✅ Templates Marketplace</p>
      </div>
      <a href="https://magic-krypton-ai.vercel.app/create" style="display:block;text-align:center;padding:14px;background:linear-gradient(135deg,#F5D800,#00CC44);border-radius:10px;color:#000;font-weight:700;font-size:15px;text-decoration:none;">
        Start Building Now →
      </a>
    </div>
    <p style="color:#333;font-size:12px;text-align:center;margin-top:24px;">
      Krypton AI · <a href="https://magic-krypton-ai.vercel.app" style="color:#F5D800;">magic-krypton-ai.vercel.app</a>
    </p>
  </div>
</body>
</html>`,
  }),

  creditLow: (name: string, remaining: number) => ({
    subject: `⚠️ Low Credits Alert — ${remaining} credits left`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="background:#0D0D0D;border:1px solid rgba(239,68,68,0.3);border-radius:16px;padding:32px;">
      <h1 style="color:#ef4444;font-size:22px;font-weight:700;margin:0 0 12px;">⚠️ Low Credits Warning</h1>
      <p style="color:#888;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Hi ${name}, you only have <strong style="color:#ef4444;">${remaining} credits</strong> remaining.
      </p>
      <a href="https://magic-krypton-ai.vercel.app/settings?tab=billing" style="display:block;text-align:center;padding:14px;background:linear-gradient(135deg,#F5D800,#00CC44);border-radius:10px;color:#000;font-weight:700;font-size:15px;text-decoration:none;">
        Top Up Credits →
      </a>
    </div>
  </div>
</body>
</html>`,
  }),

  deploySuccess: (name: string, projectName: string, url: string) => ({
    subject: `🚀 "${projectName}" is live!`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="background:#0D0D0D;border:1px solid rgba(0,204,68,0.3);border-radius:16px;padding:32px;">
      <h1 style="color:#00CC44;font-size:22px;font-weight:700;margin:0 0 12px;">🚀 Deployment Successful!</h1>
      <p style="color:#888;font-size:15px;line-height:1.7;margin:0 0 12px;">
        Hi ${name}, your project <strong style="color:#fff;">"${projectName}"</strong> is now live!
      </p>
      <div style="background:#161616;border-radius:10px;padding:16px;margin-bottom:20px;">
        <p style="color:#F5D800;font-size:13px;margin:0 0 6px;">🔗 Live URL:</p>
        <a href="${url}" style="color:#00CC44;font-size:14px;">${url}</a>
      </div>
      <a href="${url}" style="display:block;text-align:center;padding:14px;background:linear-gradient(135deg,#F5D800,#00CC44);border-radius:10px;color:#000;font-weight:700;font-size:15px;text-decoration:none;">
        View Live Site →
      </a>
    </div>
  </div>
</body>
</html>`,
  }),

  paymentSuccess: (name: string, credits: number, amount: string) => ({
    subject: `✅ Payment Successful — ${credits} credits added!`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="background:#0D0D0D;border:1px solid rgba(245,197,66,0.3);border-radius:16px;padding:32px;">
      <h1 style="color:#F5D800;font-size:22px;font-weight:700;margin:0 0 12px;">✅ Payment Successful!</h1>
      <p style="color:#888;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Hi ${name}, your payment of <strong style="color:#fff;">${amount}</strong> was successful!
      </p>
      <div style="background:#161616;border-radius:10px;padding:16px;margin-bottom:20px;">
        <p style="color:#F5D800;font-size:20px;font-weight:800;margin:0;">+${credits} Credits Added ⚡</p>
      </div>
      <a href="https://magic-krypton-ai.vercel.app/create" style="display:block;text-align:center;padding:14px;background:linear-gradient(135deg,#F5D800,#00CC44);border-radius:10px;color:#000;font-weight:700;font-size:15px;text-decoration:none;">
        Start Building →
      </a>
    </div>
  </div>
</body>
</html>`,
  }),
};

// ── API Handler ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { type, userId, data } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user info
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    if (!user?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, notification_settings")
      .eq("id", userId)
      .single();

    const name = profile?.full_name || user.email.split("@")[0];
    const notifSettings = profile?.notification_settings || {};

    let emailData: { subject: string; html: string } | null = null;

    switch (type) {
      case "welcome":
        emailData = emailTemplates.welcome(name);
        break;

      case "credit_low":
        if (notifSettings.creditLow === false) break;
        emailData = emailTemplates.creditLow(name, data.remaining);
        break;

      case "deploy_success":
        if (notifSettings.deploySuccess === false) break;
        emailData = emailTemplates.deploySuccess(name, data.projectName, data.url);
        break;

      case "payment_success":
        if (notifSettings.billing === false) break;
        emailData = emailTemplates.paymentSuccess(name, data.credits, data.amount);
        break;

      default:
        return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
    }

    if (!emailData) {
      return NextResponse.json({ message: "Email notifications disabled for this type" });
    }

    const result = await sendEmail(user.email, emailData.subject, emailData.html);

    // Save notification to DB
    await supabase.from("notifications").insert({
      user_id: userId,
      title: emailData.subject,
      message: `Email sent to ${user.email}`,
      type: type === "welcome" ? "info" : type === "credit_low" ? "error" : "success",
      read: false,
    });

    return NextResponse.json({ success: true, result });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

