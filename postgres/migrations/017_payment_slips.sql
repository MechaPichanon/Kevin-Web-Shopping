-- 017_payment_slips.sql
-- Payment-slip rejection & re-submission loop.
-- One row per customer slip upload; history is retained, never deleted.
-- orders.payment_slip_url stays as a mirror of the LATEST slip URL so the
-- existing customer/admin order views keep working unchanged.
-- Idempotent + mirrored into postgres/init/01_schema.sql.
-- No ALTER on orders' CHECK constraints — 'rejected' is already allowed (009).

CREATE TABLE IF NOT EXISTS payment_slips (
  slip_id       SERIAL       PRIMARY KEY,
  order_id      INTEGER      NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  slip_url      TEXT         NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending_verification',
  reject_reason TEXT         DEFAULT NULL,
  reviewed_by   INTEGER      DEFAULT NULL REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ  DEFAULT NULL,
  uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_payment_slips_status
    CHECK (status IN ('pending_verification','approved','rejected'))
);

CREATE INDEX IF NOT EXISTS payment_slips_order_id_idx       ON payment_slips (order_id);
CREATE INDEX IF NOT EXISTS payment_slips_order_uploaded_idx ON payment_slips (order_id, uploaded_at DESC);

-- Backfill one row per existing order that already has a slip URL.
-- NOT EXISTS makes a re-run safe.
INSERT INTO payment_slips (order_id, slip_url, status, uploaded_at)
SELECT o.order_id, o.payment_slip_url,
       CASE
         WHEN o.payment_status = 'paid'     THEN 'approved'
         WHEN o.payment_status = 'rejected' THEN 'rejected'
         ELSE 'pending_verification'
       END,
       COALESCE(o.updated_at, o.ordered_at)
FROM orders o
WHERE o.payment_slip_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payment_slips ps WHERE ps.order_id = o.order_id);
