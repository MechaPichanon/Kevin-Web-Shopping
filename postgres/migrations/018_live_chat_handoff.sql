-- 018_live_chat_handoff.sql
-- "Talk to a human" handoff: persist every chatbot conversation + its turns so an
-- admin/staff can join mid-thread and see the full history, plus a claim/close
-- workflow and a heartbeat-based "admin online" signal for the storefront widget.
-- Persisted tables are REQUIRED: the chatbot keeps conversation state in memory
-- only (single uvicorn process, no --workers) and loses everything on restart, so
-- an admin in a different process could never read the thread otherwise.
-- Idempotent + mirrored into postgres/init/01_schema.sql.
-- Deliberately NOT changed: users, orders, existing /chat response keys, CORS.
-- admin_presence uses a natural PK (user_id) on purpose — it is an upsert target,
-- one row per staff member, never referenced by a surrogate id.

-- chat_sessions — one row per chatbot conversation (created lazily on the first
-- turn). status drives everything: 'bot' (normal), 'waiting' (customer asked for
-- a human, in the queue), 'live' (an admin has claimed it), 'closed' (admin ended
-- it — the bot answers again from here, same conversation_id).
CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id            SERIAL       PRIMARY KEY,
  conversation_id       TEXT         NOT NULL UNIQUE,          -- FastAPI uuid4, client-controlled — TEXT not UUID on purpose
  user_id               INTEGER      DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
  guest_label           VARCHAR(50)  DEFAULT NULL,             -- e.g. "ลูกค้า #4821" or the username
  customer_lang         VARCHAR(5)   NOT NULL DEFAULT 'th',    -- TH/EN toggle the customer is using
  status                VARCHAR(20)  NOT NULL DEFAULT 'bot',
  assigned_admin_id     INTEGER      DEFAULT NULL REFERENCES users(id),
  escalated_at          TIMESTAMPTZ  DEFAULT NULL,
  claimed_at            TIMESTAMPTZ  DEFAULT NULL,
  ended_at              TIMESTAMPTZ  DEFAULT NULL,
  last_customer_seen_at TIMESTAMPTZ  DEFAULT NULL,             -- updated on every customer poll
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_chat_sessions_status
    CHECK (status IN ('bot','waiting','live','closed')),
  CONSTRAINT chk_chat_sessions_customer_lang
    CHECK (customer_lang IN ('th','en'))
);

CREATE INDEX IF NOT EXISTS chat_sessions_status_escalated_idx
  ON chat_sessions (status, escalated_at DESC);
CREATE INDEX IF NOT EXISTS chat_sessions_conversation_id_idx
  ON chat_sessions (conversation_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chat_sessions_updated_at'
  ) THEN
    CREATE TRIGGER trg_chat_sessions_updated_at
      BEFORE UPDATE ON chat_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- chat_messages — every turn of every conversation, bot turns included, from
-- message #1. message_id is also the poll cursor (after_id) so it must stay
-- monotonic per session — hence BIGSERIAL, not a timestamp.
CREATE TABLE IF NOT EXISTS chat_messages (
  message_id      BIGSERIAL    PRIMARY KEY,
  session_id      INTEGER      NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  sender_type     VARCHAR(20)  NOT NULL,
  sender_admin_id INTEGER      DEFAULT NULL REFERENCES users(id),
  body            TEXT         NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_chat_messages_sender_type
    CHECK (sender_type IN ('customer','bot','admin','system'))
);

CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx
  ON chat_messages (session_id, message_id);

-- admin_presence — heartbeat row per admin/staff. Upserted as a side effect of
-- the admin chat page's queue poll. "admin online" = any row here newer than 60s.
CREATE TABLE IF NOT EXISTS admin_presence (
  user_id      INTEGER      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
