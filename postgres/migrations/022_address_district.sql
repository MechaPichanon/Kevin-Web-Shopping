-- 022_address_district.sql
-- Multi-address book (profile "สมุดที่อยู่" + checkout address chips).
--
-- 1. addresses gains district (เขต/อำเภอ) and sub_district (แขวง/ตำบล) —
--    required by the new address form. Existing rows default to '' and are
--    completed the next time the user edits them.
-- 2. Every user that has addresses but no default gets their oldest one
--    promoted, then a partial unique index enforces "at most one default
--    per user" at the DB level (previously only by application code).

ALTER TABLE addresses ADD COLUMN IF NOT EXISTS district     VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS sub_district VARCHAR(80) NOT NULL DEFAULT '';

UPDATE user_addresses ua
SET is_default = TRUE
FROM (
  SELECT DISTINCT ON (user_id) user_id, address_id
  FROM user_addresses
  WHERE user_id NOT IN (SELECT user_id FROM user_addresses WHERE is_default)
  ORDER BY user_id, added_at, address_id
) first_addr
WHERE ua.user_id = first_addr.user_id
  AND ua.address_id = first_addr.address_id;

CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_one_default_idx
  ON user_addresses (user_id) WHERE is_default;
