// lib/admin-ai/types.ts
// Shared types for the Admin AI Engineer system.

export type SessionStatus =
  | "analyzing"
  | "analysis_complete"
  | "patches_proposed"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "backing_up"
  | "applying"
  | "applied"
  | "deploying"
  | "verifying"
  | "completed"
  | "failed"
  | "rolling_back"
  | "rolled_back";

export type PatchAction = "create" | "modify" | "delete";

export type PatchStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "applied"
  | "apply_failed"
  | "rolled_back";

export type MemoryType =
  | "audit"
  | "root_cause"
  | "fix_applied"
  | "fix_failed"
  | "deployment"
  | "rollback";

export interface AiEngineerSession {
  id: string;
  admin_id: string;
  prompt: string;
  status: SessionStatus;
  summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiEngineerAnalysis {
  id: string;
  session_id: string;
  root_cause: string | null;
  affected_files: string[];
  full_report: string | null;
  tool_calls: ToolCallLogEntry[];
  historical_context: string | null;
  created_at: string;
}

export interface AiEngineerPatch {
  id: string;
  session_id: string;
  file_path: string;
  action: PatchAction;
  old_content: string | null;
  new_content: string | null;
  diff_text: string | null;
  explanation: string | null;
  status: PatchStatus;
  applied_commit_sha: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

export interface AiEngineerBackup {
  id: string;
  patch_id: string;
  file_path: string;
  content_before: string | null;
  existed_before: boolean;
  commit_sha_before: string | null;
  created_at: string;
}

export interface AiEngineerAuditEntry {
  id: string;
  session_id: string | null;
  actor: "ai" | "admin" | "system";
  actor_id: string | null;
  action_type: string;
  action_detail: Record<string, unknown>;
  created_at: string;
}

export interface AiEngineerDeployment {
  id: string;
  session_id: string;
  commit_sha: string;
  vercel_deployment_id: string | null;
  deployment_status: "pending" | "building" | "ready" | "error" | "canceled";
  verification_report: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiEngineerMemory {
  id: string;
  memory_type: MemoryType;
  title: string;
  summary: string;
  details: Record<string, unknown>;
  affected_files: string[];
  tags: string[];
  outcome: string | null;
  source_session_id: string | null;
  superseded_by: string | null;
  still_relevant: boolean;
  verification_score: number;
  verification_history: unknown[];
  created_at: string;
}

export interface AiEngineerFileIntelligence {
  id: string;
  file_path: string;
  purpose: string | null;
  related_features: string[];
  related_tables: string[];
  common_bugs: Array<{ description: string; memory_id?: string; first_seen_at?: string }>;
  fix_history: Array<{ memory_id?: string; summary: string; commit_sha?: string; applied_at?: string }>;
  last_analyzed_at: string | null;
  last_modified_commit_sha: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiEngineerIssuePattern {
  id: string;
  title: string;
  symptoms: string[];
  symptoms_text: string;
  root_cause: string | null;
  fix_applied: string | null;
  fix_result: "success" | "failed" | "partial" | "unverified";
  recurrence_count: number;
  related_memory_ids: string[];
  affected_files: string[];
  tags: string[];
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCallLogEntry {
  tool: string;
  input: Record<string, unknown>;
  output_summary: string;
  ts: string;
}

// ── Agent tool definitions (Anthropic tool-use format) ──────────────
export const AGENT_TOOLS = [
  {
    name: "list_files",
    description:
      "List files in the repository, optionally under a given path prefix. Returns file paths only.",
    input_schema: {
      type: "object",
      properties: {
        path_prefix: { type: "string", description: "Optional path prefix, e.g. 'app/api/game'" },
      },
    },
  },
  {
    name: "read_file",
    description: "Read the full current content of a file from the repository.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "File path, e.g. 'app/api/game/route.ts'" } },
      required: ["path"],
    },
  },
  {
    name: "search_code",
    description:
      "Search for a keyword/string across repository files (case-insensitive substring match). Returns matching file paths with matching line numbers and context.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "get_vercel_logs",
    description: "Fetch recent Vercel runtime logs, optionally filtered by a search string (e.g. a route path or error message).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional filter, e.g. '/api/game' or '504'" },
        limit: { type: "number", description: "Max log lines to return (default 50)" },
      },
    },
  },
  {
    name: "query_supabase_schema",
    description: "Get the column list, types, nullability, and defaults for a Supabase table (or all tables if omitted).",
    input_schema: {
      type: "object",
      properties: { table: { type: "string", description: "Optional table name, e.g. 'projects'" } },
    },
  },
  {
    name: "recall_memory",
    description: "Search the AI Engineer's long-term memory for past audits, root causes, fixes, failed fixes, deployments, and rollbacks related to a topic or set of file paths.",
    input_schema: {
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" }, description: "Topic tags to search, e.g. ['persistence','timeout']" },
        files: { type: "array", items: { type: "string" }, description: "File paths to search" },
      },
    },
  },
  {
    name: "match_issue_pattern",
    description: "Check whether this issue matches a previously-seen recurring issue pattern (>=70% text similarity).",
    input_schema: {
      type: "object",
      properties: { description: { type: "string", description: "A description of the current issue/symptoms" } },
      required: ["description"],
    },
  },
  {
    name: "get_file_intelligence",
    description: "Retrieve stored long-term knowledge about specific files (purpose, related tables/features, common bugs, fix history) before scanning them.",
    input_schema: {
      type: "object",
      properties: { file_paths: { type: "array", items: { type: "string" } } },
      required: ["file_paths"],
    },
  },
  {
    name: "propose_patch",
    description:
      "Propose a code change for admin review. This does NOT modify any files — it only records a proposed patch for the admin to approve/reject.",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string" },
        action: { type: "string", enum: ["create", "modify", "delete"] },
        new_content: { type: "string", description: "Full new file content (omit for action='delete')" },
        explanation: { type: "string", description: "Why this change fixes the issue" },
      },
      required: ["file_path", "action", "explanation"],
    },
  },
  {
    name: "finish_analysis",
    description:
      "Call this when investigation is complete. Provide the root cause summary and overall report. This ends the analysis phase.",
    input_schema: {
      type: "object",
      properties: {
        root_cause: { type: "string" },
        summary: { type: "string", description: "One-paragraph summary for the session list" },
        full_report: { type: "string", description: "Full markdown report shown to the admin" },
        affected_files: { type: "array", items: { type: "string" } },
        memory_tags: { type: "array", items: { type: "string" }, description: "Tags to store this session's memory under (use the controlled vocabulary where applicable: persistence, game-generation, dashboard, timeout, db-schema, vercel-logs, supabase-findings)" },
        file_notes: {
          type: "array",
          description: "Optional per-file knowledge to persist into File Intelligence",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              purpose: { type: "string" },
              related_features: { type: "array", items: { type: "string" } },
              related_tables: { type: "array", items: { type: "string" } },
            },
            required: ["path"],
          },
        },
      },
      required: ["root_cause", "summary", "full_report", "affected_files", "memory_tags"],
    },
  },
] as const;

