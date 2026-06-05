"use client";
// components/LivePreview.tsx
// Krypton AI — Live Preview with Device Switcher

import { useState, useRef, useEffect } from "react";

type Device = "desktop" | "tablet" | "mobile";

interface Props {
  code: Record<string, string>;  // { "index.html": "...", "styles.css": "..." }
  framework?: string;
}

const deviceSizes: Record<Device, { w: number | string; h: number | string; label: string; icon: string }> = {
  desktop: { w: "100%",  h: "100%", label: "Desktop",  icon: "🖥" },
  tablet:  { w: 768,     h: 1024,   label: "Tablet",   icon: "📱" },
  mobile:  { w: 375,     h: 812,    label: "Mobile",   icon: "📱" },
};

// Build preview HTML from code files
function buildPreviewHTML(code: Record<string, string>): string {
  // Try to find main HTML file
  const htmlFile = Object.entries(code).find(([k]) => k.endsWith(".html"))?.[1];
  const cssFiles = Object.entries(code)
    .filter(([k]) => k.endsWith(".css"))
    .map(([, v]) => v).join("\n");
  const jsFiles = Object.entries(code)
    .filter(([k]) => k.endsWith(".js") && !k.includes(".min."))
    .map(([, v]) => v).join("\n");

  if (htmlFile) {
    // Inject CSS and JS into existing HTML
    return htmlFile
      .replace("</head>", `<style>${cssFiles}</style></head>`)
      .replace("</body>", `<script>${jsFiles}</script></body>`);
  }

  // Build HTML from scratch (for JSX/TSX projects — simplified preview)
  const tsxFile = Object.entries(code).find(([k]) =>
    k.includes("page") && (k.endsWith(".tsx") || k.endsWith(".jsx"))
  )?.[1];

  // Extract basic content from TSX for preview
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Krypton AI Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #fff; color: #111; }
    ${cssFiles}
  </style>
</head>
<body>
  <div id="preview-notice" style="
    background: #1a1a2e; color: #888; font-size: 12px; padding: 8px 16px;
    text-align: center; border-bottom: 1px solid #333;
  ">
    ⚡ Krypton AI Live Preview — React/Next.js components render after deployment
  </div>
  <div style="padding: 24px;">
    <pre style="font-size: 13px; color: #555; font-family: monospace; white-space: pre-wrap; overflow: auto;">
${tsxFile ? tsxFile.slice(0, 2000) + (tsxFile.length > 2000 ? "\n... (truncated)" : "") : "// No previewable content found"}
    </pre>
  </div>
  <script>${jsFiles}</script>
</body>
</html>`;
}

export default function LivePreview({ code, framework = "nextjs" }: Props) {
  const [device, setDevice]     = useState<Device>("desktop");
  const [zoom, setZoom]         = useState(100);
  const [refreshKey, setRefresh] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewHTML = buildPreviewHTML(code);
  const blobUrl = useRef<string>("");

  useEffect(() => {
    // Create blob URL for preview
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    const blob = new Blob([previewHTML], { type: "text/html" });
    blobUrl.current = URL.createObjectURL(blob);
    if (iframeRef.current) iframeRef.current.src = blobUrl.current;

    return () => { if (blobUrl.current) URL.revokeObjectURL(blobUrl.current); };
  }, [previewHTML, refreshKey]);

  const ds = deviceSizes[device];

  return (
    <>
      <style>{`
        .lp { 
          height: 100%; display: flex; flex-direction: column;
          background: #050505; font-family: 'DM Sans', sans-serif;
        }
        .lp.fullscreen {
          position: fixed; inset: 0; z-index: 999;
          background: #050505;
        }

        /* Toolbar */
        .lp-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0; gap: 12px;
        }
        .lp-devices { display: flex; gap: 4px; }
        .lp-device-btn {
          padding: 6px 14px; border-radius: 7px; border: none;
          background: transparent; color: #555; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
          display: flex; align-items: center; gap: 6px;
        }
        .lp-device-btn.active {
          background: rgba(245,197,66,0.1); color: #F5C542;
        }
        .lp-device-btn:hover:not(.active) { background: rgba(255,255,255,0.05); color: #e8e8e8; }

        .lp-actions { display: flex; align-items: center; gap: 8px; }
        .lp-zoom { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #555; }
        .lp-zoom-btn {
          width: 24px; height: 24px; border-radius: 5px; border: none;
          background: rgba(255,255,255,0.05); color: #888; cursor: pointer;
          display: flex; align-items: center; justify-content: center; font-size: 14px;
        }
        .lp-zoom-btn:hover { background: rgba(255,255,255,0.1); }
        .lp-zoom-val { width: 36px; text-align: center; }

        .lp-icon-btn {
          width: 30px; height: 30px; border-radius: 7px; border: none;
          background: rgba(255,255,255,0.05); color: #888; cursor: pointer;
          display: flex; align-items: center; justify-content: center; font-size: 14px;
          transition: all 0.15s;
        }
        .lp-icon-btn:hover { background: rgba(255,255,255,0.1); color: #e8e8e8; }

        /* Canvas */
        .lp-canvas {
          flex: 1; display: flex; align-items: center; justify-content: center;
          overflow: auto; background: #111; padding: 20px;
          background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 20px 20px;
        }

        /* Device frame */
        .lp-frame {
          background: #fff; border-radius: 8px;
          overflow: hidden; box-shadow: 0 25px 80px rgba(0,0,0,0.8);
          transition: all 0.3s ease; position: relative;
          flex-shrink: 0;
        }
        .lp-frame.tablet, .lp-frame.mobile {
          border-radius: 20px;
          border: 8px solid #1a1a1a;
          box-shadow: 0 0 0 2px #333, 0 25px 80px rgba(0,0,0,0.8);
        }

        /* Notch for mobile */
        .lp-notch {
          position: absolute; top: 0; left: 50%;
          transform: translateX(-50%);
          width: 120px; height: 28px; background: #1a1a1a;
          border-radius: 0 0 16px 16px; z-index: 10;
        }

        /* iframe */
        .lp-iframe {
          width: 100%; height: 100%;
          border: none; display: block;
        }

        /* Status bar */
        .lp-status {
          display: flex; align-items: center; gap: 8px; padding: 6px 16px;
          border-top: 1px solid rgba(255,255,255,0.05); font-size: 11px; color: #3a3a3a;
          flex-shrink: 0;
        }
        .lp-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #00D084; }
      `}</style>

      <div className={`lp ${fullscreen ? "fullscreen" : ""}`}>
        {/* Toolbar */}
        <div className="lp-toolbar">
          {/* Device switcher */}
          <div className="lp-devices">
            {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
              <button
                key={d}
                className={`lp-device-btn ${device === d ? "active" : ""}`}
                onClick={() => setDevice(d)}
              >
                <span>{deviceSizes[d].icon}</span>
                {deviceSizes[d].label}
                {d !== "desktop" && (
                  <span style={{ fontSize: 10, color: "#555" }}>
                    {d === "tablet" ? "768px" : "375px"}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="lp-actions">
            {/* Zoom */}
            <div className="lp-zoom">
              <button className="lp-zoom-btn" onClick={() => setZoom(z => Math.max(z - 10, 30))}>−</button>
              <span className="lp-zoom-val">{zoom}%</span>
              <button className="lp-zoom-btn" onClick={() => setZoom(z => Math.min(z + 10, 150))}>+</button>
            </div>

            {/* Refresh */}
            <button className="lp-icon-btn" onClick={() => setRefresh(r => r + 1)} title="Refresh">
              ⟳
            </button>

            {/* Open in new tab */}
            <button className="lp-icon-btn" title="Open in new tab"
              onClick={() => {
                const blob = new Blob([previewHTML], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
              }}>
              ↗
            </button>

            {/* Fullscreen */}
            <button className="lp-icon-btn" onClick={() => setFullscreen(f => !f)} title="Fullscreen">
              {fullscreen ? "⊠" : "⊡"}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="lp-canvas">
          <div
            className={`lp-frame ${device}`}
            style={{
              width: device === "desktop" ? `${zoom}%` : `${Number(ds.w) * (zoom / 100)}px`,
              height: device === "desktop" ? "100%" : `${Number(ds.h) * (zoom / 100)}px`,
              minWidth: device === "desktop" ? 320 : undefined,
              minHeight: device === "desktop" ? 400 : undefined,
            }}
          >
            {device === "mobile" && <div className="lp-notch" />}
            <iframe
              ref={iframeRef}
              className="lp-iframe"
              title="Krypton AI Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>

        {/* Status bar */}
        <div className="lp-status">
          <div className="lp-status-dot" />
          Live Preview · {deviceSizes[device].label} · {zoom}% zoom
          {framework && <span>· {framework}</span>}
        </div>
      </div>
    </>
  );
}
