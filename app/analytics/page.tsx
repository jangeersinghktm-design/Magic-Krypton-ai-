"use client";

// app/analytics/page.tsx
// ─────────────────────────────────────────────────────────────────
// Krypton AI — Analysis Center (Claude API powered)
// ─────────────────────────────────────────────────────────────────

import { useState, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────
type Tab = "code" | "seo" | "performance";

interface Issue {
  severity: "error" | "warning" | "info";
  message: string;
}

interface Metric {
  label: string;
  value: string;
  good: boolean;
}

interface Suggestion {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

interface AnalysisResult {
  score: number;
  label: string;
  color: string;
  summary: string;
  issues: Issue[];
  metrics: Metric[];
  suggestions: Suggestion[];
  error?: string;
}

// ── Loading status messages ────────────────────────────────────────
const loadingMessages: Record<Tab, string[]> = {
  code: [
    "🔍 Parsing code structure...",
    "⚡ Checking type safety...",
    "🛡️ Scanning for vulnerabilities...",
    "📊 Calculating complexity score...",
    "✨ Generating recommendations...",
  ],
  seo: [
    "🔍 Scanning HTML structure...",
    "📝 Analyzing keyword density...",
    "🔗 Checking link profile...",
    "📱 Evaluating readability...",
    "✨ Generating SEO report...",
  ],
  performance: [
    "🌐 Resolving domain...",
    "📡 Estimating Core Web Vitals...",
    "⚡ Checking render-blocking resources...",
    "📦 Analyzing bundle patterns...",
    "✨ Building performance audit...",
  ],
};

// ── Score Ring SVG ────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width="134" height="134" viewBox="0 0 134 134">
      {/* Track */}
      <circle cx="67" cy="67" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
      {/* Glow effect */}
      <circle cx="67" cy="67" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 67 67)"
        style={{
          transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.5s",
          filter: `drop-shadow(0 0 6px ${color}66)`,
        }}
      />
      <text x="67" y="63" textAnchor="middle" fill={color}
        fontSize="28" fontWeight="800" fontFamily="DM Sans, sans-serif">{score}</text>
      <text x="67" y="79" textAnchor="middle" fill="#444"
        fontSize="11" fontFamily="DM Sans, sans-serif">/ 100</text>
    </svg>
  );
}

// ── Priority colors ───────────────────────────────────────────────
const priColor = { high: "#ef4444", medium: "#F5C542", low: "#00D084" };
const sevColor = { error: "#ef4444", warning: "#F5C542", info: "#00D084" };
const sevIcon  = { error: "✖", warning: "⚠", info: "ℹ" };

// ── API Call ──────────────────────────────────────────────────────
async function runClaudeAnalysis(type: Tab, input: string): Promise<AnalysisResult> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, input }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Analysis failed");
  return data as AnalysisResult;
}

