"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/language-context";
import {
  escalateChat,
  sendCustomerMessage,
  pollChat,
  leaveChat,
} from "@/lib/liveChat";
import { resolveApiUrl } from "@/lib/api";

type MessageType = "text" | "cards";

type ProductCard = {
  id: string;
  name: string;
  min_price: number;
  image_url?: string;
};

type ChatRole = "user" | "assistant" | "admin" | "system";

type ChatMessage = {
  id: string;
  role: ChatRole;
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
  // live-chat handoff
  handoff_suggested?: boolean;
  handoff_active?: boolean;
};

// bot → waiting (in the human queue) → live (admin joined) → closed (bot resumes)
type Mode = "bot" | "waiting" | "live" | "closed";

const STORAGE_KEY = "kevin_chat_v1";

// Routes where the storefront chat widget should not appear:
// admin console, the purchase funnel, and auth/account pages.
const WIDGET_HIDDEN_PREFIXES = [
  "/admin",
  "/checkout",
  "/cart",
  "/login",
  "/signup",
  "/profile",
  "/orders",
];

let _msgId = 0;
function nid() {
  return "m" + ++_msgId;
}

const ACCENT = "#b89f8d";
const BOT_BUBBLE = "#F4ECE2";
const ADMIN_BUBBLE = "#3E6E8E";
const PANEL_BG = "#FFFCF8";
const BORDER_COLOR = "#ECE3D8";
const TEXT_MAIN = "#2A2622";
const TEXT_MUTED = "#6B5F55";
const DOT_ONLINE = "#6FCF8E";
const DOT_OFFLINE = "#B6A99C";

