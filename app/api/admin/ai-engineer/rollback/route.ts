// app/api/admin/ai-engineer/rollback/route.ts
// POST: rolls back all 'applied' patches for a session by re-committing
// their pre-patch content (from ai_engineer_backups). For action='create'
// patches (no prior content), the file is deleted instead.

import { NextRequest } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/admin-ai/supabase-admin";
import { commitFiles, type CommitFileChange } from "@/lib/admin-ai/github";
import { writeSessionMemory } from "@/lib/admin-ai/memory";

export const runtime = "edge";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { session_id, reason } = await req.json();
  if (!session_id) return Response.json({ error: "session_id is required" }, { status: 400 });
  if (!reason || !reason.trim()) return Response.json({ error: "reason is required for rollback" }, { status: 400 });

  const { data: patches, error: patchErr } = await supabaseAdmin
    .from("ai_engineer_patches")
    .select("*, ai_engineer_backups(*)")
    .eq("session_id", session_id)
    .eq("status", "applied");

  if (patchErr) return Response.json({ error: patchErr.message }, { status: 500 });
  if (!patches || patches.length === 0) {
    return Response.json({ error: "No applied patches to roll back for this session" }, { status: 400 });
  }

  await supabaseAdmin.from("ai_engineer_sessions").update({ status: "rolling_back", updated_at: new Date().toISOString() }).eq("id", session_id);

  const changes: CommitFileChange[] = [];
  for (const patch of patches) {
    const backups: any[] = (patch as any).ai_engineer_backups ?? [];
    const backup = backups[0];
    if (!backup) {
      return Response.json({ error: `No backup found for ${patch.file_path} — cannot roll back safely` }, { status: 500 });
    }

    if (!backup.existed_before) {
      // File was newly created by this patch — revert = delete it.
      changes.push({ path: patch.file_path, action: "delete" });
    } else {
      changes.push({ path: patch.file_path, action: "modify", content: backup.content_before ?? "" });
    }
  }

  const commitMessage = `AI Engineer rollback: session ${session_id}\n\nReason: ${reason.trim()}`;

  let commitSha: string;
  try {
    commitSha = await commitFiles(changes, commitMessage);
  } catch (e: any) {
    await supabaseAdmin.from("ai_engineer_sessions").update({ status: "failed", error_message: `Rollback failed: ${e.message}` }).eq("id", session_id);
    return Response.json({ error: `GitHub rollback commit failed: ${e.message}` }, { status: 500 });
  }

  await supabaseAdmin
    .from("ai_engineer_patches")
    .update({ status: "rolled_back" })
    .eq("session_id", session_id)
    .eq("status", "applied");

  await supabaseAdmin
    .from("ai_engineer_sessions")
    .update({ status: "rolled_back", updated_at: new Date().toISOString() })
    .eq("id", session_id);

  const { data: analysis } = await supabaseAdmin
    .from("ai_engineer_analysis")
    .select("affected_files")
    .eq("session_id", session_id)
    .maybeSingle();

  await writeSessionMemory(session_id, "rolled_back", {
    fixSummary: patches.map((p) => p.explanation).filter(Boolean).join(" | "),
    affectedFiles: analysis?.affected_files ?? [],
    patchIds: patches.map((p) => p.id),
    commitSha,
    rollbackReason: reason.trim(),
  });

  await supabaseAdmin.from("ai_engineer_audit_log").insert({
    session_id,
    actor: "admin",
    actor_id: auth.userId,
    action_type: "rollback",
    action_detail: { commit_sha: commitSha, reason: reason.trim(), files: patches.map((p) => p.file_path) },
  });

  return Response.json({ ok: true, commit_sha: commitSha, files_reverted: patches.length });
}

