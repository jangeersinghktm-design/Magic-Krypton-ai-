// lib/admin-ai/agent.ts
// Agent Orchestrator — 3-layer provider fallback:
//   1. Anthropic Claude (primary)
//   2. OpenAI GPT-4o-mini (fallback)
//   3. Gemini 1.5 Flash (last resort)
// Billing/quota/429/400 errors trigger automatic fallback.
// Session continues — never marked failed due to provider errors alone.

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

// ── Constants ────────────────────────────────────────────────────────
const MAX_ITERATIONS = 15;
const MAX_TOKENS = 8000;

export type SendFn = (event: string, data: Record<string, unknown>) => void;

// ── Provider types ───────────────────────────────────────────────────
type Provider = "anthropic" | "openai" | "gemini";

interface ProviderResult {
  provider: Provider;
  response: any;
}

// Errors that should trigger fallback (billing, quota, auth, rate-limit)
const FALLBACK_STATUS_CODES = new Set([400, 401, 402, 403, 429]);
const FALLBACK_KEYWORDS = [
  "credit", "billing", "quota", "limit", "payment", "balance",
  "insufficient", "exceeded", "rate", "overloaded", "capacity",
];

function isFallbackError(status: number, body: string): boolean {
  if (FALLBACK_STATUS_CODES.has(status)) return true;
  const lower = body.toLowerCase();
  return FALLBACK_KEYWORDS.some((k) => lower.includes(k));
}

// ── System prompt ────────────────────────────────────────────────────
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
  EARLY — do not re-discover what is already known.
- If match_issue_pattern returns a match >=70% similarity, your FIRST action
  must be to read_file the affected_files and verify the fix is still present.
- propose_patch does NOT modify any file — only records a proposal for admin approval.
  Always provide FULL new file content for create/modify.
