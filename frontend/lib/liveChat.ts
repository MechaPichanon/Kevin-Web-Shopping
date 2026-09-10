// Client-safe helper for the "talk to a human" live-chat handoff.
// Talks to the Express backend directly (same pattern as lib/orders.ts).
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
const API_BASE = `${BACKEND_URL}/live-chat`

// ⚠️ Admin calls assume the login page stores the JWT under localStorage "token".
function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type SenderType = "customer" | "bot" | "admin" | "system"

export type LiveChatMessage = {
  message_id: number
  sender_type: SenderType
  sender_admin_name: string | null
  body: string
  created_at: string
}

export type SessionStatus = "bot" | "waiting" | "live" | "closed"

export type PollResult = {
  status: SessionStatus
  assigned_admin_name: string | null
  admin_online: boolean
  messages: LiveChatMessage[]
}

export type EscalateResult = {
  status: "waiting"
  session_id: number | null
  admin_online: boolean
  queue_position: number | null
  last_message_id: number
}

export type QueueRow = {
  session_id: number
  conversation_id: string
  guest_label: string
  customer_lang: "th" | "en"
  status: "waiting" | "live"
  escalated_at: string
  claimed_at: string | null
  last_customer_seen_at: string | null
  assigned_admin_id: number | null
  assigned_admin_name: string | null
  is_mine: boolean
  last_message: string | null
}

export type QueueResult = {
  waiting: QueueRow[]
  live: QueueRow[]
  counts: { waiting: number; live: number }
  now: string
}

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const err = new Error(
      (data as { error?: string })?.error || `Request failed (${res.status})`,
    ) as Error & { status?: number; code?: string }
    err.status = res.status
    err.code = (data as { error?: string })?.error
    throw err
  }
  return data as T
}

// ── customer side (no auth) ──

export async function escalateChat(input: {
  conversationId: string
  lang: "th" | "en"
  userId?: number
  guestLabel?: string
  reason?: string
}): Promise<EscalateResult> {
  const res = await fetch(`${API_BASE}/escalate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation_id: input.conversationId,
      lang: input.lang,
      user_id: input.userId,
      guest_label: input.guestLabel,
      reason: input.reason,
    }),
  })
  return asJson<EscalateResult>(res)
}

export async function sendCustomerMessage(
  conversationId: string,
  body: string,
): Promise<{ ok: true; message_id: number }> {
  const res = await fetch(`${API_BASE}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId, body }),
  })
  return asJson(res)
}

export async function pollChat(
  conversationId: string,
  afterId: number,
): Promise<PollResult> {
  const res = await fetch(
    `${API_BASE}/poll?conversation_id=${encodeURIComponent(conversationId)}&after_id=${afterId}`,
    { cache: "no-store" },
  )
  return asJson<PollResult>(res)
}

export async function leaveChat(conversationId: string): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId }),
  })
  return asJson(res)
}

// ── admin side (auth + admin/staff) ──

export async function fetchQueue(): Promise<QueueResult> {
  const res = await fetch(`${API_BASE}/admin/queue`, {
    cache: "no-store",
    headers: authHeaders(),
  })
  return asJson<QueueResult>(res)
}

export async function claimChat(
  conversationId: string,
): Promise<{ ok: true; session: unknown }> {
  const res = await fetch(`${API_BASE}/admin/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ conversation_id: conversationId }),
  })
  return asJson(res)
}

export async function fetchAdminSession(
  conversationId: string,
  afterId: number,
): Promise<{ session: QueueRow & { ended_at: string | null }; messages: LiveChatMessage[] }> {
  const res = await fetch(
    `${API_BASE}/admin/session/${encodeURIComponent(conversationId)}?after_id=${afterId}`,
    { cache: "no-store", headers: authHeaders() },
  )
  return asJson(res)
}

export async function sendAdminMessage(
  conversationId: string,
  body: string,
): Promise<{ ok: true; message_id: number }> {
  const res = await fetch(`${API_BASE}/admin/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ conversation_id: conversationId, body }),
  })
  return asJson(res)
}

export async function closeChat(conversationId: string): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE}/admin/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ conversation_id: conversationId }),
  })
  return asJson(res)
}
