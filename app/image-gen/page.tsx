"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const C = {
  bg:"#050816",surface:"#0B1020",card:"#0D1530",border:"rgba(255,217,61,0.12)",
  borderHi:"rgba(255,217,61,0.35)",text:"#FFFFFF",sub:"#94A3B8",muted:"#4A5568",
  grad:"linear-gradient(135deg,#FFD93D,#FF8A00)",accent:"#FFD93D",danger:"#EF4444",
};

const STYLES=["Realistic","Anime","Digital Art","Oil Painting","Watercolor","3D Render","Pixel Art","Cinematic","Sketch","Fantasy"];
const RATIOS=[{label:"1:1 Square",w:1024,h:1024},{label:"16:9 Wide",w:1792,h:1024},{label:"9:16 Portrait",w:1024,h:1792},{label:"4:3 Landscape",w:1344,h:1024}];
const QUALITIES=["Standard","HD","Ultra HD"];
const MOODS=["Dramatic","Soft","Vibrant","Dark","Minimal","Ethereal"];

type ImgItem={id:string;url:string;prompt:string;style:string;ts:Date};

export default function ImageGenPage(){
  const router=useRouter();
  const supabase=createClient();
  const[prompt,setPrompt]=useState("");
  const[negPrompt,setNegPrompt]=useState("");
  const[style,setStyle]=useState("Realistic");
  const[ratio,setRatio]=useState(RATIOS[0]);
  const[quality,setQuality]=useState("HD");
  const[mood,setMood]=useState("Dramatic");
  const[loading,setLoading]=useState(false);
  const[progress,setProgress]=useState(0);
  const[images,setImages]=useState<ImgItem[]>([]);
  const[selected,setSelected]=useState<ImgItem|null>(null);
  const[error,setError]=useState("");
  const[showNeg,setShowNeg]=useState(false);

  useEffect(()=>{
    (async()=>{
      const{data:{session}}=await supabase.auth.getSession();
      if(!session){router.push("/auth/login");return;}
    })();
  },[]);

  const generate=async()=>{
    if(!prompt.trim()||loading)return;
    setLoading(true);setError("");setProgress(0);

    // Animate progress bar
    const progressInterval=setInterval(()=>{
      setProgress(p=>{if(p>=90)return p;return p+Math.random()*8;});
    },400);

    try{
      const fullPrompt=`${style} style, ${mood} mood: ${prompt}${negPrompt?`, avoid: ${negPrompt}`:""}`;
      const res=await fetch("/api/screenshot",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:fullPrompt,size:`${ratio.w}x${ratio.h}`,quality}),
      });
      const data=await res.json();
      if(data.url){
        const item:ImgItem={id:Date.now().toString(),url:data.url,prompt,style,ts:new Date()};
        setImages(prev=>[item,...prev]);
        setSelected(item);
        setProgress(100);
      } else {
        setError(data.error||"Generation failed. Please try again with a different prompt.");
      }
    }catch{
      setError("Connection error. Please try again.");
    }finally{
      clearInterval(progressInterval);
      setTimeout(()=>{setLoading(false);setProgress(0);},500);
    }
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Inter',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,217,61,.2);border-radius:4px;}
        textarea,select,input{font-family:'Inter',sans-serif;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes fadeIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        .style-chip:hover{border-color:rgba(255,217,61,.5)!important;color:#fff!important;}
        .img-card:hover{transform:scale(1.03);box-shadow:0 8px 32px rgba(255,217,61,.15)!important;}
        .gen-btn:hover{box-shadow:0 0 32px rgba(255,138,0,.5)!important;transform:translateY(-1px);}
        .dl-btn:hover{background:rgba(255,217,61,.15)!important;}
      `}</style>

      {/* Header */}
      <div style={{padding:"12px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,background:"rgba(11,16,32,.9)",backdropFilter:"blur(20px)",flexShrink:0,position:"sticky",top:0,zIndex:10}}>
        <button onClick={()=>window.close()} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",gap:4}}>← Back</button>
        <div style={{width:1,height:20,background:C.border}}/>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🎨</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Image Studio</span>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:C.muted,background:C.card,border:`1px solid ${C.border}`,padding:"4px 10px",borderRadius:20}}>{images.length} Generated</span>
        </div>
      </div>

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* LEFT — Controls */}
        <div style={{width:320,flexShrink:0,borderRight:`1px solid ${C.border}`,overflowY:"auto",padding:"20px 16px",display:"flex",flexDirection:"column",gap:16}}>

          {/* Prompt */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:8}}>Describe your image</label>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 12px",transition:"border-color .2s"}}>
              <textarea
                value={prompt}
                onChange={e=>setPrompt(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))generate();}}
                placeholder="A cinematic shot of a futuristic city at dawn, neon reflections on wet streets..."
                rows={4}
                style={{width:"100%",background:"none",border:"none",color:C.text,fontSize:14,resize:"none",outline:"none",lineHeight:1.6}}
              />
            </div>
          </div>

          {/* Negative Prompt */}
          <div>
            <button onClick={()=>setShowNeg(v=>!v)} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5,padding:0,marginBottom:showNeg?8:0}}>
              {showNeg?"▼":"▶"} Negative Prompt (optional)
            </button>
            {showNeg&&(
              <textarea
                value={negPrompt}
                onChange={e=>setNegPrompt(e.target.value)}
                placeholder="blurry, bad quality, watermark, text, ugly..."
                rows={2}
                style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 12px",color:C.sub,fontSize:13,resize:"none",outline:"none",lineHeight:1.5}}
              />
            )}
          </div>

          {/* Style */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:8}}>Art Style</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {STYLES.map(s=>(
                <button key={s} className="style-chip" onClick={()=>setStyle(s)} style={{
                  padding:"5px 12px",borderRadius:20,
                  background:style===s?"rgba(255,217,61,.12)":"rgba(255,255,255,.04)",
                  border:`1px solid ${style===s?C.borderHi:C.border}`,
                  color:style===s?C.accent:C.muted,fontSize:12,cursor:"pointer",
                  transition:"all .15s",fontWeight:style===s?600:400,
                }}>{s}</button>
              ))}
            </div>
          </div>

          {/* Mood */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:8}}>Mood</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {MOODS.map(m=>(
                <button key={m} className="style-chip" onClick={()=>setMood(m)} style={{
                  padding:"5px 12px",borderRadius:20,
                  background:mood===m?"rgba(255,217,61,.12)":"rgba(255,255,255,.04)",
                  border:`1px solid ${mood===m?C.borderHi:C.border}`,
                  color:mood===m?C.accent:C.muted,fontSize:12,cursor:"pointer",transition:"all .15s",
                }}>{m}</button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:8}}>Aspect Ratio</label>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {RATIOS.map(r=>(
                <button key={r.label} onClick={()=>setRatio(r)} style={{
                  padding:"9px 14px",borderRadius:10,textAlign:"left",
                  background:ratio.label===r.label?"rgba(255,217,61,.08)":"rgba(255,255,255,.03)",
                  border:`1px solid ${ratio.label===r.label?C.borderHi:C.border}`,
                  color:ratio.label===r.label?C.text:C.muted,fontSize:13,cursor:"pointer",
                  display:"flex",justifyContent:"space-between",transition:"all .15s",
                }}>
                  <span>{r.label}</span>
                  <span style={{fontSize:11,color:C.muted}}>{r.w}×{r.h}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:8}}>Quality</label>
            <div style={{display:"flex",gap:6}}>
              {QUALITIES.map(q=>(
                <button key={q} onClick={()=>setQuality(q)} style={{
                  flex:1,padding:"8px 0",borderRadius:10,
                  background:quality===q?C.grad:"rgba(255,255,255,.04)",
                  border:`1px solid ${quality===q?"transparent":C.border}`,
                  color:quality===q?"#0B1020":C.muted,fontSize:12,fontWeight:quality===q?700:400,cursor:"pointer",transition:"all .15s",
                }}>{q}</button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button className="gen-btn" onClick={generate} disabled={!prompt.trim()||loading} style={{
            width:"100%",padding:"14px",background:prompt.trim()?C.grad:"rgba(255,255,255,.06)",
            border:"none",borderRadius:12,color:prompt.trim()?"#0B1020":C.muted,
            fontWeight:700,fontSize:15,cursor:prompt.trim()?"pointer":"not-allowed",
            transition:"all .2s",position:"relative",overflow:"hidden",
          }}>
            {loading?(
              <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{width:14,height:14,border:"2px solid rgba(0,0,0,.3)",borderTop:"2px solid #0B1020",borderRadius:"50%",animation:"spin .8s linear infinite",display:"inline-block"}}/>
                Generating...
              </span>
            ):"✦ Generate Image"}
          </button>

          {/* Progress */}
          {loading&&(
            <div>
              <div style={{height:3,background:"rgba(255,255,255,.06)",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${progress}%`,background:C.grad,borderRadius:4,transition:"width .4s ease"}}/>
              </div>
              <div style={{fontSize:11,color:C.muted,marginTop:5,textAlign:"center"}}>Generating your masterpiece... {Math.round(progress)}%</div>
            </div>
          )}

          {error&&<div style={{padding:12,background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:10,color:"#EF4444",fontSize:13}}>{error}</div>}
        </div>

        {/* RIGHT — Preview + Gallery */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Main Preview */}
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:"rgba(5,8,22,.5)",overflow:"hidden"}}>
            {loading&&!selected&&(
              <div style={{textAlign:"center"}}>
                <div style={{width:80,height:80,borderRadius:"50%",background:C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 16px",animation:"pulse 1.5s ease-in-out infinite"}}>✨</div>
                <div style={{color:C.sub,fontSize:14}}>Crafting your image...</div>
              </div>
            )}
            {!loading&&!selected&&(
              <div style={{textAlign:"center"}}>
                <div style={{width:120,height:120,borderRadius:24,background:C.card,border:`2px dashed ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,margin:"0 auto 16px"}}>🎨</div>
                <div style={{color:C.muted,fontSize:14}}>Your generated image will appear here</div>
                <div style={{color:C.muted,fontSize:12,marginTop:6}}>Describe an image and click Generate</div>
              </div>
            )}
            {selected&&(
              <div style={{position:"relative",maxWidth:"100%",maxHeight:"100%",animation:"fadeIn .4s ease"}}>
                <img src={selected.url} alt={selected.prompt}
                  style={{maxWidth:"100%",maxHeight:"60vh",objectFit:"contain",borderRadius:16,boxShadow:"0 24px 80px rgba(0,0,0,.6)"}}/>
                <div style={{position:"absolute",top:12,right:12,display:"flex",gap:8}}>
                  <a href={selected.url} download="krypton-image.png" className="dl-btn" style={{
                    padding:"8px 16px",background:"rgba(0,0,0,.7)",backdropFilter:"blur(10px)",
                    border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:13,
                    fontWeight:600,textDecoration:"none",transition:"all .2s",
                  }}>⬇ Download</a>
                  <button onClick={generate} className="dl-btn" style={{
                    padding:"8px 16px",background:"rgba(0,0,0,.7)",backdropFilter:"blur(10px)",
                    border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:13,
                    fontWeight:600,cursor:"pointer",transition:"all .2s",
                  }}>🔄 Regenerate</button>
                </div>
                <div style={{marginTop:12,padding:"10px 14px",background:"rgba(11,16,32,.9)",backdropFilter:"blur(10px)",borderRadius:12,border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:12,color:C.muted,marginBottom:3}}>Prompt</div>
                  <div style={{fontSize:13,color:C.text}}>{selected.prompt}</div>
                  <div style={{display:"flex",gap:8,marginTop:6}}>
                    <span style={{fontSize:11,color:C.accent,background:"rgba(255,217,61,.08)",padding:"2px 8px",borderRadius:10}}>{selected.style}</span>
                    <span style={{fontSize:11,color:C.muted}}>{new Date(selected.ts).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gallery */}
          {images.length>0&&(
            <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 16px",background:C.surface}}>
              <div style={{fontSize:12,color:C.muted,marginBottom:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em"}}>History ({images.length})</div>
              <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
                {images.map(img=>(
                  <div key={img.id} className="img-card" onClick={()=>setSelected(img)} style={{
                    width:80,height:80,borderRadius:10,overflow:"hidden",flexShrink:0,
                    border:`2px solid ${selected?.id===img.id?C.borderHi:C.border}`,
                    cursor:"pointer",transition:"all .2s",
                  }}>
                    <img src={img.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
 }
                           
