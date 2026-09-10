// controllers/liveChatControllers.js
// "Talk to a human" live-chat handoff. Customer-side endpoints are
// unauthenticated and keyed by conversation_id (same trust model as the
// existing /api/chat proxy → FastAPI). Admin-side endpoints sit behind
// auth + requireAdminOrStaff (mounted in liveChatRoutes.js).
const db = require("../db")

// conversation_id is the FastAPI uuid4 — client-controlled. Validate the shape
// before it ever touches a query (the column is TEXT, so this is defence in
// depth, not the only guard).
const CID_RE = /^[0-9a-f-]{16,64}$/i

// Session states the customer widget may still write into. 'live'/'closed' from
// the customer side is rejected (admin owns those transitions).
const ONLINE_WINDOW = "60 seconds"

function badCid(res) {
  res.status(400).json({ error: "invalid conversation_id" })
  return null
}

async function adminOnline() {
  const r = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM admin_presence p
       JOIN users u ON u.id = p.user_id
       WHERE p.last_seen_at > NOW() - INTERVAL '${ONLINE_WINDOW}'
         AND u.role IN ('admin','staff')
         AND u.is_active = TRUE
     ) AS online`
  )
  return r.rows[0].online === true
}

async function touchPresence(userId) {
  await db.query(
    `INSERT INTO admin_presence (user_id, last_seen_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET last_seen_at = NOW()`,
    [userId]
  )
}

// The JWT only carries { id, email } — look the display name up when needed.
async function adminName(userId) {
  const r = await db.query("SELECT username FROM users WHERE id = $1", [userId])
  return r.rows[0] ? r.rows[0].username : `#${userId}`
}

// Shape a chat_messages row (joined with the admin's username) for the wire.
function rowToMessage(r) {
  return {
    message_id: Number(r.message_id),
    sender_type: r.sender_type,
    sender_admin_name: r.sender_admin_name || null,
    body: r.body,
    created_at: r.created_at,
  }
}

const MESSAGE_SELECT = `
  SELECT m.message_id, m.sender_type, m.body, m.created_at, u.username AS sender_admin_name
  FROM chat_messages m
  LEFT JOIN users u ON u.id = m.sender_admin_id
  WHERE m.session_id = $1 AND m.message_id > $2
  ORDER BY m.message_id
`

// ───────────────────────── customer side ─────────────────────────

// POST /live-chat/escalate  { conversation_id, lang?, reason?, user_id?, guest_label? }
const escalate = async (req, res) => {
  const { conversation_id, lang, reason, user_id, guest_label } = req.body || {}
  if (!conversation_id || !CID_RE.test(conversation_id)) return badCid(res)

  const client = await db.connect()
  try {
    await client.query("BEGIN")

    // Create the row if the bot never persisted it (DB was down, or the
    // customer hit "talk to human" before sending a first message).
    await client.query(
      `INSERT INTO chat_sessions (conversation_id, customer_lang, status)
       VALUES ($1, $2, 'bot')
       ON CONFLICT (conversation_id) DO NOTHING`,
      [conversation_id, lang === "en" ? "en" : "th"]
    )

    // Flip bot/closed → waiting. If already waiting/live, this is a no-op and
    // we just return the current state (idempotent double-tap).
    const upd = await client.query(
      `UPDATE chat_sessions
         SET status = 'waiting',
             escalated_at = NOW(),
             ended_at = NULL,
             customer_lang = COALESCE($2, customer_lang),
             user_id = COALESCE($3, user_id),
             guest_label = COALESCE(guest_label, $4)
       WHERE conversation_id = $1
         AND status IN ('bot','closed')
       RETURNING session_id, escalated_at`,
      [
        conversation_id,
        lang === "en" || lang === "th" ? lang : null,
        Number.isInteger(user_id) ? user_id : null,
        typeof guest_label === "string" && guest_label.trim() ? guest_label.trim().slice(0, 50) : null,
      ]
    )

    let sessionId
    if (upd.rowCount === 1) {
      sessionId = upd.rows[0].session_id
      // Give guests a stable label once we know the session_id.
      await client.query(
        `UPDATE chat_sessions
           SET guest_label = COALESCE(guest_label, 'ลูกค้า #' || session_id)
         WHERE session_id = $1`,
        [sessionId]
      )
      const note = reason && String(reason).trim()
        ? `ลูกค้าขอคุยกับแอดมิน: ${String(reason).trim().slice(0, 300)}`
        : "ลูกค้าขอคุยกับแอดมิน"
      await client.query(
        `INSERT INTO chat_messages (session_id, sender_type, body) VALUES ($1, 'system', $2)`,
        [sessionId, note]
      )
    } else {
      const cur = await client.query(
        `SELECT session_id FROM chat_sessions WHERE conversation_id = $1`,
        [conversation_id]
      )
      sessionId = cur.rows[0] ? cur.rows[0].session_id : null
    }

    await client.query("COMMIT")

    const online = await adminOnline()
    let queuePosition = null
    let lastMessageId = 0
    if (sessionId) {
      const qp = await db.query(
        `SELECT COUNT(*)::int AS n
         FROM chat_sessions s
         WHERE s.status = 'waiting'
           AND s.escalated_at <= (SELECT escalated_at FROM chat_sessions WHERE session_id = $1)`,
        [sessionId]
      )
      queuePosition = qp.rows[0].n
      const mm = await db.query(
        `SELECT COALESCE(MAX(message_id), 0)::bigint AS m FROM chat_messages WHERE session_id = $1`,
        [sessionId]
      )
      lastMessageId = Number(mm.rows[0].m)
    }

    res.json({
      status: "waiting",
      session_id: sessionId,
      admin_online: online,
      queue_position: queuePosition,
      last_message_id: lastMessageId,
    })
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("LIVE-CHAT ESCALATE ERROR:", err.message)
    res.status(500).json({ error: "Server Error" })
  } finally {
    client.release()
  }
}

