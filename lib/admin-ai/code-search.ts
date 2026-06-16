// lib/admin-ai/code-search.ts
// Code Search Engine. Avoids fetching the whole repo: matches file
// PATHS first (cheap), then greps CONTENT for a capped, prioritized
// set of text files, caching fetched content for the rest of the
// session (list_files/read_file/search_code all share this cache).

import { getRepoTree, getFileContent, type RepoFile } from "./github";

const TEXT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".sql", ".md", ".json", ".css"];
const SKIP_DIR_PREFIXES = ["node_modules/", ".next/", ".git/", "public/", "out/"];
const MAX_SEARCH_FILES = 200;
const MAX_MATCHES = 30;

export class RepoSession {
  private tree: RepoFile[] | null = null;
  private contentCache = new Map<string, string>();

  async getTree(): Promise<RepoFile[]> {
    if (!this.tree) this.tree = await getRepoTree();
    return this.tree;
  }

  async listFiles(pathPrefix?: string): Promise<string[]> {
    const tree = await this.getTree();
    return tree
      .map((f) => f.path)
      .filter((p) => !pathPrefix || p.startsWith(pathPrefix))
      .sort();
  }

  async readFile(path: string): Promise<string | null> {
    if (this.contentCache.has(path)) return this.contentCache.get(path)!;
    const file = await getFileContent(path);
    if (!file) return null;
    this.contentCache.set(path, file.content);
    return file.content;
  }

  /** Returns the cached content if we already fetched it (no new fetch). */
  getCached(path: string): string | undefined {
    return this.contentCache.get(path);
  }

  async searchCode(query: string): Promise<Array<{ path: string; line: number; text: string }>> {
    const tree = await this.getTree();
    const q = query.toLowerCase();
    const matches: Array<{ path: string; line: number; text: string }> = [];

    // 1. Path-name matches first (cheap, often the most useful)
    const pathMatches = tree.filter((f) => f.path.toLowerCase().includes(q));
    for (const f of pathMatches) {
      matches.push({ path: f.path, line: 0, text: "(path match)" });
      if (matches.length >= MAX_MATCHES) return matches;
    }

    // 2. Content grep over a capped, prioritized set of text files
    const candidates = tree
      .filter((f) => TEXT_EXTENSIONS.some((ext) => f.path.endsWith(ext)))
      .filter((f) => !SKIP_DIR_PREFIXES.some((p) => f.path.startsWith(p)))
      // prioritize app/ and lib/ — most likely to contain business logic
      .sort((a, b) => {
        const score = (p: string) => (p.startsWith("app/") || p.startsWith("lib/") ? 0 : 1);
        return score(a.path) - score(b.path);
      })
      .slice(0, MAX_SEARCH_FILES);

    for (const f of candidates) {
      const content = await this.readFile(f.path);
      if (!content) continue;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          matches.push({ path: f.path, line: i + 1, text: lines[i].trim().slice(0, 200) });
          if (matches.length >= MAX_MATCHES) return matches;
        }
      }
    }

    return matches;
  }
}

