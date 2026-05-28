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
    <div style={{
      height:"100vh",
      display:"flex",
      flexDirection:"column",
      background:"#0a0a0a",
      color:"#fff",
      fontFamily:"sans-serif",
      overflow:"hidden"
    }}>
      
      {/* Top Bar */}
      <div style={{
        padding:"12px 20px",
        borderBottom:"1px solid #222",
        display:"flex",
        alignItems:"center",
        background:"#000",
        flexShrink:0
      }}>
        <span style={{fontSize:"20px",marginRight:"8px"}}>⚡</span>
        <h1 style={{fontSize:"16px",fontWeight:"bold",margin:0}}>Krypton AI</h1>
        <button
          onClick={() => router.push("/dashboard")}
          style={{marginLeft:"auto",padding:"6px 14px",background:"#111",border:"1px solid #333",borderRadius:"6px",color:"#fff",cursor:"pointer",fontSize:"13px"}}
        >
          Dashboard
        </button>
      </div>

      {/* Main Area - Split View */}
      <div style={{
        flex:1,
        display:"flex",
        overflow:"hidden",
        flexDirection:"row"
      }}>

        {/* LEFT PANEL */}
        <div style={{
          width:"320px",
          minWidth:"280px",
          maxWidth:"380px",
          borderRight:"1px solid #222",
          display:"flex",
          flexDirection:"column",
          padding:"16px",
          overflowY:"auto",
          background:"#0a0a0a",
          flexShrink:0
        }}>
          <p style={{color:"#888",fontSize:"12px",margin:"0 0 8px 0",textTransform:"uppercase",letterSpacing:"0.5px"}}>
            What do you want to build?
          </p>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Restaurant website with menu and contact form..."
            style={{
              width:"100%",
              height:"140px",
              background:"#111",
              border:"1px solid #333",
              borderRadius:"8px",
              color:"#fff",
              padding:"10px",
              fontSize:"13px",
              resize:"none",
              outline:"none",
              boxSizing:"border-box",
              lineHeight:"1.5"
            }}
          />

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            style={{
              marginTop:"10px",
              width:"100%",
              padding:"12px",
              background:loading?"#2a2a2a":"#7c3aed",
              color:loading?"#666":"#fff",
              borderRadius:"8px",
              fontWeight:"700",
              border:"none",
              cursor:loading?"not-allowed":"pointer",
              fontSize:"14px"
            }}
          >
            {loading ? "⚡ Generating..." : "⚡ Generate"}
          </button>

          {loading && (
            <p style={{color:"#666",fontSize:"11px",textAlign:"center",marginTop:"6px"}}>
              Please wait 20-30 seconds...
            </p>
          )}

          {/* Quick Examples */}
          <p style={{color:"#555",fontSize:"11px",margin:"16px 0 6px 0",textTransform:"uppercase",letterSpacing:"0.5px"}}>
            Quick examples
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
            {[
              "Restaurant website with menu",
              "Snake game in JavaScript",
              "Portfolio for a designer",
              "Calculator app",
              "Todo list app",
              "E-commerce landing page",
            ].map((ex, i) => (
              <button
                key={i}
                onClick={() => setPrompt(ex)}
                style={{
                  textAlign:"left",
                  padding:"7px 10px",
                  background:"rgba(124,58,237,0.08)",
                  border:"1px solid rgba(124,58,237,0.15)",
                  borderRadius:"6px",
                  color:"#aaa",
                  cursor:"pointer",
                  fontSize:"12px"
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL - Preview */}
        <div style={{
          flex:1,
          display:"flex",
          flexDirection:"column",
          overflow:"hidden",
          background:"#111"
        }}>
          
          {/* Preview Header */}
          <div style={{
            padding:"8px 16px",
            borderBottom:"1px solid #222",
            display:"flex",
            alignItems:"center",
            gap:"8px",
            background:"#0a0a0a",
            flexShrink:0
          }}>
            <div style={{width:"10px",height:"10px",borderRadius:"50%",background:result?"#22c55e":"#444"}}></div>
            <span style={{fontSize:"12px",color:"#666"}}>
              {loading ? "⚡ Generating..." : result ? "✅ Preview ready" : "Preview"}
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
                style={{
                  marginLeft:"auto",
                  padding:"4px 10px",
                  background:"rgba(124,58,237,0.2)",
                  border:"1px solid rgba(124,58,237,0.4)",
                  borderRadius:"5px",
                  color:"#a78bfa",
                  cursor:"pointer",
                  fontSize:"11px"
                }}
              >
                ⬇️ Download
              </button>
            )}
          </div>

          {/* Preview Content */}
          <div style={{flex:1,overflow:"hidden",position:"relative"}}>
            {error ? (
              <div style={{
                padding:"40px 20px",
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                height:"100%"
              }}>
                <div style={{
                  padding:"16px 24px",
                  background:"rgba(255,0,0,0.1)",
                  border:"1px solid rgba(255,0,0,0.3)",
                  borderRadius:"8px",
                  color:"#ff6b6b",
                  textAlign:"center",
                  maxWidth:"400px"
                }}>
                  ❌ {error}
                </div>
              </div>
            ) : result ? (
              <iframe
                key={result}
                srcDoc={result}
                style={{
                  width:"100%",
                  height:"100%",
                  border:"none",
                  display:"block"
                }}
                title="Krypton AI Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : (
              <div style={{
                height:"100%",
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                flexDirection:"column",
                gap:"12px"
              }}>
                <span style={{fontSize:"64px",opacity:0.3}}>⚡</span>
                <p style={{color:"#333",margin:0,fontSize:"16px"}}>Your creation will appear here</p>
                <p style={{color:"#2a2a2a",margin:0,fontSize:"13px"}}>Type a prompt and click Generate</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile CSS */}
      <style>{`
        @media (max-width: 640px) {
          .split-view {
            flex-direction: column !important;
          }
          .left-panel {
            width: 100% !important;
            max-width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid #222 !important;
            max-height: 45vh !important;
          }
          .right-panel {
            flex: 1 !important;
          }
        }
      `}</style>
    </div>
  );
                  }
