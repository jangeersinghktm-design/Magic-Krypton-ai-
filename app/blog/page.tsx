"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const C = {
  bg:"#050505",card:"#0D0D0D",border:"rgba(245,197,66,0.12)",
  text:"#FFFFFF",sub:"#A0A0A0",muted:"#6B7280",
  grad:"linear-gradient(135deg,#F5C542,#00D084)",
};

const POSTS = [
  { id:1, tag:"Tutorial", emoji:"⚡", title:"Build a Full SaaS Landing Page with AI in 60 Seconds", date:"June 8, 2026", readTime:"4 min read",
    desc:"Learn how to use Krypton AI to generate a complete, production-ready SaaS landing page with pricing, testimonials, and animations — all from a single prompt.",
    author:"Krypton Team" },
  { id:2, tag:"Guide", emoji:"🎮", title:"How to Build Browser Games with Krypton AI", date:"June 5, 2026", readTime:"6 min read",
    desc:"From Snake to 2048, Krypton AI can generate fully playable browser games with keyboard controls, scoring, and animations. Here's how to get the best results.",
    author:"Krypton Team" },
  { id:3, tag:"Tips", emoji:"🚀", title:"10 Prompts That Generate Premium Websites", date:"June 1, 2026", readTime:"3 min read",
    desc:"The secret to getting great output from Krypton AI is a great prompt. We've tested hundreds — here are the top 10 that consistently produce stunning results.",
    author:"Krypton Team" },
  { id:4, tag:"Feature", emoji:"🤖", title:"Introducing Krypton Intelligence — Multi-Engine Architecture", date:"May 28, 2026", readTime:"5 min read",
    desc:"Krypton AI now routes your requests across the Krypton Intelligence Engine automatically. If one fails, the next kicks in instantly — you never see an error.",
    author:"Krypton Team" },
  { id:5, tag:"Tutorial", emoji:"📊", title:"Build a Complete Dashboard App in Under 2 Minutes", date:"May 22, 2026", readTime:"5 min read",
    desc:"Analytics dashboards, CRM panels, admin UIs — Krypton AI can generate them all with working charts, data tables, and sidebar navigation from one prompt.",
    author:"Krypton Team" },
  { id:6, tag:"Guide", emoji:"🛒", title:"E-Commerce Stores: From Prompt to Deployable in Seconds", date:"May 15, 2026", readTime:"7 min read",
    desc:"Build a full e-commerce store with product grid, cart system, checkout flow, and mobile-responsive design — without writing a single line of code.",
    author:"Krypton Team" },
];

const TAGS = ["All", "Tutorial", "Guide", "Tips", "Feature"];