// POST /live-chat/message  { conversation_id, body }
const postCustomerMessage = async (req, res) => {
  const { conversation_id, body } = req.body || {}
  if (!conversation_id || !CID_RE.test(conversation_id)) return badCid(res)
  const text = typeof body === "string" ? body.trim() : ""
  if (!text) return res.status(400).json({ error: "empty message" })

  try {
    const s = await db.query(
      `SELECT session_id, status FROM chat_sessions WHERE conversation_id = $1`,
      [conversation_id]
    )
    if (!s.rows[0]) return res.status(404).json({ error: "unknown conversation" })
    if (s.rows[0].status === "closed") {
      return res.status(409).json({ error: "chat_closed" })
    }
    const ins = await db.query(
      `INSERT INTO chat_messages (session_id, sender_type, body)
       VALUES ($1, 'customer', $2) RETURNING message_id`,
      [s.rows[0].session_id, text]
    )
    res.json({ ok: true, message_id: Number(ins.rows[0].message_id) })
  } catch (err) {
    console.error("LIVE-CHAT CUSTOMER MSG ERROR:", err.message)
    res.status(500).json({ error: "Server Error" })
  }
}

// GET /live-chat/poll?conversation_id=&after_id=0
const pollConversation = async (req, res) => {
  const conversation_id = req.query.conversation_id
  if (!conversation_id || !CID_RE.test(conversation_id)) return badCid(res)
  const afterId = Number.parseInt(req.query.after_id, 10) || 0

  try {
    const s = await db.query(
      `SELECT s.session_id, s.status, u.username AS assigned_admin_name
       FROM chat_sessions s
       LEFT JOIN users u ON u.id = s.assigned_admin_id
       WHERE s.conversation_id = $1`,
      [conversation_id]
    )
    if (!s.rows[0]) return res.status(404).json({ error: "unknown conversation" })
    const { session_id, status, assigned_admin_name } = s.rows[0]

    // Mark the customer as recently seen (drives the "customer may have left"
    // hint on the admin queue).
    await db.query(
      `UPDATE chat_sessions SET last_customer_seen_at = NOW() WHERE session_id = $1`,
      [session_id]
    )

    const msgs = await db.query(MESSAGE_SELECT, [session_id, afterId])
    const online = await adminOnline()

    res.json({
      status,
      assigned_admin_name: assigned_admin_name || null,
      admin_online: online,
      messages: msgs.rows.map(rowToMessage),
    })
  } catch (err) {
    console.error("LIVE-CHAT POLL ERROR:", err.message)
    res.status(500).json({ error: "Server Error" })
  }
}

// POST /live-chat/leave  { conversation_id }
const leaveConversation = async (req, res) => {
  const { conversation_id } = req.body || {}
  if (!conversation_id || !CID_RE.test(conversation_id)) return badCid(res)

  const client = await db.connect()
  try {
    await client.query("BEGIN")
    const s = await client.query(
      `SELECT session_id, status FROM chat_sessions WHERE conversation_id = $1 FOR UPDATE`,
      [conversation_id]
    )
    if (!s.rows[0]) {
      await client.query("ROLLBACK")
      return res.status(404).json({ error: "unknown conversation" })
    }
    if (s.rows[0].status !== "closed") {
      await client.query(
        `UPDATE chat_sessions SET status = 'closed', ended_at = NOW() WHERE session_id = $1`,
        [s.rows[0].session_id]
      )
      await client.query(
        `INSERT INTO chat_messages (session_id, sender_type, body)
         VALUES ($1, 'system', 'ลูกค้าออกจากการสนทนา')`,
        [s.rows[0].session_id]
      )
    }
    await client.query("COMMIT")
    res.json({ ok: true })
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("LIVE-CHAT LEAVE ERROR:", err.message)
    res.status(500).json({ error: "Server Error" })
  } finally {
    client.release()
  }
}