const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p style={{ margin: "0 0 4px 0" }}>{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong style={{ fontWeight: 600 }}>{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul style={{ margin: "4px 0", paddingLeft: 16 }}>{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol style={{ margin: "4px 0", paddingLeft: 16 }}>{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
};

function readStoredUser(): { id?: number; username?: string } | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u && typeof u === "object" ? u : null;
  } catch {
    return null;
  }
}

function newConversationId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ChatWidget() {
  const { lang, t } = useLang();
  const pathname = usePathname();

  const INITIAL_QUICK_REPLIES = [
    t("chat.quick.tshirts"),
    t("chat.quick.pants"),
    t("chat.quick.findSize"),
    t("chat.quick.policy"),
    t("chat.quick.recommendations"),
  ];

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"welcome" | "chat">("welcome");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>(INITIAL_QUICK_REPLIES);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [greetingDismissed, setGreetingDismissed] = useState(false);

  // live-chat handoff state
  const [mode, setMode] = useState<Mode>("bot");
  const [adminOnline, setAdminOnline] = useState<boolean | null>(null);
  const [showOffer, setShowOffer] = useState(false);
  const [escalating, setEscalating] = useState(false);

  // Poll cursor. State (so the persist effect writes it to localStorage) with a
  // ref mirror (so interval callbacks read the live value synchronously).
  const [lastSeenId, setLastSeenId] = useState<number>(0);
  const lastSeenIdRef = useRef<number>(0);
  function setSeen(id: number) {
    lastSeenIdRef.current = id;
    setLastSeenId(id);
  }
  function bumpSeen(id: number) {
    if (id > lastSeenIdRef.current) setSeen(id);
  }

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<Mode>("bot");
  const convRef = useRef<string | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    convRef.current = conversationId;
  }, [conversationId]);

  // Restore from localStorage on mount. If we look mid-handoff, reconcile once
  // against the server so a stale persisted mode can't strand the UI.
  useEffect(() => {
    let saved: {
      messages?: ChatMessage[];
      conversationId?: string;
      view?: string;
      mode?: string;
      lastSeenId?: number;
    } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      saved = null;
    }
    if (!saved) return;

    if (Array.isArray(saved.messages) && saved.messages.length > 0) {
      setMessages(saved.messages);
      setView(saved.view === "chat" ? "chat" : "welcome");
    }
    if (typeof saved.conversationId === "string") setConversationId(saved.conversationId);
    if (typeof saved.lastSeenId === "number") setSeen(saved.lastSeenId);

    const m = saved.mode;
    if (m === "waiting" || m === "live" || m === "closed") {
      setMode(m);
      if ((m === "waiting" || m === "live") && typeof saved.conversationId === "string") {
        void doPoll(saved.conversationId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist widget state (including the poll cursor) to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages,
          conversationId,
          view,
          mode,
          lastSeenId,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [messages, conversationId, view, mode, lastSeenId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  // Poll loop — only while a human chat is waiting/live.
  useEffect(() => {
    if (mode !== "waiting" && mode !== "live") return;
    if (!conversationId) return;
    let alive = true;
    const tick = () => {
      if (alive) void doPoll();
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, conversationId]);

  async function doPoll(cidArg?: string) {
    const cid = cidArg || convRef.current;
    if (!cid) return;
    try {
      const res = await pollChat(cid, lastSeenIdRef.current);
      setAdminOnline(res.admin_online);

      if (res.messages.length > 0) {
        const additions: ChatMessage[] = [];
        for (const msg of res.messages) {
          bumpSeen(msg.message_id);
          if (msg.sender_type === "system") continue; // synthesized locally instead
          const role: ChatRole =
            msg.sender_type === "admin"
              ? "admin"
              : msg.sender_type === "bot"
                ? "assistant"
                : "user";
          additions.push({ id: "s" + msg.message_id, role, type: "text", content: msg.body });
        }
        if (additions.length > 0) setMessages((prev) => [...prev, ...additions]);
      }

      // Status transitions → locally-translated system lines.
      if (res.status === "live" && modeRef.current !== "live") {
        setMode("live");
        if (res.assigned_admin_name) {
          setMessages((prev) => [
            ...prev,
            {
              id: nid(),
              role: "system",
              type: "text",
              content: t("chat.adminJoined", { name: res.assigned_admin_name as string }),
            },
          ]);
        }
      } else if (res.status === "closed" && modeRef.current !== "closed") {
        setMode("closed");
        setMessages((prev) => [
          ...prev,
          { id: nid(), role: "system", type: "text", content: t("chat.chatClosed") },
        ]);
      } else if (
        res.status === "bot" &&
        (modeRef.current === "waiting" || modeRef.current === "live")
      ) {
        setMode("bot");
      }
    } catch {
      // transient — keep polling
    }
  }

  async function handleEscalate(reason?: string) {
    if (escalating || mode === "waiting" || mode === "live") return;
    setEscalating(true);
    setError(null);
    setShowOffer(false);

    let cid = conversationId;
    if (!cid) {
      cid = newConversationId();
      setConversationId(cid);
      convRef.current = cid;
    }

    try {
      const u = readStoredUser();
      const res = await escalateChat({
        conversationId: cid,
        lang: lang === "en" ? "en" : "th",
        userId: typeof u?.id === "number" ? u.id : undefined,
        guestLabel: typeof u?.username === "string" ? u.username : undefined,
        reason,
      });
      if (res.last_message_id) bumpSeen(res.last_message_id);
      setAdminOnline(res.admin_online);
      setView("chat");
      setQuickReplies([]);
      setMode("waiting");
      setMessages((prev) => [
        ...prev,
        {
          id: nid(),
          role: "system",
          type: "text",
          content: res.admin_online ? t("chat.waitingForAdmin") : t("chat.noAdminOnline"),
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setEscalating(false);
    }
  }

  async function handleLeaveHuman() {
    const cid = convRef.current || conversationId;
    setMode("closed");
    setMessages((prev) => [
      ...prev,
      { id: nid(), role: "system", type: "text", content: t("chat.chatClosed") },
    ]);
    if (cid) {
      try {
        await leaveChat(cid);
      } catch {
        /* best effort */
      }
    }
  }

  function handleNewChat() {
    setMessages([]);
    setConversationId(null);
    convRef.current = null;
    setInput("");
    setError(null);
    setView("welcome");
    setQuickReplies(INITIAL_QUICK_REPLIES);
    setMode("bot");
    setAdminOnline(null);
    setShowOffer(false);
    setSeen(0);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending || escalating) return;

    setError(null);
    setView("chat");

    // ── Live / waiting: message goes to the human, not the bot ──
    if (mode === "waiting" || mode === "live") {
      setInput("");
      const optimisticId = nid();
      setMessages((prev) => [
        ...prev,
        { id: optimisticId, role: "user", type: "text", content: trimmed },
      ]);
      setIsSending(true);
      try {
        const cid = convRef.current || conversationId;
        if (!cid) throw new Error("No conversation");
        const out = await sendCustomerMessage(cid, trimmed);
        bumpSeen(out.message_id);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "chat_closed") {
          setMode("closed");
          setMessages((prev) => [
            ...prev,
            { id: nid(), role: "system", type: "text", content: t("chat.chatClosed") },
          ]);
        } else {
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      } finally {
        setIsSending(false);
      }
      return;
    }

    // ── Bot path (mode "bot" or "closed" — closed behaves as bot) ──
    if (mode === "closed") setMode("bot");
    setQuickReplies([]);
    setShowOffer(false);
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
        body: JSON.stringify({ message: trimmed, conversation_id: conversationId, lang }),
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      const data = (await res.json()) as ApiResponse;

      if (typeof data.conversation_id === "string" && data.conversation_id.trim()) {
        setConversationId(data.conversation_id.trim());
        convRef.current = data.conversation_id.trim();
      }

      // A human already owns this conversation server-side (widget was out of
      // sync). Drop the local view and let the poll loop rebuild the transcript
      // from the DB, then correct to "live" if needed.
      if (data.handoff_active) {
        setQuickReplies([]);
        setShowOffer(false);
        setMessages([]);
        setSeen(0);
        setMode("waiting");
        return;
      }

      const reply = typeof data.reply === "string" ? data.reply : "";
      if (!reply) throw new Error("Invalid response from server.");

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
      if (data.handoff_suggested) setShowOffer(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { id: nid(), role: "assistant", type: "text", content: t("chat.error") },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  // Don't render the storefront chat widget on admin, checkout, or account pages.
  if (
    pathname &&
    WIDGET_HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return null;
  }

  const inHumanChat = mode === "waiting" || mode === "live";
  const canOfferHuman = mode === "bot" || mode === "closed";

  const headerDot =
    inHumanChat && adminOnline === false
      ? { color: DOT_OFFLINE, label: t("chat.adminOffline") }
      : inHumanChat
        ? { color: DOT_ONLINE, label: t("chat.adminOnline") }
        : { color: DOT_ONLINE, label: t("chat.botStatus") };

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
  const adminAvatarStyle: React.CSSProperties = { ...avatarStyle, background: ADMIN_BUBBLE };

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
            {t("chat.greetingShort")}
          </div>
          <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.4 }}>
            {t("chat.greetingHint")}
          </div>
        </div>
      )}

      {/* Launcher bubble */}
      <button
        onClick={() => {
          setOpen((o) => !o);
          setGreetingDismissed(true);
        }}
        aria-label={t("chat.openChat")}
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
                    background: headerDot.color,
                    display: "inline-block",
                  }}
                />
                {headerDot.label}
              </div>
            </div>
            <button
              onClick={handleNewChat}
              title={t("chat.newConversation")}
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
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}>
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
                    {t("chat.welcomeGreeting")}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: TEXT_MUTED,
                      lineHeight: 1.5,
                      marginTop: 6,
                    }}
                  >
                    {t("chat.welcomeBody")}
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
                  if (m.role === "system") {
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: "center",
                          maxWidth: "92%",
                          textAlign: "center",
                          fontSize: 12,
                          color: TEXT_MUTED,
                          margin: "8px 0",
                          lineHeight: 1.4,
                        }}
                      >
                        {m.content}
                      </div>
                    );
                  }

                  const isBot = m.role === "assistant";
                  const isAdmin = m.role === "admin";
                  const isLeft = isBot || isAdmin;
                  const prev = messages[i - 1];
                  const showAvatar = isLeft && (!prev || prev.role !== m.role);

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-end",
                        justifyContent: isLeft ? "flex-start" : "flex-end",
                        marginBottom: 10,
                        marginLeft: isLeft && !showAvatar ? 36 : 0,
                      }}
                    >
                      {isBot && showAvatar && <div style={avatarStyle}>K</div>}
                      {isAdmin && showAvatar && <div style={adminAvatarStyle}>♦</div>}

                      <div style={{ maxWidth: "80%" }}>
                        {isAdmin && showAvatar && (
                          <div
                            style={{
                              fontSize: 11,
                              color: TEXT_MUTED,
                              margin: "0 0 3px 2px",
                              fontWeight: 600,
                            }}
                          >
                            {t("chat.staffLabel")}
                          </div>
                        )}
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
                              <ReactMarkdown components={mdComponents}>{m.content}</ReactMarkdown>
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
                                    overflow: "hidden",
                                    background: `repeating-linear-gradient(135deg,${ACCENT}33,${ACCENT}33 7px,${ACCENT}14 7px,${ACCENT}14 14px)`,
                                  }}
                                >
                                  {c.image_url && (
                                    <img
                                      src={resolveApiUrl(c.image_url)}
                                      alt={c.name}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: "block",
                                      }}
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  )}
                                </div>
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
                                  <Link href={`/products/${c.id}`}>
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
                              background: isAdmin ? ADMIN_BUBBLE : isBot ? BOT_BUBBLE : ACCENT,
                              color: isBot ? TEXT_MAIN : "#fff",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {isBot ? (
                              <ReactMarkdown components={mdComponents}>{m.content}</ReactMarkdown>
                            ) : (
                              m.content
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Inline "talk to a human" offer */}
                {showOffer && mode === "bot" && (
                  <div
                    style={{
                      alignSelf: "center",
                      maxWidth: "92%",
                      textAlign: "center",
                      margin: "6px 0 12px",
                    }}
                  >
                    <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5, marginBottom: 8 }}>
                      {t("chat.handoffOffer")}
                    </div>
                    <button
                      onClick={() => handleEscalate()}
                      disabled={escalating}
                      style={{
                        padding: "8px 18px",
                        fontSize: 13,
                        fontWeight: 600,
                        background: ACCENT,
                        color: "#fff",
                        border: "none",
                        borderRadius: 999,
                        cursor: escalating ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        opacity: escalating ? 0.6 : 1,
                      }}
                    >
                      {t("chat.talkToHuman")}
                    </button>
                  </div>
                )}

                {/* Animated typing indicator (bot only) */}
                {isSending && !inHumanChat && (
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

          {/* Quick-reply chips (bot chat mode only) */}
          {view === "chat" && mode === "bot" && quickReplies.length > 0 && (
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

          {/* Talk-to-a-human chip (bot / closed) */}
          {canOfferHuman && (
            <div style={{ padding: "0 16px 8px" }}>
              <button
                onClick={() => handleEscalate()}
                disabled={escalating}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: "transparent",
                  color: ACCENT,
                  border: `1px solid ${ACCENT}`,
                  borderRadius: 999,
                  cursor: escalating ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  opacity: escalating ? 0.6 : 1,
                }}
              >
                {t("chat.talkToHuman")}
              </button>
            </div>
          )}

          {/* Leave-human-chat link */}
          {inHumanChat && (
            <div style={{ padding: "0 16px 8px" }}>
              <button
                onClick={handleLeaveHuman}
                style={{
                  background: "transparent",
                  border: "none",
                  color: TEXT_MUTED,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                {t("chat.leaveChat")}
              </button>
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
              placeholder={t("chat.inputPlaceholder")}
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
