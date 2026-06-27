// app/api/admin/ai-engineer/sessions/route.ts
// POST: create a new investigation session, stream progress via SSE.
// GET: list past sessions (for the history sidebar).

import { NextRequest } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/admin-ai/supabase-admin";
import { runAgentSession } from "@/lib/admin-ai/agent";

export const runtime = "nodejs"; // FIX: edge→nodejs for AI calls
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const { data: session, error } = await supabaseAdmin
    .from("ai_engineer_sessions")
    .insert({ admin_id: auth.userId, prompt: prompt.trim(), status: "analyzing" })
    .select("id")
    .single();

  if (error || !session) {
    return Response.json({ error: error?.message ?? "Failed to create session" }, { status: 500 });
  }

  await supabaseAdmin.from("ai_engineer_audit_log").insert({
    session_id: session.id,
    actor: "admin",
    actor_id: auth.userId,
    action_type: "session_created",
    action_detail: { prompt },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      send("session", { id: session.id });

      try {
        await runAgentSession(session.id, prompt.trim(), send);
      } catch (err: any) {
        send("error", { message: err.message || "Investigation failed." });
        await supabaseAdmin
          .from("ai_engineer_sessions")
          .update({ status: "failed", error_message: err.message })
          .eq("id", session.id);
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin
    .from("ai_engineer_sessions")
    .select("id, prompt, status, summary, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ sessions: data });
}

