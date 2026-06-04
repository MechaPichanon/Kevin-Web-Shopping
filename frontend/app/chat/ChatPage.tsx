"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatApiResponse = {
  reply: string;
  intent?: string;
  products_used?: string[];
  conversation_id?: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I can help you find and compare our shirts and pants. What are you looking for today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<{
    intent?: string;
    products_used?: string[];
  } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const canSend = useMemo(
    () => !isSending && input.trim().length > 0,
    [input, isSending]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function sendMessage(message: string) {
    setError(null);
    setLastMeta(null);

    const trimmed = message.trim();
    if (!trimmed) return;

    setIsSending(true);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversation_id: conversationId }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as ChatApiResponse;
      const reply = typeof data.reply === "string" ? data.reply : "";
      if (!reply) throw new Error("Invalid response from server.");

      if (typeof data.conversation_id === "string" && data.conversation_id.trim()) {
        setConversationId(data.conversation_id.trim());
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setLastMeta({
        intent: data.intent,
        products_used: data.products_used,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry — I couldn’t reach the chatbot API. Make sure the backend (and Ollama) are running.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  const meta = lastMeta;

  return (
    <section className="flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10">
        <div className="text-sm font-medium">Chat</div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Backend: FastAPI
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={
              m.role === "user"
                ? "flex justify-end"
                : "flex justify-start"
            }
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
              }
            >
              {m.role === "assistant" ? (
                <ReactMarkdown
                  components={{
                    p:      ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                    ul:     ({ children }) => <ul className="mt-1 list-disc pl-4 space-y-0.5">{children}</ul>,
                    ol:     ({ children }) => <ol className="mt-1 list-decimal pl-4 space-y-0.5">{children}</ol>,
                    li:     ({ children }) => <li>{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    h3:     ({ children }) => <h3 className="font-semibold mt-2 mb-1 text-sm">{children}</h3>,
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {isSending ? (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              Thinking…
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-zinc-200 px-4 py-3 dark:border-white/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
            setInput("");
          }}
          className="flex gap-2"
        >
          <input
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-white/10 dark:bg-zinc-950 dark:focus:border-white/30"
            placeholder='chat here'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Send
          </button>
        </form>

        {error ? (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {meta && (meta.intent || (meta.products_used?.length ?? 0) > 0) ? (
          <details className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            <summary className="cursor-pointer select-none">
              Debug details
            </summary>
            <div className="mt-1 space-y-1">
              {meta.intent ? (
                <div>
                  intent: <code>{meta.intent}</code>
                </div>
              ) : null}
              {meta.products_used?.length ? (
                <div>
                  products_used:{" "}
                  <code>{JSON.stringify(meta.products_used)}</code>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