// ───────────────────────── admin side ─────────────────────────

// GET /live-chat/admin/queue  — also refreshes this admin's presence
const getQueue = async (req, res) => {
  try {
    await touchPresence(req.user.id)

    const rows = await db.query(
      `SELECT s.session_id, s.conversation_id, s.guest_label, s.customer_lang,
              s.status, s.escalated_at, s.claimed_at, s.last_customer_seen_at,
              s.assigned_admin_id, u.username AS assigned_admin_name,
              (SELECT body FROM chat_messages m
                 WHERE m.session_id = s.session_id
                 ORDER BY m.message_id DESC LIMIT 1) AS last_message
       FROM chat_sessions s
       LEFT JOIN users u ON u.id = s.assigned_admin_id
       WHERE s.status IN ('waiting','live')
       ORDER BY s.escalated_at ASC`
    )

    const mine = req.user.id
    const shape = (r) => ({
      session_id: r.session_id,
      conversation_id: r.conversation_id,
      guest_label: r.guest_label || `ลูกค้า #${r.session_id}`,
      customer_lang: r.customer_lang,
      status: r.status,
      escalated_at: r.escalated_at,
      claimed_at: r.claimed_at,
      last_customer_seen_at: r.last_customer_seen_at,
      assigned_admin_id: r.assigned_admin_id,
      assigned_admin_name: r.assigned_admin_name || null,
      is_mine: r.assigned_admin_id === mine,
      last_message: r.last_message || null,
    })

    const waiting = rows.rows.filter((r) => r.status === "waiting").map(shape)
    const live = rows.rows
      .filter((r) => r.status === "live")
      .map(shape)
      .sort((a, b) => (b.is_mine ? 1 : 0) - (a.is_mine ? 1 : 0))

    res.json({
      waiting,
      live,
      counts: { waiting: waiting.length, live: live.length },
      now: new Date().toISOString(),
    })
  } catch (err) {
    console.error("LIVE-CHAT QUEUE ERROR:", err.message)
    res.status(500).json({ error: "Server Error" })
  }
}

// POST /live-chat/admin/claim  { conversation_id }
const claimSession = async (req, res) => {
  const { conversation_id } = req.body || {}
  if (!conversation_id || !CID_RE.test(conversation_id)) return badCid(res)

  const client = await db.connect()
  try {
    await client.query("BEGIN")
    // Race-safe: only a 'waiting' row (or one already mine) can be claimed.
    const upd = await client.query(
      `UPDATE chat_sessions
         SET status = 'live', assigned_admin_id = $1,
             claimed_at = COALESCE(claimed_at, NOW())
       WHERE conversation_id = $2
         AND (status = 'waiting' OR (status = 'live' AND assigned_admin_id = $1))
       RETURNING session_id`,
      [req.user.id, conversation_id]
    )

    if (upd.rowCount === 0) {
      await client.query("ROLLBACK")
      const cur = await db.query(
        `SELECT s.status, u.username AS owner_name
         FROM chat_sessions s LEFT JOIN users u ON u.id = s.assigned_admin_id
         WHERE s.conversation_id = $1`,
        [conversation_id]
      )
      return res.status(409).json({
        error: "already_claimed",
        owner_name: cur.rows[0] ? cur.rows[0].owner_name : null,
        status: cur.rows[0] ? cur.rows[0].status : null,
      })
    }

    const sessionId = upd.rows[0].session_id
    const name = await adminName(req.user.id)
    // System breadcrumb only on the first claim (not on a re-open of my own).
    await client.query(
      `INSERT INTO chat_messages (session_id, sender_type, body)
       SELECT $1::int, 'system', 'แอดมิน ' || $2::text || ' เข้าร่วมการสนทนา'
       WHERE NOT EXISTS (
         SELECT 1 FROM chat_messages
         WHERE session_id = $1::int AND sender_type = 'system'
           AND body LIKE 'แอดมิน %เข้าร่วมการสนทนา'
       )`,
      [sessionId, name]
    )
    await client.query("COMMIT")

    const full = await db.query(
      `SELECT s.session_id, s.conversation_id, s.guest_label, s.customer_lang,
              s.status, s.escalated_at, s.claimed_at, s.assigned_admin_id,
              u.username AS assigned_admin_name
       FROM chat_sessions s LEFT JOIN users u ON u.id = s.assigned_admin_id
       WHERE s.session_id = $1`,
      [sessionId]
    )
    res.json({ ok: true, session: full.rows[0] })
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("LIVE-CHAT CLAIM ERROR:", err.message)
    res.status(500).json({ error: "Server Error" })
  } finally {
    client.release()
  }
}

