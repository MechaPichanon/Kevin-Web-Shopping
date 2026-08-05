-- Adds a place to store the customer-uploaded transfer slip image URL for an
-- order, so the admin orders UI's confirm/reject buttons (already built, but
-- currently unreachable since nothing ever sets payment_status =
-- 'pending_verification') have something real to review.
-- Safe to run multiple times.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_slip_url TEXT DEFAULT NULL;
