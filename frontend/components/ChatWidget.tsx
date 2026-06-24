"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";

type MessageType = "text" | "cards";

type ProductCard = {
  id: string;
  name: string;
  min_price: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  type: MessageType;
  content: string;
  cards?: ProductCard[];
};

type ApiResponse = {
  reply: string;
  intent?: string;
  products_used?: string[];
  product_cards?: ProductCard[];
  quick_replies?: string[];
  conversation_id?: string;
};

const STORAGE_KEY = "kevin_chat_v1";

const INITIAL_QUICK_REPLIES = [
  "ดูเสื้อยืด / Show T-shirts",
  "ดูกางเกง / Show pants",
  "หาไซส์ / Find my size",
  "นโยบายร้าน / Store policy",
  "สินค้าแนะนำ / Recommendations",
];

let _msgId = 0;
function nid() {
  return "m" + ++_msgId;
}

const ACCENT = "#b89f8d";
const BOT_BUBBLE = "#F4ECE2";
const PANEL_BG = "#FFFCF8";
const BORDER_COLOR = "#ECE3D8";
const TEXT_MAIN = "#2A2622";
const TEXT_MUTED = "#6B5F55";

const mdComponents = {
  p: ({ children }: { children: React.ReactNode }) => (
    <p style={{ margin: "0 0 4px 0" }}>{children}</p>
  ),
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong style={{ fontWeight: 600 }}>{children}</strong>
  ),
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul style={{ margin: "4px 0", paddingLeft: 16 }}>{children}</ul>
  ),
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol style={{ margin: "4px 0", paddingLeft: 16 }}>{children}</ol>
  ),
  li: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"welcome" | "chat">("welcome");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>(INITIAL_QUICK_REPLIES);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [greetingDismissed, setGreetingDismissed] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { messages: m, conversationId: cid, view: v } = JSON.parse(saved);
        if (Array.isArray(m) && m.length > 0) {
          setMessages(m);
          setView(v === "chat" ? "chat" : "welcome");
        }
        if (typeof cid === "string") setConversationId(cid);
      }
    } catch {}
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, conversationId, view }));
    } catch {}
  }, [messages, conversationId, view]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  function handleNewChat() {
    setMessages([]);
    setConversationId(null);
    setInput("");
    setError(null);
    setView("welcome");
    setQuickReplies(INITIAL_QUICK_REPLIES);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setError(null);
    setView("chat");
    setQuickReplies([]);
    setIsSending(true);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: nid(), role: "user", type: "text", content: trimmed },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversation_id: conversationId }),
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      const data = (await res.json()) as ApiResponse;
      const reply = typeof data.reply === "string" ? data.reply : "";
      if (!reply) throw new Error("Invalid response from server.");

      if (typeof data.conversation_id === "string" && data.conversation_id.trim()) {
        setConversationId(data.conversation_id.trim());
      }

      const hasCards = (data.product_cards?.length ?? 0) > 0;
      setMessages((prev) => [
        ...prev,
        {
          id: nid(),
          role: "assistant",
          type: hasCards ? "cards" : "text",
          content: reply,
          cards: data.product_cards,
        },
      ]);
      setQuickReplies(data.quick_replies ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: nid(),
          role: "assistant",
          type: "text",
          content:
            "ขอโทษค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง\nSorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  const avatarStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: "50%",
    flex: "0 0 28px",
    background: ACCENT,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
  };

  return (
    <>
      {/* Greeting tooltip */}
      {!open && !greetingDismissed && (
        <div
          onClick={() => {
            setOpen(true);
            setGreetingDismissed(true);
          }}
          style={{
            position: "fixed",
            right: 96,
            bottom: 32,
            zIndex: 49,
            maxWidth: 220,
            background: "#fff",
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: 16,
            borderBottomRightRadius: 4,
            padding: "10px 14px",
            boxShadow: "0 12px 30px rgba(80,50,30,0.16)",
            cursor: "pointer",
            animation: "tipIn .3s ease-out",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
            สวัสดีครับ! / Hi!
          </div>
          <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.4 }}>
            ถามเรื่องสินค้าได้เลยค่ะ / Ask about our products 👋
          </div>
        </div>
      )}

      {/* Launcher bubble */}
      <button
        onClick={() => {
          setOpen((o) => !o);
          setGreetingDismissed(true);
        }}
        aria-label="Open chat"
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: ACCENT,
          color: "#fff",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 10px 28px rgba(120,70,40,0.32)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
        }}
      >
        {open ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M6 6 L18 18 M18 6 L6 18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M4 5.5 h16 a1 1 0 0 1 1 1 v9 a1 1 0 0 1 -1 1 H9 l-4 3.5 v-3.5 H4 a1 1 0 0 1 -1 -1 v-9 a1 1 0 0 1 1 -1 z"
              fill="currentColor"
              stroke="none"
            />
            <circle cx="9" cy="11" r="1.1" fill="#fff" />
            <circle cx="12.5" cy="11" r="1.1" fill="#fff" />
            <circle cx="16" cy="11" r="1.1" fill="#fff" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 96,
            width: 380,
            height: 560,
            maxHeight: "78vh",
            background: PANEL_BG,
            borderRadius: 24,
            boxShadow: "0 24px 60px rgba(80,50,30,0.24)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 50,
            border: "1px solid rgba(0,0,0,0.05)",
            animation: "panelIn .24s cubic-bezier(.2,.8,.2,1)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: ACCENT,
              color: "#fff",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 11,
              flex: "0 0 auto",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                flex: "0 0 34px",
                background: "rgba(255,255,255,0.22)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              K
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Kevin</div>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.85,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#6FCF8E",
                    display: "inline-block",
                  }}
                />
                ตอบทันที / replies instantly
              </div>
            </div>
            <button
              onClick={handleNewChat}
              title="Start a new conversation"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.45)",
                color: "#fff",
                cursor: "pointer",
                padding: "5px 12px",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 500,
                borderRadius: 999,
              }}
            >
              + New Chat
            </button>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                opacity: 0.8,
                padding: 4,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M6 6 L18 18 M18 6 L6 18" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}
          >
            {view === "welcome" ? (
              /* Welcome screen */
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: ACCENT,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 20,
                  }}
                >
                  K
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 21, lineHeight: 1.2, color: TEXT_MAIN }}>
                    สวัสดีครับ! / Hi there 👋
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: TEXT_MUTED,
                      lineHeight: 1.5,
                      marginTop: 6,
                    }}
                  >
                    ฉันคือ Kevin ผู้ช่วยร้านค้า ถามเรื่องสินค้า ไซส์ หรือนโยบายร้านได้เลย
                    <br />
                    I&apos;m Kevin, your store assistant. Ask me anything about products, sizing, or
                    policies.
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {quickReplies.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        padding: "13px 16px",
                        fontSize: 14,
                        fontWeight: 500,
                        background: "#fff",
                        color: "#6B4A38",
                        border: `1px solid ${BORDER_COLOR}`,
                        borderRadius: 18,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                      }}
                    >
                      <span>{q}</span>
                      <span style={{ opacity: 0.5 }}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Chat view */
              <div style={{ display: "flex", flexDirection: "column" }}>
                {messages.map((m, i) => {
                  const isBot = m.role === "assistant";
                  const prev = messages[i - 1];
                  const showAvatar = isBot && (!prev || prev.role !== "assistant");

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-end",
                        justifyContent: isBot ? "flex-start" : "flex-end",
                        marginBottom: 10,
                        marginLeft: isBot && !showAvatar ? 36 : 0,
                      }}
                    >
                      {isBot && showAvatar && <div style={avatarStyle}>K</div>}

                      <div style={{ maxWidth: "80%" }}>
                        {m.type === "cards" && m.cards && m.cards.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {/* Text part of cards message */}
                            <div
                              style={{
                                padding: "10px 14px",
                                fontSize: 14,
                                lineHeight: 1.45,
                                borderRadius: 18,
                                background: BOT_BUBBLE,
                                color: TEXT_MAIN,
                                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                              }}
                            >
                              <ReactMarkdown components={mdComponents}>
                                {m.content}
                              </ReactMarkdown>
                            </div>
                            {/* Product cards */}
                            {m.cards.map((c) => (
                              <div
                                key={c.id}
                                style={{
                                  display: "flex",
                                  gap: 11,
                                  padding: 9,
                                  background: "#fff",
                                  border: `1px solid ${BORDER_COLOR}`,
                                  borderRadius: 13,
                                  alignItems: "center",
                                }}
                              >
                                <div
                                  style={{
                                    width: 52,
                                    height: 66,
                                    borderRadius: 8,
                                    flex: "0 0 52px",
                                    background: `repeating-linear-gradient(135deg,${ACCENT}33,${ACCENT}33 7px,${ACCENT}14 7px,${ACCENT}14 14px)`,
                                  }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: TEXT_MAIN,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {c.name}
                                  </div>
                                  {c.min_price > 0 && (
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: "#9A8E83",
                                        margin: "1px 0 4px",
                                      }}
                                    >
                                      {c.min_price.toLocaleString()} ฿
                                    </div>
                                  )}
                                  <Link href="/products">
                                    <button
                                      style={{
                                        padding: "5px 12px",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        background: "transparent",
                                        color: ACCENT,
                                        border: `1px solid ${ACCENT}`,
                                        borderRadius: 999,
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                      }}
                                    >
                                      View
                                    </button>
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: "10px 14px",
                              fontSize: 14,
                              lineHeight: 1.45,
                              borderRadius: 18,
                              background: isBot ? BOT_BUBBLE : ACCENT,
                              color: isBot ? TEXT_MAIN : "#fff",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {isBot ? (
                              <ReactMarkdown components={mdComponents}>
                                {m.content}
                              </ReactMarkdown>
                            ) : (
                              m.content
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Animated typing indicator */}
                {isSending && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-end",
                      marginBottom: 10,
                    }}
                  >
                    <div style={avatarStyle}>K</div>
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        alignItems: "center",
                        padding: "12px 14px",
                        borderRadius: 18,
                        background: BOT_BUBBLE,
                      }}
                    >
                      {[0, 0.2, 0.4].map((delay) => (
                        <span
                          key={delay}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#B6A99C",
                            display: "inline-block",
                            animation: `blink 1.2s infinite ${delay}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick-reply chips (chat mode only) */}
          {view === "chat" && quickReplies.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "0 16px 10px",
                flexWrap: "wrap",
              }}
            >
              {quickReplies.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    background: "#fff",
                    color: "#6B4A38",
                    border: `1px solid ${BORDER_COLOR}`,
                    borderRadius: 999,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 14px",
              borderTop: "1px solid rgba(0,0,0,0.06)",
              flex: "0 0 auto",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ถามเรื่องสินค้า ไซส์ หรือนโยบายร้าน… / Ask about products…"
              disabled={isSending}
              autoComplete="off"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 14,
                fontFamily: "inherit",
                color: TEXT_MAIN,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              aria-label="Send"
              style={{
                width: 36,
                height: 36,
                flex: "0 0 36px",
                borderRadius: "50%",
                background: ACCENT,
                color: "#fff",
                border: "none",
                cursor: !input.trim() || isSending ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: !input.trim() || isSending ? 0.5 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 11 L20 4 L13 20 L11 13 Z" />
              </svg>
            </button>
          </form>

          {error && (
            <div
              style={{
                padding: "0 14px 10px",
                fontSize: 12,
                color: "#c0392b",
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </>
  );
}