// ── Main Page ──────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [tab, setTab]       = useState<Tab>("code");
  const [input, setInput]   = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [loadMsg, setLoadMsg]   = useState("");
  const [error, setError]       = useState("");
  const [copied, setCopied]     = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Config per tab
  const tabConfig = {
    code: {
      label: "Code Analysis",
      icon: "⚡",
      hint: "Paste any code — JS, TS, Python, React, Go...",
      placeholder:
        "// Paste your code here...\nfunction greet(name: any) {\n  console.log('Hello ' + name);\n  // TODO: fix this\n}",
    },
    seo: {
      label: "SEO Analysis",
      icon: "🔍",
      hint: "Paste page content, HTML, article text, or meta tags.",
      placeholder:
        "Paste your page content, HTML, or meta tags here...\n\n<h1>My AI Tool</h1>\n<meta name='description' content='...'>\n\nThis is the body content of my page...",
    },
    performance: {
      label: "Performance",
      icon: "📊",
      hint: "Enter your website URL for an AI-powered audit.",
      placeholder: "https://yourwebsite.com",
    },
  };

  // ── Rotate loading messages
  const startLoadingMessages = (t: Tab) => {
    const msgs = loadingMessages[t];
    let i = 0;
    setLoadMsg(msgs[0]);
    msgIntervalRef.current = setInterval(() => {
      i = (i + 1) % msgs.length;
      setLoadMsg(msgs[i]);
    }, 1800);
  };
  const stopLoadingMessages = () => {
    if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
  };

  // ── Run analysis
  const runAnalysis = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError("");
    startLoadingMessages(tab);
    try {
      const res = await runClaudeAnalysis(tab, input);
      setResult(res);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
    } finally {
      stopLoadingMessages();
      setLoading(false);
    }
  };

  // ── Copy report to clipboard
  const copyReport = () => {
    if (!result) return;
    const text = [
      `═══════════════════════════════`,
      `  KRYPTON AI — ${tabConfig[tab].label.toUpperCase()} REPORT`,
      `═══════════════════════════════`,
      `Score: ${result.score}/100  (${result.label})`,
      ``,
      `SUMMARY`,
      result.summary,
      ``,
      `METRICS`,
      ...(result.metrics || []).map(m => `• ${m.label}: ${m.value} ${m.good ? "✓" : "✗"}`),
      ``,
      `ISSUES`,
      ...(result.issues || []).map(i => `[${i.severity.toUpperCase()}] ${i.message}`),
      ``,
      `SUGGESTIONS`,
      ...(result.suggestions || []).map((s, idx) =>
        `${idx + 1}. [${s.priority.toUpperCase()}] ${s.title}\n   ${s.detail}`
      ),
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #050505; color: #e8e8e8; font-family: 'DM Sans', sans-serif; }

        /* ── Page ── */
        .ap { padding: 40px 48px; max-width: 1060px; }

        /* ── Header ── */
        .ap-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase;
          color: #F5C542; font-weight: 700; margin-bottom: 14px;
          background: rgba(245,197,66,0.08); border: 1px solid rgba(245,197,66,0.2);
          padding: 5px 12px; border-radius: 20px;
        }
        .ap-title {
          font-size: 36px; font-weight: 800; color: #fff; line-height: 1.15; margin-bottom: 8px;
        }
        .ap-title span {
          background: linear-gradient(135deg, #F5C542, #00D084);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .ap-sub { font-size: 14px; color: #555; margin-bottom: 34px; }

        /* ── Tabs ── */
        .ap-tabs {
          display: flex; gap: 6px; margin-bottom: 26px;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; padding: 5px;
          width: fit-content;
        }
        .ap-tab {
          padding: 9px 22px; border-radius: 8px; border: none;
          background: transparent; color: #555; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.18s;
          display: flex; align-items: center; gap: 7px; white-space: nowrap;
        }
        .ap-tab:hover { color: #e8e8e8; }
        .ap-tab.active {
          background: linear-gradient(135deg, rgba(245,197,66,0.18), rgba(0,208,132,0.10));
          color: #F5C542;
          box-shadow: 0 2px 12px rgba(245,197,66,0.1);
        }

        /* ── Input zone ── */
        .ap-input-zone {
          background: #0d0d0d;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; overflow: hidden; margin-bottom: 14px;
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .ap-input-zone:focus-within {
          border-color: rgba(245,197,66,0.35);
          box-shadow: 0 0 0 3px rgba(245,197,66,0.06);
        }
        .ap-input-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px 18px; border-bottom: 1px solid rgba(255,255,255,0.04);
          background: rgba(255,255,255,0.015);
        }
        .ap-input-hint { font-size: 12px; color: #555; }
        .ap-clear-btn {
          background: none; border: none; color: #444; font-size: 12px;
          cursor: pointer; padding: 3px 10px; border-radius: 6px;
          transition: all 0.15s;
        }
        .ap-clear-btn:hover { background: rgba(255,255,255,0.05); color: #999; }

        textarea.ap-textarea {
          width: 100%; min-height: 190px; max-height: 400px;
          padding: 16px 18px; background: transparent; border: none; outline: none;
          color: #ccc; font-size: 13px; font-family: 'JetBrains Mono', monospace;
          line-height: 1.75; resize: vertical;
        }
        textarea.ap-textarea::placeholder { color: #333; }

        /* ── Char counter ── */
        .ap-char-bar {
          display: flex; justify-content: flex-end;
          padding: 6px 18px 10px; font-size: 11px; color: #333;
        }

        /* ── Analyze button ── */
        .ap-analyze-btn {
          width: 100%; padding: 15px 0;
          background: linear-gradient(135deg, #F5C542 0%, #e8a800 40%, #00D084 100%);
          border: none; border-radius: 12px;
          color: #000; font-size: 15px; font-weight: 800;
          cursor: pointer; letter-spacing: 0.2px;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          box-shadow: 0 4px 24px rgba(245,197,66,0.2);
        }
        .ap-analyze-btn:hover:not(:disabled) {
          opacity: 0.9; transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(245,197,66,0.3);
        }
        .ap-analyze-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

        /* ── Loading ── */
        .ap-loading {
          display: flex; flex-direction: column; align-items: center;
          gap: 16px; padding: 56px 0; color: #555;
        }
        .ap-spinner {
          width: 38px; height: 38px; border-radius: 50%;
          border: 3px solid rgba(245,197,66,0.12);
          border-top-color: #F5C542;
          animation: spin 0.85s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ap-load-msg {
          font-size: 13.5px; color: #555;
          animation: fadeMsg 0.4s ease;
          text-align: center;
        }
        @keyframes fadeMsg { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; } }

        /* ── Error ── */
        .ap-error {
          margin-top: 20px; padding: 16px 20px;
          background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.25);
          border-radius: 12px; color: #ef4444; font-size: 13.5px;
          display: flex; align-items: center; gap: 10px;
        }

        /* ── Results ── */
        .ap-results { margin-top: 34px; animation: fadeUp 0.4s ease; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; } }

        .ap-results-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 22px;
        }
        .ap-results-title { font-size: 19px; font-weight: 700; color: #fff; }
        .ap-results-time { font-size: 11.5px; color: #3a3a3a; }

        /* ── Score card ── */
        .ap-score-card {
          display: grid; grid-template-columns: 140px 1fr; gap: 24px;
          background: linear-gradient(135deg, rgba(13,13,13,1), rgba(16,16,16,1));
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px; padding: 28px; margin-bottom: 18px;
          align-items: center;
          position: relative; overflow: hidden;
        }
        .ap-score-card::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at 0% 50%, rgba(245,197,66,0.04) 0%, transparent 60%);
          pointer-events: none;
        }
        .ap-score-label {
          font-size: 26px; font-weight: 900; margin-bottom: 8px;
        }
        .ap-score-summary {
          font-size: 13.5px; color: #666; line-height: 1.75;
        }

        /* ── Section header ── */
        .ap-section-hdr {
          font-size: 10.5px; font-weight: 700; letter-spacing: 1.2px;
          text-transform: uppercase; color: #3a3a3a; margin-bottom: 12px;
        }

        /* ── Metrics ── */
        .ap-metrics {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
          gap: 11px; margin-bottom: 22px;
        }
        .ap-metric {
          background: #0d0d0d; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 13px; padding: 16px 18px;
          transition: transform 0.15s, border-color 0.15s;
        }
        .ap-metric:hover { transform: translateY(-1px); }
        .ap-metric-lbl {
          font-size: 10.5px; color: #444; text-transform: uppercase;
          letter-spacing: 0.8px; margin-bottom: 10px; font-weight: 600;
        }
        .ap-metric-val { font-size: 21px; font-weight: 800; }
        .ap-metric-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          margin-left: 6px; vertical-align: middle; margin-bottom: 2px;
        }

        /* ── Issues ── */
        .ap-issues { display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; }
        .ap-issue {
          display: flex; align-items: flex-start; gap: 12px;
          background: #0d0d0d; border-radius: 10px; padding: 13px 16px;
          border-left: 3px solid; transition: background 0.15s;
        }
        .ap-issue:hover { background: rgba(255,255,255,0.02); }
        .ap-issue-icon { font-size: 13px; margin-top: 1px; flex-shrink: 0; font-weight: 700; }
        .ap-issue-msg { font-size: 13px; color: #bbb; line-height: 1.6; }

        /* ── Suggestions ── */
        .ap-suggestions { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
        .ap-suggestion {
          background: #0d0d0d; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; padding: 16px 18px;
          display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: start;
        }
        .ap-sug-pri {
          font-size: 9.5px; font-weight: 800; letter-spacing: 0.8px;
          text-transform: uppercase; padding: 3px 8px; border-radius: 5px;
          white-space: nowrap; margin-top: 1px;
        }
        .ap-sug-title { font-size: 13.5px; font-weight: 700; color: #e8e8e8; margin-bottom: 4px; }
        .ap-sug-detail { font-size: 12.5px; color: #666; line-height: 1.65; }

        /* ── Export ── */
        .ap-export {
          display: flex; gap: 9px; flex-wrap: wrap;
          padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.05);
        }
        .ap-export-btn {
          padding: 9px 18px; border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.09);
          background: transparent; color: #777; font-size: 12.5px;
          cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif;
          font-weight: 500;
        }
        .ap-export-btn:hover { background: rgba(255,255,255,0.05); color: #e8e8e8; }
        .ap-export-btn.copied { color: #00D084; border-color: rgba(0,208,132,0.3); }
      `}</style>

      <main className="ap">

        {/* ── Header ── */}
        <div className="ap-badge">⚡ Krypton AI — Analysis Center</div>
        <h1 className="ap-title">
          AI-Powered <span>Analysis</span>
        </h1>
        <p className="ap-sub">
          Real Claude AI analysis — Code quality · SEO health · Performance audits
        </p>

        {/* ── Tabs ── */}
        <div className="ap-tabs">
          {(["code", "seo", "performance"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`ap-tab ${tab === t ? "active" : ""}`}
              onClick={() => { setTab(t); setResult(null); setInput(""); setError(""); }}
            >
              <span>{tabConfig[t].icon}</span>
              {tabConfig[t].label}
            </button>
          ))}
        </div>

        {/* ── Input ── */}
        <div className="ap-input-zone">
          <div className="ap-input-header">
            <span className="ap-input-hint">{tabConfig[tab].hint}</span>
            <button className="ap-clear-btn"
              onClick={() => { setInput(""); setResult(null); setError(""); }}>
              Clear ✕
            </button>
          </div>
          <textarea
            className="ap-textarea"
            placeholder={tabConfig[tab].placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
          <div className="ap-char-bar">
            <span style={{ color: input.length > 10000 ? "#ef4444" : "#3a3a3a" }}>
              {input.length.toLocaleString()} / 12,000
            </span>
          </div>
        </div>

        {/* ── Analyze button ── */}
        <button
          className="ap-analyze-btn"
          disabled={loading || !input.trim() || input.length > 12000}
          onClick={runAnalysis}
        >
          {loading ? (
            <>
              <span style={{
                display: "inline-block", width: 17, height: 17,
                borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)",
                borderTopColor: "#000", animation: "spin 0.85s linear infinite",
              }} />
              Analyzing with Claude AI...
            </>
          ) : (
            <>{tabConfig[tab].icon} Run {tabConfig[tab].label}</>
          )}
        </button>

        {/* ── Loading animation ── */}
        {loading && (
          <div className="ap-loading">
            <div className="ap-spinner" />
            <div key={loadMsg} className="ap-load-msg">{loadMsg}</div>
            <div style={{ fontSize: 11, color: "#2a2a2a", marginTop: 4 }}>
              Claude AI is analyzing your input...
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="ap-error">
            <span>⚠</span>
            <div>
              <strong>Analysis failed:</strong> {error}
              <br />
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                Check your ANTHROPIC_API_KEY in .env.local
              </span>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {result && !loading && (
          <div className="ap-results" ref={resultRef}>

            {/* Header row */}
            <div className="ap-results-header">
              <div className="ap-results-title">
                {tabConfig[tab].icon} Analysis Results
              </div>
              <span className="ap-results-time">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {/* Score card */}
            <div className="ap-score-card">
              <ScoreRing score={result.score} color={result.color} />
              <div>
                <div className="ap-score-label" style={{ color: result.color }}>
                  {result.label}
                </div>
                <p className="ap-score-summary">{result.summary}</p>
              </div>
            </div>

            {/* Metrics */}
            {result.metrics?.length > 0 && (
              <>
                <div className="ap-section-hdr">Key Metrics</div>
                <div className="ap-metrics">
                  {result.metrics.map((m) => (
                    <div className="ap-metric" key={m.label}
                      style={{
                        borderColor: m.good
                          ? "rgba(0,208,132,0.18)"
                          : "rgba(239,68,68,0.15)",
                      }}>
                      <div className="ap-metric-lbl">{m.label}</div>
                      <div className="ap-metric-val"
                        style={{ color: m.good ? "#00D084" : "#ef4444" }}>
                        {m.value}
                        <span
                          className="ap-metric-dot"
                          style={{ background: m.good ? "#00D084" : "#ef4444" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Issues */}
            {result.issues?.length > 0 && (
              <>
                <div className="ap-section-hdr">Issues Found</div>
                <div className="ap-issues">
                  {result.issues.map((issue, i) => (
                    <div key={i} className="ap-issue"
                      style={{ borderLeftColor: sevColor[issue.severity] }}>
                      <span className="ap-issue-icon"
                        style={{ color: sevColor[issue.severity] }}>
                        {sevIcon[issue.severity]}
                      </span>
                      <span className="ap-issue-msg">{issue.message}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Suggestions */}
            {result.suggestions?.length > 0 && (
              <>
                <div className="ap-section-hdr">Recommendations</div>
                <div className="ap-suggestions">
                  {result.suggestions.map((s, i) => (
                    <div key={i} className="ap-suggestion">
                      <span className="ap-sug-pri"
                        style={{
                          background: `${priColor[s.priority]}18`,
                          color: priColor[s.priority],
                          border: `1px solid ${priColor[s.priority]}33`,
                        }}>
                        {s.priority}
                      </span>
                      <div>
                        <div className="ap-sug-title">{s.title}</div>
                        <div className="ap-sug-detail">{s.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Export */}
            <div className="ap-export">
              <button
                className={`ap-export-btn ${copied ? "copied" : ""}`}
                onClick={copyReport}>
                {copied ? "✓ Copied!" : "📋 Copy Report"}
              </button>
              <button className="ap-export-btn"
                onClick={() => { setResult(null); runAnalysis(); }}>
                🔄 Re-analyze
              </button>
              <button className="ap-export-btn"
                onClick={() => { setTab("code"); setResult(null); setInput(""); setError(""); }}>
                ← New Analysis
              </button>
            </div>

          </div>
        )}
      </main>
    </>
  );
}
