"use client";
// components/ExportCenter.tsx
// Krypton AI — Export: ZIP, GitHub, Copy Code

import { useState } from "react";
import JSZip from "jszip";

interface Props {
  projectName: string;
  projectId: string;
  code: Record<string, string>;
  framework: string;
  deploymentUrl?: string;
}

const EXPORT_OPTIONS = [
  { id: "zip",      icon: "📦", label: "Download ZIP",     desc: "All files as .zip archive",         free: true },
  { id: "github",   icon: "🐙", label: "Push to GitHub",   desc: "Create/update GitHub repo",          free: false },
  { id: "copy",     icon: "📋", label: "Copy All Code",    desc: "Copy to clipboard",                  free: true },
  { id: "vercel",   icon: "▲",  label: "Deploy to Vercel", desc: "Live URL in 60 seconds",             free: false },
  { id: "html",     icon: "🌐", label: "Export HTML/CSS",  desc: "Static files only",                  free: true },
  { id: "nextjs",   icon: "⚡", label: "Next.js Export",   desc: "Full Next.js project structure",     free: false },
];

export default function ExportCenter({ projectName, projectId, code, framework, deploymentUrl }: Props) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [done, setDone]           = useState<string | null>(null);
  const [githubModal, setGithubModal] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [githubRepo, setGithubRepo]   = useState(projectName.toLowerCase().replace(/\s+/g, "-"));

  const markDone = (id: string) => {
    setDone(id);
    setTimeout(() => setDone(null), 3000);
  };

  // ── ZIP Download ──────────────────────────────────────────────
  const downloadZip = async () => {
    setExporting("zip");
    const zip = new JSZip();
    const folder = zip.folder(projectName) || zip;

    Object.entries(code).forEach(([filename, content]) => {
      folder.file(filename, content);
    });

    // Add README
    folder.file("README.md", `# ${projectName}\n\nGenerated with [Krypton AI](https://kryptonai.tech)\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`);

    // Add package.json if Next.js
    if (framework === "nextjs") {
      folder.file("package.json", JSON.stringify({
        name: projectName.toLowerCase().replace(/\s+/g, "-"),
        version: "0.1.0",
        private: true,
        scripts: { dev: "next dev", build: "next build", start: "next start" },
        dependencies: { next: "14.0.0", react: "^18", "react-dom": "^18" },
        devDependencies: { typescript: "^5", "@types/react": "^18", "@types/node": "^20" },
      }, null, 2));
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "_")}_krypton.zip`;
    a.click();
    URL.revokeObjectURL(url);

    setExporting(null);
    markDone("zip");
  };

  // ── Copy All Code ─────────────────────────────────────────────
  const copyAllCode = async () => {
    setExporting("copy");
    const text = Object.entries(code)
      .map(([file, content]) => `// ═══ ${file} ═══\n${content}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setExporting(null);
    markDone("copy");
  };

  // ── GitHub Push ───────────────────────────────────────────────
  const pushToGitHub = async () => {
    if (!githubToken) return;
    setExporting("github");
    setGithubModal(false);

    try {
      const headers = {
        Authorization: `token ${githubToken}`,
        "Content-Type": "application/json",
      };

      // Create repo
      const repoRes = await fetch("https://api.github.com/user/repos", {
        method: "POST", headers,
        body: JSON.stringify({
          name: githubRepo, description: `Built with Krypton AI`,
          private: false, auto_init: false,
        }),
      });
      const repo = await repoRes.json();
      const repoUrl = repo.full_name;

      // Push each file
      for (const [filename, content] of Object.entries(code)) {
        await fetch(`https://api.github.com/repos/${repoUrl}/contents/${filename}`, {
          method: "PUT", headers,
          body: JSON.stringify({
            message: `Add ${filename} via Krypton AI`,
            content: btoa(unescape(encodeURIComponent(content))),
          }),
        });
      }

      setExporting(null);
      markDone("github");
      alert(`✅ Pushed to github.com/${repoUrl}`);
    } catch {
      alert("GitHub push failed. Check your token and try again.");
      setExporting(null);
    }
  };

  // ── HTML Export ───────────────────────────────────────────────
  const exportHTML = async () => {
    setExporting("html");
    const zip = new JSZip();

    const html = Object.entries(code).find(([k]) => k.endsWith(".html"))?.[1]
      || `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${projectName}</title></head><body>${Object.entries(code).find(([k]) => k.endsWith(".jsx") || k.endsWith(".tsx"))?.[1] || ""}</body></html>`;
    const css = Object.entries(code).filter(([k]) => k.endsWith(".css")).map(([, v]) => v).join("\n");

    zip.file("index.html", html);
    if (css) zip.file("styles.css", css);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}_html.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(null);
    markDone("html");
  };

  // ── Vercel Deploy ─────────────────────────────────────────────
  const deployVercel = async () => {
    setExporting("vercel");
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, projectName, code, framework }),
    });
    const data = await res.json();
    setExporting(null);
    if (data.url) {
      markDone("vercel");
      window.open(`https://${data.url}`, "_blank");
    } else {
      alert(data.error || "Deploy failed");
    }
  };

  const handleExport = (id: string) => {
    if      (id === "zip")    downloadZip();
    else if (id === "copy")   copyAllCode();
    else if (id === "github") setGithubModal(true);
    else if (id === "html")   exportHTML();
    else if (id === "vercel") deployVercel();
  };

  return (
    <>
      <style>{`
        .ec { font-family: 'DM Sans', sans-serif; }
        .ec-title { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 16px; }
        .ec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .ec-card {
          background: #0d0d0d; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 16px; cursor: pointer;
          transition: all 0.18s; position: relative;
          display: flex; flex-direction: column; gap: 8px;
        }
        .ec-card:hover { border-color: rgba(245,197,66,0.25); transform: translateY(-1px); }
        .ec-card.done { border-color: rgba(0,208,132,0.35); }
        .ec-card.loading { opacity: 0.7; cursor: not-allowed; }
        .ec-card-top { display: flex; align-items: center; gap: 10px; }
        .ec-icon { font-size: 22px; }
        .ec-label { font-size: 13.5px; font-weight: 700; color: #fff; }
        .ec-desc { font-size: 11.5px; color: #555; }
        .ec-status {
          font-size: 11px; padding: 3px 8px; border-radius: 5px;
          font-weight: 600; width: fit-content;
        }
        .ec-free { background: rgba(0,208,132,0.1); color: #00D084; }
        .ec-pro  { background: rgba(245,197,66,0.1); color: #F5C542; }
        .ec-done { background: rgba(0,208,132,0.15); color: #00D084; }
        .ec-loading-dot {
          display: inline-block; width: 8px; height: 8px; border-radius: 50%;
          background: #F5C542; animation: pulse 0.8s infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

        /* Deployment URL banner */
        .ec-deployed {
          margin-bottom: 16px; padding: 12px 16px;
          background: rgba(0,208,132,0.07); border: 1px solid rgba(0,208,132,0.2);
          border-radius: 10px; display: flex; align-items: center; gap: 10px;
        }
        .ec-deployed-url {
          font-size: 13px; color: #00D084; flex: 1;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ec-deployed-copy {
          background: none; border: none; color: #555; cursor: pointer;
          font-size: 14px; padding: 4px;
        }

        /* GitHub Modal */
        .ec-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85);
          backdrop-filter: blur(6px); z-index: 1000;
          display: flex; align-items: center; justify-content: center;
        }
        .ec-modal {
          background: #0d0d0d; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 28px; width: 420px;
        }
        .ec-modal-title { font-size: 17px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .ec-modal label { font-size: 12px; color: #555; display: block; margin-bottom: 6px; margin-top: 14px; }
        .ec-modal input {
          width: 100%; padding: 10px 14px; background: #050505;
          border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
          color: #e8e8e8; font-size: 13px; outline: none;
          transition: border-color 0.2s;
        }
        .ec-modal input:focus { border-color: rgba(245,197,66,0.35); }
        .ec-modal-actions { display: flex; gap: 10px; margin-top: 20px; }
        .ec-modal-cancel {
          flex: 1; padding: 10px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          background: transparent; color: #555; cursor: pointer;
        }
        .ec-modal-submit {
          flex: 2; padding: 10px; border-radius: 8px; border: none;
          background: linear-gradient(135deg,#F5C542,#00D084);
          color: #000; font-weight: 700; cursor: pointer;
        }
      `}</style>

      <div className="ec">
        <div className="ec-title">📤 Export Center</div>

        {deploymentUrl && (
          <div className="ec-deployed">
            <span>🚀</span>
            <a href={`https://${deploymentUrl}`} target="_blank" rel="noreferrer"
              className="ec-deployed-url">
              {deploymentUrl}
            </a>
            <button className="ec-deployed-copy"
              onClick={() => navigator.clipboard.writeText(`https://${deploymentUrl}`)}>
              📋
            </button>
          </div>
        )}

        <div className="ec-grid">
          {EXPORT_OPTIONS.map((opt) => {
            const isLoading = exporting === opt.id;
            const isDone    = done === opt.id;
            return (
              <div
                key={opt.id}
                className={`ec-card ${isDone ? "done" : ""} ${isLoading ? "loading" : ""}`}
                onClick={() => !isLoading && !exporting && handleExport(opt.id)}
              >
                <div className="ec-card-top">
                  <span className="ec-icon">{opt.icon}</span>
                  <span className="ec-label">{opt.label}</span>
                </div>
                <div className="ec-desc">{opt.desc}</div>
                <span className={`ec-status ${isDone ? "ec-done" : opt.free ? "ec-free" : "ec-pro"}`}>
                  {isDone ? "✓ Done!" :
                   isLoading ? <><span className="ec-loading-dot" /> Exporting...</> :
                   opt.free ? "Free" : "Pro"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* GitHub Modal */}
      {githubModal && (
        <div className="ec-modal-overlay">
          <div className="ec-modal">
            <div className="ec-modal-title">🐙 Push to GitHub</div>
            <label>GitHub Personal Access Token</label>
            <input
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
            />
            <label>Repository Name</label>
            <input
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="my-krypton-project"
            />
            <div className="ec-modal-actions">
              <button className="ec-modal-cancel" onClick={() => setGithubModal(false)}>Cancel</button>
              <button className="ec-modal-submit" onClick={pushToGitHub} disabled={!githubToken}>
                Push to GitHub →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
