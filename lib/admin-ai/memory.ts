// lib/admin-ai/memory.ts
// Memory recall, "Historical Context" generation, file-intelligence
// upserts, issue-pattern matching/recording, and write-back at the end
// of every session.

import { supabaseAdmin } from "./supabase-admin";
import type {
  AiEngineerMemory,
  AiEngineerFileIntelligence,
  AiEngineerIssuePattern,
  MemoryType,
  SessionStatus,
} from "./types";

export const CONTROLLED_TAGS = [
  "persistence",
  "game-generation",
  "dashboard",
  "timeout",
  "db-schema",
  "vercel-logs",
  "supabase-findings",
] as const;

// ── Retrieval ─────────────────────────────────────────────────────

export interface RankedMemory extends AiEngineerMemory {
  match_score: number;
  confidence: number;
  rank_score: number;
}

export async function searchMemory(tags: string[], files: string[] = [], limit = 8): Promise<RankedMemory[]> {
  const { data, error } = await supabaseAdmin.rpc("ai_engineer_search_memory", {
    p_tags: tags,
    p_files: files,
    p_limit: limit,
  });
  if (error) {
    console.error("[admin-ai][memory] searchMemory failed:", error.message);
    return [];
  }
  return (data || []) as RankedMemory[];
}

export interface IssuePatternMatch extends AiEngineerIssuePattern {
  similarity: number;
}

export async function matchIssuePattern(description: string, threshold = 0.7, limit = 5): Promise<IssuePatternMatch[]> {
  const { data, error } = await supabaseAdmin.rpc("ai_engineer_match_issue_pattern", {
    p_description: description,
    p_threshold: threshold,
    p_limit: limit,
  });
  if (error) {
    console.error("[admin-ai][memory] matchIssuePattern failed:", error.message);
    return [];
  }
  return (data || []) as IssuePatternMatch[];
}

export async function getFileIntelligence(filePaths: string[]): Promise<AiEngineerFileIntelligence[]> {
  if (filePaths.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("ai_engineer_file_intelligence")
    .select("*")
    .in("file_path", filePaths);
  if (error) {
    console.error("[admin-ai][memory] getFileIntelligence failed:", error.message);
    return [];
  }
  return (data || []) as AiEngineerFileIntelligence[];
}

// ── Keyword extraction (prompt -> tags, for the initial recall pass) ─

const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","to","of","in","on",
  "for","and","or","why","how","what","fix","issue","bug","problem","please",
  "user","users","not","does","do","can","this","that","it","not","with",
]);

export function extractKeywords(prompt: string): string[] {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const tags = new Set<string>(words);

  // Map common phrasing onto the controlled vocabulary
  const text = prompt.toLowerCase();
  if (/(save|persist|project.*not.*appear|total projects)/.test(text)) tags.add("persistence");
  if (/(game|mario|platformer|sprite|canvas)/.test(text)) tags.add("game-generation");
  if (/(dashboard|recent projects)/.test(text)) tags.add("dashboard");
  if (/(504|timeout|time out|slow)/.test(text)) tags.add("timeout");
  if (/(schema|column|table|migration)/.test(text)) tags.add("db-schema");
  if (/(vercel|log)/.test(text)) tags.add("vercel-logs");
  if (/(supabase|rls|policy)/.test(text)) tags.add("supabase-findings");

  return Array.from(tags);
}

// ── Historical Context builder ───────────────────────────────────────

