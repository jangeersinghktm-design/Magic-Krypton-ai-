// lib/admin-ai/github.ts
// Repository Scanner + commit writer. All codebase access goes through
// the GitHub REST API — Vercel serverless functions have no writable
// local checkout of the repo.

const GITHUB_API = "https://api.github.com";

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function repoSlug() {
  const repo = process.env.GITHUB_REPO; // "owner/name"
  if (!repo) throw new Error("GITHUB_REPO env var not set");
  return repo;
}

function branch() {
  return process.env.GITHUB_DEFAULT_BRANCH || "main";
}

export interface RepoFile {
  path: string;
  sha: string;
  size: number;
  type: "blob" | "tree";
}

/**
 * Returns the full recursive file tree (paths only, blobs only) for the
 * default branch. Used by list_files / search_code.
 */
export async function getRepoTree(): Promise<RepoFile[]> {
  const url = `${GITHUB_API}/repos/${repoSlug()}/git/trees/${branch()}?recursive=1`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    throw new Error(`GitHub getRepoTree failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const tree: any[] = json.tree || [];
  return tree
    .filter((t) => t.type === "blob")
    .map((t) => ({ path: t.path, sha: t.sha, size: t.size, type: t.type }));
}

/**
 * Reads the current content of a file from the default branch.
 * Returns null if the file doesn't exist.
 */
export async function getFileContent(path: string): Promise<{ content: string; sha: string } | null> {
  const url = `${GITHUB_API}/repos/${repoSlug()}/contents/${encodeURIComponent(path)}?ref=${branch()}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub getFileContent(${path}) failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  if (Array.isArray(json)) throw new Error(`${path} is a directory, not a file`);
  // atob() is Web-standard (available in Vercel Edge); Buffer is Node-only.
  const content = atob(json.content.replace(/\n/g, ""));
  return { content, sha: json.sha };
}

export interface CommitFileChange {
  path: string;
  action: "create" | "modify" | "delete";
  content?: string; // required for create/modify
}

/**
 * Commits one or more file changes to the default branch in a single
 * commit, using the Git Data API (blob -> tree -> commit -> update ref).
 * Returns the new commit SHA.
 */
export async function commitFiles(changes: CommitFileChange[], message: string): Promise<string> {
  const repo = repoSlug();
  const ref = branch();

  // 1. Get the current branch head commit + its tree sha
  const refRes = await fetch(`${GITHUB_API}/repos/${repo}/git/ref/heads/${ref}`, { headers: ghHeaders() });
  if (!refRes.ok) throw new Error(`getRef failed: ${refRes.status} ${await refRes.text()}`);
  const refJson = await refRes.json();
  const baseCommitSha = refJson.object.sha;

  const baseCommitRes = await fetch(`${GITHUB_API}/repos/${repo}/git/commits/${baseCommitSha}`, { headers: ghHeaders() });
  if (!baseCommitRes.ok) throw new Error(`getBaseCommit failed: ${baseCommitRes.status}`);
  const baseCommit = await baseCommitRes.json();
  const baseTreeSha = baseCommit.tree.sha;

  // 2. Create blobs for create/modify changes
  const treeEntries: any[] = [];
  for (const change of changes) {
    if (change.action === "delete") {
      treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const blobRes = await fetch(`${GITHUB_API}/repos/${repo}/git/blobs`, {
      method: "POST",
      headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ content: change.content ?? "", encoding: "utf-8" }),
    });
    if (!blobRes.ok) throw new Error(`createBlob(${change.path}) failed: ${blobRes.status} ${await blobRes.text()}`);
    const blob = await blobRes.json();
    treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  // 3. Create new tree based on the base tree
  const treeRes = await fetch(`${GITHUB_API}/repos/${repo}/git/trees`, {
    method: "POST",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });
  if (!treeRes.ok) throw new Error(`createTree failed: ${treeRes.status} ${await treeRes.text()}`);
  const newTree = await treeRes.json();

  // 4. Create commit
  const commitRes = await fetch(`${GITHUB_API}/repos/${repo}/git/commits`, {
    method: "POST",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] }),
  });
  if (!commitRes.ok) throw new Error(`createCommit failed: ${commitRes.status} ${await commitRes.text()}`);
  const newCommit = await commitRes.json();

  // 5. Update branch ref (this is the "push" — triggers Vercel's auto-deploy)
  const updateRes = await fetch(`${GITHUB_API}/repos/${repo}/git/refs/heads/${ref}`, {
    method: "PATCH",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });
  if (!updateRes.ok) throw new Error(`updateRef failed: ${updateRes.status} ${await updateRes.text()}`);

  return newCommit.sha as string;
}
