"use client";

const T = {
  gold: "#F5D800", green: "#00CC44", bg: "#050505", card: "#0D0D0D",
  border: "rgba(245,197,66,0.12)", text: "#FFFFFF", muted: "#6B7280", red: "#ef4444",
};

export default function DiffViewer({ diffText }: { diffText: string }) {
  if (!diffText) return <div style={{ color: T.muted, fontSize: 13 }}>No diff available.</div>;

  const lines = diffText.split("\n");

  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        background: "#0a0a0a",
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.6,
        overflowX: "auto",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      {lines.map((line, i) => {
        let color = T.muted;
        let bg = "transparent";
        if (line.startsWith("+++") || line.startsWith("---")) {
          color = T.gold;
        } else if (line.startsWith("+")) {
          color = T.green;
          bg = "rgba(0,204,68,0.08)";
        } else if (line.startsWith("-")) {
          color = T.red;
          bg = "rgba(239,68,68,0.08)";
        } else if (line.startsWith("@@")) {
          color = "#8b9bff";
        } else {
          color = "#9CA3AF";
        }
        return (
          <div key={i} style={{ color, background: bg, whiteSpace: "pre-wrap", padding: "0 4px" }}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

