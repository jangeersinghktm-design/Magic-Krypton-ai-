"use client";
// components/ProjectChat.tsx
// Krypton AI — Project-aware AI Chat with Claude Streaming
// Har project ka dedicated AI context hota hai

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  codeChanges?: Record<string, string>;
  timestamp: Date;
  streaming?: boolean;
}

interface Props {
  projectId: string;
  projectName: string;
  currentCode: Record<string, string>;
  framework: string;
  onApplyChanges: (changes: Record<string, string>) => void;
}

// ── Quick prompt suggestions ──────────────────────────────────────
const quickPrompts = [
  "Add dark mode toggle",
  "Improve the hero section",
  "Add mobile responsiveness",
  "Fix any bugs in the code",
  "Add loading states",
  "Improve SEO meta tags",
  "Add form validation",
  "Make it faster",
];

export default function ProjectChat({
  projectId, projectName, currentCode, framework, onApplyChanges,
}: Props) {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  // ── Textarea auto-resize ──────────────────────────────────────
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // ── Send message ──────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const content = text || input.trim();
    if (!content || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    // Placeholder streaming message
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      streaming: true,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          framework,
          currentCode,
          userMessage: content,
          history: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error("Chat API failed");

      // Stream response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let codeChanges: Record<string, string> | undefined;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text") {
                fullText += data.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: fullText, streaming: true }
                      : m
                  )
                );
              } else if (data.type === "code_changes") {
                codeChanges = data.changes;
              } else if (data.type === "credits") {
                setCreditsUsed((c) => c + data.used);
              }
            } catch {}
          }
        }
      }

      // Finalize message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: fullText, streaming: false, codeChanges }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: "⚠️ Something went wrong. Please try again.",
                streaming: false,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, projectId, projectName, framework, currentCode]);

  // ── Keyboard shortcut ─────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Format message content ────────────────────────────────────
  const formatContent = (content: string) => {
    // Simple code block detection
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.split("\n");
        const lang = lines[0].replace("```", "").trim();
        const code = lines.slice(1, -1).join("\n");
        return (
          <div key={i} style={{
            background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, margin: "8px 0", overflow: "hidden",
          }}>
            {lang && (
              <div style={{
                padding: "4px 12px", background: "rgba(255,255,255,0.03)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: 10, color: "#555", fontFamily: "monospace",
              }}>{lang}</div>
            )}
            <pre style={{
              padding: "12px", margin: 0, fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace", color: "#a8d8a8",
              overflowX: "auto", lineHeight: 1.6,
            }}>{code}</pre>
          </div>
        );
      }
      return (
        <span key={i} style={{ whiteSpace: "pre-wrap" }}>{part}</span>
      );
    });
  };

  return (
    <>
      <style>{`
        .pc { display: flex; flex-direction: column; height: 100%;
          background: #050505; font-family: 'DM Sans', sans-serif; }

        /* Header */
        .pc-header {
          padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0;
        }
        .pc-header-left { display: flex; align-items: center; gap: 10px; }
        .pc-dot {
          width: 8px; height: 8px; border-radius: 50%; background: #00D084;
          animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%,100%{box-shadow:0 0 0 0 rgba(0,208,132,0.4)}
          70%{box-shadow:0 0 0 6px rgba(0,208,132,0)}
        }
        .pc-title { font-size: 13.5px; font-weight: 700; color: #fff; }
        .pc-subtitle { font-size: 11px; color: #555; }
        .pc-credits {
          font-size: 11px; color: #444;
          background: rgba(255,255,255,0.04); padding: 4px 10px; border-radius: 6px;
        }
        .pc-credits span { color: #F5C542; font-weight: 600; }

        /* Messages */
        .pc-messages {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 14px;
          scrollbar-width: thin; scrollbar-color: #222 transparent;
        }

        /* Welcome */
        .pc-welcome {
          text-align: center; padding: 30px 20px; color: #444;
        }
        .pc-welcome-icon { font-size: 32px; margin-bottom: 12px; }
        .pc-welcome-title { font-size: 14px; font-weight: 700; color: #666; margin-bottom: 6px; }
        .pc-welcome-sub { font-size: 12px; color: #3a3a3a; margin-bottom: 20px; }

        /* Quick prompts */
        .pc-quick { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
        .pc-quick-btn {
          padding: 6px 12px; border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03); color: #666; font-size: 11.5px;
          cursor: pointer; transition: all 0.15s;
        }
        .pc-quick-btn:hover {
          background: rgba(245,197,66,0.08); color: #F5C542;
          border-color: rgba(245,197,66,0.2);
        }

        /* Message bubble */
        .pc-msg { display: flex; gap: 10px; max-width: 100%; }
        .pc-msg.user { flex-direction: row-reverse; }

        .pc-avatar {
          width: 28px; height: 28px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; flex-shrink: 0; margin-top: 2px;
        }
        .pc-avatar.ai { background: linear-gradient(135deg,#F5C542,#00D084); color: #000; font-weight: 800; }
        .pc-avatar.user { background: rgba(255,255,255,0.08); }

        .pc-bubble {
          max-width: calc(100% - 44px); padding: 11px 14px;
          border-radius: 12px; font-size: 13px; line-height: 1.65;
        }
        .pc-bubble.user {
          background: linear-gradient(135deg,rgba(245,197,66,0.12),rgba(0,208,132,0.08));
          border: 1px solid rgba(245,197,66,0.18); color: #e8e8e8;
          border-radius: 12px 2px 12px 12px;
        }
        .pc-bubble.ai {
          background: #0d0d0d; border: 1px solid rgba(255,255,255,0.07);
          color: #ccc; border-radius: 2px 12px 12px 12px;
        }

        /* Cursor blink */
        .pc-cursor {
          display: inline-block; width: 2px; height: 14px;
          background: #00D084; animation: blink 0.7s infinite;
          margin-left: 2px; vertical-align: middle;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

        /* Apply changes button */
        .pc-apply-btn {
          margin-top: 10px; padding: 8px 14px; border-radius: 8px;
          background: linear-gradient(135deg,#F5C542,#00D084);
          border: none; color: #000; font-size: 12.5px; font-weight: 700;
          cursor: pointer; transition: opacity 0.18s; width: 100%;
        }
        .pc-apply-btn:hover { opacity: 0.88; }

        /* Timestamp */
        .pc-time { font-size: 10px; color: #333; margin-top: 4px; text-align: right; }
        .pc-msg.user .pc-time { text-align: left; }

        /* Input area */
        .pc-input-area {
          padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .pc-input-wrap {
          display: flex; gap: 8px; align-items: flex-end;
          background: #0d0d0d; border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: 10px 12px;
          transition: border-color 0.2s;
        }
        .pc-input-wrap:focus-within { border-color: rgba(245,197,66,0.3); }
        textarea.pc-textarea {
          flex: 1; background: transparent; border: none; outline: none;
          color: #e8e8e8; font-size: 13px; font-family: 'DM Sans', sans-serif;
          resize: none; height: 20px; max-height: 120px; line-height: 1.5;
        }
        textarea.pc-textarea::placeholder { color: #333; }
        .pc-send-btn {
          width: 32px; height: 32px; border-radius: 8px; border: none;
          background: linear-gradient(135deg,#F5C542,#00D084);
          color: #000; font-size: 14px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.18s; flex-shrink: 0;
        }
        .pc-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .pc-hint { font-size: 10.5px; color: #333; margin-top: 6px; text-align: center; }
      `}</style>

      <div className="pc">
        {/* Header */}
        <div className="pc-header">
          <div className="pc-header-left">
            <div className="pc-dot" />
            <div>
              <div className="pc-title">AI Assistant</div>
              <div className="pc-subtitle">{projectName} · {framework}</div>
            </div>
          </div>
          <div className="pc-credits">
            Credits used: <span>{creditsUsed}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="pc-messages">
          {messages.length === 0 ? (
            <div className="pc-welcome">
              <div className="pc-welcome-icon">⚡</div>
              <div className="pc-welcome-title">Project AI Assistant</div>
              <div className="pc-welcome-sub">
                I know your project code. Ask me anything!
              </div>
              <div className="pc-quick">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    className="pc-quick-btn"
                    onClick={() => sendMessage(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`pc-msg ${msg.role}`}>
                <div className={`pc-avatar ${msg.role === "assistant" ? "ai" : "user"}`}>
                  {msg.role === "assistant" ? "K" : "U"}
                </div>
                <div>
                  <div className={`pc-bubble ${msg.role === "assistant" ? "ai" : "user"}`}>
                    {formatContent(msg.content)}
                    {msg.streaming && <span className="pc-cursor" />}
                    {msg.codeChanges && !msg.streaming && (
                      <button
                        className="pc-apply-btn"
                        onClick={() => onApplyChanges(msg.codeChanges!)}
                      >
                        ✓ Apply Code Changes
                      </button>
                    )}
                  </div>
                  <div className="pc-time">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="pc-input-area">
          <div className="pc-input-wrap">
            <textarea
              ref={textareaRef}
              className="pc-textarea"
              placeholder="Ask AI to improve your project..."
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
            />
            <button
              className="pc-send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
            >
              {loading ? "⟳" : "↑"}
            </button>
          </div>
          <div className="pc-hint">Enter to send · Shift+Enter for new line · 2 credits/message</div>
        </div>
      </div>
    </>
  );
}

