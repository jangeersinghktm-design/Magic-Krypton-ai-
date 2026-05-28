"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  return (
    <div style={{minHeight: "100vh", background: "#000", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px"}}>
      
      {/* Logo */}
      <div style={{marginBottom: "20px", fontSize: "48px"}}>⚡</div>
      
      <h1 style={{fontSize: "48px", fontWeight: "bold", textAlign: "center", background: "linear-gradient(to right, #7c3aed, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "16px"}}>
        KRYPTON AI
      </h1>
      
      <p style={{fontSize: "20px", color: "#999", textAlign: "center", maxWidth: "500px", marginBottom: "40px"}}>
        Build websites, games, apps, images and videos with AI. No code needed.
      </p>

      <div style={{display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center"}}>
        {user ? (
          <Link href="/dashboard" style={{padding: "14px 32px", background: "#7c3aed", color: "white", borderRadius: "8px", fontWeight: "600", textDecoration: "none", fontSize: "16px"}}>
            Go to Dashboard
          </Link>
        ) : (
          <>
            <Link href="/auth/signup" style={{padding: "14px 32px", background: "#7c3aed", color: "white", borderRadius: "8px", fontWeight: "600", textDecoration: "none", fontSize: "16px"}}>
              Get Started Free
            </Link>
            <Link href="/auth/login" style={{padding: "14px 32px", background: "transparent", color: "#7c3aed", borderRadius: "8px", fontWeight: "600", textDecoration: "none", fontSize: "16px", border: "2px solid #7c3aed"}}>
              Sign In
            </Link>
          </>
        )}
      </div>

      {/* Features */}
      <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginTop: "80px", maxWidth: "700px"}}>
        {["🌐 Websites", "🎮 Games", "🖼️ Images", "📱 Apps", "🎬 Videos", "📊 Analysis"].map((f, i) => (
          <div key={i} style={{background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "20px", textAlign: "center", fontSize: "14px"}}>
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}
