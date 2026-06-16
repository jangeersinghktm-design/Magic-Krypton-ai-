// lib/admin-ai/diff.ts
// Minimal unified-diff generator (line-based LCS), used by the Diff
// Viewer. No external `diff` package is installed, so this is
// self-contained.

interface DiffLine {
  type: "context" | "add" | "remove";
  text: string;
}

/** Computes a line-level LCS-based diff between two strings. */
function lcsDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;

  // dp[i][j] = length of LCS of oldLines[i:] and newLines[j:]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: "context", text: oldLines[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "remove", text: oldLines[i] });
      i++;
    } else {
      result.push({ type: "add", text: newLines[j] });
      j++;
    }
  }
  while (i < m) { result.push({ type: "remove", text: oldLines[i] }); i++; }
  while (j < n) { result.push({ type: "add", text: newLines[j] }); j++; }
  return result;
}

/**
 * Produces a unified-diff-style text block (with surrounding context
 * lines collapsed via "...") for display in the Diff Viewer.
 */
export function generateUnifiedDiff(oldContent: string, newContent: string, filePath: string, context = 3): string {
  if (oldContent === newContent) return `(no changes to ${filePath})`;

  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  // Cap LCS cost for very large files — fall back to a whole-file diff note.
  if (oldLines.length * newLines.length > 4_000_000) {
    return `--- ${filePath}\n+++ ${filePath}\n@@ file too large for line-diff (${oldLines.length} -> ${newLines.length} lines) @@\n`;
  }

  const diffLines = lcsDiff(oldLines, newLines);

  // Collapse long runs of unchanged context lines.
  const out: string[] = [`--- ${filePath}`, `+++ ${filePath}`];
  let i = 0;
  while (i < diffLines.length) {
    if (diffLines[i].type === "context") {
      let runStart = i;
      while (i < diffLines.length && diffLines[i].type === "context") i++;
      const runLen = i - runStart;
      if (runLen <= context * 2) {
        for (let k = runStart; k < i; k++) out.push(" " + diffLines[k].text);
      } else {
        for (let k = runStart; k < runStart + context; k++) out.push(" " + diffLines[k].text);
        out.push(`@@ ... ${runLen - context * 2} unchanged lines ... @@`);
        for (let k = i - context; k < i; k++) out.push(" " + diffLines[k].text);
      }
    } else {
      const prefix = diffLines[i].type === "add" ? "+" : "-";
      out.push(prefix + diffLines[i].text);
      i++;
    }
  }
  return out.join("\n");
}

export interface FileChangeStats {
  additions: number;
  deletions: number;
}

export function diffStats(oldContent: string, newContent: string): FileChangeStats {
  const diffLines = lcsDiff(oldContent.split("\n"), newContent.split("\n"));
  let additions = 0, deletions = 0;
  for (const l of diffLines) {
    if (l.type === "add") additions++;
    else if (l.type === "remove") deletions++;
  }
  return { additions, deletions };
}

