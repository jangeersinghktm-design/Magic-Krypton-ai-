"use client";
// components/workspace/FileExplorer.tsx
// Krypton AI — File Explorer
// Parses generated HTML into virtual file system
// Shows index.html, styles.css, app.js as separate "files"

import { useState, useMemo } from "react";

interface ProjectFile {
  name:     string;
  language: string;
  icon:     string;
  size:     string;
  content:  string;
  editable: boolean;
}

interface FileExplorerProps {
  html:          string;
  projectName:   string;
  onFileSelect?: (file: ProjectFile) => void;
  onDownload?:   () => void;
  onCopyCode?:   () => void;
  className?:    string;
}

// ── Extract virtual files from HTML ─────────────────────────────
function extractFiles(html: string, projectName: string): ProjectFile[] {
  if (!html) return [];

  const files: ProjectFile[] = [];

  // Extract CSS from <style> tags
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const cssContent = styleMatches
    .map(s => s.replace(/<style[^>]*>/i, "").replace(/<\/style>/i, "").trim())
    .join("\n\n");

  // Extract JS from <script> tags (excluding src attributes)
  const scriptMatches = html.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi) || [];
  const jsContent = scriptMatches
    .map(s => s.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim())
    .filter(s => s.length > 10)
    .join("\n\n");

  // Clean HTML (keep structure, show full file)
  files.push({
    name:     "index.html",
    language: "html",
    icon:     "🌐",
    size:     formatSize(html.length),
    content:  html,
    editable: true,
  });

  if (cssContent.length > 20) {
    files.push({
      name:     "styles.css",
      language: "css",
      icon:     "🎨",
      size:     formatSize(cssContent.length),
      content:  cssContent,
      editable: false,
    });
  }

  if (jsContent.length > 20) {
    files.push({
      name:     "app.js",
      language: "javascript",
      icon:     "⚡",
      size:     formatSize(jsContent.length),
      content:  jsContent,
      editable: false,
    });
  }

  return files;
}

function formatSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Design tokens ────────────────────────────────────────────────
const C = {
  bg:      "#090909",
  surface: "#0D0D0D",
  border:  "rgba(255,215,0,0.08)",
  text:    "#FFFFFF",
  muted:   "#4A5568",
  sub:     "#94A3B8",
  gold:    "#FFD700",
  grad:    "linear-gradient(135deg,#FFD700,#FF7A00)",
};

export default function FileExplorer({
  html,
  projectName,
  onFileSelect,
  onDownload,
  onCopyCode,
}: FileExplorerProps) {
  const [activeFile, setActiveFile] = useState<string>("index.html");
  const [expanded, setExpanded]     = useState(true);
  const [copied, setCopied]         = useState(false);

  const files = useMemo(() => extractFiles(html, projectName), [html, projectName]);
  const totalSize = files.reduce((a, f) => a + f.content.length, 0);

  const handleSelect = (file: ProjectFile) => {
    setActiveFile(file.name);
    onFileSelect?.(file);
  };

  const handleCopy = async () => {
    const file = files.find(f => f.name === activeFile);
    if (!file) return;
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopyCode?.();
  };

  const handleDownloadZip = () => {
    // Download main HTML file
    onDownload?.();
    if (!html) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `${projectName.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: C.bg,
      borderRight: `1px solid ${C.border}`,
      userSelect: "none",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 12px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
      }}>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, padding: 0 }}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: ".08em" }}>
          Files
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: C.muted }}>
          {formatSize(totalSize)}
        </span>
      </div>

      {/* File Tree */}
      {expanded && (
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {files.length === 0 ? (
            <div style={{ padding: "20px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>📁</div>
              <div style={{ fontSize: 12, color: C.muted }}>No files yet</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Generate a project to see files</div>
            </div>
          ) : (
            <>
              {/* Project root */}
              <div style={{ padding: "4px 12px 2px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11 }}>📁</span>
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
                  {projectName || "project"}
                </span>
              </div>

              {/* Files */}
              {files.map(file => (
                <button
                  key={file.name}
                  onClick={() => handleSelect(file)}
                  style={{
                    width: "100%",
                    padding: "6px 12px 6px 24px",
                    background: activeFile === file.name
                      ? "rgba(255,215,0,0.07)"
                      : "transparent",
                    border: "none",
                    borderLeft: activeFile === file.name
                      ? "2px solid #FFD700"
                      : "2px solid transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textAlign: "left",
                    transition: "all .15s",
                  }}
                  onMouseEnter={e => {
                    if (activeFile !== file.name)
                      e.currentTarget.style.background = "rgba(255,255,255,.03)";
                  }}
                  onMouseLeave={e => {
                    if (activeFile !== file.name)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{file.icon}</span>
                  <span style={{
                    fontSize: 12.5,
                    color: activeFile === file.name ? "#FFD700" : C.sub,
                    fontWeight: activeFile === file.name ? 600 : 400,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {file.name}
                  </span>
                  <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>
                    {file.size}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{
        padding: "10px 10px",
        borderTop: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        flexShrink: 0,
      }}>
        <button
          onClick={handleCopy}
          disabled={!html}
          style={{
            padding: "7px 10px",
            background: "rgba(255,255,255,.04)",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            color: copied ? "#00D084" : C.sub,
            fontSize: 12,
            cursor: html ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: 7,
            transition: "all .15s",
            fontFamily: "inherit",
          }}
          onMouseEnter={e => { if (html) e.currentTarget.style.borderColor = "rgba(255,215,0,.25)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
        >
          <span>{copied ? "✓" : "📋"}</span>
          <span>{copied ? "Copied!" : "Copy Code"}</span>
        </button>

        <button
          onClick={handleDownloadZip}
          disabled={!html}
          style={{
            padding: "7px 10px",
            background: html ? "linear-gradient(135deg,#FFD700,#FF7A00)" : "rgba(255,255,255,.04)",
            border: "none",
            borderRadius: 8,
            color: html ? "#050505" : C.muted,
            fontSize: 12,
            fontWeight: html ? 700 : 400,
            cursor: html ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontFamily: "inherit",
          }}
        >
          <span>⬇</span>
          <span>Download HTML</span>
        </button>
      </div>
    </div>
  );
}

