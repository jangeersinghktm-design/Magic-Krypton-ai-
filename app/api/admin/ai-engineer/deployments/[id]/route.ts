// app/api/admin/ai-engineer/deployments/[id]/route.ts
// GET: polls Vercel for the deployment's current build status and
// updates ai_engineer_deployments + session status accordingly.
// This implements the "deploying -> verifying -> completed/failed" steps.

import { NextRequest } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/admin-ai/supabase-admin";
import { getDeploymentForCommit, getDeploymentStatus } from "@/lib/admin-ai/vercel";
import { writeSessionMemory } from "@/lib/admin-ai/memory";

export const runtime = "edge";

const READY_STATES = new Set(["READY", "ready"]);
const ERROR_STATES = new Set(["ERROR", "error", "CANCELED", "canceled"]);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { data: deployment, error } = await supabaseAdmin
    .from("ai_engineer_deployments")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !deployment) return Response.json({ error: error?.message ?? "Deployment not found" }, { status: 404 });

  let status = deployment.vercel_deployment_id
    ? await getDeploymentStatus(deployment.vercel_deployment_id)
    : await getDeploymentForCommit(deployment.commit_sha);

  if (!status) {
    return Response.json({ deployment, vercel_status: null, message: "Vercel deployment not found yet — try again shortly." });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!deployment.vercel_deployment_id) updates.vercel_deployment_id = status.id;

  let newDeploymentStatus = deployment.deployment_status;
  let verificationReport: string | null = deployment.verification_report;

  if (READY_STATES.has(status.state)) {
    newDeploymentStatus = "ready";
    verificationReport = `Build succeeded (Vercel deployment ${status.id}, url: ${status.url ?? "n/a"}).`;
  } else if (ERROR_STATES.has(status.state)) {
    newDeploymentStatus = "error";
    verificationReport = `Build failed (Vercel deployment ${status.id}, state: ${status.state}).`;
  } else {
    newDeploymentStatus = "building";
  }

  updates.deployment_status = newDeploymentStatus;
  updates.verification_report = verificationReport;

  await supabaseAdmin.from("ai_engineer_deployments").update(updates).eq("id", params.id);

  // ── Propagate to session + memory write-back on terminal states ───
  if (newDeploymentStatus === "ready" && deployment.deployment_status !== "ready") {
    await supabaseAdmin
      .from("ai_engineer_sessions")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", deployment.session_id);

    const { data: analysis } = await supabaseAdmin
      .from("ai_engineer_analysis")
      .select("affected_files, root_cause")
      .eq("session_id", deployment.session_id)
      .maybeSingle();

    const { data: patches } = await supabaseAdmin
      .from("ai_engineer_patches")
      .select("id, explanation")
      .eq("session_id", deployment.session_id)
      .eq("status", "applied");

    await writeSessionMemory(deployment.session_id, "completed", {
      fixSummary: (patches || []).map((p) => p.explanation).filter(Boolean).join(" | ") || "Fix applied",
      affectedFiles: analysis?.affected_files ?? [],
      patchIds: (patches || []).map((p) => p.id),
      commitSha: deployment.commit_sha,
      deploymentOutcome: "success",
      verificationReport: verificationReport ?? undefined,
    });

    await supabaseAdmin.from("ai_engineer_audit_log").insert({
      session_id: deployment.session_id,
      actor: "system",
      action_type: "deployment_verified",
      action_detail: { commit_sha: deployment.commit_sha, status: "ready" },
    });
  } else if (newDeploymentStatus === "error" && deployment.deployment_status !== "error") {
    await supabaseAdmin
      .from("ai_engineer_sessions")
      .update({ status: "failed", error_message: verificationReport, updated_at: new Date().toISOString() })
      .eq("id", deployment.session_id);

    const { data: analysis } = await supabaseAdmin
      .from("ai_engineer_analysis")
      .select("affected_files")
      .eq("session_id", deployment.session_id)
      .maybeSingle();

    await writeSessionMemory(deployment.session_id, "rolled_back", {
      fixSummary: "Build failed post-deploy (not yet rolled back — admin should review/rollback)",
      affectedFiles: analysis?.affected_files ?? [],
      commitSha: deployment.commit_sha,
      rollbackReason: verificationReport ?? "Build error",
    });

    await supabaseAdmin.from("ai_engineer_audit_log").insert({
      session_id: deployment.session_id,
      actor: "system",
      action_type: "deployment_failed",
      action_detail: { commit_sha: deployment.commit_sha, status: status.state },
    });
  }

  return Response.json({ deployment: { ...deployment, ...updates }, vercel_status: status });
}

