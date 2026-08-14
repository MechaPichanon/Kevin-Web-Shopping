-- 011_user_addresses_junction.sql
-- Makes users<->addresses genuinely many-to-many: a saved address can be
-- shared by more than one account (e.g. family members at the same house).
-- addresses.user_id is kept as-is (now just "original creator", informational)
-- so nothing that already queries it breaks. Real access/sharing is now
-- expressed through this junction table.

CREATE TABLE IF NOT EXISTS user_addresses (
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_id INTEGER     NOT NULL REFERENCES addresses(address_id) ON DELETE CASCADE,
  is_default BOOLEAN     NOT NULL DEFAULT FALSE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, address_id)
);

CREATE INDEX IF NOT EXISTS user_addresses_address_id_idx ON user_addresses (address_id);

-- Backfill: every existing address's creator gets a matching junction row
-- so no existing relationship is lost.
INSERT INTO user_addresses (user_id, address_id, is_default)
SELECT user_id, address_id, TRUE FROM addresses
ON CONFLICT (user_id, address_id) DO NOTHING;
