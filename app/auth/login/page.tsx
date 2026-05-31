"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{width:"100%",maxWidth:"400px"}}>
        
        <div style={{textAlign:"center",marginBottom:"32px"}}>
          <div style={{fontSize:"40px",marginBottom:"12px"}}>⚡</div>
          <h1 style={{fontSize:"28px",fontWeight:"bold",color:"#fff",marginBottom:"8px"}}>Welcome Back</h1>
          <p style={{color:"#999"}}>Sign in to Krypton AI</p>
        </div>

        <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"12px",padding:"32px"}}>
          
          {error && (
            <div style={{background:"rgba(255,0,0,0.1)",border:"1px solid rgba(255,0,0,0.3)",borderRadius:"8px",padding:"12px",marginBottom:"16px",color:"#ff6b6b",fontSize:"14px"}}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{marginBottom:"16px"}}>
              <label style={{display:"block",color:"#fff",marginBottom:"8px",fontSize:"14px"}}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{width:"100%",padding:"12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",color:"#fff",fontSize:"14px",outline:"none",boxSizing:"border-box"}}
              />
            </div>

            <div style={{marginBottom:"24px"}}>
              <label style={{display:"block",color:"#fff",marginBottom:"8px",fontSize:"14px"}}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{width:"100%",padding:"12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",color:"#fff",fontSize:"14px",outline:"none",boxSizing:"border-box"}}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{width:"100%",padding:"14px",background:"#7c3aed",color:"white",borderRadius:"8px",fontWeight:"600",border:"none",cursor:"pointer",fontSize:"16px"}}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p style={{textAlign:"center",marginTop:"24px",color:"#999"}}>
          Don't have an account?{" "}
          <Link href="/auth/signup" style={{color:"#7c3aed",fontWeight:"600"}}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
