// app/api/admin/ai-engineer/sessions/[id]/route.ts
// GET: full session detail — analysis, patches, audit log, deployments.

import { NextRequest } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/admin-ai/supabase-admin";

export const runtime = "edge";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const sessionId = params.id;

  const [{ data: session, error: sErr }, { data: analysis }, { data: patches }, { data: auditLog }, { data: deployments }] =
    await Promise.all([
      supabaseAdmin.from("ai_engineer_sessions").select("*").eq("id", sessionId).single(),
      supabaseAdmin.from("ai_engineer_analysis").select("*").eq("session_id", sessionId).maybeSingle(),
      supabaseAdmin.from("ai_engineer_patches").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
      supabaseAdmin.from("ai_engineer_audit_log").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
      supabaseAdmin.from("ai_engineer_deployments").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }),
    ]);

  if (sErr || !session) return Response.json({ error: sErr?.message ?? "Session not found" }, { status: 404 });

  return Response.json({
    session,
    analysis: analysis ?? null,
    patches: patches ?? [],
    audit_log: auditLog ?? [],
    deployments: deployments ?? [],
  });
}

