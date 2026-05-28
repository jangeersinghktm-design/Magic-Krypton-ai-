"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div style={{minHeight:"100vh",background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <p style={{color:"#999"}}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:"#000",color:"#fff",padding:"40px 20px"}}>
      
      {/* Header */}
      <div style={{maxWidth:"1000px",margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"40px"}}>
          <div>
            <h1 style={{fontSize:"32px",fontWeight:"bold",marginBottom:"8px"}}>⚡ Dashboard</h1>
            <p style={{color:"#999"}}>Welcome, {user?.email}</p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/");
            }}
            style={{padding:"10px 20px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",color:"#fff",cursor:"pointer"}}
          >
            Logout
          </button>
        </div>

        {/* Create Button */}
        <Link
          href="/create"
          style={{display:"inline-block",padding:"14px 28px",background:"#7c3aed",color:"white",borderRadius:"8px",fontWeight:"600",textDecoration:"none",fontSize:"16px",marginBottom:"40px"}}
        >
          + Create New Project
        </Link>

        {/* Features Grid */}
        <h2 style={{fontSize:"20px",fontWeight:"bold",marginBottom:"20px"}}>What do you want to create?</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",gap:"16px"}}>
          {[
            {emoji:"🌐", title:"Website Builder", desc:"Create full websites"},
            {emoji:"🎮", title:"Game Builder", desc:"Build browser games"},
            {emoji:"🖼️", title:"AI Images", desc:"Generate images"},
            {emoji:"🎬", title:"AI Videos", desc:"Create videos"},
            {emoji:"📊", title:"Analysis", desc:"Analyze websites"},
            {emoji:"📋", title:"Business Plan", desc:"AI business plans"},
          ].map((item, i) => (
            <div key={i} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"12px",padding:"20px",cursor:"pointer",transition:"all 0.2s"}}>
              <div style={{fontSize:"32px",marginBottom:"12px"}}>{item.emoji}</div>
              <h3 style={{fontWeight:"600",marginBottom:"4px"}}>{item.title}</h3>
              <p style={{color:"#999",fontSize:"13px"}}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
