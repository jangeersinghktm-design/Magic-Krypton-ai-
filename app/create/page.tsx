"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreatePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
    };
    checkAuth();
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult("");
    setError("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (data.html) {
        setResult(data.html);
      } else {
        setError(data.error || "Failed");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{background:"#000",color:"#fff",minHeight:"100vh",fontFamily:"sans-serif"}}>
      
      {/* Top Bar */}
      <div style={{padding:"12px 20px",borderBottom:"1px solid #222",display:"flex",alignItems:"center",background:"#000"}}>
        <span style={{fontSize:"20px",marginRight:"8px"}}>⚡</span>
        <h1 style={{fontSize:"16px",fontWeight:"bold",margin:0}}>Krypton AI</h1>
        <button onClick={() => router.push("/dashboard")} style={{marginLeft:"auto",padding:"6px 14px",background:"#111",border:"1px solid #333",borderRadius:"6px",color:"#fff",cursor:"pointer",fontSize:"13px"}}>
          Dashboard
        </button>
      </div>

      {/* Input Section */}
      <div style={{padding:"20px",borderBottom:"1px solid #222"}}>
        <p style={{color:"#888",fontSize:"13px",marginBottom:"8px",marginTop:0}}>What do you want to build?</p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Restaurant website with menu..."
          rows={4}
          style={{width:"100%",background:"#111",border:"1px solid #333",borderRadius:"8px",color:"#fff",padding:"12px",fontSize:"14px",resize:"vertical",outline:"none",boxSizing:"border-box"}}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          style={{marginTop:"10px",width:"100%",padding:"13px",background:loading?"#333":"#7c3aed",color:"#fff",borderRadius:"8px",fontWeight:"700",border:"none",cursor:loading?"not-allowed":"pointer",fontSize:"15px"}}
        >
          {loading ? "⚡ Generating... (30 sec)" : "⚡ Generate"}
        </button>

        {/* Quick examples */}
        <div style={{marginTop:"10px",display:"flex",gap:"6px",flexWrap:"wrap"}}>
          {["Restaurant website","Snake game","Portfolio","Calculator","Todo app"].map((ex,i) => (
            <button key={i} onClick={() => setPrompt(ex)} style={{padding:"5px 10px",background:"#111",border:"1px solid #333",borderRadius:"5px",color:"#888",cursor:"pointer",fontSize:"11px"}}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Preview Section */}
      <div style={{padding:"20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
          <p style={{color:"#888",fontSize:"13px",margin:0}}>
            {result ? "✅ Preview ready!" : "⏳ Preview will appear here"}
          </p>
          {result && (
            <button
              onClick={() => {
                const blob = new Blob([result], {type:"text/html"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "krypton-creation.html";
                a.click();
              }}
              style={{padding:"5px 12px",background:"#1a1a2e",border:"1px solid #7c3aed",borderRadius:"6px",color:"#a78bfa",cursor:"pointer",fontSize:"12px"}}
            >
              ⬇️ Download
            </button>
          )}
        </div>

        {error && (
          <div style={{padding:"12px",background:"rgba(255,0,0,0.1)",border:"1px solid #ff4444",borderRadius:"8px",color:"#ff6b6b",marginBottom:"12px",fontSize:"14px"}}>
            ❌ {error}
          </div>
        )}

        {result ? (
          <iframe
            srcDoc={result}
            style={{width:"100%",height:"70vh",minHeight:"400px",border:"2px solid #7c3aed",borderRadius:"8px",display:"block",background:"#fff"}}
            title="preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : (
          <div style={{height:"300px",background:"#111",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"12px",border:"1px solid #222"}}>
            <span style={{fontSize:"48px"}}>⚡</span>
            <p style={{color:"#444",margin:0}}>Your creation will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