// GET /live-chat/admin/session/:conversationId?after_id=0
const getAdminSession = async (req, res) => {
  const conversation_id = req.params.conversationId
  if (!conversation_id || !CID_RE.test(conversation_id)) return badCid(res)
  const afterId = Number.parseInt(req.query.after_id, 10) || 0

  try {
    await touchPresence(req.user.id)
    const s = await db.query(
      `SELECT s.session_id, s.conversation_id, s.guest_label, s.customer_lang,
              s.status, s.escalated_at, s.claimed_at, s.ended_at,
              s.last_customer_seen_at, s.assigned_admin_id,
              u.username AS assigned_admin_name
       FROM chat_sessions s LEFT JOIN users u ON u.id = s.assigned_admin_id
       WHERE s.conversation_id = $1`,
      [conversation_id]
    )
    if (!s.rows[0]) return res.status(404).json({ error: "unknown conversation" })

    const msgs = await db.query(MESSAGE_SELECT, [s.rows[0].session_id, afterId])
    res.json({
      session: {
        ...s.rows[0],
        guest_label: s.rows[0].guest_label || `ลูกค้า #${s.rows[0].session_id}`,
      },
      messages: msgs.rows.map(rowToMessage),
    })
  } catch (err) {
    console.error("LIVE-CHAT ADMIN SESSION ERROR:", err.message)
    res.status(500).json({ error: "Server Error" })
  }
}

// POST /live-chat/admin/message  { conversation_id, body }
const postAdminMessage = async (req, res) => {
  const { conversation_id, body } = req.body || {}
  if (!conversation_id || !CID_RE.test(conversation_id)) return badCid(res)
  const text = typeof body === "string" ? body.trim() : ""
  if (!text) return res.status(400).json({ error: "empty message" })

  try {
    const s = await db.query(
      `SELECT session_id, status, assigned_admin_id
       FROM chat_sessions WHERE conversation_id = $1`,
      [conversation_id]
    )
    if (!s.rows[0]) return res.status(404).json({ error: "unknown conversation" })
    if (s.rows[0].status !== "live" || s.rows[0].assigned_admin_id !== req.user.id) {
      return res.status(409).json({ error: "not_your_live_chat" })
    }
    const ins = await db.query(
      `INSERT INTO chat_messages (session_id, sender_type, sender_admin_id, body)
       VALUES ($1, 'admin', $2, $3) RETURNING message_id`,
      [s.rows[0].session_id, req.user.id, text]
    )
    res.json({ ok: true, message_id: Number(ins.rows[0].message_id) })
  } catch (err) {
    console.error("LIVE-CHAT ADMIN MSG ERROR:", err.message)
    res.status(500).json({ error: "Server Error" })
  }
}

// POST /live-chat/admin/close  { conversation_id }
const closeSession = async (req, res) => {
  const { conversation_id } = req.body || {}
  if (!conversation_id || !CID_RE.test(conversation_id)) return badCid(res)

  const client = await db.connect()
  try {
    await client.query("BEGIN")
    const s = await client.query(
      `SELECT session_id, status FROM chat_sessions WHERE conversation_id = $1 FOR UPDATE`,
      [conversation_id]
    )
    if (!s.rows[0]) {
      await client.query("ROLLBACK")
      return res.status(404).json({ error: "unknown conversation" })
    }
    if (s.rows[0].status !== "closed") {
      await client.query(
        `UPDATE chat_sessions SET status = 'closed', ended_at = NOW() WHERE session_id = $1`,
        [s.rows[0].session_id]
      )
      await client.query(
        `INSERT INTO chat_messages (session_id, sender_type, body)
         VALUES ($1, 'system', 'แอดมินปิดการสนทนาแล้ว บอทจะดูแลต่อจากนี้')`,
        [s.rows[0].session_id]
      )
    }
    await client.query("COMMIT")
    res.json({ ok: true })
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("LIVE-CHAT CLOSE ERROR:", err.message)
    res.status(500).json({ error: "Server Error" })
  } finally {
    client.release()
  }
}

module.exports = {
  escalate,
  postCustomerMessage,
  pollConversation,
  leaveConversation,
  getQueue,
  claimSession,
  getAdminSession,
  postAdminMessage,
  closeSession,
}
