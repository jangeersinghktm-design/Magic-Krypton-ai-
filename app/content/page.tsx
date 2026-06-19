"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const C={
  bg:"#050816",surface:"#0B1020",card:"#0D1530",border:"rgba(255,217,61,0.12)",
  borderHi:"rgba(255,217,61,0.35)",text:"#FFFFFF",sub:"#94A3B8",muted:"#4A5568",
  grad:"linear-gradient(135deg,#FFD93D,#FF8A00)",accent:"#FFD93D",
};

const TOOLS=[
  {id:"blog",icon:"📝",label:"Blog Post",desc:"Long-form articles & blog content",
    placeholder:"Benefits of meditation for productivity",
    options:["Word Count: 500","Word Count: 1000","Word Count: 2000"],
    systemHint:"Write a high-quality, SEO-optimized blog post with H2/H3 headings, engaging intro, detailed body sections, and strong conclusion."},
  {id:"youtube",icon:"🎬",label:"YouTube Script",desc:"Engaging video scripts",
    placeholder:"How to build a successful SaaS in 2025",
    options:["Duration: 5 min","Duration: 10 min","Duration: 20 min"],
    systemHint:"Write a YouTube script with [HOOK], [INTRO], [MAIN CONTENT with timestamps], [CTA], and [OUTRO]. Include on-screen text suggestions in brackets."},
  {id:"adcopy",icon:"📢",label:"Ad Copy",desc:"High-converting advertisements",
    placeholder:"AI productivity tool for remote teams",
    options:["Platform: Google","Platform: Facebook","Platform: Instagram"],
    systemHint:"Write 3 variations of ad copy with headline, primary text, and CTA. Make it conversion-focused and benefit-driven."},
  {id:"facebook",icon:"👥",label:"Facebook Post",desc:"Engaging social media posts",
    placeholder:"Launch of our new fitness app",
    options:["Style: Informative","Style: Story","Style: Promotional"],
    systemHint:"Write an engaging Facebook post with hook, body, and clear CTA. Include relevant emojis and hashtags."},
  {id:"instagram",icon:"📸",label:"Instagram Caption",desc:"Captions with hashtags",
    placeholder:"Morning workout routine at home",
    options:["Tone: Motivational","Tone: Casual","Tone: Professional"],
    systemHint:"Write an Instagram caption with engaging opening line, body text, call-to-action, line break, and 20-30 relevant hashtags."},
  {id:"email",icon:"📧",label:"Email Writer",desc:"Professional email campaigns",
    placeholder:"Follow up after sales demo",
    options:["Type: Cold Outreach","Type: Follow-up","Type: Newsletter"],
    systemHint:"Write a professional email with subject line, personalized opening, clear value proposition, CTA, and professional signature."},
  {id:"sales",icon:"💰",label:"Sales Letter",desc:"Long-form sales copy",
    placeholder:"Online course about digital marketing",
    options:["Length: Short","Length: Medium","Length: Long"],
    systemHint:"Write a persuasive sales letter with attention-grabbing headline, problem identification, solution, benefits, social proof, offer, and strong CTA."},
  {id:"product",icon:"🛒",label:"Product Description",desc:"Compelling product copy",
    placeholder:"Wireless noise-canceling headphones",
    options:["Format: Short","Format: Detailed","Format: Bullet Points"],
    systemHint:"Write a compelling product description with hook, key features, benefits, technical specs, and purchase CTA. Focus on customer outcomes."},
];

type HistoryItem={id:string;tool:string;topic:string;content:string;ts:Date};

