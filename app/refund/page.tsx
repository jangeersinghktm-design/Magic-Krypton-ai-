// app/refund/page.tsx
export default function RefundPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'DM Sans', sans-serif", padding: "60px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, background: "linear-gradient(135deg,#F5D800,#00CC44)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>Refund Policy</h1>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 48 }}>Last updated: June 1, 2026</p>

        {[
          { title: "Overview", content: "At Krypton AI, we want you to be completely satisfied with your purchase. This refund policy outlines the conditions under which refunds may be issued." },
          { title: "Subscription Plans", content: "If you are not satisfied with your paid subscription within 7 days of purchase, you may request a full refund. After 7 days, subscriptions are non-refundable but you may cancel to prevent future charges." },
          { title: "Credit Top-ups", content: "Credit purchases are generally non-refundable once credits have been used. If you purchased credits and have not used them, you may request a refund within 48 hours of purchase." },
          { title: "How to Request a Refund", content: "To request a refund, email us at support@kryptonai.tech with your account email, transaction ID, and reason for the refund. We will process eligible refunds within 5-7 business days." },
          { title: "Exceptions", content: "Refunds will not be issued for accounts suspended due to violations of our Terms of Service. We also cannot refund credits that have already been consumed for AI generations." },
          { title: "Contact Us", content: "For refund requests or questions, contact us at: support@kryptonai.tech" },
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

