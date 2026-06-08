// app/terms/page.tsx
export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'DM Sans', sans-serif", padding: "60px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, background: "linear-gradient(135deg,#F5D800,#00CC44)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 48 }}>Last updated: June 1, 2026</p>

        {[
          { title: "1. Acceptance of Terms", content: "By accessing and using Krypton AI, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use our service." },
          { title: "2. Description of Service", content: "Krypton AI is an AI-powered platform that allows users to generate websites, web applications, games, and other digital products using artificial intelligence. We use Claude AI by Anthropic to power our generation capabilities." },
          { title: "3. User Accounts", content: "You must create an account to use our services. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 13 years old to use our service." },
          { title: "4. Credits and Payments", content: "Krypton AI operates on a credit-based system. Credits are consumed when you generate projects. Paid plans and credit purchases are non-refundable except as required by law. Credits do not expire on paid plans but may expire on promotional credits." },
          { title: "5. Acceptable Use", content: "You agree not to use Krypton AI to generate illegal content, spam, malware, or content that violates intellectual property rights. You may not attempt to reverse engineer our AI systems or use our service to build competing AI generation platforms." },
          { title: "6. Intellectual Property", content: "You retain ownership of the content you create using Krypton AI. By using our service, you grant us a limited license to store and process your content to provide our services. We retain ownership of our platform, AI models, and technology." },
          { title: "7. Generated Content", content: "Krypton AI generates code and content using AI. While we strive for quality, we do not guarantee that generated content will be error-free, secure, or fit for a particular purpose. Users are responsible for reviewing and testing generated content." },
          { title: "8. Limitation of Liability", content: "To the maximum extent permitted by law, Krypton AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of our service." },
          { title: "9. Termination", content: "We reserve the right to terminate or suspend your account at any time for violations of these terms. You may cancel your account at any time through your account settings." },
          { title: "10. Contact", content: "For questions about these Terms, contact us at: legal@kryptonai.tech" },
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