export default function BlogPage() {
  const router = useRouter();
  const [activeTag, setActiveTag] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = POSTS.filter(p =>
    (activeTag === "All" || p.tag === activeTag) &&
    (p.title.toLowerCase().includes(search.toLowerCase()) || p.desc.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:rgba(245,197,66,.2);border-radius:4px;}
        .post-card:hover{border-color:rgba(245,197,66,.3)!important;transform:translateY(-4px);box-shadow:0 20px 48px rgba(0,0,0,.5);}
        .tag-btn:hover{border-color:rgba(245,197,66,.4)!important;color:#fff!important;}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom:`1px solid ${C.border}`, background:"rgba(5,5,5,.95)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"14px 24px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>router.push("/")} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>← Back</button>
          <div style={{ width:1, height:20, background:C.border }}/>
          <span style={{ fontFamily:"'Baloo 2',sans-serif", fontWeight:800, fontSize:16, background:C.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Krypton Blog</span>
          <div style={{ marginLeft:"auto" }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search posts..."
              style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"7px 14px", color:C.text, fontSize:13, outline:"none", width:200 }}/>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"60px 24px 40px", textAlign:"center" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(245,197,66,.08)", border:`1px solid rgba(245,197,66,.2)`, borderRadius:20, padding:"5px 16px", marginBottom:20, fontSize:12, fontWeight:600 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#00D084", display:"inline-block" }}/>
          <span style={{ background:C.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Tutorials, Guides & Updates</span>
        </div>
        <h1 style={{ fontFamily:"'Baloo 2',sans-serif", fontSize:"clamp(32px,5vw,56px)", fontWeight:800, lineHeight:1.1, letterSpacing:"-0.02em", marginBottom:16 }}>
          Build More with <span style={{ background:C.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Krypton AI</span>
        </h1>
        <p style={{ color:C.sub, fontSize:17, maxWidth:480, margin:"0 auto" }}>Tips, tutorials and product updates to help you build faster.</p>
      </div>

      {/* Tag Filter */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px 32px", display:"flex", gap:8, flexWrap:"wrap" }}>
        {TAGS.map(tag=>(
          <button key={tag} className="tag-btn" onClick={()=>setActiveTag(tag)} style={{
            padding:"7px 18px", borderRadius:20, border:`1px solid ${activeTag===tag?"rgba(245,197,66,.4)":C.border}`,
            background:activeTag===tag?"rgba(245,197,66,.1)":"transparent",
            color:activeTag===tag?"#F5C542":C.muted, fontSize:13, fontWeight:activeTag===tag?600:400,
            cursor:"pointer", transition:"all .15s",
          }}>{tag}</button>
        ))}
        <span style={{ marginLeft:"auto", fontSize:13, color:C.muted, alignSelf:"center" }}>{filtered.length} posts</span>
      </div>

      {/* Posts Grid */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px 80px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:C.muted }}>No posts found for "{search}"</div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:20 }}>
          {filtered.map(post=>(
            <div key={post.id} className="post-card" style={{
              background:C.card, border:`1px solid ${C.border}`, borderRadius:20,
              overflow:"hidden", cursor:"pointer", transition:"all .25s",
            }}>
              {/* Card top */}
              <div style={{ height:140, background:`linear-gradient(135deg,rgba(245,197,66,.1),rgba(0,208,132,.05))`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:52, position:"relative" }}>
                {post.emoji}
                <div style={{ position:"absolute", top:14, left:14, padding:"4px 10px", background:"rgba(245,197,66,.12)", border:`1px solid rgba(245,197,66,.25)`, borderRadius:12, fontSize:11, fontWeight:700, color:"#F5C542" }}>{post.tag}</div>
              </div>
              {/* Card body */}
              <div style={{ padding:"20px 22px" }}>
                <h2 style={{ fontFamily:"'Baloo 2',sans-serif", fontSize:17, fontWeight:700, lineHeight:1.35, marginBottom:10, color:C.text }}>{post.title}</h2>
                <p style={{ color:C.sub, fontSize:13, lineHeight:1.7, marginBottom:16 }}>{post.desc}</p>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:24, height:24, borderRadius:"50%", background:C.grad, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#050505" }}>K</div>
                    <span style={{ fontSize:12, color:C.muted }}>{post.author}</span>
                  </div>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:C.muted }}>{post.date}</span>
                    <span style={{ fontSize:11, color:"#F5C542", background:"rgba(245,197,66,.08)", padding:"2px 8px", borderRadius:8 }}>{post.readTime}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ borderTop:`1px solid ${C.border}`, padding:"60px 24px", textAlign:"center", background:"rgba(255,255,255,.015)" }}>
        <h2 style={{ fontFamily:"'Baloo 2',sans-serif", fontSize:"clamp(24px,4vw,40px)", fontWeight:800, marginBottom:12 }}>
          Ready to <span style={{ background:C.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>start building?</span>
        </h2>
        <p style={{ color:C.sub, fontSize:15, marginBottom:28 }}>5 free generations every day. No credit card required.</p>
        <button onClick={()=>router.push("/auth/signup")} style={{
          padding:"13px 36px", background:C.grad, border:"none", borderRadius:12,
          color:"#050505", fontWeight:700, fontSize:15, cursor:"pointer",
        }}>Start Building Free →</button>
      </div>
    </div>
  );
}

      
