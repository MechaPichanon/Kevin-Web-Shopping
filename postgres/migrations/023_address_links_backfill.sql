-- 023_address_links_backfill.sql
-- Step 1 of making user_addresses the ONLY users<->addresses link (024_ drops
-- the legacy columns). Safe to re-run, and a no-op once 024_ has been applied.
--
-- 1. Every address creator (addresses.user_id) gets a user_addresses link if
--    it's missing, so no ownership is lost when that column is dropped.
-- 2. addresses.user_id becomes nullable: the app no longer writes it, so new
--    addresses must be insertable before 024_ removes the column.
-- 3. Any user left with links but no default gets their oldest one promoted
--    (same rule as 022_). The one-default-per-user partial unique index
--    user_addresses_one_default_idx already exists since 022_.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'addresses' AND column_name = 'user_id') THEN
    INSERT INTO user_addresses (user_id, address_id, is_default)
    SELECT a.user_id, a.address_id, FALSE
    FROM addresses a
    WHERE a.user_id IS NOT NULL
    ON CONFLICT (user_id, address_id) DO NOTHING;

    ALTER TABLE addresses ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END
$$;

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
