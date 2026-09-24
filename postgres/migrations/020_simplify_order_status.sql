-- Simplify order status: merge 'delivered' into 'confirmed' (they meant the
-- same thing — 'delivered' was vestigial, never set anywhere except one seed
-- row) and remove 'refunded' everywhere (orders.status, orders.payment_status,
-- payments.status) since no endpoint in the codebase ever set it on any of
-- the three columns. Also adds orders.shipped_at, stamped once the first
-- time an order's status becomes 'shipped', so the new customer
-- "I received it" flow and the auto-confirm sweep have a stable timestamp
-- that isn't clobbered by unrelated later updates (e.g. editing tracking info).

-- 1. Defensive backfill — expected to touch 0 rows in practice (confirmed via
--    full-codebase search) except the one hardcoded 'delivered' demo row in
--    seed_database.sql, but must run before the CHECK constraints below tighten.
UPDATE orders SET status = 'confirmed' WHERE status = 'delivered';
UPDATE orders SET status = 'cancelled' WHERE status = 'refunded';
UPDATE orders SET payment_status = 'rejected' WHERE payment_status = 'refunded';
UPDATE payments SET status = 'failed' WHERE status = 'refunded';

-- 2. orders.shipped_at — nullable, only ever set once per order.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

-- Best-effort backfill for existing shipped/confirmed orders: there's no
-- better historical signal than updated_at, so this is an approximation for
-- orders that were already shipped before this migration ran.
UPDATE orders
SET shipped_at = updated_at
WHERE status IN ('shipped', 'confirmed') AND shipped_at IS NULL;

-- 3. Tighten the CHECK constraints.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;
ALTER TABLE orders ADD CONSTRAINT chk_orders_status
  CHECK (status IN ('pending','confirmed','shipped','cancelled'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_payment_status;
ALTER TABLE orders ADD CONSTRAINT chk_orders_payment_status
  CHECK (payment_status IN ('unpaid','pending_verification','paid','rejected'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_status;
ALTER TABLE payments ADD CONSTRAINT chk_payments_status
  CHECK (status IN ('pending','success','failed'));
