"use client";
// components/workspace/DeployPanel.tsx
// Krypton AI — One-Click Deploy Panel
// Vercel + Netlify integration
// Download + Share

import { useState } from "react";

interface DeployPanelProps {
  html:        string;
  projectName: string;
  projectId?:  string;
}

type DeployStatus = "idle" | "deploying" | "success" | "error";

const C = {
  bg:      "#090909",
  card:    "#0D0D0D",
  border:  "rgba(255,215,0,0.08)",
  text:    "#FFFFFF",
  sub:     "#94A3B8",
  muted:   "#4A5568",
  grad:    "linear-gradient(135deg,#FFD700,#FF7A00)",
  green:   "#00D084",
  red:     "#EF4444",
};

function DeployButton({
  icon, label, sublabel, onClick, status, deployUrl, color,
}: {
  icon: string;
  label: string;
  sublabel: string;
  onClick: () => void;
  status: DeployStatus;
  deployUrl?: string;
  color: string;
}) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${status === "success" ? "rgba(0,208,132,.2)" : C.border}`,
      borderRadius: 12,
      padding: "14px 16px",
      transition: "all .2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: status === "success" ? 10 : 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}15`,
          border: `1px solid ${color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{label}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{sublabel}</div>
        </div>
        <button
          onClick={onClick}
          disabled={status === "deploying" || !true}
          style={{
            padding: "7px 14px",
            background: status === "success" ? "rgba(0,208,132,.12)" : C.grad,
            border: status === "success" ? "1px solid rgba(0,208,132,.25)" : "none",
            borderRadius: 8,
            color: status === "success" ? C.green : "#050505",
            fontSize: 12, fontWeight: 700,
            cursor: status === "deploying" ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6,
            transition: "all .2s",
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >
          {status === "deploying" && (
            <div style={{
              width: 12, height: 12, borderRadius: "50%",
              border: "2px solid rgba(5,5,5,.3)",
              borderTopColor: "#050505",
              animation: "spin .8s linear infinite",
            }}/>
          )}
          {status === "success" ? "✓ Live" : status === "deploying" ? "Deploying..." : "Deploy"}
        </button>
      </div>

      {status === "success" && deployUrl && (
        <div style={{
          padding: "8px 10px",
          background: "rgba(0,208,132,.05)",
          borderRadius: 8,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ color: C.green, fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            🔗 {deployUrl}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(deployUrl)}
            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}
          >
            Copy
          </button>
          <a
            href={deployUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.green, fontSize: 11, textDecoration: "none" }}
          >
            ↗ Open
          </a>
        </div>
      )}

      {status === "error" && (
        <div style={{
          padding: "8px 10px",
          background: "rgba(239,68,68,.05)",
          borderRadius: 8,
          fontSize: 11, color: C.red,
          marginTop: 8,
        }}>
          Deploy failed. Check API keys in Settings → Integrations.
        </div>
      )}
    </div>
  );
}

export default function DeployPanel({ html, projectName, projectId }: DeployPanelProps) {
  const [vercelStatus, setVercelStatus] = useState<DeployStatus>("idle");
  const [netlifyStatus, setNetlifyStatus] = useState<DeployStatus>("idle");
  const [vercelUrl, setVercelUrl]   = useState("");
  const [netlifyUrl, setNetlifyUrl] = useState("");
  const [copied, setCopied]         = useState(false);

  const slug = projectName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);

  const deployToVercel = async () => {
    if (!html) return;
    setVercelStatus("deploying");
    try {
      const res = await fetch("/api/deploy/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, projectName: slug, projectId }),
      });
      const data = await res.json();
      if (data.url) {
        setVercelUrl(data.url);
        setVercelStatus("success");
      } else {
        setVercelStatus("error");
      }
    } catch {
      setVercelStatus("error");
    }
  };

  const deployToNetlify = async () => {
    if (!html) return;
    setNetlifyStatus("deploying");
    try {
      const res = await fetch("/api/deploy/netlify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, projectName: slug, projectId }),
      });
      const data = await res.json();
      if (data.url) {
        setNetlifyUrl(data.url);
        setNetlifyStatus("success");
      } else {
        setNetlifyStatus("error");
      }
    } catch {
      setNetlifyStatus("error");
    }
  };

  const handleDownload = () => {
    if (!html) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `${slug}.html`;
    a.click();
  };

  const handleShare = async () => {
    if (!html) return;
    const shareUrl = `${window.location.origin}/share/${projectId}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 0" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".08em", padding: "0 14px", marginBottom: 4 }}>
        Deploy
      </div>

      <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Vercel */}
        <DeployButton
          icon="▲"
          label="Deploy to Vercel"
          sublabel="Instant global CDN"
          onClick={deployToVercel}
          status={vercelStatus}
          deployUrl={vercelUrl}
          color="#fff"
        />

        {/* Netlify */}
        <DeployButton
          icon="◆"
          label="Deploy to Netlify"
          sublabel="Free hosting included"
          onClick={deployToNetlify}
          status={netlifyStatus}
          deployUrl={netlifyUrl}
          color="#00D2BE"
        />

        {/* Download */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleDownload}
            disabled={!html}
            style={{
              flex: 1, padding: "9px 0",
              background: "rgba(255,255,255,.04)",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              color: html ? C.sub : C.muted,
              fontSize: 12, fontWeight: 600,
              cursor: html ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontFamily: "inherit",
              transition: "all .15s",
            }}
            onMouseEnter={e => { if (html) e.currentTarget.style.borderColor = "rgba(255,215,0,.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
          >
            ⬇ Download
          </button>

          <button
            onClick={handleShare}
            disabled={!projectId}
            style={{
              flex: 1, padding: "9px 0",
              background: copied ? "rgba(0,208,132,.08)" : "rgba(255,255,255,.04)",
              border: `1px solid ${copied ? "rgba(0,208,132,.2)" : C.border}`,
              borderRadius: 10,
              color: copied ? C.green : C.sub,
              fontSize: 12, fontWeight: 600,
              cursor: projectId ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontFamily: "inherit",
              transition: "all .15s",
            }}
          >
            {copied ? "✓ Copied" : "🔗 Share"}
          </button>
        </div>

        {!html && (
          <p style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "8px 0" }}>
            Generate a project first to deploy
          </p>
        )}
      </div>
    </div>
  );
}
