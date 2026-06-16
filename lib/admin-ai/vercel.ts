// lib/admin-ai/vercel.ts
// Log Analyzer (runtime logs) + deployment status polling.

const VERCEL_API = "https://api.vercel.com";

function vercelHeaders() {
  return { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
}

function teamQuery() {
  return process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : "";
}

export interface VercelLogLine {
  timestamp: number;
  level: string;
  message: string;
  source?: string;
}

/**
 * Fetches recent runtime logs for the project, optionally filtered by a
 * substring (route path, error text, etc). Best-effort: Vercel's logs
 * API surface varies by plan; this targets the most recent deployment's
 * runtime logs.
 */
export async function getRecentLogs(opts: { query?: string; limit?: number } = {}): Promise<VercelLogLine[]> {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) throw new Error("VERCEL_PROJECT_ID env var not set");
  const limit = opts.limit ?? 50;

  // 1. Find the most recent production deployment
  const depRes = await fetch(
    `${VERCEL_API}/v6/deployments?projectId=${projectId}&limit=1&target=production${teamQuery()}`,
    { headers: vercelHeaders() }
  );
  if (!depRes.ok) throw new Error(`Vercel deployments failed: ${depRes.status} ${await depRes.text()}`);
  const depJson = await depRes.json();
  const deployment = depJson.deployments?.[0];
  if (!deployment) return [];

  // 2. Fetch runtime logs for that deployment
  const logRes = await fetch(
    `${VERCEL_API}/v3/deployments/${deployment.uid}/events?limit=${limit}${teamQuery()}`,
    { headers: vercelHeaders() }
  );
  if (!logRes.ok) throw new Error(`Vercel logs failed: ${logRes.status} ${await logRes.text()}`);
  const events = await logRes.json();

  let lines: VercelLogLine[] = (Array.isArray(events) ? events : events.events || [])
    .map((e: any) => ({
      timestamp: e.created ?? e.date ?? 0,
      level: e.type ?? e.level ?? "info",
      message: typeof e.payload?.text === "string" ? e.payload.text : (e.text ?? JSON.stringify(e.payload ?? e)),
      source: e.source,
    }));

  if (opts.query) {
    const q = opts.query.toLowerCase();
    lines = lines.filter((l) => l.message.toLowerCase().includes(q));
  }

  return lines.slice(0, limit);
}

export interface VercelDeploymentStatus {
  id: string;
  state: string; // QUEUED | BUILDING | READY | ERROR | CANCELED
  url?: string;
  createdAt?: number;
}

/**
 * Finds the Vercel deployment corresponding to a given commit SHA and
 * returns its current state. Used to poll build status after /apply.
 */
export async function getDeploymentForCommit(commitSha: string): Promise<VercelDeploymentStatus | null> {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) throw new Error("VERCEL_PROJECT_ID env var not set");

  const res = await fetch(
    `${VERCEL_API}/v6/deployments?projectId=${projectId}&limit=10${teamQuery()}`,
    { headers: vercelHeaders() }
  );
  if (!res.ok) throw new Error(`Vercel deployments failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const match = (json.deployments || []).find(
    (d: any) => d.meta?.githubCommitSha === commitSha || d.meta?.githubCommitSha?.startsWith(commitSha)
  );
  if (!match) return null;

  return { id: match.uid, state: match.state, url: match.url, createdAt: match.createdAt };
}

/** Direct lookup by Vercel deployment id (for re-polling). */
export async function getDeploymentStatus(deploymentId: string): Promise<VercelDeploymentStatus | null> {
  const res = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}${teamQuery() ? "?" + teamQuery().slice(1) : ""}`, {
    headers: vercelHeaders(),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return { id: json.id ?? deploymentId, state: json.readyState ?? json.state, url: json.url, createdAt: json.createdAt };
}

