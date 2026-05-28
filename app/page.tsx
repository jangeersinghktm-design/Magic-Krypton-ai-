"use client";

import { useState } from "react";

export default function CreatePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

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
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err: any) {
      setError("Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",background:"#000",color:"#fff",display:"flex",flexDirection:"column"}}>
      
      <div style={{padding:"16px 24px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:"16px"}}>
        <span style={{fontSize:"24px"}}>⚡</span>
        <h1 style={{fontSize:"18px",fontWeight:"bold"}}>Krypton AI</h1>
        <a href="/dashboard" style={{marginLeft:"auto",padding:"8px 16px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",color:"#fff",textDecoration:"none"}}>
          Dashboard
        </a>
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column",padding:"20px",gap:"16px"}}>
        
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to build... e.g. Make a snake game"
          style={{width:"100%",height:"120px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",color:"#fff",padding:"12px",fontSize:"14px",resize:"none",outline:"none",boxSizing:"border-box"}}
        />

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          style={{padding:"14px",background:loading?"#4a4a4a":"#7c3aed",color:"white",borderRadius:"8px",fontWeight:"600",border:"none",cursor:loading?"not-allowed":"pointer",fontSize:"16px"}}
        >
          {loading ? "⚡ Generating... Please wait 30 seconds" : "⚡ Generate"}
        </button>

        {error && (
          <div style={{padding:"12px",background:"rgba(255,0,0,0.1)",border:"1px solid red",borderRadius:"8px",color:"#ff6b6b"}}>
            Error: {error}
          </div>
        )}

        {result && (
          <div style={{flex:1,minHeight:"500px",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",overflow:"hidden"}}>
            <iframe
              srcDoc={result}
              style={{width:"100%",height:"500px",border:"none"}}
              title="preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}
