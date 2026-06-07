"use client";

// app/team/page.tsx
import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280", red: "#ef4444",
};

type Role = "admin" | "editor" | "viewer";
type Member = { id: string; user_id: string; role: Role; invited_email: string; status: string; created_at: string };
type Team = { id: string; name: string; owner_id: string; plan: string; created_at: string };
type Log = { id: string; user_id: string; action: string; details: any; created_at: string };
type TeamProject = { id: string; project_id: string; added_by: string; created_at: string; projects?: { title: string; html_code: string; prompt: string } };

const ROLE_COLORS: Record<Role, string> = { admin: "#F5D800", editor: "#00CC44", viewer: "#6B7280" };
const ROLE_ICONS:  Record<Role, string> = { admin: "👑", editor: "✏️", viewer: "👁" };

function TeamContent() {
  const router   = useRouter();
  const supabase = createClient();

  const [team, setTeam]               = useState<Team | null>(null);
  const [members, setMembers]         = useState<Member[]>([]);
  const [logs, setLogs]               = useState<Log[]>([]);
  const [teamProjects, setTeamProjects] = useState<TeamProject[]>([]);
  const [myProjects, setMyProjects]   = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [userId, setUserId]           = useState<string | null>(null);
  const [userRole, setUserRole]       = useState<Role | "owner">("viewer");
  const [activeTab, setActiveTab]     = useState<"members"|"projects"|"activity"|"settings">("members");

  // Create team
  const [teamName, setTeamName]     = useState("");
  const [creating, setCreating]     = useState(false);

  // Invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState<Role>("editor");
  const [inviting, setInviting]       = useState(false);
  const [inviteMsg, setInviteMsg]     = useState("");

  // Add project
  const [addingProject, setAddingProject]   = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth/login"); return; }
    setUserId(session.user.id);

    // Check owned team
    const { data: ownedTeam } = await supabase
      .from("teams").select("*").eq("owner_id", session.user.id).single();

    if (ownedTeam) {
      setTeam(ownedTeam);
      setUserRole("owner");
      await loadTeamData(ownedTeam.id, session.user.id);
    } else {
      // Check membership
      const { data: membership } = await supabase
        .from("team_members").select("team_id, role")
        .eq("user_id", session.user.id).eq("status", "accepted").single();

      if (membership) {
        const { data: memberTeam } = await supabase
          .from("teams").select("*").eq("id", membership.team_id).single();
        if (memberTeam) {
          setTeam(memberTeam);
          setUserRole(membership.role as Role);
          await loadTeamData(memberTeam.id, session.user.id);
        }
      }
    }

    // Load my projects for sharing
    const { data: projs } = await supabase
      .from("projects").select("id, title, html_code, prompt")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false });
    setMyProjects(projs || []);

    setLoading(false);
  };

  const loadTeamData = async (teamId: string, uid: string) => {
    const [{ data: m }, { data: l }, { data: tp }] = await Promise.all([
      supabase.from("team_members").select("*").eq("team_id", teamId).order("created_at"),
      supabase.from("activity_logs").select("*").eq("team_id", teamId).order("created_at", { ascending: false }).limit(20),
      supabase.from("team_projects").select("*, projects(title, html_code, prompt)").eq("team_id", teamId).order("created_at", { ascending: false }),
    ]);
    setMembers(m || []);
    setLogs(l || []);
    setTeamProjects(tp || []);
  };

  const createTeam = async () => {
    if (!teamName.trim() || !userId) return;
    setCreating(true);
    const { data } = await supabase.from("teams").insert({
      name: teamName.trim(), owner_id: userId, plan: "free",
    }).select().single();

    if (data) {
      setTeam(data);
      setUserRole("owner");
      await supabase.from("activity_logs").insert({
        team_id: data.id, user_id: userId, action: "Team created", details: { name: data.name },
      });
      setTeamName("");
    }
    setCreating(false);
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !team) return;
    setInviting(true); setInviteMsg("");

    const { error } = await supabase.from("team_members").insert({
      team_id: team.id, invited_email: inviteEmail.trim().toLowerCase(),
      role: inviteRole, status: "pending",
    });

    if (!error) {
      await supabase.from("activity_logs").insert({
        team_id: team.id, user_id: userId,
        action: `Invited ${inviteEmail}`, details: { email: inviteEmail, role: inviteRole },
      });
      setInviteMsg("✅ Invitation sent!");
      setInviteEmail("");
      await loadTeamData(team.id, userId!);
    } else {
      setInviteMsg("❌ " + error.message);
    }
    setInviting(false);
    setTimeout(() => setInviteMsg(""), 3000);
  };

  const updateRole = async (memberId: string, newRole: Role) => {
    await supabase.from("team_members").update({ role: newRole }).eq("id", memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    await supabase.from("activity_logs").insert({
      team_id: team?.id, user_id: userId,
      action: `Role updated to ${newRole}`, details: { memberId },
    });
  };

  const removeMember = async (memberId: string, email: string) => {
    if (!confirm(`Remove ${email}?`)) return;
    await supabase.from("team_members").delete().eq("id", memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
    await supabase.from("activity_logs").insert({
      team_id: team?.id, user_id: userId, action: `Removed ${email}`, details: { email },
    });
  };

  const addProjectToTeam = async (projectId: string) => {
    if (!team) return;
    setAddingProject(true);

    const { data, error } = await supabase.from("team_projects").insert({
      team_id: team.id, project_id: projectId, added_by: userId,
    }).select("*, projects(title, html_code, prompt)").single();

    if (data) {
      setTeamProjects(prev => [data, ...prev]);
      await supabase.from("activity_logs").insert({
        team_id: team.id, user_id: userId,
        action: "Project shared to team", details: { projectId },
      });
      setShowAddProject(false);
    } else if (error?.code === "23505") {
      alert("Project already shared!");
    }
    setAddingProject(false);
  };

  const removeProjectFromTeam = async (teamProjectId: string) => {
    if (!confirm("Remove from team?")) return;
    await supabase.from("team_projects").delete().eq("id", teamProjectId);
    setTeamProjects(prev => prev.filter(p => p.id !== teamProjectId));
    await supabase.from("activity_logs").insert({
      team_id: team?.id, user_id: userId, action: "Project removed from team", details: {},
    });
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const isOwner  = userRole === "owner";
  const canEdit  = userRole === "owner" || userRole === "admin" || userRole === "editor";

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, color: T.gold }}>Loading...</div>
  );

  // No team — create
  if (!team) return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>👥</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 10 }}>Create Your Team</h1>
        <p style={{ color: T.muted, fontSize: 14, marginBottom: 28, lineHeight: 1.7 }}>Collaborate with your team. Invite members, share projects, assign roles!</p>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "28px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[{ icon: "👑", label: "Admin", desc: "Full access" }, { icon: "✏️", label: "Editor", desc: "Create & edit" }, { icon: "👁", label: "Viewer", desc: "View only" }, { icon: "📁", label: "Shared Projects", desc: "Collaborate" }].map(f => (
              <div key={f.label} style={{ background: "#161616", border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px" }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{f.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{f.desc}</div>
              </div>
            ))}
          </div>
          <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Team name (e.g. Acme Corp)"
            onKeyDown={e => e.key === "Enter" && createTeam()}
            style={{ width: "100%", background: "#161616", border: `1px solid ${T.border}`, borderRadius: 9, color: T.text, padding: "12px 14px", fontSize: 14, outline: "none", marginBottom: 14, boxSizing: "border-box" as const, fontFamily: "'DM Sans', sans-serif" }} />
          <button onClick={createTeam} disabled={!teamName.trim() || creating} style={{ width: "100%", padding: "13px", background: teamName.trim() ? G : "#1a1a1a", border: "none", borderRadius: 10, color: teamName.trim() ? "#000" : "#444", fontWeight: 700, fontSize: 15, cursor: teamName.trim() ? "pointer" : "not-allowed" }}>
            {creating ? "Creating..." : "Create Team →"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, background: "rgba(8,8,8,0.9)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>👥</span>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{team.name}</h1>
            <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>{members.length + 1} members · {teamProjects.length} projects · {team.plan} plan</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/dashboard")} style={{ padding: "7px 14px", background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, fontSize: 12, cursor: "pointer" }}>← Dashboard</button>
          {isOwner && <button onClick={() => router.push("/settings?tab=billing")} style={{ padding: "7px 14px", background: G, border: "none", borderRadius: 8, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>⚡ Upgrade</button>}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4, width: "fit-content", flexWrap: "wrap" }}>
          {(["members","projects","activity","settings"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "7px 16px", borderRadius: 7, border: "none",
              background: activeTab === tab ? "rgba(245,197,66,0.15)" : "none",
              color: activeTab === tab ? T.gold : T.muted,
              fontSize: 13, fontWeight: activeTab === tab ? 700 : 400, cursor: "pointer",
            }}>
              {tab === "members" ? "👥 Members" : tab === "projects" ? "📁 Projects" : tab === "activity" ? "📋 Activity" : "⚙️ Settings"}
            </button>
          ))}
        </div>

        {/* ── MEMBERS ── */}
        {activeTab === "members" && (
          <div>
            {(isOwner || userRole === "admin") && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 16 }}>
                <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Invite Member</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com"
                    style={{ flex: 1, minWidth: 200, background: "#161616", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "10px 12px", fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)}
                    style={{ padding: "10px 12px", background: "#161616", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: "none", cursor: "pointer" }}>
                    <option value="admin">👑 Admin</option>
                    <option value="editor">✏️ Editor</option>
                    <option value="viewer">👁 Viewer</option>
                  </select>
                  <button onClick={inviteMember} disabled={inviting || !inviteEmail.trim()} style={{ padding: "10px 18px", background: inviteEmail.trim() ? G : "#1a1a1a", border: "none", borderRadius: 8, color: inviteEmail.trim() ? "#000" : "#444", fontSize: 13, fontWeight: 700, cursor: inviteEmail.trim() ? "pointer" : "not-allowed" }}>
                    {inviting ? "Sending..." : "Invite →"}
                  </button>
                </div>
                {inviteMsg && <p style={{ fontSize: 12, marginTop: 8, color: inviteMsg.startsWith("✅") ? T.green : T.red }}>{inviteMsg}</p>}
              </div>
            )}

            {/* Owner */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 20px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#000" }}>
                  {team.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Team Owner {isOwner && "(You)"}</p>
                  <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0" }}>Full access</p>
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", background: "rgba(245,216,0,0.1)", color: T.gold, borderRadius: 20, border: "1px solid rgba(245,216,0,0.2)" }}>👑 Owner</span>
            </div>

            {members.map(member => (
              <div key={member.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 20px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1a1a", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    {ROLE_ICONS[member.role]}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{member.invited_email}</p>
                    <p style={{ fontSize: 11, color: member.status === "pending" ? "#888" : T.green, margin: "2px 0 0" }}>
                      {member.status === "pending" ? "⏳ Pending" : "✅ Active"} · {timeAgo(member.created_at)}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {isOwner ? (
                    <>
                      <select value={member.role} onChange={e => updateRole(member.id, e.target.value as Role)}
                        style={{ padding: "5px 10px", background: "#1a1a1a", border: `1px solid ${T.border}`, borderRadius: 7, color: ROLE_COLORS[member.role], fontSize: 12, outline: "none", cursor: "pointer" }}>
                        <option value="admin">👑 Admin</option>
                        <option value="editor">✏️ Editor</option>
                        <option value="viewer">👁 Viewer</option>
                      </select>
                      <button onClick={() => removeMember(member.id, member.invited_email)} style={{ padding: "5px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, color: T.red, fontSize: 12, cursor: "pointer" }}>Remove</button>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(107,114,128,0.1)", color: ROLE_COLORS[member.role] }}>
                      {ROLE_ICONS[member.role]} {member.role}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {members.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 24px", color: "#444" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                <p style={{ fontSize: 14 }}>No members yet. Invite your team!</p>
              </div>
            )}
          </div>
        )}

        {/* ── SHARED PROJECTS ── */}
        {activeTab === "projects" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📁 Shared Projects ({teamProjects.length})</p>
              {canEdit && (
                <button onClick={() => setShowAddProject(!showAddProject)} style={{ padding: "8px 16px", background: G, border: "none", borderRadius: 8, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  + Add Project
                </button>
              )}
            </div>

            {/* Add project modal */}
            {showAddProject && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Select Project to Share</p>
                {myProjects.length === 0 ? (
                  <p style={{ color: "#444", fontSize: 13 }}>No projects yet. <button onClick={() => router.push("/create")} style={{ background: "none", border: "none", color: T.gold, cursor: "pointer", fontSize: 13 }}>Create one →</button></p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto", scrollbarWidth: "none" }}>
                    {myProjects.map(p => {
                      const alreadyShared = teamProjects.some(tp => tp.project_id === p.id);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#161616", borderRadius: 9, border: `1px solid ${T.border}` }}>
                          <span style={{ fontSize: 13, color: alreadyShared ? T.muted : T.text }}>{p.title || "Untitled"}</span>
                          {alreadyShared ? (
                            <span style={{ fontSize: 11, color: T.green }}>✅ Shared</span>
                          ) : (
                            <button onClick={() => addProjectToTeam(p.id)} disabled={addingProject}
                              style={{ padding: "5px 12px", background: G, border: "none", borderRadius: 7, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                              Share
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Projects list */}
            {teamProjects.length === 0 ? (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
                <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No shared projects yet</p>
                <p style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Share your projects with the team to collaborate!</p>
                {canEdit && (
                  <button onClick={() => setShowAddProject(true)} style={{ padding: "10px 24px", background: G, border: "none", borderRadius: 9, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    + Add First Project
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                {teamProjects.map(tp => (
                  <div key={tp.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                    {/* Preview */}
                    <div style={{ height: 130, background: "#111", overflow: "hidden", cursor: "pointer", position: "relative" }}
                      onClick={() => router.push(`/create?id=${tp.project_id}`)}>
                      {tp.projects?.html_code ? (
                        <iframe srcDoc={tp.projects.html_code} style={{ width: "200%", height: "200%", transform: "scale(0.5)", transformOrigin: "top left", border: "none", pointerEvents: "none" }} sandbox="allow-scripts" />
                      ) : (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: "#333" }}>📄</div>
                      )}
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {tp.projects?.title || "Untitled"}
                      </h3>
                      <p style={{ fontSize: 11, color: T.muted, marginBottom: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                        {tp.projects?.prompt || "No description"}
                      </p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => router.push(`/create?id=${tp.project_id}`)} style={{ flex: 1, padding: "6px", background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.2)", borderRadius: 7, color: T.gold, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => { const w = window.open("","_blank"); if(w && tp.projects?.html_code){w.document.write(tp.projects.html_code);w.document.close();} }}
                          style={{ flex: 1, padding: "6px", background: "rgba(0,204,68,0.08)", border: "1px solid rgba(0,204,68,0.15)", borderRadius: 7, color: T.green, fontSize: 11, cursor: "pointer" }}>
                          👁 Preview
                        </button>
                        {canEdit && (
                          <button onClick={() => removeProjectFromTeam(tp.id)} style={{ padding: "6px 8px", background: "rgba(239,68,68,0.08)", border: "none", borderRadius: 7, color: T.red, fontSize: 11, cursor: "pointer" }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {activeTab === "activity" && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📋 Activity Log</p>
            {logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#444" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <p style={{ fontSize: 13 }}>No activity yet</p>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={log.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: i < logs.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.gold, flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, margin: 0 }}>{log.action}</p>
                    <p style={{ fontSize: 10, color: "#444", margin: "2px 0 0" }}>{timeAgo(log.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {activeTab === "settings" && (
          <div>
            {isOwner ? (
              <>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 16 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Team Settings</p>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1 }}>TEAM NAME</label>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <input id="team-name-input" defaultValue={team.name}
                        style={{ flex: 1, background: "#161616", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "10px 12px", fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
                      <button onClick={async () => {
                        const input = document.getElementById("team-name-input") as HTMLInputElement;
                        if (input?.value) {
                          await supabase.from("teams").update({ name: input.value }).eq("id", team.id);
                          setTeam(t => t ? { ...t, name: input.value } : t);
                        }
                      }} style={{ padding: "10px 16px", background: G, border: "none", borderRadius: 8, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save</button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1 }}>CURRENT PLAN</label>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#161616", borderRadius: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" as const }}>{team.plan} Plan</span>
                      <button onClick={() => router.push("/settings?tab=billing")} style={{ padding: "5px 14px", background: G, border: "none", borderRadius: 7, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Upgrade →</button>
                    </div>
                  </div>
                </div>
                <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "20px 24px" }}>
                  <p style={{ color: T.red, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Danger Zone</p>
                  <p style={{ color: T.muted, fontSize: 13, marginBottom: 14 }}>Deleting team cannot be undone.</p>
                  <button onClick={async () => {
                    if (!confirm("Delete team permanently?")) return;
                    await supabase.from("teams").delete().eq("id", team.id);
                    setTeam(null); setMembers([]); setTeamProjects([]);
                  }} style={{ padding: "8px 18px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: T.red, fontSize: 13, cursor: "pointer" }}>
                    Delete Team
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "#444" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔒</div>
                <p style={{ fontSize: 14 }}>Only team owner can manage settings</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050505", color: "#F5D800" }}>Loading...</div>}>
      <TeamContent />
    </Suspense>
  );
}
            
