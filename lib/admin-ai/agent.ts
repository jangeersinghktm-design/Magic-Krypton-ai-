// lib/admin-ai/agent.ts — v2 (fallback-hardened)
// 3-layer fallback: Anthropic → OpenAI → Gemini
// ANY billing/credit/quota/429/400 error triggers automatic fallback.
// Session is NEVER marked failed due to a provider billing error alone.
//
// AUDIT FINDINGS that this version fixes:
// 1. Old version threw "Anthropic API error: ..." and runAgentSession caught
//    it immediately and called markSessionFailed — no fallback ever ran.
// 2. isFallback flag was set on err object BEFORE throw, but the outer
//    try/catch in runAgentSession caught raw Error without checking isFallback.
// 3. This version moves fallback entirely INSIDE callWithFallback so the
//    outer loop never sees a billing error — it only sees a final result
//    or a "all providers exhausted" error.

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

const MAX_ITERATIONS = 15;
const MAX_TOKENS = 8000;

export type SendFn = (event: string, data: Record<string, unknown>) => void;
type Provider = "anthropic" | "openai" | "gemini";
interface ProviderResult { provider: Provider; response: any; }

// ── Billing/quota error detection ─────────────────────────────────────
// Status codes that always mean "switch provider"
const BILLING_CODES = new Set([400, 401, 402, 403, 429]);
// Keywords in the response body that mean "switch provider"
const BILLING_KEYWORDS = [
  "credit", "billing", "quota", "limit exceeded", "payment",
  "balance", "insufficient", "rate limit", "overloaded",
  "capacity", "too many requests", "out of credits",
  "invalid_request_error", // Anthropic's billing error type
];

function isBillingError(status: number, body: string): boolean {
  if (BILLING_CODES.has(status)) return true;
  const b = body.toLowerCase();
  return BILLING_KEYWORDS.some((k) => b.includes(k));
}

// ── System prompt ─────────────────────────────────────────────────────
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
- ALWAYS check recall_memory / match_issue_pattern / get_file_intelligence EARLY.
- If match_issue_pattern returns >=70% similarity, first read_file affected_files
  and verify whether the previous fix is still present in the code.
- propose_patch does NOT modify files — only records a proposal for admin approval.
  Always provide FULL new file content for create/modify.
- Be surgical: smallest correct change. Reuse existing codebase patterns.
- ALWAYS end by calling finish_analysis exactly once.`;

// ── OpenAI format converters ──────────────────────────────────────────
function toOpenAITools(tools: typeof AGENT_TOOLS): any[] {
  return ([...tools] as any[]).map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

function normalizeOpenAIResponse(raw: any): any {
  const msg = raw.choices?.[0]?.message;
  const content: any[] = [];
  if (msg?.content) content.push({ type: "text", text: msg.content });
  for (const tc of msg?.tool_calls ?? []) {
    let input: any = {};
    try { input = JSON.parse(tc.function.arguments); } catch {}
    content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
  }
  const stopReason = raw.choices?.[0]?.finish_reason === "tool_calls" ? "tool_use" : "end_turn";
  return { content, stop_reason: stopReason };
}

function toOpenAIMessages(messages: any[]): any[] {
  const result: any[] = [];
  for (const m of messages) {
    if (m.role === "user" && Array.isArray(m.content)) {
      const toolResults = m.content.filter((c: any) => c.type === "tool_result");
      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          result.push({
            role: "tool",
            tool_call_id: tr.tool_use_id,
            content: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content),
          });
        }
        continue;
      }
      const text = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
      result.push({ role: "user", content: text });
    } else if (m.role === "assistant" && Array.isArray(m.content)) {
      const text = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
      const tool_calls = m.content
        .filter((c: any) => c.type === "tool_use")
        .map((c: any) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input) } }));
      result.push({ role: "assistant", content: text || null, ...(tool_calls.length ? { tool_calls } : {}) });
    } else {
      result.push(m);
    }
  }
  return result;
}

// ── Gemini format converters ──────────────────────────────────────────
function toGeminiTools(tools: typeof AGENT_TOOLS): any[] {
  return [{ function_declarations: ([...tools] as any[]).map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }];
}

function normalizeGeminiResponse(raw: any): any {
  const parts = raw.candidates?.[0]?.content?.parts ?? [];
  const content: any[] = [];
  for (const p of parts) {
    if (p.text) content.push({ type: "text", text: p.text });
    if (p.functionCall) {
      content.push({
        type: "tool_use",
        id: `gem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: p.functionCall.name,
        input: p.functionCall.args ?? {},
      });
    }
  }
  const finishReason = raw.candidates?.[0]?.finishReason;
  return { content, stop_reason: finishReason === "STOP" ? "end_turn" : "tool_use" };
}