- Be surgical: smallest correct change. Re-use existing codebase patterns.
- ALWAYS end by calling finish_analysis exactly once.`;

// ── OpenAI tool format converter ─────────────────────────────────────
// OpenAI uses a slightly different tool format than Anthropic.
function toOpenAITools(tools: typeof AGENT_TOOLS): any[] {
  return ([...tools] as any[]).map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

// OpenAI response → Anthropic-compatible format
function normalizeOpenAIResponse(res: any): any {
  const choice = res.choices?.[0];
  const msg = choice?.message;
  const content: any[] = [];

  if (msg?.content) content.push({ type: "text", text: msg.content });

  if (msg?.tool_calls) {
    for (const tc of msg.tool_calls) {
      let input: any = {};
      try { input = JSON.parse(tc.function.arguments); } catch {}
      content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
    }
  }

  return {
    content,
    stop_reason: choice?.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
    _openai_raw: msg,
  };
}

// OpenAI messages format (tool_results need different structure)
function toOpenAIMessages(messages: any[]): any[] {
  return messages.map((m) => {
    if (m.role === "user" && Array.isArray(m.content)) {
      // tool_result array → individual tool messages
      const toolResults = m.content.filter((c: any) => c.type === "tool_result");
      if (toolResults.length > 0) {
        return toolResults.map((tr: any) => ({
          role: "tool",
          tool_call_id: tr.tool_use_id,
          content: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content),
        }));
      }
    }
    if (m.role === "assistant" && Array.isArray(m.content)) {
      const text = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
      const tool_calls = m.content
        .filter((c: any) => c.type === "tool_use")
        .map((c: any) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: JSON.stringify(c.input) },
        }));
      return { role: "assistant", content: text || null, tool_calls: tool_calls.length ? tool_calls : undefined };
    }
    return m;
  }).flat();
}

// Gemini tool format
function toGeminiTools(tools: typeof AGENT_TOOLS): any[] {
  return [{
    function_declarations: ([...tools] as any[]).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    })),
  }];
}

// Gemini response → Anthropic-compatible format
function normalizeGeminiResponse(res: any): any {
  const candidate = res.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const content: any[] = [];

  for (const part of parts) {
    if (part.text) content.push({ type: "text", text: part.text });
    if (part.functionCall) {
      content.push({
        type: "tool_use",
        id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: part.functionCall.name,
        input: part.functionCall.args ?? {},
      });
    }
  }

  const finishReason = candidate?.finishReason;
  return {
    content,
    stop_reason: finishReason === "STOP" ? "end_turn" : "tool_use",
  };
}

// Gemini messages format
function toGeminiMessages(systemPrompt: string, messages: any[]): { system: string; contents: any[] } {
  const contents: any[] = [];
  for (const m of messages) {
    if (m.role === "user" && Array.isArray(m.content)) {
      const toolResults = m.content.filter((c: any) => c.type === "tool_result");
      if (toolResults.length > 0) {
        contents.push({
          role: "user",
          parts: toolResults.map((tr: any) => ({
            functionResponse: {
              name: tr.tool_use_id,
              response: { result: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content) },
            },
          })),
        });
        continue;
      }
      const text = Array.isArray(m.content)
        ? m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n")
        : m.content;
      contents.push({ role: "user", parts: [{ text }] });
    } else if (m.role === "assistant" && Array.isArray(m.content)) {
      const parts: any[] = [];
      for (const c of m.content) {
        if (c.type === "text" && c.text) parts.push({ text: c.text });
        if (c.type === "tool_use") parts.push({ functionCall: { name: c.name, args: c.input } });
      }
      if (parts.length) contents.push({ role: "model", parts });
    } else {
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text }] });
    }
  }
  return { system: systemPrompt, contents };
}

// ── Provider callers ──────────────────────────────────────────────────

async function callAnthropic(systemPrompt: string, messages: any[]): Promise<any> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
      tools: AGENT_TOOLS,
    }),
    signal: AbortSignal.timeout(90000),
  });
  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`Anthropic: ${res.status} ${body}`);
    (err as any).status = res.status;
    (err as any).body = body;
    (err as any).isFallback = isFallbackError(res.status, body);
    throw err;
  }
  return JSON.parse(body);
}

async function callOpenAI(systemPrompt: string, messages: any[]): Promise<any> {
  const oaiMessages = [{ role: "system", content: systemPrompt }, ...toOpenAIMessages(messages)];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: MAX_TOKENS,
      messages: oaiMessages,
      tools: toOpenAITools(AGENT_TOOLS),
      tool_choice: "auto",
    }),
    signal: AbortSignal.timeout(90000),
  });
  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`OpenAI: ${res.status} ${body}`);
    (err as any).status = res.status;
    (err as any).body = body;
    (err as any).isFallback = isFallbackError(res.status, body);
    throw err;
  }
  return normalizeOpenAIResponse(JSON.parse(body));
}

async function callGemini(systemPrompt: string, messages: any[]): Promise<any> {
  const { contents } = toGeminiMessages(systemPrompt, messages);
  const model = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: toGeminiTools(AGENT_TOOLS),
      generationConfig: { maxOutputTokens: MAX_TOKENS },
    }),
    signal: AbortSignal.timeout(90000),
  });
  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`Gemini: ${res.status} ${body}`);
    (err as any).status = res.status;
    (err as any).body = body;
    (err as any).isFallback = isFallbackError(res.status, body);
    throw err;
  }
  return normalizeGeminiResponse(JSON.parse(body));
}

// ── 3-layer fallback caller ───────────────────────────────────────────
async function callWithFallback(
  systemPrompt: string,
  messages: any[],
  send: SendFn,
  sessionId: string,
  currentProvider: { value: Provider }
): Promise<ProviderResult> {
  const providers: Provider[] = ["anthropic", "openai", "gemini"];
  const startIndex = providers.indexOf(currentProvider.value);

  for (let i = startIndex; i < providers.length; i++) {
    const provider = providers[i];
    currentProvider.value = provider;

    send("provider", { action: "started", provider });
    await auditLog(sessionId, "system", "provider_started", { provider });

    try {
      let response: any;
      if (provider === "anthropic") response = await callAnthropic(systemPrompt, messages);
      else if (provider === "openai") response = await callOpenAI(systemPrompt, messages);
      else response = await callGemini(systemPrompt, messages);

      send("provider", { action: "selected", provider });
      await auditLog(sessionId, "system", "provider_selected", { provider });
      return { provider, response };

    } catch (err: any) {
      const shouldFallback = err.isFallback ?? false;
      send("provider", {
        action: "failed",
        provider,
        reason: err.message?.slice(0, 200),
        will_fallback: shouldFallback && i < providers.length - 1,
      });
      await auditLog(sessionId, "system", "provider_failed", {
        provider,
        error: err.message?.slice(0, 500),
        status: err.status,
        will_fallback: shouldFallback,
      });

      // Only fallback on billing/quota/rate errors, not on logic errors
      if (shouldFallback && i < providers.length - 1) {
        const nextProvider = providers[i + 1];
        send("provider", { action: "fallback_triggered", from: provider, to: nextProvider });
        await auditLog(sessionId, "system", "fallback_triggered", { from: provider, to: nextProvider });
        continue;
      }

      // Non-fallback error (network timeout, bad request logic, etc.) — throw
      throw err;
    }
  }

  throw new Error("All providers exhausted — billing/quota issues on all three providers.");
}

// ── Helpers ──────────────────────────────────────────────────────────
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

interface AgentContext {
  sessionId: string;
  repo: RepoSession;
  toolCallLog: ToolCallLogEntry[];
  patternMatches: IssuePatternMatch[];
  send: SendFn;
}

// ── Tool dispatcher ──────────────────────────────────────────────────
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

// ── Main entry point ─────────────────────────────────────────────────
export async function runAgentSession(sessionId: string, prompt: string, send: SendFn): Promise<void> {
  const repo = new RepoSession();
  const toolCallLog: ToolCallLogEntry[] = [];

  send("phase", { action: "Recalling memory and historical context..." });
  const { markdown: historicalContext, patternMatches } = await buildHistoricalContext(prompt);
  send("historical_context", { markdown: historicalContext });
  await auditLog(sessionId, "system", "historical_context_built", { patternMatches: patternMatches.length });

  await supabaseAdmin.from("ai_engineer_analysis").insert({
    session_id: sessionId,
    historical_context: historicalContext,
    affected_files: [],
    tool_calls: [],
  });

  const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${historicalContext}`;
  const messages: any[] = [{ role: "user", content: prompt }];
  const ctx: AgentContext = { sessionId, repo, toolCallLog, patternMatches, send };

  // Track which provider is currently active (mutable ref for fallback continuity)
  const currentProvider: { value: Provider } = { value: "anthropic" };
  let completedProvider: Provider = "anthropic";

  let finished = false;
  for (let iter = 0; iter < MAX_ITERATIONS && !finished; iter++) {
    send("phase", { action: `Thinking (step ${iter + 1})...` });

    let providerResult: ProviderResult;
    try {
      providerResult = await callWithFallback(systemPrompt, messages, send, sessionId, currentProvider);
      completedProvider = providerResult.provider;
    } catch (e: any) {
      send("error", { message: `All providers failed: ${e.message}` });
      await markSessionFailed(sessionId, e.message, toolCallLog);
      return;
    }

    const response = providerResult.response;
    messages.push({ role: "assistant", content: response.content });

    const toolUses = (response.content || []).filter((b: any) => b.type === "tool_use");
    const textBlocks = (response.content || []).filter((b: any) => b.type === "text");
    for (const t of textBlocks) {
      if (t.text?.trim()) send("thinking", { text: t.text.trim() });
    }

    if (toolUses.length === 0) {
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
        await finalizeAnalysis(sessionId, block.input, toolCallLog, historicalContext, patternMatches, prompt, completedProvider);
        send("complete", {
          root_cause: block.input.root_cause,
          summary: block.input.summary,
          provider: completedProvider,
        });
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
    await markSessionFailed(sessionId, "Max iterations reached without finish_analysis.", toolCallLog);
  }
}

async function markSessionFailed(sessionId: string, errorMessage: string, toolCallLog: ToolCallLogEntry[]) {
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
  prompt: string,
  completedProvider: Provider,
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

  const { count } = await supabaseAdmin
    .from("ai_engineer_patches")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const newStatus = (count ?? 0) > 0 ? "awaiting_approval" : "analysis_complete";

  await supabaseAdmin
    .from("ai_engineer_sessions")
    .update({
      status: newStatus,
      summary: `[${completedProvider.toUpperCase()}] ${input.summary}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  await writeSessionMemory(sessionId, "analysis_complete", {
    rootCause: input.root_cause,
    summary: input.summary,
    affectedFiles,
    tags,
  });

  const topMatch = patternMatches[0] ?? null;
  await recordIssuePattern({
    prompt,
    title: input.summary?.slice(0, 120) ?? input.root_cause?.slice(0, 120) ?? "Untitled issue",
    rootCause: input.root_cause,
    affectedFiles,
    tags,
    matched: topMatch,
  });

  const fileNotes: Array<{ path: string; purpose?: string; related_features?: string[]; related_tables?: string[] }> = input.file_notes ?? [];
  const noteByPath = new Map(fileNotes.map((n: any) => [n.path, n]));
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
