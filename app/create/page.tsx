"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreatePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"input"|"preview">("input");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
      setUser(user);
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
        setActiveTab("preview");
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0a",color:"#fff",fontFamily:"sans-serif"}}>
      
      {/* Top Bar */}
      <div style={{padding:"12px 20px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:"12px",background:"#000",position:"sticky",top:0,zIndex:100}}>
        <span style={{fontSize:"20px"}}>⚡</span>
        <h1 style={{fontSize:"16px",fontWeight:"bold",margin:0}}>Krypton AI</h1>
        <button
          onClick={() => router.push("/dashboard")}
          style={{marginLeft:"auto",padding:"6px 14px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"6px",color:"#fff",cursor:"pointer",fontSize:"13px"}}
        >
          Dashboard
        </button>
      </div>

      {/* Desktop: Side by Side | Mobile: Tabs */}
      <div style={{display:"flex",height:"calc(100vh - 49px)"}}>

        {/* LEFT PANEL - always visible on desktop, tab on mobile */}
        <div style={{
          width:"100%",
          maxWidth:"420px",
          borderRight:"1px solid rgba(255,255,255,0.1)",
          display:"flex",
          flexDirection:"column",
          padding:"20px",
          overflowY:"auto",
        }}
        className="left-panel"
        >
          <h2 style={{fontSize:"15px",fontWeight:"600",marginBottom:"12px",color:"#aaa",marginTop:0}}>
            What do you want to build?
          </h2>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Make a beautiful restaurant website with menu and contact form..."
            style={{
              width:"100%",
              height:"150px",
              background:"rgba(255,255,255,0.05)",
              border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:"8px",
              color:"#fff",
              padding:"12px",
              fontSize:"14px",
              resize:"vertical",
              outline:"none",
              boxSizing:"border-box",
              lineHeight:"1.5"
            }}
          />

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            style={{
              marginTop:"12px",
              width:"100%",
              padding:"13px",
              background:loading?"#333":"#7c3aed",
              color:"white",
              borderRadius:"8px",
              fontWeight:"700",
              border:"none",
              cursor:loading?"not-allowed":"pointer",
              fontSize:"15px",
              transition:"background 0.2s"
            }}
          >
            {loading ? "⚡ Generating... (30s)" : "⚡ Generate"}
          </button>

          {/* Quick Examples */}
          <div style={{marginTop:"16px"}}>
            <p style={{color:"#555",fontSize:"11px",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Quick examples</p>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {[
                "Restaurant website with menu",
                "Snake game in JavaScript",
                "Portfolio for a designer",
                "Calculator app",
                "Todo list app",
              ].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(ex)}
                  style={{
                    textAlign:"left",
                    padding:"8px 12px",
                    background:"rgba(124,58,237,0.08)",
                    border:"1px solid rgba(124,58,237,0.2)",
                    borderRadius:"6px",
                    color:"#bbb",
                    cursor:"pointer",
                    fontSize:"12px",
                    transition:"all 0.2s"
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Preview */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          
          <div style={{padding:"10px 20px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:"8px"}}>
            <span style={{fontSize:"13px",color:"#888"}}>
              {result ? "✅ Preview ready" : "⏳ Preview"}
            </span>
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
                style={{marginLeft:"auto",padding:"5px 12px",background:"rgba(124,58,237,0.2)",border:"1px solid rgba(124,58,237,0.4)",borderRadius:"6px",color:"#a78bfa",cursor:"pointer",fontSize:"12px"}}
              >
                ⬇️ Download
              </button>
            )}
          </div>

          <div style={{flex:1,overflow:"hidden",background:"#fff"}}>
            {error ? (
              <div style={{padding:"20px",background:"#0a0a0a",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{padding:"16px",background:"rgba(255,0,0,0.1)",border:"1px solid rgba(255,0,0,0.3)",borderRadius:"8px",color:"#ff6b6b",maxWidth:"400px",textAlign:"center"}}>
                  ❌ {error}
                </div>
              </div>
            ) : result ? (
              <iframe
                srcDoc={result}
                style={{width:"100%",height:"100%",border:"none"}}
                title="Krypton AI Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : (
              <div style={{height:"100%",background:"#0a0a0a",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"12px"}}>
                <div style={{fontSize:"56px"}}>⚡</div>
                <p style={{color:"#444",fontSize:"16px",margin:0}}>Your creation will appear here</p>
                <p style={{color:"#333",fontSize:"13px",margin:0}}>Type a prompt and click Generate</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .left-panel {
            max-width: 100% !important;
            border-right: none !important;
          }
        }
      `}</style>
    </div>
  );
                     }
