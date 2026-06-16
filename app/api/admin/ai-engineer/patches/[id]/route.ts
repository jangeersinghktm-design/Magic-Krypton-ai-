// app/api/admin/ai-engineer/patches/[id]/route.ts
// PATCH: approve or reject a single proposed patch.

import { NextRequest } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/admin-ai/supabase-admin";

export const runtime = "edge";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { decision } = await req.json(); // "approved" | "rejected"
  if (decision !== "approved" && decision !== "rejected") {
    return Response.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const { data: patch, error } = await supabaseAdmin
    .from("ai_engineer_patches")
    .update({ status: decision, decided_at: new Date().toISOString(), decided_by: auth.userId })
    .eq("id", params.id)
    .eq("status", "proposed") // can only decide on still-proposed patches
    .select("id, session_id, file_path")
    .single();

  if (error || !patch) {
    return Response.json({ error: error?.message ?? "Patch not found or already decided" }, { status: 404 });
  }

  await supabaseAdmin.from("ai_engineer_audit_log").insert({
    session_id: patch.session_id,
    actor: "admin",
    actor_id: auth.userId,
    action_type: `patch:${decision}`,
    action_detail: { patch_id: patch.id, file_path: patch.file_path },
  });

  // If ALL patches for this session are now decided (none left "proposed"),
  // and at least one was approved, move session to 'approved'. If all
  // rejected, move to 'rejected'.
  const { data: remaining } = await supabaseAdmin
    .from("ai_engineer_patches")
    .select("status")
    .eq("session_id", patch.session_id);

  const allDecided = (remaining || []).every((p) => p.status !== "proposed");
  if (allDecided) {
    const anyApproved = (remaining || []).some((p) => p.status === "approved");
    await supabaseAdmin
      .from("ai_engineer_sessions")
      .update({ status: anyApproved ? "approved" : "rejected", updated_at: new Date().toISOString() })
      .eq("id", patch.session_id);
  }

  return Response.json({ ok: true, patch_id: patch.id, decision });
}

