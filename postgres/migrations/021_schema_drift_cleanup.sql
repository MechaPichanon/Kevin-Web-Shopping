-- Fixes schema drift found between postgres/init/01_schema.sql and what
-- migrations/app code actually produced on a long-running dev DB:
--
-- 1. wishlist.product_id was created as unbounded VARCHAR by 015_wishlish.sql,
--    but every other FK to products.product_id (variants, product_images,
--    cart_items, order_items, product_chunks, ...) is VARCHAR(20), matching
--    products.product_id's own definition. Narrow it to match — existing
--    values are all well under 20 chars (checked before writing this).
--
-- 2. users_role_check (added by 004_user_role.sql, unnamed-turned-auto-named
--    CHECK) duplicates chk_users_role (added later by 005_new_ecommerce_schema.sql
--    when the users table was rebuilt) — same 3 allowed values, just never
--    dropped. Harmless but redundant; drop the leftover.
--
-- (users.address drift — present on live DBs via server.js's runtime
-- ensureUserProfileColumns() self-heal, but missing from 01_schema.sql — is
-- fixed directly in 01_schema.sql, not here, since no live DB needs an
-- ALTER for it.)

ALTER TABLE wishlist ALTER COLUMN product_id TYPE VARCHAR(20);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