export async function buildHistoricalContext(prompt: string): Promise<{
  markdown: string;
  patternMatches: IssuePatternMatch[];
  memories: RankedMemory[];
  fileIntel: AiEngineerFileIntelligence[];
}> {
  const tags = extractKeywords(prompt);
  const patternMatches = await matchIssuePattern(prompt);
  const memories = await searchMemory(tags, []);

  const allFiles = new Set<string>();
  for (const m of memories) for (const f of m.affected_files) allFiles.add(f);
  for (const p of patternMatches) for (const f of p.affected_files) allFiles.add(f);

  const fileIntel = await getFileIntelligence(Array.from(allFiles));

  const lines: string[] = ["## Historical Context", ""];

  if (patternMatches.length > 0) {
    lines.push("### Issue pattern match");
    for (const p of patternMatches) {
      lines.push(
        `**[${Math.round(p.similarity * 100)}% similar]** "${p.title}" ` +
        `(seen ${p.recurrence_count} time${p.recurrence_count === 1 ? "" : "s"}, ` +
        `last: ${new Date(p.last_seen_at).toISOString().slice(0, 10)}, fix_result: ${p.fix_result})`
      );
      if (p.affected_files.length) lines.push(`Affected files: ${p.affected_files.join(", ")}`);
      if (p.fix_applied) lines.push(`Previous fix: ${p.fix_applied}`);
    }
    lines.push("");
  } else {
    lines.push("### Issue pattern match", "*(no pattern ≥70% similar found)*", "");
  }

  if (memories.length > 0) {
    lines.push("### Similar issues found");
    lines.push("| When | Type | Title | Confidence |", "|---|---|---|---|");
    for (const m of memories) {
      lines.push(
        `| ${new Date(m.created_at).toISOString().slice(0, 10)} | ${m.memory_type} | ${m.title} | ${m.confidence.toFixed(2)} |`
      );
    }
    lines.push("");

    const failed = memories.filter((m) => m.memory_type === "fix_failed");
    if (failed.length > 0) {
      lines.push("### Previous failures — DO NOT REPEAT");
      for (const f of failed) {
        lines.push(`- **[fix_failed, ${new Date(f.created_at).toISOString().slice(0, 10)}]** ${f.title} — ${f.outcome ?? f.summary}`);
      }
      lines.push("");
    }

    const applied = memories.filter((m) => m.memory_type === "fix_applied");
    if (applied.length > 0) {
      lines.push("### Previous fixes attempted");
      for (const a of applied) {
        lines.push(`- **[fix_applied, ${new Date(a.created_at).toISOString().slice(0, 10)}]** ${a.title} — ${a.summary}`);
      }
      lines.push("");
    }

    const deployments = memories.filter((m) => m.memory_type === "deployment");
    if (deployments.length > 0) {
      lines.push("### Related deployments");
      for (const d of deployments) {
        lines.push(`- **[deployment, ${new Date(d.created_at).toISOString().slice(0, 10)}]** ${d.summary}`);
      }
      lines.push("");
    }
  } else {
    lines.push("### Similar issues found", "*(none found)*", "");
  }

  if (fileIntel.length > 0) {
    lines.push("### File intelligence");
    for (const f of fileIntel) {
      lines.push(`**${f.file_path}**`);
      if (f.purpose) lines.push(`- Purpose: ${f.purpose}`);
      if (f.related_features.length) lines.push(`- Related features: ${f.related_features.join(", ")}`);
      if (f.related_tables.length) lines.push(`- Related tables: ${f.related_tables.join(", ")}`);
      if (f.common_bugs.length) lines.push(`- Common bugs (${f.common_bugs.length}): ${f.common_bugs.map((b) => b.description).join("; ")}`);
      if (f.fix_history.length) lines.push(`- Fix history (${f.fix_history.length}): ${f.fix_history.map((h) => h.summary).join("; ")}`);
    }
    lines.push("");
  }

  return { markdown: lines.join("\n"), patternMatches, memories, fileIntel };
}

// ── Write-back ────────────────────────────────────────────────────

export interface MemoryWriteInput {
  memory_type: MemoryType;
  title: string;
  summary: string;
  details?: Record<string, unknown>;
  affected_files?: string[];
  tags?: string[];
  outcome?: string;
}

export async function writeMemory(sessionId: string, entries: MemoryWriteInput[]): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({
    memory_type: e.memory_type,
    title: e.title,
    summary: e.summary,
    details: e.details ?? {},
    affected_files: e.affected_files ?? [],
    tags: e.tags ?? [],
    outcome: e.outcome ?? null,
    source_session_id: sessionId,
  }));
  const { error } = await supabaseAdmin.from("ai_engineer_memory").insert(rows);
  if (error) console.error("[admin-ai][memory] writeMemory failed:", error.message);
}

/** Upserts file-intelligence rows — purpose set once, arrays/jsonb grow via union/append. */
export async function upsertFileIntelligence(entries: Array<{
  file_path: string;
  purpose?: string;
  related_features?: string[];
  related_tables?: string[];
  common_bugs?: Array<{ description: string; memory_id?: string }>;
  fix_history?: Array<{ summary: string; memory_id?: string; commit_sha?: string }>;
  last_modified_commit_sha?: string;
}>): Promise<void> {
  for (const e of entries) {
    const { data: existing } = await supabaseAdmin
      .from("ai_engineer_file_intelligence")
      .select("*")
      .eq("file_path", e.file_path)
      .maybeSingle();

    const now = new Date().toISOString();

    if (!existing) {
      await supabaseAdmin.from("ai_engineer_file_intelligence").insert({
        file_path: e.file_path,
        purpose: e.purpose ?? null,
        related_features: e.related_features ?? [],
        related_tables: e.related_tables ?? [],
        common_bugs: e.common_bugs ?? [],
        fix_history: e.fix_history ?? [],
        last_analyzed_at: now,
        last_modified_commit_sha: e.last_modified_commit_sha ?? null,
      });
      continue;
    }

    const mergedFeatures = Array.from(new Set([...(existing.related_features || []), ...(e.related_features || [])]));
    const mergedTables = Array.from(new Set([...(existing.related_tables || []), ...(e.related_tables || [])]));
    const mergedBugs = [...(existing.common_bugs || []), ...(e.common_bugs || [])];
    const mergedFixes = [...(existing.fix_history || []), ...(e.fix_history || [])];

    await supabaseAdmin
      .from("ai_engineer_file_intelligence")
      .update({
        purpose: existing.purpose ?? e.purpose ?? null,
        related_features: mergedFeatures,
        related_tables: mergedTables,
        common_bugs: mergedBugs,
        fix_history: mergedFixes,
        last_analyzed_at: now,
        last_modified_commit_sha: e.last_modified_commit_sha ?? existing.last_modified_commit_sha,
        updated_at: now,
      })
      .eq("file_path", e.file_path);
  }
}

