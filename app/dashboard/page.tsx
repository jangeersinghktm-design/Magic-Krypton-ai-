"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  title: string;
  prompt: string;
  created_at: string;
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/auth/login");
      else fetchProjects();
    };
    checkAuth();
  }, []);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, title, prompt, created_at")
      .order("created_at", { ascending: false });
    setProjects(data || []);
    setLoading(false);
  };

  const deleteProject = async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#06060A",
      color: "#fff",
      fontFamily: "'DM Sans', sans-serif",
      padding: "2rem 1.5rem",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "2rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            background: "#FFC107",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L3 7v6l7 5 7-5V7L10 2z" fill="#06060A" />
              <path d="M10 6l-4 3v2l4 3 4-3V9L10 6z" fill="#FFC107" opacity="0.7" />
            </svg>
          </div>
          <span style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: "16px",
          }}>
            KRYPTON <span style={{ color: "#FFC107" }}>AI</span>
          </span>
        </div>

        <button
          onClick={() => router.push("/create")}
          style={{
            padding: "10px 20px",
            background: "#FFC107",
            border: "none",
            borderRadius: "10px",
            fontWeight: 700,
            color: "#06060A",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          + New Project
        </button>
      </div>

      <h2 style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: "22px",
        fontWeight: 700,
        marginBottom: "1.5rem",
      }}>
        My Projects
      </h2>

      {loading && (
        <p style={{ color: "#555" }}>Loading...</p>
      )}

      {!loading && projects.length === 0 && (
        <div style={{
          background: "#0D0D12",
          border: "1px solid #1e1e2a",
          borderRadius: "16px",
          padding: "3rem",
          textAlign: "center",
        }}>
          <p style={{ color: "#444", fontSize: "15px", marginBottom: "1rem" }}>
            No projects yet!
          </p>
          <button
            onClick={() => router.push("/create")}
            style={{
              padding: "10px 24px",
              background: "#FFC107",
              borderRadius: "10px",
              color: "#06060A",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Create First Project →
          </button>
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: "16px",
      }}>
        {projects.map((project) => (
          <div
            key={project.id}
            style={{
              background: "#0D0D12",
              border: "1px solid #1e1e2a",
              borderRadius: "16px",
              padding: "1.5rem",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#FFC107")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e2a")}
          >
            <h3 style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "15px",
              fontWeight: 700,
              color: "#fff",
              marginBottom: "8px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {project.title}
            </h3>

            <p style={{
              fontSize: "13px",
              color: "#555",
              marginBottom: "1rem",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}>
              {project.prompt || "No prompt"}
            </p>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span style={{ fontSize: "11px", color: "#444" }}>
                {timeAgo(project.created_at)}
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => router.push("/create")}
                  style={{
                    padding: "6px 14px",
                    background: "rgba(255,193,7,0.1)",
                    border: "1px solid rgba(255,193,7,0.2)",
                    borderRadius: "8px",
                    color: "#FFC107",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Open
                </button>
                <button
                  onClick={() => deleteProject(project.id)}
                  style={{
                    padding: "6px 10px",
                    background: "rgba(255,77,77,0.08)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#ff4d4d",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
                }
