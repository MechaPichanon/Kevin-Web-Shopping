-- 024_drop_legacy_address_columns.sql
-- Step 2: drop the two legacy address-ownership columns. Run AFTER 023_ and
-- after the backend no longer reads/writes them.
--
-- addresses.user_id — implied one owner per address (1:N), contradicting the
--   many-to-many user_addresses table. Its FK and index go with it.
-- users.address     — flat-text mirror of the default address. 013_ dropped it
--   once, but server.js's ensureUserProfileColumns() re-added it at boot; that
--   self-heal no longer includes it.
--
-- Guard: refuse to drop users.address if any non-empty value is NOT exactly the
-- user's current default address, so no typed-in address is silently lost.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'users' AND column_name = 'address') THEN
    IF EXISTS (
      SELECT 1 FROM users u
      WHERE COALESCE(u.address, '') <> ''
        AND u.address IS DISTINCT FROM (
          SELECT concat_ws(' ', a.address_line1, NULLIF(a.address_line2, ''),
                           NULLIF(a.sub_district, ''), NULLIF(a.district, ''),
                           a.province, a.postal_code)
          FROM user_addresses ua
          JOIN addresses a ON a.address_id = ua.address_id
          WHERE ua.user_id = u.id AND ua.is_default)
    ) THEN
      RAISE EXCEPTION 'users.address holds data not found in addresses — migrate it before dropping';
    END IF;
  END IF;
END
$$;

DROP INDEX IF EXISTS addresses_user_id_idx;
ALTER TABLE addresses DROP COLUMN IF EXISTS user_id;
ALTER TABLE users     DROP COLUMN IF EXISTS address;
