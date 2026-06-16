// lib/admin-ai/agent.ts
// Agent Orchestrator — runs the Claude tool-use loop for a session.
// Tools have READ access to the repo/logs/schema/memory, and a
// write-only `propose_patch` that only ever writes to the DATABASE
// (never to GitHub). GitHub writes happen exclusively in /apply,
// after admin approval — see ADMIN_AI_ENGINEER_ARCHITECTURE.md §2.

import { supabaseAdmin } from "./supabase-admin";
import { RepoSession } from "./code-search";
import { getFileContent } from "./github";
import { getRecentLogs } from "./vercel";
import { generateUnifiedDiff } from "./diff";
import {
  buildHistoricalContext,
  searchMemory,
  matchIssuePattern,
  getFileIntelligence,
  writeSessionMemory,
  upsertFileIntelligence,
  recordIssuePattern,
  type IssuePatternMatch,
} from "./memory";
import { AGENT_TOOLS, type ToolCallLogEntry } from "./types";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const MAX_ITERATIONS = 15;
const MAX_TOKENS = 8000;

export type SendFn = (event: string, data: Record<string, unknown>) => void;

const SYSTEM_PROMPT_BASE = `You are the Krypton AI Engineer — an AI CTO / senior software engineer for the
Krypton AI codebase (Next.js 14 + TypeScript + Supabase + Vercel Edge functions,
a website/app/game builder product).

Your job: investigate the admin's prompt, find the EXACT root cause using the
available tools, and either:
  (a) propose one or more concrete code patches via propose_patch, then call
      finish_analysis, OR
  (b) if no code change is needed (e.g. pure audit request), call
      finish_analysis directly with no patches.

Rules:
- ALWAYS check recall_memory / match_issue_pattern / get_file_intelligence
  EARLY — do not re-discover what is already known. The Historical Context
  below was already retrieved for you; use recall_memory/match_issue_pattern
  again only for FOLLOW-UP lookups on new files/topics you discover.
- If match_issue_pattern returns a match >=70% similarity, your FIRST action
  must be to read_file the affected_files from that match and verify whether
  the previously-applied fix is STILL PRESENT in the current code, before
  doing anything else.
- propose_patch does NOT modify any file — it only records a proposal for
  admin approval. Always provide the FULL new file content for create/modify.
- Be surgical: prefer the smallest correct change. Re-use existing patterns
  in the codebase (this project has very specific conventions — read
  neighboring code before writing new code).
- ALWAYS end by calling finish_analysis exactly once.`;

function logToolCall(log: ToolCallLogEntry[], tool: string, input: Record<string, unknown>, outputSummary: string) {
  log.push({ tool, input, output_summary: outputSummary, ts: new Date().toISOString() });
}

async function auditLog(sessionId: string, actor: "ai" | "admin" | "system", actionType: string, detail: Record<string, unknown>, actorId?: string) {
  await supabaseAdmin.from("ai_engineer_audit_log").insert({
    session_id: sessionId,
    actor,
    actor_id: actorId ?? null,
    action_type: actionType,
    action_detail: detail,
  });
}

