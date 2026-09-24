-- One-off data fix for CRITICAL-2 (hardcoded http://localhost:5000 in stored
-- upload URLs). Run once against any existing database that has rows written
-- before this fix (dev DB, or a VM seeded before the fix shipped).
--
-- Safe to re-run: the WHERE clause only matches rows still holding the old
-- absolute-URL form, so a second run is a no-op.
--
-- Usage: psql "$DATABASE_URL" -f backend/scripts/fix_upload_urls_relative.sql

UPDATE product_images
SET image_url = regexp_replace(image_url, '^https?://[^/]+', '')
WHERE image_url ~ '^https?://[^/]+/uploads/';

UPDATE orders
SET payment_slip_url = regexp_replace(payment_slip_url, '^https?://[^/]+', '')
WHERE payment_slip_url ~ '^https?://[^/]+/uploads/';

UPDATE payment_slips
SET slip_url = regexp_replace(slip_url, '^https?://[^/]+', '')
WHERE slip_url ~ '^https?://[^/]+/uploads/';
