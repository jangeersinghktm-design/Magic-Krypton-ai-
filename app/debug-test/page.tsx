"use client";
// app/debug-test/page.tsx — DELETE after fixing

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DebugTest() {
  const [result, setResult] = useState("Testing...");

  useEffect(() => {
    async function run() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setResult("❌ NOT LOGGED IN — Login karo pehle");
        return;
      }

      const res = await fetch("/api/debug-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });

      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    }
    run();
  }, []);

  return (
    <div style={{ background: "#000", minHeight: "100vh", padding: 32, color: "#fff", fontFamily: "monospace" }}>
      <h2 style={{ color: "#FFD700", marginBottom: 24 }}>🔍 Krypton Debug Test</h2>
      <pre style={{ background: "#111", padding: 24, borderRadius: 12, fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {result}
      </pre>
    </div>
  );
}
