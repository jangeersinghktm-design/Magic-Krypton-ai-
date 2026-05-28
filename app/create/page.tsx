"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreatePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setUser(user);
    };
    checkAuth();
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (data.html) {
        setResult(data.html);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",background:"#000",color:"#fff",display:"flex",flexDirection:"column"}}>
      
      {/* Top Bar */}
      <div style={{padding:"16px 24px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:"16px"}}>
        <span style={{fontSize:"24px"}}>⚡</span>
        <h1 style={{fontSize:"18px",fontWeight:"bold"}}>Krypton AI</h1>
        <button
          onClick={() => router.push("/dashboard")}
          style={{marginLeft:"auto",padding:"8px 16px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",color:"#fff",cursor:"pointer"}}
        >
          Dashboard
        </button>
      </div>

      {/* Main Split View */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        
        {/* Left Panel - Chat */}
        <div style={{width:"380px",borderRight:"1px solid rgba(255,255,255,0.1)",display:"flex",flexDirection:"column",padding:"20px"}}>
          <h2 style={{fontSize:"16px",fontWeight:"600",marginBottom:"16px",color:"#999"}}>Describe what you want to build</h2>
          
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: Create a beautiful restaurant website with menu, about us section and contact form..."
            style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",color:"#fff",padding:"12px",fontSize:"14px",resize:"none",outline:"none",minHeight:"200px"}}
          />

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            style={{marginTop:"16px",padding:"14px",background:loading?"#4a4a4a":"#7c3aed",color:"white",borderRadius:"8px",fontWeight:"600",border:"none",cursor:loading?"not-allowed":"pointer",fontSize:"16px"}}
          >
            {loading ? "⚡ Generating..." : "⚡ Generate"}
          </button>

          {/* Quick Prompts */}
          <div style={{marginTop:"20px"}}>
            <p style={{color:"#666",fontSize:"12px",marginBottom:"8px"}}>Quick examples:</p>
            {[
              "Restaurant website with menu",
              "Snake game in JavaScript",
              "Portfolio website for designer",
            ].map((ex, i) => (
              <button
                key={i}
                onClick={() => setPrompt(ex)}
                style={{display:"block",width:"100%",textAlign:"left",padding:"8px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:"6px",color:"#999",cursor:"pointer",fontSize:"12px",marginBottom:"6px"}}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{padding:"12px 20px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",gap:"12px",alignItems:"center"}}>
            <span style={{fontSize:"14px",color:"#999"}}>Preview</span>
          </div>
          
          <div style={{flex:1,background:"#fff"}}>
            {result ? (
              <iframe
                srcDoc={result}
                style={{width:"100%",height:"100%",border:"none"}}
                title="preview"
              />
            ) : (
              <div style={{height:"100%",background:"#111",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"16px"}}>
                <div style={{fontSize:"48px"}}>⚡</div>
                <p style={{color:"#666",fontSize:"16px"}}>Your creation will appear here</p>
                <p style={{color:"#444",fontSize:"13px"}}>Type a prompt and click Generate</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
