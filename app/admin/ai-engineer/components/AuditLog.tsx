"use client";

const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280", red: "#ef4444",
};

export interface AuditEntry {
  id: string;
  actor: "ai" | "admin" | "system";
  action_type: string;
  action_detail: Record<string, unknown>;
  created_at: string;
}

const ACTOR_COLOR: Record<string, string> = {
  ai: T.gold,
  admin: T.green,
  system: "#8b9bff",
};

function summarize(entry: AuditEntry): string {
  const d = entry.action_detail || {};
  switch (entry.action_type) {
    case "session_created": return `Investigation started: "${String(d.prompt ?? "").slice(0, 80)}"`;
    case "historical_context_built": return `Historical context built (${d.patternMatches ?? 0} pattern match${d.patternMatches === 1 ? "" : "es"})`;
    case "patch:approved": return `Approved patch for ${d.file_path}`;
    case "patch:rejected": return `Rejected patch for ${d.file_path}`;
    case "backup_created": return `Backed up ${d.patch_count} file(s) before apply`;
    case "apply": return `Applied ${d.patch_count} patch(es) — commit ${String(d.commit_sha ?? "").slice(0, 7)}`;
    case "rollback": return `Rolled back ${d.files?.toString().length ? (d.files as string[]).length : ""} file(s) — commit ${String(d.commit_sha ?? "").slice(0, 7)}. Reason: ${d.reason}`;
    case "deployment_verified": return `Deployment verified READY — commit ${String(d.commit_sha ?? "").slice(0, 7)}`;
    case "deployment_failed": return `Deployment FAILED — commit ${String(d.commit_sha ?? "").slice(0, 7)} (${d.status})`;
    case "memory_feedback": return `Feedback on "${d.memory_title}": ${d.feedback} (score -> ${d.new_score})`;
    default:
      if (entry.action_type.startsWith("tool:")) return `Tool call: ${entry.action_type.slice(5)}`;
      return entry.action_type;
  }
}

export default function AuditLog({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <div style={{ color: T.muted, fontSize: 13 }}>No audit entries yet.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map((e) => (
        <div key={e.id} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "flex-start" }}>
          <span
            style={{
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 700,
              color: ACTOR_COLOR[e.actor] ?? T.muted,
              border: `1px solid ${ACTOR_COLOR[e.actor] ?? T.border}`,
              borderRadius: 4,
              padding: "1px 6px",
              textTransform: "uppercase",
              minWidth: 52,
              textAlign: "center",
            }}
          >
            {e.actor}
          </span>
          <span style={{ color: T.text }}>{summarize(e)}</span>
          <span style={{ color: T.muted, fontSize: 11, marginLeft: "auto", flexShrink: 0 }}>
            {new Date(e.created_at).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

