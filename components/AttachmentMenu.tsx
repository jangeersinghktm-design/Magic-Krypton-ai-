"use client";

// components/AttachmentMenu.tsx
// Real "+" attachment system — shared by Home and Create pages.
// Camera/Photos/Files genuinely open the native file picker and produce
// a real attachment object the caller can send to the AI. Plugins are
// shown honestly disabled (no OAuth credentials configured) rather than
// faking a "connected" state.

import { useEffect, useRef, useState } from "react";

export interface Attachment {
  id: string;
  name: string;
  type: "image" | "pdf" | "text" | "code" | "other";
  mimeType: string;
  size: number;
  dataUrl?: string;   // for images — base64, used for AI vision
  textContent?: string; // for text/code/pdf — extracted text sent to the AI
  previewUrl?: string;  // object URL for thumbnail display
}

const CODE_EXTENSIONS = ["js","jsx","ts","tsx","py","java","c","cpp","cs","go","rb","php","html","css","json","yaml","yml","sql","sh","md"];

function classifyFile(file: File): Attachment["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (CODE_EXTENSIONS.includes(ext)) return "code";
  if (file.type.startsWith("text/") || ext === "txt") return "text";
  return "other";
}

const PLUGINS = [
  { id: "github",  icon: "🐙", label: "GitHub" },
  { id: "figma",   icon: "🎨", label: "Figma" },
  { id: "gdrive",  icon: "📁", label: "Google Drive" },
  { id: "notion",  icon: "📝", label: "Notion" },
  { id: "vercel",  icon: "▲",  label: "Vercel" },
];

export default function AttachmentMenu({ onAttach }: { onAttach: (a: Attachment) => void }) {
  const [open, setOpen] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowPlugins(false); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setShowPlugins(false); } };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClickOutside); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const readFileAsText = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0]; // one attachment at a time — keeps context focused and cost predictable
    setUploading(true);
    const type = classifyFile(file);
    const id = `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

    try {
      if (type === "image") {
        const dataUrl = await readFileAsDataUrl(file);
        onAttach({ id, name: file.name, type, mimeType: file.type, size: file.size, dataUrl, previewUrl: dataUrl });
      } else if (type === "pdf") {
        // Real server-side extraction — not a fake preview.
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/attachments/extract", { method: "POST", body: form });
        const data = await res.json();
        onAttach({ id, name: file.name, type, mimeType: file.type, size: file.size, textContent: data.text || "" });
      } else if (type === "text" || type === "code") {
        const text = await readFileAsText(file);
        onAttach({ id, name: file.name, type, mimeType: file.type, size: file.size, textContent: text.slice(0, 50000) });
      } else {
        onAttach({ id, name: file.name, type: "other", mimeType: file.type, size: file.size, textContent: "" });
      }
    } catch {
      // Fail visibly, not silently — caller can decide how to surface this.
      onAttach({ id, name: file.name, type, mimeType: file.type, size: file.size, textContent: "[Could not read this file]" });
    } finally {
      setUploading(false);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <style>{`
        @keyframes am-dd-in { from{opacity:0; transform:translateY(-6px) scale(.97);} to{opacity:1; transform:translateY(0) scale(1);} }
        @keyframes am-spin { to { transform: rotate(360deg); } }
      `}</style>

      <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Attach a file"
        disabled={uploading}
        style={{
          width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 16, fontWeight: 700,
          cursor: uploading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .15s",
        }}
      >
        {uploading ? <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#F5D800", borderRadius: "50%", animation: "am-spin .7s linear infinite" }} /> : "+"}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", bottom: "calc(100% + 8px)", left: 0, minWidth: 220,
            background: "rgba(13,13,13,0.85)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 6,
            boxShadow: "0 16px 40px rgba(0,0,0,0.55)", zIndex: 50,
            animation: "am-dd-in .15s cubic-bezier(.16,1,.3,1) both",
          }}
        >
          {!showPlugins ? (
            <>
              <MenuItem icon="📷" label="Camera" onClick={() => cameraInputRef.current?.click()} />
              <MenuItem icon="🖼" label="Photos" onClick={() => photoInputRef.current?.click()} />
              <MenuItem icon="📄" label="Files" onClick={() => fileInputRef.current?.click()} />
              <MenuItem icon="🔌" label="Plugins" onClick={() => setShowPlugins(true)} />
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px 8px" }}>
                <button onClick={() => setShowPlugins(false)} style={{ background: "none", border: "none", color: "#8892A0", cursor: "pointer", fontSize: 13, padding: 0 }}>←</button>
                <span style={{ fontSize: 11, color: "#8892A0", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Plugins</span>
              </div>
              {PLUGINS.map(p => (
                <div key={p.id} title="Not yet configured — requires OAuth app credentials for this service" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, opacity: 0.45, cursor: "not-allowed",
                }}>
                  <span style={{ fontSize: 15 }}>{p.icon}</span>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "#fff" }}>{p.label}</span>
                  <span style={{ fontSize: 9.5, color: "#8892A0", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "2px 7px" }}>Not connected</span>
                </div>
              ))}
              <div style={{ padding: "6px 10px 4px", fontSize: 10, color: "#5B6472", lineHeight: 1.5 }}>
                Plugins require OAuth setup with each service's developer credentials — not yet configured for this project.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
        background: "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left",
        transition: "background .12s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#fff" }}>{label}</span>
    </button>
  );
}

