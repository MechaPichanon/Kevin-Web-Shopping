-- 009_expand_payment_status.sql
-- Widens orders.payment_status to include the slip-verification states
-- ('pending_verification', 'rejected') that the admin orders UI already
-- expects (frontend/app/admin/orders/page.tsx) but the schema never allowed.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_payment_status;
ALTER TABLE orders ADD CONSTRAINT chk_orders_payment_status
  CHECK (payment_status IN ('unpaid','pending_verification','paid','rejected','refunded'));
