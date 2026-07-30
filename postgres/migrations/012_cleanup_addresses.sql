-- Drop unused addresses columns.
-- city: never real input — every write path mirrored it to equal `province`.
-- is_default: predates the user_addresses junction table (011); the real
--   default flag now lives on user_addresses.is_default.
-- label: no multi-address UI exists or is planned.
-- Safe to run multiple times.

ALTER TABLE addresses DROP COLUMN IF EXISTS city;
ALTER TABLE addresses DROP COLUMN IF EXISTS is_default;
ALTER TABLE addresses DROP COLUMN IF EXISTS label;