function toGeminiMessages(messages: any[]): any[] {
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
      const text = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
      contents.push({ role: "user", parts: [{ text: text || m.content }] });
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
  return contents;
}

// ── Individual provider callers ───────────────────────────────────────
async function callAnthropic(system: string, messages: any[]): Promise<any> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: MAX_TOKENS, system, messages, tools: AGENT_TOOLS }),
    signal: AbortSignal.timeout(90000),
  });
  const body = await res.text();
  if (!res.ok) {
    const billing = isBillingError(res.status, body);
    const err: any = new Error(`[anthropic:${res.status}] ${body.slice(0, 300)}`);
    err.isBilling = billing;
    throw err;
  }
  return JSON.parse(body);
}

async function callOpenAI(system: string, messages: any[]): Promise<any> {
  const oaiKey = process.env.OPENAI_API_KEY ?? "";
  if (!oaiKey) throw Object.assign(new Error("[openai] OPENAI_API_KEY not set"), { isBilling: false });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${oaiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: system }, ...toOpenAIMessages(messages)],
      tools: toOpenAITools(AGENT_TOOLS),
      tool_choice: "auto",
    }),
    signal: AbortSignal.timeout(90000),
  });
  const body = await res.text();
  if (!res.ok) {
    const billing = isBillingError(res.status, body);
    const err: any = new Error(`[openai:${res.status}] ${body.slice(0, 300)}`);
    err.isBilling = billing;
    throw err;
  }
  return normalizeOpenAIResponse(JSON.parse(body));
}

async function callGemini(system: string, messages: any[]): Promise<any> {
  const gemKey = process.env.GEMINI_API_KEY ?? "";
  if (!gemKey) throw Object.assign(new Error("[gemini] GEMINI_API_KEY not set"), { isBilling: false });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: toGeminiMessages(messages),
      tools: toGeminiTools(AGENT_TOOLS),
      generationConfig: { maxOutputTokens: MAX_TOKENS },
    }),
    signal: AbortSignal.timeout(90000),
  });
  const body = await res.text();
  if (!res.ok) {
    const billing = isBillingError(res.status, body);
    const err: any = new Error(`[gemini:${res.status}] ${body.slice(0, 300)}`);
    err.isBilling = billing;
    throw err;
  }
  return normalizeGeminiResponse(JSON.parse(body));
}

// ── 3-layer fallback — THE CORE FIX ──────────────────────────────────
// This function never throws on billing errors.
// It only throws when ALL providers fail, or a non-billing error occurs.
async function callWithFallback(
  system: string,
  messages: any[],
  send: SendFn,
  sessionId: string,
  activeProvider: { value: Provider },
): Promise<ProviderResult> {
  const ALL: Provider[] = ["anthropic", "openai", "gemini"];
  // Start from whichever provider succeeded last (persists across iterations)
  const startIdx = ALL.indexOf(activeProvider.value);

  for (let i = startIdx; i < ALL.length; i++) {
    const provider = ALL[i];
    activeProvider.value = provider;

    send("provider", { action: "started", provider });
    await dbLog(sessionId, "provider_started", { provider });

    try {
      let response: any;
      if (provider === "anthropic") response = await callAnthropic(system, messages);
      else if (provider === "openai")  response = await callOpenAI(system, messages);
      else                             response = await callGemini(system, messages);

      // SUCCESS
      send("provider", { action: "selected", provider });
      await dbLog(sessionId, "provider_selected", { provider });
      return { provider, response };

    } catch (err: any) {
      const billing: boolean = err.isBilling ?? false;
      const hasNext = i < ALL.length - 1;

      send("provider", {
        action: "failed",
        provider,
        reason: err.message?.slice(0, 250),
        billing_error: billing,
        will_fallback: billing && hasNext,
      });
      await dbLog(sessionId, "provider_failed", {
        provider,
        error: err.message?.slice(0, 500),
        billing_error: billing,
        will_fallback: billing && hasNext,
      });

      if (billing && hasNext) {
        // FALLBACK — continue to next provider
        const next = ALL[i + 1];
        send("provider", { action: "fallback_triggered", from: provider, to: next });
        await dbLog(sessionId, "fallback_triggered", { from: provider, to: next });
        continue; // <-- this is the critical line that was missing before
      }

      // Non-billing error (network, bad JSON, etc.) — rethrow
      throw err;
    }
  }

  // All providers tried and all had billing issues
  throw new Error("All AI providers exhausted (billing/quota on all three). Add credits to Anthropic, OpenAI, or Gemini.");
}

