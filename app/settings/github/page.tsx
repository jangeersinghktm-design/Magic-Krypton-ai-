"use client";

// app/settings/github/page.tsx
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280",
};

function GitHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [githubToken, setGithubToken]       = useState<string | null>(null);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [projects, setProjects]             = useState<any[]>([]);
  const [repos, setRepos]                   = useState<any[]>([]);
  const [pushing, setPushing]               = useState<string | null>(null);
  const [pushResult, setPushResult]         = useState<any>(null);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth/login"); return; }

    // Check URL params from OAuth callback
    const token    = searchParams.get("github_token");
    const username = searchParams.get("github_username");
    const connected = searchParams.get("connected");

    if (token && username) {
      // Save to profile
      await supabase.from("profiles")
        .update({ github_token: token, github_username: username })
        .eq("id", session.user.id);
      setGithubToken(token);
      setGithubUsername(username);
    } else {
      // Load from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("github_token, github_username")
        .eq("id", session.user.id)
        .single();

      if (profile?.github_token) {
        setGithubToken(profile.github_token);
        setGithubUsername(profile.github_username);
      }
    }

    // Load projects
    const { data: projs } = await supabase
      .from("projects")
      .select("id, title, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    setProjects(projs || []);

    // Load pushed repos
    const { data: githubRepos } = await supabase
      .from("github_repos")
      .select("*")
      .eq("user_id", session.user.id)
      .order("last_push", { ascending: false });
    setRepos(githubRepos || []);

    setLoading(false);
  };

  const handleConnect = () => {
    window.location.href = "/api/auth/github";
  };

  const handleDisconnect = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("profiles")
      .update({ github_token: null, github_username: null })
      .eq("id", session.user.id);
    setGithubToken(null);
    setGithubUsername(null);
  };

  const handlePush = async (projectId: string) => {
    if (!githubToken) return;
    setPushing(projectId);
    setPushResult(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/github/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ projectId, githubToken }),
    });

    const data = await res.json();
    setPushResult(data);
    setPushing(null);

    if (data.success) {
      // Refresh repos
      const { data: githubRepos } = await supabase
        .from("github_repos")
        .select("*")
        .eq("user_id", session.user.id)
        .order("last_push", { ascending: false });
      setRepos(githubRepos || []);
    }
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, color: T.gold }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, background: "rgba(8,8,8,0.9)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/settings")} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>← Settings</button>
          <span style={{ color: "#333" }}>|</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            🐙 GitHub Integration
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 24px" }}>

        {/* Connection Status */}
        <div style={{ background: T.card, border: `1px solid ${githubToken ? "rgba(0,204,68,0.3)" : T.border}`, borderRadius: 14, padding: "24px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: githubToken ? "rgba(0,204,68,0.1)" : "#161616", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                🐙
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  {githubToken ? `Connected as @${githubUsername}` : "GitHub Not Connected"}
                </p>
                <p style={{ fontSize: 13, color: T.muted, margin: "4px 0 0" }}>
                  {githubToken ? "You can push projects to GitHub repos" : "Connect to push projects to GitHub"}
                </p>
              </div>
            </div>

            {githubToken ? (
              <button onClick={handleDisconnect} style={{ padding: "8px 18px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, color: "#ef4444", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Disconnect
              </button>
            ) : (
              <button onClick={handleConnect} style={{ padding: "8px 18px", background: G, border: "none", borderRadius: 9, color: "#000", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                Connect GitHub
              </button>
            )}
          </div>

          {githubToken && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(0,204,68,0.06)", border: "1px solid rgba(0,204,68,0.15)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: T.green }}>✅</span>
              <span style={{ fontSize: 13, color: T.green }}>GitHub connected! You can now push projects to repos.</span>
            </div>
          )}
        </div>

        {/* Push Result */}
        {pushResult && (
          <div style={{ background: pushResult.success ? "rgba(0,204,68,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${pushResult.success ? "rgba(0,204,68,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{pushResult.success ? "✅" : "❌"}</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: pushResult.success ? T.green : "#ef4444" }}>
                {pushResult.success ? "Pushed Successfully!" : "Push Failed"}
              </p>
              {pushResult.repoUrl && (
                <a href={pushResult.repoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: T.gold, textDecoration: "none" }}>
                  {pushResult.repoUrl} →
                </a>
              )}
              {pushResult.error && <p style={{ fontSize: 12, color: "#ef4444", margin: "2px 0 0" }}>{pushResult.error}</p>}
            </div>
          </div>
        )}

        {/* Projects List */}
        {githubToken && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Push Projects to GitHub</p>

            {projects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#444" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <p style={{ fontSize: 13 }}>No projects yet. Create one first!</p>
                <button onClick={() => router.push("/create")} style={{ marginTop: 12, padding: "8px 20px", background: G, border: "none", borderRadius: 8, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Create Project →
                </button>
              </div>
            ) : (
              projects.map(project => {
                const repo = repos.find(r => r.project_id === project.id);
                return (
                  <div key={project.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#161616", borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>📄</span>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{project.title || "Untitled"}</p>
                        {repo && (
                          <a href={repo.repo_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.gold, textDecoration: "none" }}>
                            🐙 {repo.repo_name} →
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handlePush(project.id)}
                      disabled={pushing === project.id}
                      style={{ padding: "6px 14px", background: pushing === project.id ? "#1a1a1a" : G, border: "none", borderRadius: 7, color: pushing === project.id ? T.muted : "#000", fontSize: 12, fontWeight: 700, cursor: pushing === project.id ? "not-allowed" : "pointer" }}>
                      {pushing === project.id ? "Pushing..." : repo ? "🔄 Update" : "🐙 Push"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Pushed Repos History */}
        {repos.length > 0 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📚 Pushed Repos</p>
            {repos.map(repo => (
              <div key={repo.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#161616", borderRadius: 10, marginBottom: 8 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{repo.repo_name}</p>
                  <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0" }}>
                    Last push: {new Date(repo.last_push).toLocaleString()}
                  </p>
                </div>
                <a href={repo.repo_url} target="_blank" rel="noreferrer" style={{ padding: "5px 12px", background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.2)", borderRadius: 7, color: T.gold, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  View →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GitHubPage() {
  return (
    <Suspense fallback={
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050505", color: "#F5D800" }}>
        Loading...
      </div>
    }>
      <GitHubContent />
    </Suspense>
  );
      }
                  
