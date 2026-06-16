// app/api/admin/ai-engineer/apply/route.ts
// POST: applies all 'approved' patches for a session.
//  1. Backs up current content of each file (ai_engineer_backups)
//  2. Commits all changes to GitHub in ONE commit (triggers Vercel deploy)
//  3. Marks patches 'applied' with the commit sha
//  4. Creates an ai_engineer_deployments row for verification polling

import { NextRequest } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/admin-ai/supabase-admin";
import { getFileContent, commitFiles, type CommitFileChange } from "@/lib/admin-ai/github";

export const runtime = "edge";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { session_id } = await req.json();
  if (!session_id) return Response.json({ error: "session_id is required" }, { status: 400 });

  const { data: patches, error: patchErr } = await supabaseAdmin
    .from("ai_engineer_patches")
    .select("*")
    .eq("session_id", session_id)
    .eq("status", "approved");

  if (patchErr) return Response.json({ error: patchErr.message }, { status: 500 });
  if (!patches || patches.length === 0) {
    return Response.json({ error: "No approved patches to apply" }, { status: 400 });
  }

  await supabaseAdmin.from("ai_engineer_sessions").update({ status: "backing_up", updated_at: new Date().toISOString() }).eq("id", session_id);

  // ── 1. Backups ───────────────────────────────────────────────────
  for (const patch of patches) {
    let contentBefore: string | null = null;
    let existedBefore = true;
    try {
      const current = await getFileContent(patch.file_path);
      if (current) {
        contentBefore = current.content;
      } else {
        existedBefore = false;
      }
    } catch (e: any) {
      return Response.json({ error: `Backup failed for ${patch.file_path}: ${e.message}` }, { status: 500 });
    }

    await supabaseAdmin.from("ai_engineer_backups").insert({
      patch_id: patch.id,
      file_path: patch.file_path,
      content_before: contentBefore,
      existed_before: existedBefore,
    });
  }

  await supabaseAdmin.from("ai_engineer_audit_log").insert({
    session_id,
    actor: "admin",
    actor_id: auth.userId,
    action_type: "backup_created",
    action_detail: { patch_count: patches.length },
  });

  // ── 2. Commit to GitHub ──────────────────────────────────────────
  await supabaseAdmin.from("ai_engineer_sessions").update({ status: "applying", updated_at: new Date().toISOString() }).eq("id", session_id);

  const changes: CommitFileChange[] = patches.map((p) => ({
    path: p.file_path,
    action: p.action,
    content: p.action === "delete" ? undefined : (p.new_content ?? ""),
  }));

  const { data: sessionRow } = await supabaseAdmin.from("ai_engineer_sessions").select("prompt").eq("id", session_id).single();
  const commitMessage = `AI Engineer: ${sessionRow?.prompt?.slice(0, 60) ?? session_id}\n\nApplied via Admin AI Engineer (session ${session_id}). ${patches.length} file(s) changed.`;

  let commitSha: string;
  try {
    commitSha = await commitFiles(changes, commitMessage);
  } catch (e: any) {
    await supabaseAdmin.from("ai_engineer_sessions").update({ status: "failed", error_message: `Apply failed: ${e.message}` }).eq("id", session_id);
    await supabaseAdmin.from("ai_engineer_patches").update({ status: "apply_failed" }).eq("session_id", session_id).eq("status", "approved");
    return Response.json({ error: `GitHub commit failed: ${e.message}` }, { status: 500 });
  }

  // ── 3. Mark patches applied ───────────────────────────────────────
  await supabaseAdmin
    .from("ai_engineer_patches")
    .update({ status: "applied", applied_commit_sha: commitSha })
    .eq("session_id", session_id)
    .eq("status", "approved");

  // ── 4. Deployment tracking row ────────────────────────────────────
  const { data: deployment } = await supabaseAdmin
    .from("ai_engineer_deployments")
    .insert({ session_id, commit_sha: commitSha, deployment_status: "pending" })
    .select("id")
    .single();

  await supabaseAdmin.from("ai_engineer_sessions").update({ status: "deploying", updated_at: new Date().toISOString() }).eq("id", session_id);

  await supabaseAdmin.from("ai_engineer_audit_log").insert({
    session_id,
    actor: "admin",
    actor_id: auth.userId,
    action_type: "apply",
    action_detail: { commit_sha: commitSha, patch_count: patches.length, deployment_id: deployment?.id },
  });

  return Response.json({ ok: true, commit_sha: commitSha, deployment_id: deployment?.id, files_changed: patches.length });
}

