-- users.address predates the addresses/user_addresses model (003_user_profile.sql).
-- Nothing reads it; PUT /profile writes a flattened duplicate of what the
-- addresses table already stores correctly. Safe to drop.
-- Safe to run multiple times.

ALTER TABLE users DROP COLUMN IF EXISTS address;
