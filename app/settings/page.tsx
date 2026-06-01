"use client";
import { useRouter } from "next/navigation";
export default function SettingsPage() {
  const router = useRouter();
  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ fontSize: "48px" }}>⚙</div>
      <h2 style={{ color: "#fff", fontFamily: "'Syne', sans-serif", fontSize: "24px", margin: 0 }}>Settings</h2>
      <p style={{ color: "#555", fontSize: "14px", margin: 0 }}>Coming soon...</p>
      <button onClick={() => router.push("/")} style={{ marginTop: "8px", padding: "10px 24px", background: "#FFC107", border: "none", borderRadius: "10px", color: "#080808", fontWeight: 700, cursor: "pointer", fontSize: "14px" }}>
        Go Home
      </button>
    </div>
  );
}