export default function ContentPage(){
  const router=useRouter();
  const supabase=createClient();
  const[activeTool,setActiveTool]=useState(TOOLS[0]);
  const[topic,setTopic]=useState("");
  const[option,setOption]=useState(0);
  const[tone,setTone]=useState("Professional");
  const[result,setResult]=useState("");
  const[loading,setLoading]=useState(false);
  const[copied,setCopied]=useState(false);
  const[history,setHistory]=useState<HistoryItem[]>([]);
  const[showHistory,setShowHistory]=useState(false);
  const[wordCount,setWordCount]=useState(0);

  useEffect(()=>{
    (async()=>{
      const{data:{session}}=await supabase.auth.getSession();
      if(!session){router.push("/auth/login");return;}
    })();
    // Load history from localStorage
    try{const h=JSON.parse(localStorage.getItem("krypton_content_history")||"[]");setHistory(h);}catch{}
  },[]);

  useEffect(()=>{
    setWordCount(result?result.trim().split(/\s+/).filter(Boolean).length:0);
  },[result]);

  const generate=async()=>{
    if(!topic.trim()||loading)return;
    setLoading(true);setResult("");
    try{
      const selectedOption=activeTool.options[option];
      const fullPrompt=`${activeTool.systemHint}

Topic/Subject: "${topic}"
Option: ${selectedOption}
Tone: ${tone}

Generate ONLY in English. Make it high-quality, professional, and ready to use.`;

      const res=await fetch("/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:fullPrompt}),
      });
      const data=await res.json();
      const output=data.reply||data.text||"Failed to generate. Please try again.";
      setResult(output);

      // Save to history
      const item:HistoryItem={
        id:Date.now().toString(),
        tool:activeTool.label,
        topic,
        content:output,
        ts:new Date(),
      };
      const newHistory=[item,...history].slice(0,20);
      setHistory(newHistory);
      try{localStorage.setItem("krypton_content_history",JSON.stringify(newHistory));}catch{}
    }catch{
      setResult("Connection error. Please try again.");
    }finally{
      setLoading(false);
    }
  };

  const copy=()=>{
    navigator.clipboard.writeText(result);
    setCopied(true);setTimeout(()=>setCopied(false),2000);
  };

  const download=()=>{
    const blob=new Blob([result],{type:"text/plain"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=`${activeTool.label}-${topic.slice(0,20)}.txt`;a.click();
    URL.revokeObjectURL(url);
  };

  const TONES=["Professional","Casual","Humorous","Formal","Conversational","Persuasive"];

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Inter',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Baloo+2:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,217,61,.2);border-radius:4px;}
        textarea,select,input{font-family:'Inter',sans-serif;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .tool-card:hover{border-color:rgba(255,217,61,.3)!important;background:rgba(255,217,61,.05)!important;}
        .action-btn:hover{background:rgba(255,255,255,.08)!important;}
        .history-item:hover{background:rgba(255,217,61,.05)!important;border-color:rgba(255,217,61,.2)!important;}
      `}</style>

      {/* Header */}
      <div style={{padding:"12px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,background:"rgba(11,16,32,.9)",backdropFilter:"blur(20px)",flexShrink:0,position:"sticky",top:0,zIndex:10}}>
        <button onClick={()=>window.close()} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",gap:4}}>← Back</button>
        <div style={{width:1,height:20,background:C.border}}/>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✍️</div>
          <span style={{fontFamily:"'Baloo 2',sans-serif",fontWeight:800,fontSize:15,background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Content Studio</span>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button onClick={()=>setShowHistory(v=>!v)} style={{padding:"6px 12px",background:showHistory?"rgba(255,217,61,.1)":"rgba(255,255,255,.04)",border:`1px solid ${showHistory?C.borderHi:C.border}`,borderRadius:8,color:showHistory?C.accent:C.muted,fontSize:12,cursor:"pointer",transition:"all .15s"}}>
            📋 History ({history.length})
          </button>
        </div>
      </div>

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* LEFT — Tool Selector */}
        <div style={{width:240,flexShrink:0,borderRight:`1px solid ${C.border}`,overflowY:"auto",padding:"12px 10px"}}>
          <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".1em",padding:"4px 8px",marginBottom:8}}>Content Types</div>
          {TOOLS.map(tool=>(
            <div key={tool.id} className="tool-card" onClick={()=>{setActiveTool(tool);setResult("");setOption(0);}}
              style={{
                padding:"10px 12px",borderRadius:10,cursor:"pointer",marginBottom:4,
                background:activeTool.id===tool.id?"rgba(255,217,61,.08)":"transparent",
                border:`1px solid ${activeTool.id===tool.id?C.borderHi:"transparent"}`,
                transition:"all .15s",
              }}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                <span style={{fontSize:16}}>{tool.icon}</span>
                <span style={{fontSize:13,fontWeight:600,color:activeTool.id===tool.id?C.text:C.sub}}>{tool.label}</span>
              </div>
              <div style={{fontSize:11,color:C.muted,paddingLeft:24}}>{tool.desc}</div>
            </div>
          ))}
        </div>

        {/* MIDDLE — Input */}
        <div style={{width:340,flexShrink:0,borderRight:`1px solid ${C.border}`,overflowY:"auto",padding:"20px 16px",display:"flex",flexDirection:"column",gap:16}}>
          {/* Active Tool Header */}
          <div style={{padding:"14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:20}}>{activeTool.icon}</span>
              <div>
                <div style={{fontWeight:700,fontSize:15,fontFamily:"'Baloo 2',sans-serif"}}>{activeTool.label}</div>
                <div style={{fontSize:12,color:C.muted}}>{activeTool.desc}</div>
              </div>
            </div>
          </div>

          {/* Topic */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:8}}>Topic / Subject</label>
            <textarea
              value={topic}
              onChange={e=>setTopic(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))generate();}}
              placeholder={activeTool.placeholder}
              rows={3}
              style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",color:C.text,fontSize:14,resize:"none",outline:"none",lineHeight:1.6,transition:"border-color .2s"}}
            />
          </div>

          {/* Options */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:8}}>Options</label>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {activeTool.options.map((opt,i)=>(
                <button key={opt} onClick={()=>setOption(i)} style={{
                  padding:"9px 14px",borderRadius:10,textAlign:"left",
                  background:option===i?"rgba(255,217,61,.08)":"rgba(255,255,255,.03)",
                  border:`1px solid ${option===i?C.borderHi:C.border}`,
                  color:option===i?C.text:C.muted,fontSize:13,cursor:"pointer",transition:"all .15s",
                }}>{opt}</button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:8}}>Tone of Voice</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {TONES.map(t=>(
                <button key={t} onClick={()=>setTone(t)} style={{
                  padding:"5px 12px",borderRadius:20,
                  background:tone===t?"rgba(255,217,61,.12)":"rgba(255,255,255,.04)",
                  border:`1px solid ${tone===t?C.borderHi:C.border}`,
                  color:tone===t?C.accent:C.muted,fontSize:12,cursor:"pointer",transition:"all .15s",
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <button onClick={generate} disabled={!topic.trim()||loading} style={{
            width:"100%",padding:"13px",background:topic.trim()?C.grad:"rgba(255,255,255,.06)",
            border:"none",borderRadius:12,color:topic.trim()?"#0B1020":C.muted,
            fontWeight:700,fontSize:15,cursor:topic.trim()?"pointer":"not-allowed",transition:"all .2s",
          }}>
            {loading?(
              <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{width:14,height:14,border:"2px solid rgba(0,0,0,.3)",borderTop:"2px solid #0B1020",borderRadius:"50%",animation:"spin .8s linear infinite",display:"inline-block"}}/>
                Writing...
              </span>
            ):`✦ Generate ${activeTool.label}`}
          </button>
        </div>

        {/* RIGHT — Output */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Output Header */}
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <span style={{fontSize:13,fontWeight:600,color:C.sub}}>Output</span>
            {result&&<span style={{fontSize:11,color:C.muted,background:C.card,border:`1px solid ${C.border}`,padding:"2px 8px",borderRadius:10}}>{wordCount} words</span>}
            <div style={{marginLeft:"auto",display:"flex",gap:6}}>
              {result&&(
                <>
                  <button className="action-btn" onClick={copy} style={{padding:"6px 14px",background:"rgba(255,255,255,.04)",border:`1px solid ${C.border}`,borderRadius:8,color:copied?"#10B981":C.muted,fontSize:12,cursor:"pointer",transition:"all .15s"}}>
                    {copied?"✓ Copied!":"Copy"}
                  </button>
                  <button className="action-btn" onClick={download} style={{padding:"6px 14px",background:"rgba(255,255,255,.04)",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:12,cursor:"pointer",transition:"all .15s"}}>
                    ⬇ Download
                  </button>
                  <button className="action-btn" onClick={()=>setResult("")} style={{padding:"6px 14px",background:"rgba(255,255,255,.04)",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:12,cursor:"pointer",transition:"all .15s"}}>
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Output Content */}
          <div style={{flex:1,overflowY:"auto",padding:20}}>
            {!result&&!loading&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12,textAlign:"center"}}>
                <div style={{width:64,height:64,borderRadius:18,background:C.card,border:`2px dashed ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>✍️</div>
                <div style={{color:C.muted,fontSize:14}}>Your generated content will appear here</div>
                <div style={{color:C.muted,fontSize:12}}>Select a tool, enter your topic, and click Generate</div>
              </div>
            )}
            {loading&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12}}>
                <div style={{width:48,height:48,border:"3px solid rgba(255,217,61,.15)",borderTop:`3px solid ${C.accent}`,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
                <div style={{color:C.sub,fontSize:14}}>Writing your {activeTool.label.toLowerCase()}...</div>
                <div style={{color:C.muted,fontSize:12}}>This takes 5–15 seconds</div>
              </div>
            )}
            {result&&(
              <div style={{animation:"fadeIn .3s ease"}}>
                <textarea
                  value={result}
                  onChange={e=>setResult(e.target.value)}
                  style={{
                    width:"100%",minHeight:"60vh",background:"none",border:"none",
                    color:C.text,fontSize:14,lineHeight:1.85,outline:"none",resize:"none",
                    fontFamily:"'Inter',sans-serif",
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* History Panel */}
        {showHistory&&(
          <div style={{width:280,flexShrink:0,borderLeft:`1px solid ${C.border}`,overflowY:"auto",background:C.surface}}>
            <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:13,fontWeight:600}}>Recent History</span>
              <button onClick={()=>{setHistory([]);localStorage.removeItem("krypton_content_history");}} style={{background:"none",border:"none",color:C.muted,fontSize:11,cursor:"pointer"}}>Clear all</button>
            </div>
            <div style={{padding:"8px"}}>
              {history.length===0&&<div style={{textAlign:"center",padding:24,color:C.muted,fontSize:13}}>No history yet</div>}
              {history.map(item=>(
                <div key={item.id} className="history-item" onClick={()=>{setResult(item.content);setTopic(item.topic);setShowHistory(false);}}
                  style={{padding:"10px 12px",borderRadius:10,cursor:"pointer",border:`1px solid transparent`,marginBottom:6,transition:"all .15s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <span style={{fontSize:10,color:C.accent,background:"rgba(255,217,61,.08)",padding:"2px 6px",borderRadius:6,fontWeight:600}}>{item.tool}</span>
                    <span style={{fontSize:10,color:C.muted}}>{new Date(item.ts).toLocaleDateString()}</span>
                  </div>
                  <div style={{fontSize:13,color:C.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.topic}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{item.content.trim().split(/\s+/).length} words</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
