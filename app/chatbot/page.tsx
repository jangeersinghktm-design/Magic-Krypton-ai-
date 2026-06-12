"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const C = {
  bg:"#050816",surface:"#0B1020",card:"#0D1530",
  border:"rgba(255,217,61,0.12)",borderHi:"rgba(255,217,61,0.35)",
  text:"#FFFFFF",sub:"#94A3B8",muted:"#4A5568",
  grad:"linear-gradient(135deg,#FFD93D,#FF8A00)",
  accent:"#FFD93D",danger:"#EF4444",
};

function renderMarkdown(text:string):string{
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g,(_,lang,code)=>
      `<div class="cb"><div class="cl">${lang||"code"}</div><pre><code>${code.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</code></pre><button class="cpb" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').innerText)">Copy</button></div>`)
    .replace(/`([^`]+)`/g,"<code class=\"ic\">$1</code>")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/^### (.+)$/gm,"<h3>$1</h3>")
    .replace(/^## (.+)$/gm,"<h2>$1</h2>")
    .replace(/^# (.+)$/gm,"<h1>$1</h1>")
    .replace(/^- (.+)$/gm,"<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g,s=>`<ul>${s}</ul>`)
    .replace(/\n\n/g,"</p><p>").trim();
}

type Msg={id:string;role:"user"|"ai";content:string;ts:Date;loading?:boolean};
type Chat={id:string;title:string;messages:Msg[];createdAt:Date};
const mkChat=():Chat=>({id:Date.now().toString(),title:"New Chat",messages:[],createdAt:new Date()});

export default function ChatbotPage(){
  const router=useRouter();
  const supabase=createClient();
  const[chats,setChats]=useState<Chat[]>([mkChat()]);
  const[activeId,setActiveId]=useState<string>("");
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const[search,setSearch]=useState("");
  const[sidebar,setSidebar]=useState(true);
  const[renaming,setRenaming]=useState<string|null>(null);
  const[renameVal,setRenameVal]=useState("");
  const[isMobile,setIsMobile]=useState(false);
  const[user,setUser]=useState<any>(null);
  const endRef=useRef<HTMLDivElement>(null);
  const abortRef=useRef<AbortController|null>(null);

  useEffect(()=>{
    (async()=>{
      const{data:{session}}=await supabase.auth.getSession();
      if(!session){router.push("/auth/login");return;}
      setUser(session.user);
    })();
    const check=()=>setIsMobile(window.innerWidth<768);
    check();window.addEventListener("resize",check);
    return()=>window.removeEventListener("resize",check);
  },[]);

  useEffect(()=>{if(chats.length>0&&!activeId)setActiveId(chats[0].id);},[chats]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[chats,activeId]);

  const activeChat=chats.find(c=>c.id===activeId)||chats[0];

  const updateChat=useCallback((id:string,fn:(c:Chat)=>Chat)=>{
    setChats(prev=>prev.map(c=>c.id===id?fn(c):c));
  },[]);

  const addChat=()=>{
    const c=mkChat();setChats(prev=>[c,...prev]);setActiveId(c.id);
    if(isMobile)setSidebar(false);
  };

  const deleteChat=(id:string)=>{
    setChats(prev=>{
      const next=prev.filter(c=>c.id!==id);
      return next.length===0?[mkChat()]:next;
    });
  };

  const send=async(override?:string)=>{
    const text=(override||input).trim();
    if(!text||loading)return;
    const chatId=activeId||chats[0]?.id;if(!chatId)return;
    const uid=`u-${Date.now()}`,aid=`a-${Date.now()}`;
    updateChat(chatId,c=>({
      ...c,
      title:c.messages.length===0?text.slice(0,36)||"New Chat":c.title,
      messages:[...c.messages,
        {id:uid,role:"user",content:text,ts:new Date()},
        {id:aid,role:"ai",content:"",ts:new Date(),loading:true}
      ],
    }));
    setInput("");setLoading(true);
    abortRef.current=new AbortController();
    try{
      const history=(activeChat?.messages||[]).slice(-8).map(m=>({role:m.role,content:m.content}));
      const res=await fetch("/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:text,history}),
        signal:abortRef.current.signal,
      });
      const data=await res.json();
      const reply=data.reply||data.text||"Sorry, I couldn't process that.";
      let displayed="";
      for(let i=0;i<reply.length;i++){
        await new Promise(r=>setTimeout(r,7));
        displayed+=reply[i];
        updateChat(chatId,c=>({...c,messages:c.messages.map(m=>m.id===aid?{...m,content:displayed,loading:false}:m)}));
      }
    }catch(e:any){
      if(e.name!=="AbortError"){
        updateChat(chatId,c=>({...c,messages:c.messages.map(m=>m.id===aid?{...m,content:"Connection error. Please try again.",loading:false}:m)}));
      }
    }finally{setLoading(false);}
  };

  const stop=()=>{abortRef.current?.abort();setLoading(false);};

  const regenerate=async()=>{
    if(!activeChat)return;
    const last=[...activeChat.messages].reverse().find(m=>m.role==="user");
    if(!last)return;
    updateChat(activeChat.id,c=>({...c,messages:c.messages.slice(0,-1)}));
    await send(last.content);
  };

  const filtered=chats.filter(c=>c.title.toLowerCase().includes(search.toLowerCase()));

  const SUGGESTIONS=["Write a Python web scraper","Explain machine learning","Draft a cold email","Create a business plan","Debug my code"];

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,color:C.text,fontFamily:"'Inter',sans-serif",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,217,61,.2);border-radius:4px;}
        textarea{font-family:'Inter',sans-serif;}input{font-family:'Inter',sans-serif;}
        .cb{position:relative;background:#0A0F1E;border:1px solid rgba(255,255,255,.07);border-radius:10px;margin:12px 0;overflow:hidden;}
        .cl{padding:6px 14px;background:rgba(255,255,255,.04);font-size:11px;color:#64748B;font-family:'JetBrains Mono',monospace;border-bottom:1px solid rgba(255,255,255,.05);}
        .cb pre{padding:14px;overflow-x:auto;}.cb code{font-family:'JetBrains Mono',monospace;font-size:13px;color:#E2E8F0;line-height:1.6;}
        .cpb{position:absolute;top:8px;right:8px;padding:4px 10px;background:rgba(255,217,61,.1);border:1px solid rgba(255,217,61,.25);border-radius:6px;color:#FFD93D;font-size:11px;cursor:pointer;font-family:'Inter',sans-serif;}
        .ic{background:rgba(255,255,255,.08);border-radius:4px;padding:2px 6px;font-family:'JetBrains Mono',monospace;font-size:13px;color:#FFD93D;}
        .mc h1{font-size:20px;font-weight:700;margin:12px 0 8px;font-family:'Syne',sans-serif;}
        .mc h2{font-size:17px;font-weight:600;margin:10px 0 6px;}
        .mc h3{font-size:15px;font-weight:600;margin:8px 0 4px;color:#FFD93D;}
        .mc p{line-height:1.75;margin-bottom:10px;}.mc ul{padding-left:20px;margin-bottom:10px;}
        .mc li{margin-bottom:4px;line-height:1.6;}.mc strong{font-weight:600;color:#fff;}.mc em{color:#94A3B8;}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .td{display:inline-block;width:7px;height:7px;border-radius:50%;background:#FFD93D;animation:pulse 1.2s ease-in-out infinite;}
        .td:nth-child(2){animation-delay:.2s}.td:nth-child(3){animation-delay:.4s}
        .ci:hover .db{opacity:1!important;}
        .ab:hover{background:rgba(255,255,255,.08)!important;color:#fff!important;}
        .sb:hover{transform:scale(1.05);box-shadow:0 0 20px rgba(255,217,61,.4);}
      `}</style>

      {/* SIDEBAR */}
      {(sidebar||!isMobile)&&(
        <div style={{
          width:isMobile?"100vw":272,flexShrink:0,background:C.surface,
          borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",
          position:isMobile?"fixed":"relative",inset:isMobile?0:"auto",zIndex:isMobile?100:"auto",
        }}>
          <div style={{padding:"14px 12px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:28,height:28,borderRadius:8,background:C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🤖</div>
                <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Krypton Chat</span>
              </div>
              {isMobile&&<button onClick={()=>setSidebar(false)} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:20}}>✕</button>}
            </div>
            <button onClick={addChat} style={{width:"100%",padding:"9px",background:C.grad,border:"none",borderRadius:10,color:"#0B1020",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
              ✦ New Chat
            </button>
          </div>
          <div style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}`}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search chats..."
              style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:13,outline:"none"}}/>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"6px"}}>
            {filtered.map(chat=>(
              <div key={chat.id} className="ci" style={{
                padding:"9px 10px",borderRadius:10,cursor:"pointer",
                background:chat.id===activeId?"rgba(255,217,61,.07)":"transparent",
                border:`1px solid ${chat.id===activeId?C.borderHi:"transparent"}`,
                marginBottom:3,display:"flex",alignItems:"center",gap:8,
              }} onClick={()=>{setActiveId(chat.id);if(isMobile)setSidebar(false);}}>
                <span style={{fontSize:13,flexShrink:0}}>💬</span>
                {renaming===chat.id?(
                  <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                    onBlur={()=>{setChats(p=>p.map(c=>c.id===renaming?{...c,title:renameVal||c.title}:c));setRenaming(null);}}
                    onKeyDown={e=>{if(e.key==="Enter"){setChats(p=>p.map(c=>c.id===renaming?{...c,title:renameVal||c.title}:c));setRenaming(null);}}}
                    onClick={e=>e.stopPropagation()}
                    style={{flex:1,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,217,61,.4)",borderRadius:6,padding:"2px 8px",color:C.text,fontSize:13,outline:"none"}}/>
                ):(
                  <span style={{flex:1,fontSize:13,color:chat.id===activeId?C.text:C.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{chat.title}</span>
                )}
                <div style={{display:"flex",gap:3,flexShrink:0}}>
                  <button className="db" onClick={e=>{e.stopPropagation();setRenaming(chat.id);setRenameVal(chat.title);}}
                    style={{opacity:0,background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:11,padding:"2px 4px",transition:"opacity .15s"}}>✏️</button>
                  <button className="db" onClick={e=>{e.stopPropagation();deleteChat(chat.id);}}
                    style={{opacity:0,background:"none",border:"none",color:C.danger,cursor:"pointer",fontSize:11,padding:"2px 4px",transition:"opacity .15s"}}>🗑</button>
                </div>
              </div>
            ))}
          </div>
          {user&&(
            <div style={{padding:"10px 12px",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#0B1020",flexShrink:0}}>
                {(user.email||"U")[0].toUpperCase()}
              </div>
              <div style={{overflow:"hidden",flex:1}}>
                <div style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,background:"rgba(11,16,32,.85)",backdropFilter:"blur(20px)",flexShrink:0}}>
          <button onClick={()=>setSidebar(v=>!v)} style={{background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px",color:C.sub,cursor:"pointer",fontSize:13}}>☰</button>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14}}>{activeChat?.title||"New Chat"}</div>
            <div style={{fontSize:11,color:C.muted}}>{activeChat?.messages.length||0} messages</div>
          </div>
          <button onClick={addChat} style={{padding:"7px 14px",background:C.grad,border:"none",borderRadius:8,color:"#0B1020",fontWeight:700,fontSize:12,cursor:"pointer"}}>+ New</button>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 0"}}>
          {(!activeChat||activeChat.messages.length===0)&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:14,padding:32,textAlign:"center"}}>
              <div style={{width:56,height:56,borderRadius:18,background:C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🤖</div>
              <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800}}>How can I help you?</h2>
              <p style={{color:C.sub,fontSize:14,maxWidth:380,lineHeight:1.6}}>Ask me anything — coding, writing, analysis, or creative ideas.</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",maxWidth:520}}>
                {SUGGESTIONS.map(q=>(
                  <button key={q} onClick={()=>send(q)} style={{padding:"7px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:20,color:C.sub,fontSize:12,cursor:"pointer",transition:"all .2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderHi;e.currentTarget.style.color=C.text;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.sub;}}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {activeChat?.messages.map((msg,i)=>(
            <div key={msg.id} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start",padding:"5px 16px",animation:"slideIn .2s ease"}}>
              {msg.role==="ai"&&(
                <div style={{width:30,height:30,borderRadius:"50%",background:C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginRight:8,marginTop:4}}>🤖</div>
              )}
              <div style={{maxWidth:"74%"}}>
                <div style={{
                  padding:"12px 16px",
                  borderRadius:msg.role==="user"?"16px 16px 4px 16px":"4px 16px 16px 16px",
                  background:msg.role==="user"?C.grad:C.card,
                  border:msg.role==="ai"?`1px solid ${C.border}`:"none",
                  color:msg.role==="user"?"#0B1020":C.text,
                  fontSize:14,lineHeight:1.7,
                }}>
                  {msg.loading?(
                    <div style={{display:"flex",gap:5,padding:"2px 0"}}>
                      <span className="td"/><span className="td"/><span className="td"/>
                    </div>
                  ):msg.role==="ai"?(
                    <div className="mc" dangerouslySetInnerHTML={{__html:renderMarkdown(msg.content)||msg.content}}/>
                  ):(
                    <span style={{fontWeight:500}}>{msg.content}</span>
                  )}
                </div>
                {msg.role==="ai"&&!msg.loading&&(
                  <div style={{display:"flex",gap:5,marginTop:5,paddingLeft:2}}>
                    <button className="ab" onClick={()=>navigator.clipboard.writeText(msg.content)}
                      style={{padding:"3px 9px",background:"rgba(255,255,255,.04)",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,fontSize:11,cursor:"pointer",transition:"all .15s"}}>Copy</button>
                    {i===activeChat.messages.length-1&&(
                      <button className="ab" onClick={regenerate}
                        style={{padding:"3px 9px",background:"rgba(255,255,255,.04)",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,fontSize:11,cursor:"pointer",transition:"all .15s"}}>Regenerate</button>
                    )}
                  </div>
                )}
              </div>
              {msg.role==="user"&&(
                <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,217,61,.12)",border:`1px solid ${C.borderHi}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.accent,flexShrink:0,marginLeft:8,marginTop:4}}>
                  {(user?.email||"U")[0].toUpperCase()}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <div style={{padding:"10px 16px 14px",borderTop:`1px solid ${C.border}`,background:"rgba(11,16,32,.85)",backdropFilter:"blur(20px)",flexShrink:0}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"10px 12px",boxShadow:"0 0 30px rgba(255,217,61,.03)"}}>
            <textarea
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              placeholder="Ask anything... (Enter to send)"
              rows={1}
              style={{width:"100%",background:"none",border:"none",color:C.text,fontSize:14,resize:"none",outline:"none",lineHeight:1.6,maxHeight:120,overflowY:"auto"}}
            />
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
              <span style={{fontSize:11,color:C.muted}}>Krypton Intelligence Engine</span>
              <div style={{display:"flex",gap:6}}>
                {loading&&(
                  <button onClick={stop} style={{padding:"7px 14px",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",borderRadius:8,color:"#EF4444",fontSize:12,fontWeight:600,cursor:"pointer"}}>⏹ Stop</button>
                )}
                <button className="sb" onClick={()=>send()} disabled={!input.trim()||loading} style={{
                  width:38,height:38,borderRadius:"50%",
                  background:input.trim()?C.grad:"rgba(255,255,255,.06)",
                  border:"none",cursor:input.trim()?"pointer":"not-allowed",
                  display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M12 19V5M5 12l7-7 7 7" stroke={input.trim()?"#0B1020":"#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

          
