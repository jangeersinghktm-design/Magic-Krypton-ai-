// app/api/admin/ai-engineer/feedback/route.ts
// POST: admin retroactively confirms ("this fix worked") or refutes
// ("this came back / didn't actually fix it") a past fix_applied memory
// entry. Implements the self-learning adjustment (Memory Part 3, §3).

import { NextRequest } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/admin-ai/supabase-admin";
import { adjustVerification } from "@/lib/admin-ai/memory";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { memory_id, feedback, note } = await req.json();
  if (!memory_id) return Response.json({ error: "memory_id is required" }, { status: 400 });
  if (feedback !== "confirmed" && feedback !== "refuted") {
    return Response.json({ error: "feedback must be 'confirmed' or 'refuted'" }, { status: 400 });
  }

  const { data: memory, error } = await supabaseAdmin
    .from("ai_engineer_memory")
    .select("id, memory_type, title")
    .eq("id", memory_id)
    .single();

  if (error || !memory) return Response.json({ error: error?.message ?? "Memory entry not found" }, { status: 404 });

  const delta = feedback === "confirmed" ? 0.2 : -0.5;
  const reason = note?.trim() || (feedback === "confirmed" ? "Admin confirmed fix is working in production" : "Admin reported this fix did not resolve the issue");

  const newScore = await adjustVerification(memory_id, delta, reason, "admin_feedback");

  await supabaseAdmin.from("ai_engineer_audit_log").insert({
    session_id: null,
    actor: "admin",
    actor_id: auth.userId,
    action_type: "memory_feedback",
    action_detail: { memory_id, memory_title: memory.title, feedback, delta, new_score: newScore },
  });

  return Response.json({ ok: true, memory_id, new_verification_score: newScore });
}