/** Records a new issue pattern, or increments recurrence on a matched one. */
export async function recordIssuePattern(opts: {
  prompt: string;
  title: string;
  rootCause: string;
  fixApplied?: string;
  fixResult?: AiEngineerIssuePattern["fix_result"];
  affectedFiles: string[];
  tags: string[];
  relatedMemoryId?: string;
  matched?: IssuePatternMatch | null;
}): Promise<void> {
  const now = new Date().toISOString();
  if (opts.matched) {
    const relatedIds = Array.from(new Set([...(opts.matched.related_memory_ids || []), ...(opts.relatedMemoryId ? [opts.relatedMemoryId] : [])]));
    await supabaseAdmin
      .from("ai_engineer_issue_patterns")
      .update({
        recurrence_count: opts.matched.recurrence_count + 1,
        last_seen_at: now,
        fix_result: opts.fixResult ?? opts.matched.fix_result,
        related_memory_ids: relatedIds,
        updated_at: now,
      })
      .eq("id", opts.matched.id);
    return;
  }

  await supabaseAdmin.from("ai_engineer_issue_patterns").insert({
    title: opts.title,
    symptoms: [opts.prompt],
    symptoms_text: opts.prompt,
    root_cause: opts.rootCause,
    fix_applied: opts.fixApplied ?? null,
    fix_result: opts.fixResult ?? "unverified",
    recurrence_count: 1,
    related_memory_ids: opts.relatedMemoryId ? [opts.relatedMemoryId] : [],
    affected_files: opts.affectedFiles,
    tags: opts.tags,
  });
}

/** Self-learning: adjust a memory entry's verification_score. */
export async function adjustVerification(memoryId: string, delta: number, reason: string, source: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc("ai_engineer_adjust_verification", {
    p_memory_id: memoryId,
    p_delta: delta,
    p_reason: reason,
    p_source: source,
  });
  if (error) {
    console.error("[admin-ai][memory] adjustVerification failed:", error.message);
    return null;
  }
  return data as number;
}

/** Standard write-back at the end of a session, based on its final status. */
export async function writeSessionMemory(sessionId: string, status: SessionStatus, payload: {
  rootCause?: string;
  summary?: string;
  affectedFiles?: string[];
  tags?: string[];
  fixSummary?: string;
  patchIds?: string[];
  commitSha?: string;
  deploymentOutcome?: string;
  verificationReport?: string;
  rollbackReason?: string;
}): Promise<void> {
  const files = payload.affectedFiles ?? [];
  const tags = payload.tags ?? [];

  if (status === "analysis_complete") {
    await writeMemory(sessionId, [
      { memory_type: "audit", title: payload.summary ?? "Audit", summary: payload.summary ?? "", affected_files: files, tags, details: { session_outcome: "no_fix_needed" } },
      ...(payload.rootCause ? [{ memory_type: "root_cause" as const, title: payload.rootCause.slice(0, 120), summary: payload.rootCause, affected_files: files, tags }] : []),
    ]);
  } else if (status === "completed") {
    await writeMemory(sessionId, [
      { memory_type: "fix_applied", title: payload.fixSummary?.slice(0, 120) ?? "Fix applied", summary: payload.fixSummary ?? "", affected_files: files, tags, details: { patch_ids: payload.patchIds ?? [], commit_sha: payload.commitSha, diff_summary: payload.fixSummary } },
      { memory_type: "deployment", title: `Deployment ${payload.commitSha ?? ""}`.trim(), summary: payload.verificationReport ?? "Deployed", affected_files: files, tags, details: { commit_sha: payload.commitSha, outcome: payload.deploymentOutcome ?? "success", verification_report: payload.verificationReport } },
    ]);
  } else if (status === "rolled_back") {
    await writeMemory(sessionId, [
      { memory_type: "rollback", title: `Rollback of ${payload.commitSha ?? "session " + sessionId}`, summary: payload.rollbackReason ?? "Rolled back", affected_files: files, tags, details: { reverted_commit_sha: payload.commitSha, reverted_patch_ids: payload.patchIds ?? [], reason: payload.rollbackReason } },
      { memory_type: "fix_failed", title: (payload.fixSummary ?? "Fix").slice(0, 120) + " (rolled back)", summary: payload.rollbackReason ?? "Rolled back after deployment", affected_files: files, tags, outcome: payload.rollbackReason },
    ]);
  } else if (status === "failed") {
    await writeMemory(sessionId, [
      { memory_type: "audit", title: payload.summary ?? "Session failed", summary: payload.summary ?? "", affected_files: files, tags, details: { session_outcome: "failed" } },
    ]);
  }
}
          