// ── Helpers ───────────────────────────────────────────────────────────
function logTool(log: ToolCallLogEntry[], tool: string, input: Record<string, unknown>, summary: string) {
  log.push({ tool, input, output_summary: summary, ts: new Date().toISOString() });
}

async function dbLog(sessionId: string, actionType: string, detail: Record<string, unknown>) {
  await supabaseAdmin.from("ai_engineer_audit_log").insert({
    session_id: sessionId, actor: "system", actor_id: null, action_type: actionType, action_detail: detail,
  });
}

interface AgentCtx {
  sessionId: string;
  repo: RepoSession;
  log: ToolCallLogEntry[];
  patterns: IssuePatternMatch[];
  send: SendFn;
}

// ── Tool dispatcher ───────────────────────────────────────────────────
async function dispatch(name: string, input: any, ctx: AgentCtx): Promise<unknown> {
  switch (name) {
    case "list_files": {
      const files = await ctx.repo.listFiles(input.path_prefix);
      logTool(ctx.log, name, input, `${files.length} files`);
      return { files: files.slice(0, 500) };
    }
    case "read_file": {
      const content = await ctx.repo.readFile(input.path);
      logTool(ctx.log, name, input, content ? `${content.length} chars` : "not found");
      return content === null ? { error: "File not found" } : { path: input.path, content };
    }
    case "search_code": {
      const matches = await ctx.repo.searchCode(input.query);
      logTool(ctx.log, name, input, `${matches.length} matches`);
      return { matches };
    }
    case "get_vercel_logs": {
      try {
        const logs = await getRecentLogs({ query: input.query, limit: input.limit ?? 50 });
        logTool(ctx.log, name, input, `${logs.length} lines`);
        return { logs };
      } catch (e: any) {
        logTool(ctx.log, name, input, `error: ${e.message}`);
        return { error: e.message };
      }
    }
    case "query_supabase_schema": {
      const { data, error } = await supabaseAdmin.rpc("admin_introspect_schema", { p_table: input.table ?? null });
      logTool(ctx.log, name, input, error ? `error: ${error.message}` : `${(data || []).length} columns`);
      return error ? { error: error.message } : { columns: data };
    }
    case "recall_memory": {
      const results = await searchMemory(input.tags ?? [], input.files ?? []);
      logTool(ctx.log, name, input, `${results.length} entries`);
      return { memories: results.map((m) => ({ memory_type: m.memory_type, title: m.title, summary: m.summary, outcome: m.outcome, confidence: m.confidence, created_at: m.created_at })) };
    }
    case "match_issue_pattern": {
      const matches = await matchIssuePattern(input.description);
      logTool(ctx.log, name, input, `${matches.length} matches`);
      return { matches };
    }
    case "get_file_intelligence": {
      const intel = await getFileIntelligence(input.file_paths ?? []);
      logTool(ctx.log, name, input, `${intel.length} files`);
      return { file_intelligence: intel };
    }
    case "propose_patch": {
      const { file_path: filePath, action, new_content: newContent, explanation } = input;
      let oldContent: string | null = null;
      if (action !== "create") {
        const existing = await getFileContent(filePath);
        oldContent = existing?.content ?? null;
      }
      const diffText = generateUnifiedDiff(oldContent ?? "", action === "delete" ? "" : (newContent ?? ""), filePath);
      const { data: patch, error } = await supabaseAdmin
        .from("ai_engineer_patches")
        .insert({ session_id: ctx.sessionId, file_path: filePath, action, old_content: oldContent, new_content: action === "delete" ? null : (newContent ?? null), diff_text: diffText, explanation, status: "proposed" })
        .select("id")
        .single();
      logTool(ctx.log, name, { file_path: filePath, action }, error ? `error: ${error.message}` : `patch ${patch?.id}`);
      ctx.send("patch_proposed", { file_path: filePath, action, explanation, patch_id: patch?.id });
      return error ? { error: error.message } : { patch_id: patch.id, diff_preview: diffText.slice(0, 2000) };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── Main entry point ──────────────────────────────────────────────────
export async function runAgentSession(sessionId: string, prompt: string, send: SendFn): Promise<void> {
  const repo = new RepoSession();
  const log: ToolCallLogEntry[] = [];

  send("phase", { action: "Recalling memory and historical context..." });
  const { markdown: historicalContext, patternMatches } = await buildHistoricalContext(prompt);
  send("historical_context", { markdown: historicalContext });
  await dbLog(sessionId, "historical_context_built", { patternMatches: patternMatches.length });

  await supabaseAdmin.from("ai_engineer_analysis").insert({
    session_id: sessionId, historical_context: historicalContext, affected_files: [], tool_calls: [],
  });

  const system = `${SYSTEM_PROMPT_BASE}\n\n${historicalContext}`;
  const messages: any[] = [{ role: "user", content: prompt }];
  const ctx: AgentCtx = { sessionId, repo, log, patterns: patternMatches, send };

  // activeProvider persists across iterations — once we fall back to OpenAI,
  // we stay on OpenAI for the rest of the session (no redundant Anthropic retries)
  const activeProvider: { value: Provider } = { value: "anthropic" };
  let completedProvider: Provider = "anthropic";

  let finished = false;
  for (let iter = 0; iter < MAX_ITERATIONS && !finished; iter++) {
    send("phase", { action: `Thinking (step ${iter + 1})...` });

    let result: ProviderResult;
    try {
      result = await callWithFallback(system, messages, send, sessionId, activeProvider);
      completedProvider = result.provider;
    } catch (e: any) {
      // Only reaches here if ALL providers failed or a non-billing error occurred
      send("error", { message: e.message });
      await supabaseAdmin.from("ai_engineer_sessions")
        .update({ status: "failed", error_message: e.message, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      await supabaseAdmin.from("ai_engineer_analysis").update({ tool_calls: log }).eq("session_id", sessionId);
      await writeSessionMemory(sessionId, "failed", { summary: e.message });
      return;
    }

    const response = result.response;
    messages.push({ role: "assistant", content: response.content });

    const toolUses = (response.content || []).filter((b: any) => b.type === "tool_use");
    for (const t of (response.content || []).filter((b: any) => b.type === "text")) {
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
      await dbLog(sessionId, `tool:${block.name}`, { input: block.input });

      if (block.name === "finish_analysis") {
        await finalizeSession(sessionId, block.input, log, historicalContext, patternMatches, prompt, completedProvider);
        send("complete", { root_cause: block.input.root_cause, summary: block.input.summary, provider: completedProvider });
        finished = true;
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Analysis finalized." });
        break;
      }

      const out = await dispatch(block.name, block.input, ctx);
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out).slice(0, 12000) });
    }

    if (!finished) messages.push({ role: "user", content: toolResults });
  }

  if (!finished) {
    const msg = "Investigation did not conclude within the step limit.";
    send("error", { message: msg });
    await supabaseAdmin.from("ai_engineer_sessions")
      .update({ status: "failed", error_message: msg, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    await writeSessionMemory(sessionId, "failed", { summary: msg });
  }
}

// ── Session finalize ──────────────────────────────────────────────────
async function finalizeSession(
  sessionId: string, input: any, log: ToolCallLogEntry[],
  historicalContext: string, patternMatches: IssuePatternMatch[],
  prompt: string, completedProvider: Provider,
) {
  const affectedFiles: string[] = input.affected_files ?? [];
  const tags: string[] = input.memory_tags ?? [];

  await supabaseAdmin.from("ai_engineer_analysis")
    .update({ root_cause: input.root_cause, affected_files: affectedFiles, full_report: input.full_report, tool_calls: log })
    .eq("session_id", sessionId);

  const { count } = await supabaseAdmin.from("ai_engineer_patches")
    .select("id", { count: "exact", head: true }).eq("session_id", sessionId);

  const status = (count ?? 0) > 0 ? "awaiting_approval" : "analysis_complete";
  const providerLabel = completedProvider.toUpperCase();

  await supabaseAdmin.from("ai_engineer_sessions")
    .update({ status, summary: `[${providerLabel}] ${input.summary}`, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  await writeSessionMemory(sessionId, "analysis_complete", { rootCause: input.root_cause, summary: input.summary, affectedFiles, tags });

  const topMatch = patternMatches[0] ?? null;
  await recordIssuePattern({
    prompt,
    title: input.summary?.slice(0, 120) ?? input.root_cause?.slice(0, 120) ?? "Untitled issue",
    rootCause: input.root_cause, affectedFiles, tags, matched: topMatch,
  });

  const fileNotes: any[] = input.file_notes ?? [];
  const noteByPath = new Map(fileNotes.map((n: any) => [n.path, n]));
  await upsertFileIntelligence(
    affectedFiles.map((path) => {
      const note = noteByPath.get(path);
      return { file_path: path, purpose: note?.purpose, related_features: note?.related_features ?? [], related_tables: note?.related_tables ?? [], common_bugs: [{ description: input.root_cause }] };
    })
  );
}
