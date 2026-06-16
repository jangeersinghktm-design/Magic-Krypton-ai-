"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DiffViewer from "../components/DiffViewer";
import AuditLog, { type AuditEntry } from "../components/AuditLog";

const G = "linear-gradient(135deg, #F5D800 0%, #00CC44 100%)";
const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280", red: "#ef4444",
};

interface Patch {
  id: string;
  file_path: string;
  action: "create" | "modify" | "delete";
  diff_text: string | null;
  explanation: string | null;
  status: string;
}

interface Deployment {
  id: string;
  commit_sha: string;
  deployment_status: string;
  verification_report: string | null;
}

interface SessionDetail {
  session: { id: string; prompt: string; status: string; summary: string | null; error_message: string | null; created_at: string };
  analysis: { root_cause: string | null; affected_files: string[]; full_report: string | null; historical_context: string | null } | null;
  patches: Patch[];
  audit_log: AuditEntry[];
  deployments: Deployment[];
}

const STATUS_COLOR: Record<string, string> = {
  analyzing: T.gold, analysis_complete: T.muted, awaiting_approval: T.gold,
  patches_proposed: T.gold, approved: T.green, rejected: T.red,
  backing_up: T.gold, applying: T.gold, applied: T.green, deploying: T.gold,
  verifying: T.gold, completed: T.green, failed: T.red,
  rolling_back: T.gold, rolled_back: "#8b9bff",
};

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rollbackReason, setRollbackReason] = useState("");
  const [showRollbackInput, setShowRollbackInput] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }
      const res = await fetch(`/api/admin/ai-engineer/sessions/${params.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setDetail(json);
        setLoadError(null);
      } else {
        const err = await res.json().catch(() => ({}));
        setLoadError(`API error ${res.status}: ${err.error ?? "Unknown error"}`);
      }
    } catch (e: any) {
      setLoadError(`Failed to load: ${e.message}`);
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!detail) return;
    const live = new Set(["analyzing", "backing_up", "applying", "deploying", "verifying", "rolling_back"]);
    if (!live.has(detail.session.status)) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [detail, load]);

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
  }

  async function decidePatch(patchId: string, decision: "approved" | "rejected") {
    setBusy(true);
    await fetch(`/api/admin/ai-engineer/patches/${patchId}`, {
      method: "PATCH", headers: await authHeader(), body: JSON.stringify({ decision }),
    });
    await load();
    setBusy(false);
  }

  async function applyChanges() {
    setBusy(true);
    const res = await fetch("/api/admin/ai-engineer/apply", {
      method: "POST", headers: await authHeader(), body: JSON.stringify({ session_id: params.id }),
    });
    const json = await res.json();
    if (!res.ok) alert(json.error || "Apply failed");
    await load();
    setBusy(false);
  }

  async function pollDeployment(deploymentId: string) {
    setBusy(true);
    await fetch(`/api/admin/ai-engineer/deployments/${deploymentId}`, { headers: await authHeader() });
    await load();
    setBusy(false);
  }

  async function rollback() {
    if (!rollbackReason.trim()) { alert("Rollback reason required."); return; }
    setBusy(true);
    const res = await fetch("/api/admin/ai-engineer/rollback", {
      method: "POST", headers: await authHeader(), body: JSON.stringify({ session_id: params.id, reason: rollbackReason.trim() }),
    });
    const json = await res.json();
    if (!res.ok) alert(json.error || "Rollback failed");
    setShowRollbackInput(false);
    setRollbackReason("");
    await load();
    setBusy(false);
  }

  // ── Loading / Error states ─────────────────────────────────────────
  if (loadError) {
    return (
      <div style={{ padding: 32, color: T.text }}>
        <button onClick={() => router.push("/admin/ai-engineer")} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", marginBottom: 16, fontSize: 13 }}>
          ← Back
        </button>
        <div style={{ border: `1px solid ${T.red}`, color: T.red, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          ⚠ {loadError}
        </div>
        <button onClick={load} style={{ background: G, color: "#000", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, cursor: "pointer" }}>
          Retry
        </button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ padding: 32, color: T.muted, display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => router.push("/admin/ai-engineer")} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 13, textAlign: "left" }}>
          ← Back
        </button>
        <div>Loading session...</div>
        <button onClick={load} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, width: "fit-content" }}>
          Force reload
        </button>
      </div>
    );
  }

  const { session, analysis, patches, audit_log, deployments } = detail;
  const approvedPatches = patches.filter((p) => p.status === "approved");
  const appliedPatches = patches.filter((p) => p.status === "applied");
  const latestDeployment = deployments[0];
  const allDecided = patches.length > 0 && patches.every((p) => p.status !== "proposed");

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 32 }}>
      <button onClick={() => router.push("/admin/ai-engineer")} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", marginBottom: 16, fontSize: 13 }}>
        ← Back to AI Engineer
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, maxWidth: 700 }}>{session.prompt}</h1>
        <span style={{ color: STATUS_COLOR[session.status] ?? T.muted, border: `1px solid ${STATUS_COLOR[session.status] ?? T.border}`, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 16 }}>
          {session.status.replace(/_/g, " ")}
        </span>
      </div>
      <div style={{ color: T.muted, fontSize: 12, marginBottom: 24 }}>
        {session.created_at ? new Date(session.created_at).toLocaleString() : "—"}
      </div>

      {session.error_message && (
        <div style={{ border: `1px solid ${T.red}`, color: T.red, borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 13 }}>
          ⚠ {session.error_message}
        </div>
      )}

      {analysis?.historical_context && (
        <details style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <summary style={{ cursor: "pointer", color: T.gold, fontWeight: 700, fontSize: 14 }}>Historical Context</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, color: "#9CA3AF", marginTop: 10, fontFamily: "inherit" }}>{analysis.historical_context}</pre>
        </details>
      )}

      {analysis?.full_report && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px", color: T.gold }}>Analysis Report</h2>
          {analysis.root_cause && (
            <div style={{ marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>Root cause: </strong>
              <span style={{ fontSize: 13, color: "#D1D5DB" }}>{analysis.root_cause}</span>
            </div>
          )}
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#D1D5DB", margin: 0, fontFamily: "inherit", lineHeight: 1.6 }}>{analysis.full_report}</pre>
          {analysis.affected_files.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: T.muted }}>
              Affected files: {analysis.affected_files.join(", ")}
            </div>
          )}
        </div>
      )}

      {patches.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Proposed Patches ({patches.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {patches.map((p) => (
              <div key={p.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{p.file_path}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 4, padding: "1px 6px" }}>{p.action}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[p.status] ?? T.muted }}>{p.status}</span>
                </div>
                {p.explanation && <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 10 }}>{p.explanation}</div>}
                <DiffViewer diffText={p.diff_text ?? ""} />
                {p.status === "proposed" && (
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <button disabled={busy} onClick={() => decidePatch(p.id, "approved")} style={{ background: T.green, color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                      Approve
                    </button>
                    <button disabled={busy} onClick={() => decidePatch(p.id, "rejected")} style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}`, borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {allDecided && approvedPatches.length > 0 && session.status === "approved" && (
            <button disabled={busy} onClick={applyChanges} style={{ marginTop: 14, background: G, color: "#000", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>
              Deploy Changes ({approvedPatches.length} file{approvedPatches.length === 1 ? "" : "s"})
            </button>
          )}
          {allDecided && approvedPatches.length === 0 && session.status === "rejected" && (
            <div style={{ marginTop: 14, color: T.muted, fontSize: 13 }}>All patches rejected — no changes deployed.</div>
          )}
        </div>
      )}

      {latestDeployment && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Deployment</h2>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            Commit: <code>{latestDeployment.commit_sha.slice(0, 10)}</code> — status:{" "}
            <span style={{ color: STATUS_COLOR[latestDeployment.deployment_status] ?? T.muted, fontWeight: 700 }}>
              {latestDeployment.deployment_status}
            </span>
          </div>
          {latestDeployment.verification_report && <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>{latestDeployment.verification_report}</div>}
          {(latestDeployment.deployment_status === "pending" || latestDeployment.deployment_status === "building") && (
            <button disabled={busy} onClick={() => pollDeployment(latestDeployment.id)} style={{ background: "transparent", border: `1px solid ${T.gold}`, color: T.gold, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Check deployment status
            </button>
          )}
        </div>
      )}

      {(appliedPatches.length > 0 || session.status === "completed" || session.status === "failed") && session.status !== "rolled_back" && (
        <div style={{ background: T.card, border: `1px solid ${T.red}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px", color: T.red }}>Rollback</h2>
          {!showRollbackInput ? (
            <button disabled={busy} onClick={() => setShowRollbackInput(true)} style={{ background: "transparent", border: `1px solid ${T.red}`, color: T.red, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Roll back this change
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea value={rollbackReason} onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="Reason for rollback (required)" rows={2}
                style={{ background: "#0a0a0a", border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, color: T.text, fontSize: 13, fontFamily: "inherit" }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button disabled={busy} onClick={rollback} style={{ background: T.red, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  Confirm Rollback
                </button>
                <button disabled={busy} onClick={() => setShowRollbackInput(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Audit Log</h2>
        <AuditLog entries={audit_log} />
      </div>
    </div>
  );
                                                                   }