async function callClaude(systemPrompt: string, messages: any[]): Promise<any> {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
      tools: AGENT_TOOLS,
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

interface AgentContext {
  sessionId: string;
  repo: RepoSession;
  toolCallLog: ToolCallLogEntry[];
  patternMatches: IssuePatternMatch[];
  send: SendFn;
}

async function dispatchTool(name: string, input: any, ctx: AgentContext): Promise<unknown> {
  switch (name) {
    case "list_files": {
      const files = await ctx.repo.listFiles(input.path_prefix);
      logToolCall(ctx.toolCallLog, name, input, `${files.length} files`);
      return { files: files.slice(0, 500) };
    }
    case "read_file": {
      const content = await ctx.repo.readFile(input.path);
      logToolCall(ctx.toolCallLog, name, input, content ? `${content.length} chars` : "not found");
      return content === null ? { error: "File not found" } : { path: input.path, content };
    }
    case "search_code": {
      const matches = await ctx.repo.searchCode(input.query);
      logToolCall(ctx.toolCallLog, name, input, `${matches.length} matches`);
      return { matches };
    }
    case "get_vercel_logs": {
      try {
        const logs = await getRecentLogs({ query: input.query, limit: input.limit ?? 50 });
        logToolCall(ctx.toolCallLog, name, input, `${logs.length} log lines`);
        return { logs };
      } catch (e: any) {
        logToolCall(ctx.toolCallLog, name, input, `error: ${e.message}`);
        return { error: e.message };
      }
    }
    case "query_supabase_schema": {
      const { data, error } = await supabaseAdmin.rpc("admin_introspect_schema", { p_table: input.table ?? null });
      logToolCall(ctx.toolCallLog, name, input, error ? `error: ${error.message}` : `${(data || []).length} columns`);
      return error ? { error: error.message } : { columns: data };
    }
    case "recall_memory": {
      const results = await searchMemory(input.tags ?? [], input.files ?? []);
      logToolCall(ctx.toolCallLog, name, input, `${results.length} memory entries`);
      return { memories: results.map((m) => ({ memory_type: m.memory_type, title: m.title, summary: m.summary, outcome: m.outcome, confidence: m.confidence, created_at: m.created_at })) };
    }
    case "match_issue_pattern": {
      const matches = await matchIssuePattern(input.description);
      logToolCall(ctx.toolCallLog, name, input, `${matches.length} pattern matches`);
      return { matches };
    }
    case "get_file_intelligence": {
      const intel = await getFileIntelligence(input.file_paths ?? []);
      logToolCall(ctx.toolCallLog, name, input, `${intel.length} files with intelligence`);
      return { file_intelligence: intel };
    }
    case "propose_patch": {
      const filePath: string = input.file_path;
      const action: "create" | "modify" | "delete" = input.action;
      const newContent: string | undefined = input.new_content;

      let oldContent: string | null = null;
      if (action !== "create") {
        const existing = await getFileContent(filePath);
        oldContent = existing?.content ?? null;
      }

      const diffText = generateUnifiedDiff(
        oldContent ?? "",
        action === "delete" ? "" : (newContent ?? ""),
        filePath
      );

      const { data: patch, error } = await supabaseAdmin
        .from("ai_engineer_patches")
        .insert({
          session_id: ctx.sessionId,
          file_path: filePath,
          action,
          old_content: oldContent,
          new_content: action === "delete" ? null : newContent ?? null,
          diff_text: diffText,
          explanation: input.explanation,
          status: "proposed",
        })
        .select("id")
        .single();

      logToolCall(ctx.toolCallLog, name, { file_path: filePath, action }, error ? `error: ${error.message}` : `patch ${patch?.id}`);
      ctx.send("patch_proposed", { file_path: filePath, action, explanation: input.explanation, patch_id: patch?.id });
      return error ? { error: error.message } : { patch_id: patch.id, diff_preview: diffText.slice(0, 2000) };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function runAgentSession(sessionId: string, prompt: string, send: SendFn): Promise<void> {
  const repo = new RepoSession();
  const toolCallLog: ToolCallLogEntry[] = [];

  send("phase", { action: "Recalling memory and historical context..." });
  const { markdown: historicalContext, patternMatches } = await buildHistoricalContext(prompt);
  send("historical_context", { markdown: historicalContext });
  await auditLog(sessionId, "system", "historical_context_built", { patternMatches: patternMatches.length });

  // Pre-create the analysis row so historical_context is visible even if
  // the session later fails mid-investigation.
  await supabaseAdmin.from("ai_engineer_analysis").insert({
    session_id: sessionId,
    historical_context: historicalContext,
    affected_files: [],
    tool_calls: [],
  });

  const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${historicalContext}`;
  const messages: any[] = [{ role: "user", content: prompt }];

  const ctx: AgentContext = { sessionId, repo, toolCallLog, patternMatches, send };

  let finished = false;
  for (let iter = 0; iter < MAX_ITERATIONS && !finished; iter++) {
    send("phase", { action: `Thinking (step ${iter + 1})...` });
    let response: any;
    try {
      response = await callClaude(systemPrompt, messages);
    } catch (e: any) {
      send("error", { message: `Agent call failed: ${e.message}` });
      await markSessionFailed(sessionId, `Agent call failed: ${e.message}`, historicalContext, toolCallLog);
      return;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolUses = (response.content || []).filter((b: any) => b.type === "tool_use");
    const textBlocks = (response.content || []).filter((b: any) => b.type === "text");
    for (const t of textBlocks) {
      if (t.text?.trim()) send("thinking", { text: t.text.trim() });
    }

    if (toolUses.length === 0) {
      // Model stopped without calling finish_analysis — nudge once, then bail.
      if (response.stop_reason === "end_turn" && iter < MAX_ITERATIONS - 1) {
        messages.push({ role: "user", content: "Please call finish_analysis to conclude, or propose_patch first if you have a fix." });
        continue;
      }
      break;
    }

    const toolResults: any[] = [];
    for (const block of toolUses) {
      send("tool_call", { tool: block.name, input: block.input });

      if (block.name === "finish_analysis") {
        await finalizeAnalysis(sessionId, block.input, toolCallLog, historicalContext, patternMatches, prompt);
        send("complete", { root_cause: block.input.root_cause, summary: block.input.summary });
        finished = true;
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Analysis finalized." });
        break;
      }

      const result = await dispatchTool(block.name, block.input, ctx);
      await auditLog(sessionId, "ai", `tool:${block.name}`, { input: block.input });
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result).slice(0, 12000) });
    }

    if (!finished) messages.push({ role: "user", content: toolResults });
  }

  if (!finished) {
    send("error", { message: "Investigation did not conclude within the step limit." });
    await markSessionFailed(sessionId, "Max iterations reached without finish_analysis.", historicalContext, toolCallLog);
  }
}

async function markSessionFailed(sessionId: string, errorMessage: string, historicalContext: string, toolCallLog: ToolCallLogEntry[]) {
  await supabaseAdmin.from("ai_engineer_sessions").update({ status: "failed", error_message: errorMessage, updated_at: new Date().toISOString() }).eq("id", sessionId);
  await supabaseAdmin.from("ai_engineer_analysis").update({ tool_calls: toolCallLog }).eq("session_id", sessionId);
  await writeSessionMemory(sessionId, "failed", { summary: errorMessage });
}

async function finalizeAnalysis(
  sessionId: string,
  input: any,
  toolCallLog: ToolCallLogEntry[],
  historicalContext: string,
  patternMatches: IssuePatternMatch[],
  prompt: string
) {
  const affectedFiles: string[] = input.affected_files ?? [];
  const tags: string[] = input.memory_tags ?? [];

  await supabaseAdmin
    .from("ai_engineer_analysis")
    .update({
      root_cause: input.root_cause,
      affected_files: affectedFiles,
      full_report: input.full_report,
      tool_calls: toolCallLog,
    })
    .eq("session_id", sessionId);

  // Determine whether patches were proposed during this session
  const { count } = await supabaseAdmin
    .from("ai_engineer_patches")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const newStatus = (count ?? 0) > 0 ? "awaiting_approval" : "analysis_complete";

  await supabaseAdmin
    .from("ai_engineer_sessions")
    .update({ status: newStatus, summary: input.summary, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  // Memory write-back: root_cause + audit
  await writeSessionMemory(sessionId, "analysis_complete", {
    rootCause: input.root_cause,
    summary: input.summary,
    affectedFiles,
    tags,
  });

  // Issue pattern record/update
  const topMatch = patternMatches[0] ?? null;
  await recordIssuePattern({
    prompt,
    title: input.summary?.slice(0, 120) ?? input.root_cause?.slice(0, 120) ?? "Untitled issue",
    rootCause: input.root_cause,
    affectedFiles,
    tags,
    matched: topMatch,
  });

  // File intelligence write-back
  const fileNotes: Array<{ path: string; purpose?: string; related_features?: string[]; related_tables?: string[] }> = input.file_notes ?? [];
  const noteByPath = new Map(fileNotes.map((n) => [n.path, n]));
  await upsertFileIntelligence(
    affectedFiles.map((path) => {
      const note = noteByPath.get(path);
      return {
        file_path: path,
        purpose: note?.purpose,
        related_features: note?.related_features ?? [],
        related_tables: note?.related_tables ?? [],
        common_bugs: [{ description: input.root_cause }],
      };
    })
  );
}

