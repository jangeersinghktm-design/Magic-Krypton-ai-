// app/contact/page.tsx
"use client";
import { useState } from "react";

export default function ContactPage() {
  const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
  const T = { gold: "#F5D800", green: "#00CC44", border: "rgba(245,197,66,0.12)", muted: "#6B7280" };

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 1500));
    setSent(true);
    setSending(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'DM Sans', sans-serif", padding: "60px 24px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 10 }}>Contact Us</h1>
          <p style={{ color: T.muted, fontSize: 15 }}>We'd love to hear from you. Send us a message!</p>
        </div>

        {/* Contact cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 36 }}>
          {[
            { icon: "📧", label: "Email", value: "support@kryptonai.tech" },
            { icon: "💬", label: "Discord", value: "Coming soon" },
            { icon: "🐦", label: "Twitter", value: "@kryptonai" },
          ].map(c => (
            <div key={c.label} style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 12, color: T.gold }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        {!sent ? (
          <div style={{ background: "#0D0D0D", border: `1px solid ${T.border}`, borderRadius: 18, padding: "32px 28px" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Send a Message</h2>
            {[
              { label: "YOUR NAME", key: "name", placeholder: "John Doe" },
              { label: "EMAIL ADDRESS", key: "email", placeholder: "john@example.com" },
              { label: "SUBJECT", key: "subject", placeholder: "How can we help?" },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1 }}>{field.label}</label>
                <input value={(form as any)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  style={{ width: "100%", background: "#161616", border: `1px solid ${T.border}`, borderRadius: 9, color: "#fff", padding: "10px 14px", fontSize: 14, outline: "none", marginTop: 6, boxSizing: "border-box" as const, fontFamily: "'DM Sans', sans-serif" }} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1 }}>MESSAGE</label>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Tell us what's on your mind..."
                rows={5}
                style={{ width: "100%", background: "#161616", border: `1px solid ${T.border}`, borderRadius: 9, color: "#fff", padding: "10px 14px", fontSize: 14, outline: "none", resize: "none", marginTop: 6, boxSizing: "border-box" as const, fontFamily: "'DM Sans', sans-serif" }} />
            </div>
            <button onClick={handleSubmit} disabled={sending || !form.name || !form.email || !form.message}
              style={{ width: "100%", padding: "13px", background: form.name && form.email && form.message ? G : "#1a1a1a", border: "none", borderRadius: 10, color: form.name && form.email && form.message ? "#000" : "#444", fontWeight: 700, fontSize: 15, cursor: form.name && form.email && form.message ? "pointer" : "not-allowed" }}>
              {sending ? "Sending..." : "Send Message →"}
            </button>
          </div>
        ) : (
          <div style={{ background: "rgba(0,204,68,0.06)", border: "1px solid rgba(0,204,68,0.3)", borderRadius: 18, padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: T.green, marginBottom: 8 }}>Message Sent!</h2>
            <p style={{ color: T.muted, fontSize: 14 }}>We'll get back to you within 24 hours at {form.email}</p>
          </div>
        )}
      </div>
    </div>
  );
}

