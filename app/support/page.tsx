// app/support/page.tsx
"use client";
export default function SupportPage() {
  const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
  const T = { gold: "#F5D800", green: "#00CC44", border: "rgba(245,197,66,0.12)", muted: "#6B7280" };

  const faqs = [
    { q: "Why is my generation failing?", a: "Check your credit balance. Each generation costs 5 credits. If you're out of credits, top up from Settings > Billing." },
    { q: "How do I cancel my subscription?", a: "Go to Settings > Billing > Manage. You can cancel anytime. You'll retain access until the end of your billing period." },
    { q: "Can I get a refund?", a: "Yes, within 7 days of purchase for subscriptions. See our Refund Policy for details." },
    { q: "How do I invite team members?", a: "Go to /team, create a team, then click 'Invite Member' and enter their email address." },
    { q: "My project looks different than expected", a: "Try being more specific in your prompt. Describe colors, layout, features in detail. You can also use AI Edit to refine." },
    { q: "Can I use generated code commercially?", a: "Yes! You retain full ownership of all code generated. Use it for any purpose including commercial projects." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'DM Sans', sans-serif", padding: "60px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🆘</div>
          <h1 style={{ fontSize: 40, fontWeight: 900, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 12 }}>Support Center</h1>
          <p style={{ color: T.muted, fontSize: 15 }}>We're here to help you succeed with Krypton AI</p>
        </div>

        {/* Quick links */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 48 }}>
          {[
            { icon: "📚", label: "Documentation", href: "/docs" },
            { icon: "📧", label: "Email Support", href: "mailto:support@kryptonai.tech" },
            { icon: "💳", label: "Billing Issues", href: "/settings?tab=billing" },
            { icon: "📋", label: "Changelog", href: "/changelog" },
          ].map(link => (
            <a key={link.label} href={link.href} style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px", textAlign: "center", textDecoration: "none", display: "block", transition: "all 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = T.gold)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{link.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{link.label}</div>
            </a>
          ))}
        </div>

        {/* FAQs */}
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>Frequently Asked Questions</h2>
        {faqs.map((faq, i) => (
          <div key={i} style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 10 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: T.gold }}>{faq.q}</h3>
            <p style={{ fontSize: 13, color: T.muted, margin: 0, lineHeight: 1.7 }}>{faq.a}</p>
          </div>
        ))}

        {/* Contact CTA */}
        <div style={{ background: "rgba(245,197,66,0.04)", border: `1px solid ${T.border}`, borderRadius: 18, padding: "32px", textAlign: "center", marginTop: 40 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Still need help?</h3>
          <p style={{ color: T.muted, fontSize: 14, marginBottom: 20 }}>Our team responds within 24 hours</p>
          <a href="/contact" style={{ display: "inline-block", padding: "12px 28px", background: G, borderRadius: 10, color: "#000", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            Contact Support →
          </a>
        </div>
      </div>
    </div>
  );
}

