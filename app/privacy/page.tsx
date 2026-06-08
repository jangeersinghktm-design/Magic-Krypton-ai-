// ── PRIVACY POLICY ────────────────────────────────────────────────
// app/privacy/page.tsx

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'DM Sans', sans-serif", padding: "60px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, background: "linear-gradient(135deg,#F5D800,#00CC44)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 48 }}>Last updated: June 1, 2026</p>

        {[
          { title: "1. Information We Collect", content: "We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support. This includes: name, email address, payment information (processed securely via Razorpay), projects you create, and usage data." },
          { title: "2. How We Use Your Information", content: "We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, respond to your comments and questions, and send you marketing communications (with your consent)." },
          { title: "3. Information Sharing", content: "We do not sell, trade, or rent your personal information to third parties. We may share your information with trusted service providers who assist us in operating our website and services, including Supabase (database), Vercel (hosting), Anthropic (AI generation), and Razorpay (payments)." },
          { title: "4. Data Security", content: "We implement industry-standard security measures to protect your personal information. All data is encrypted in transit using SSL/TLS. We use Supabase with Row Level Security (RLS) to ensure users can only access their own data." },
          { title: "5. Cookies", content: "We use cookies and similar tracking technologies to track activity on our service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent." },
          { title: "6. Your Rights", content: "You have the right to access, update, or delete your personal information at any time through your account settings. You may also request data export or account deletion by contacting us at support@kryptonai.tech." },
          { title: "7. Children's Privacy", content: "Our service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us." },
          { title: "8. Changes to This Policy", content: "We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the 'Last updated' date." },
          { title: "9. Contact Us", content: "If you have any questions about this Privacy Policy, please contact us at: support@kryptonai.tech" },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F5D800", marginBottom: 10 }}>{section.title}</h2>
            <p style={{ color: "#888", fontSize: 15, lineHeight: 1.8 }}>{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
