"use client";
// components/VersionHistory.tsx
// Krypton AI — Version History Panel
// Supabase se versions load, save, restore karta hai

import { useState, useEffect, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface Version {
  id: string;
  version_number: number;
  message: string;
  type: "auto" | "manual" | "pre-deploy" | "restore";
  size_bytes: number;
  created_at: string;
  code_snapshot: Record<string, string>;
}

interface Props {
  projectId: string;
  currentCode: Record<string, string>;
  onRestore: (code: Record<string, string>, version: Version) => void;
}

const typeLabel: Record<string, { label: string; color: string; icon: string }> = {
  auto:       { label: "Auto-save",   color: "#555",    icon: "⟳" },
  manual:     { label: "Saved",       color: "#00D084", icon: "✓" },
  "pre-deploy": { label: "Pre-deploy", color: "#F5C542", icon: "🚀" },
  restore:    { label: "Restored",    color: "#7C3AED", icon: "↩" },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24)  return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function VersionHistory({ projectId, currentCode, onRestore }: Props) {
  const supabase = createClientComponentClient();
  const [versions, setVersions]     = useState<Version[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [restoring, setRestoring]   = useState<string | null>(null);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [saveMsg, setSaveMsg]       = useState("");

  // ── Load versions ──────────────────────────────────────────────
  const loadVersions = useCallback(async () => {
    const { data, error } = await supabase
      .from("project_versions")
      .select("*")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(50);

    if (!error && data) setVersions(data as Version[]);
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  // ── Auto-save every 30 seconds ─────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      saveVersion("auto", "Auto-saved");
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCode]);

  // ── Save version ───────────────────────────────────────────────
  const saveVersion = async (type: Version["type"] = "manual", msg?: string) => {
    if (saving) return;
    setSaving(true);

    const codeStr = JSON.stringify(currentCode);
    const nextNum = versions.length > 0 ? versions[0].version_number + 1 : 1;
    const message = msg || `Version ${nextNum}`;

    const { data, error } = await supabase
      .from("project_versions")
      .insert({
        project_id: projectId,
        version_number: nextNum,
        code_snapshot: currentCode,
        message,
        type,
        size_bytes: new Blob([codeStr]).size,
      })
      .select()
      .single();

    if (!error && data) {
      setVersions((prev) => [data as Version, ...prev]);
      if (type === "manual") {
        setSaveMsg("Version saved!");
        setTimeout(() => setSaveMsg(""), 2500);
      }
    }
    setSaving(false);
  };

  // ── Restore version ────────────────────────────────────────────
  const restoreVersion = async (version: Version) => {
    setRestoring(version.id);
    // Save current as a checkpoint before restoring
    await saveVersion("restore", `Before restoring v${version.version_number}`);
    onRestore(version.code_snapshot, version);
    setRestoring(null);
  };

  // ── Delete version ─────────────────────────────────────────────
  const deleteVersion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("project_versions").delete().eq("id", id);
    setVersions((prev) => prev.filter((v) => v.id !== id));
  };

  return (
    <>
      <style>{`
        .vh { 
          width: 100%; font-family: 'DM Sans', sans-serif;
          background: #0a0a0a; color: #e8e8e8;
        }

        /* Header */
        .vh-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 18px; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .vh-title { font-size: 13.5px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
        .vh-count {
          background: rgba(245,197,66,0.12); color: #F5C542;
          font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px;
        }
        .vh-save-btn {
          padding: 7px 14px; border-radius: 8px;
          background: rgba(0,208,132,0.1); border: 1px solid rgba(0,208,132,0.3);
          color: #00D084; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.18s;
          display: flex; align-items: center; gap: 6px;
        }
        .vh-save-btn:hover { background: rgba(0,208,132,0.18); }
        .vh-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Save feedback */
        .vh-feedback {
          padding: 8px 18px; background: rgba(0,208,132,0.08);
          border-bottom: 1px solid rgba(0,208,132,0.15);
          font-size: 12px; color: #00D084; font-weight: 500;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }

        /* List */
        .vh-list { overflow-y: auto; max-height: calc(100vh - 200px); }
        .vh-empty {
          padding: 40px 20px; text-align: center; color: #444; font-size: 13px;
        }

        /* Version row */
        .vh-row {
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s; cursor: pointer;
        }
        .vh-row:hover { background: rgba(255,255,255,0.02); }
        .vh-row.open { background: rgba(245,197,66,0.04); }

        .vh-row-main {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 18px;
        }

        /* Version badge */
        .vh-ver-badge {
          flex-shrink: 0; width: 36px; height: 36px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800; background: rgba(255,255,255,0.05);
          color: #888; border: 1px solid rgba(255,255,255,0.07);
        }

        /* Info */
        .vh-info { flex: 1; min-width: 0; }
        .vh-msg {
          font-size: 13px; font-weight: 600; color: #e8e8e8;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .vh-meta {
          display: flex; align-items: center; gap: 8px; margin-top: 3px;
        }
        .vh-type-badge {
          font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 4px;
        }
        .vh-time { font-size: 11px; color: #444; }
        .vh-size { font-size: 11px; color: #333; }

        /* Actions */
        .vh-actions {
          display: flex; align-items: center; gap: 6px; opacity: 0;
          transition: opacity 0.15s;
        }
        .vh-row:hover .vh-actions { opacity: 1; }

        .vh-restore-btn {
          padding: 5px 12px; border-radius: 6px;
          border: 1px solid rgba(245,197,66,0.3);
          background: rgba(245,197,66,0.08); color: #F5C542;
          font-size: 11.5px; font-weight: 600; cursor: pointer;
          transition: all 0.15s;
        }
        .vh-restore-btn:hover { background: rgba(245,197,66,0.18); }
        .vh-restore-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .vh-del-btn {
          padding: 5px 8px; border-radius: 6px;
          border: 1px solid rgba(239,68,68,0.2);
          background: transparent; color: #555;
          font-size: 11px; cursor: pointer; transition: all 0.15s;
        }
        .vh-del-btn:hover { background: rgba(239,68,68,0.1); color: #ef4444; }

        .vh-chevron {
          color: #444; font-size: 11px; transition: transform 0.2s; flex-shrink: 0;
        }
        .vh-chevron.open { transform: rotate(90deg); }

        /* Expanded diff preview */
        .vh-diff {
          padding: 12px 18px 14px 66px;
          border-top: 1px solid rgba(255,255,255,0.04);
          background: rgba(0,0,0,0.3);
          animation: slideDown 0.2s ease;
        }
        @keyframes slideDown { from { opacity:0; transform:translateY(-4px) } to { opacity:1 } }
        .vh-diff-label { font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
        .vh-diff-files { display: flex; flex-wrap: wrap; gap: 6px; }
        .vh-diff-file {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 5px; padding: 3px 10px; font-size: 11px;
          color: #888; font-family: monospace;
        }

        /* Loading skeleton */
        .vh-skeleton {
          padding: 12px 18px; display: flex; gap: 12px; align-items: center;
        }
        .vh-skel-circle {
          width: 36px; height: 36px; border-radius: 9px;
          background: rgba(255,255,255,0.04); animation: pulse 1.5s infinite;
          flex-shrink: 0;
        }
        .vh-skel-line {
          height: 12px; border-radius: 4px;
          background: rgba(255,255,255,0.04); animation: pulse 1.5s infinite;
        }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
      `}</style>

      <div className="vh">
        {/* Header */}
        <div className="vh-header">
          <div className="vh-title">
            ⏱ Version History
            <span className="vh-count">{versions.length}</span>
          </div>
          <button
            className="vh-save-btn"
            onClick={() => saveVersion("manual")}
            disabled={saving}
          >
            {saving ? "⟳ Saving..." : "💾 Save Version"}
          </button>
        </div>

        {/* Save feedback */}
        {saveMsg && <div className="vh-feedback">✓ {saveMsg}</div>}

        {/* List */}
        <div className="vh-list">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div className="vh-skeleton" key={i}>
                  <div className="vh-skel-circle" />
                  <div style={{ flex: 1 }}>
                    <div className="vh-skel-line" style={{ width: "60%", marginBottom: 8 }} />
                    <div className="vh-skel-line" style={{ width: "40%" }} />
                  </div>
                </div>
              ))}
            </>
          ) : versions.length === 0 ? (
            <div className="vh-empty">
              <div style={{ fontSize: 28, marginBottom: 10 }}>📭</div>
              No versions saved yet.
              <br />
              <span style={{ fontSize: 12 }}>Auto-saves every 30 seconds.</span>
            </div>
          ) : (
            versions.map((v) => {
              const meta = typeLabel[v.type] || typeLabel.auto;
              const isOpen = expanded === v.id;
              const files = Object.keys(v.code_snapshot || {});
              return (
                <div key={v.id} className={`vh-row ${isOpen ? "open" : ""}`}>
                  <div
                    className="vh-row-main"
                    onClick={() => setExpanded(isOpen ? null : v.id)}
                  >
                    {/* Badge */}
                    <div className="vh-ver-badge">v{v.version_number}</div>

                    {/* Info */}
                    <div className="vh-info">
                      <div className="vh-msg">{v.message}</div>
                      <div className="vh-meta">
                        <span
                          className="vh-type-badge"
                          style={{
                            background: `${meta.color}18`,
                            color: meta.color,
                            border: `1px solid ${meta.color}33`,
                          }}
                        >
                          {meta.icon} {meta.label}
                        </span>
                        <span className="vh-time">{timeAgo(v.created_at)}</span>
                        {v.size_bytes > 0 && (
                          <span className="vh-size">{formatSize(v.size_bytes)}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="vh-actions">
                      <button
                        className="vh-restore-btn"
                        disabled={restoring === v.id}
                        onClick={(e) => { e.stopPropagation(); restoreVersion(v); }}
                      >
                        {restoring === v.id ? "⟳" : "↩ Restore"}
                      </button>
                      <button
                        className="vh-del-btn"
                        onClick={(e) => deleteVersion(v.id, e)}
                      >
                        🗑
                      </button>
                    </div>

                    {/* Chevron */}
                    <span className={`vh-chevron ${isOpen ? "open" : ""}`}>▶</span>
                  </div>

                  {/* Expanded files */}
                  {isOpen && (
                    <div className="vh-diff">
                      <div className="vh-diff-label">Files in this version ({files.length})</div>
                      <div className="vh-diff-files">
                        {files.map((f) => (
                          <span key={f} className="vh-diff-file">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

